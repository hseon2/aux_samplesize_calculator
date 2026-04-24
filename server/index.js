import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOptionsAndMapping, getSegmentIds } from './segmentLoader.js';
import { fetchV1Visits } from './aaReporting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env 로드: server/.env 우선, 없으면 프로젝트루트/.env (override로 덮어씀)
try {
  const dotenv = await import('dotenv');
  const paths = [
    path.resolve(__dirname, '.env'),
    path.resolve(process.cwd(), 'server', '.env'),
    path.resolve(__dirname, '..', '.env'),
  ];
  for (const p of paths) {
    const result = dotenv.config({ path: p, override: true });
    if (!result.error) break;
  }
} catch (_) {}

const app = express();
app.use(express.json());

// Render는 PORT를 주입. 로컬은 SERVER_PORT 또는 5000
const PORT = Number(process.env.PORT || process.env.SERVER_PORT) || 5000;

// Gemini 모델 목록 캐시 (v1beta/models). 키는 서버에만 존재.
let geminiModelsCache = {
  fetchedAt: 0,
  models: /** @type {string[]} */ ([]),
};
const GEMINI_MODELS_TTL_MS = 60 * 60 * 1000; // 1 hour

// .env 로드 여부 확인 (값 노출 없이)
if (!process.env.AA_GLOBAL_COMPANY_ID || !process.env.AA_RSID) {
  console.warn('[server] .env 미로드 또는 AA_GLOBAL_COMPANY_ID/AA_RSID 없음. server/.env 경로와 값을 확인하세요.');
}

app.get('/api/options', (req, res) => {
  const { options, error } = getOptionsAndMapping();
  if (error) {
    return res.status(400).json({ error });
  }
  return res.json(options);
});

app.post('/api/v1-data', async (req, res) => {
  try {
    const body = req.body || {};
    const 사업부 = String(body.사업부 ?? '').trim();
    const 페이지타입 = String(body['페이지 타입'] ?? '').trim();
    const 상세타입 = String(body['상세 타입'] ?? '').trim();
    let start_date = String(body.start_date ?? '2026-01-01').trim();
    let end_date = String(body.end_date ?? '2026-01-31').trim();
    if (start_date.length === 10 && start_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      start_date += 'T00:00:00.000';
    }
    if (end_date.length === 10 && end_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      end_date += 'T23:59:59.999';
    }
    const ids = getSegmentIds(사업부, 페이지타입, 상세타입);
    if (!ids?.visit) {
      return res.status(400).json({
        error: "선택한 조합에 해당하는 Segment ID가 없습니다. server/Segment define.csv를 확인하세요.",
      });
    }
    if (!ids.cart || !ids.order) {
      return res.status(400).json({
        error: "Segment id(Cart), Segment id(Order) 값이 없습니다. Segment define.csv를 확인하세요.",
      });
    }
    const [rowsVisit, rowsCart, rowsOrder] = await Promise.all([
      fetchV1Visits({ start_date, end_date, page_segment_id: ids.visit }),
      fetchV1Visits({ start_date, end_date, page_segment_id: ids.cart }),
      fetchV1Visits({ start_date, end_date, page_segment_id: ids.order }),
    ]);
    const check = (r, label) => {
      if (r && typeof r === 'object' && r.error) return r.error;
      if (!Array.isArray(r)) return `${label} API 호출 실패`;
      return null;
    };
    const errVisit = check(rowsVisit, 'Visit');
    if (errVisit) return res.status(502).json({ error: errVisit });
    const errCart = check(rowsCart, 'Cart Added Visit');
    if (errCart) return res.status(502).json({ error: errCart });
    const errOrder = check(rowsOrder, 'Ordered Visit');
    if (errOrder) return res.status(502).json({ error: errOrder });
    const byV1 = {};
    for (const r of rowsVisit) {
      byV1[r.v1_value] = { v1_value: r.v1_value, visit: r.visits, cart_added_visit: 0, ordered_visit: 0 };
    }
    for (const r of rowsCart) {
      if (!byV1[r.v1_value]) byV1[r.v1_value] = { v1_value: r.v1_value, visit: 0, cart_added_visit: 0, ordered_visit: 0 };
      byV1[r.v1_value].cart_added_visit = r.visits;
    }
    for (const r of rowsOrder) {
      if (!byV1[r.v1_value]) byV1[r.v1_value] = { v1_value: r.v1_value, visit: 0, cart_added_visit: 0, ordered_visit: 0 };
      byV1[r.v1_value].ordered_visit = r.visits;
    }
    const rows = Object.values(byV1).sort((a, b) => (b.visit - a.visit) || String(a.v1_value).localeCompare(b.v1_value));
    return res.json({
      rows,
      segment_ids: { visit: ids.visit, cart: ids.cart, order: ids.order },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || '서버 오류' });
  }
});

app.post('/api/scenario', async (req, res) => {
  try {
    const objective = String(req.body?.objective ?? '').trim();
    const hypothesis = String(req.body?.hypothesis ?? '').trim();

    if (!objective || !hypothesis) {
      return res.status(400).json({ error: 'objective와 hypothesis를 모두 입력해주세요.' });
    }

    const apiKey = String(process.env.GEMINI_API_KEY ?? '').trim();
    if (!apiKey) {
      return res.status(500).json({ error: '서버에 GEMINI_API_KEY가 설정되어 있지 않습니다. server/.env를 확인해주세요.' });
    }

    const requestedModel = String(req.body?.model ?? '').trim();
    const envModel = String(process.env.GEMINI_MODEL ?? 'gemini-2.5-flash').trim() || 'gemini-2.5-flash';
    const primaryModel = requestedModel || envModel;

    const listModels = async () => {
      const now = Date.now();
      if (geminiModelsCache.models.length > 0 && now - geminiModelsCache.fetchedAt < GEMINI_MODELS_TTL_MS) {
        return geminiModelsCache.models;
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return geminiModelsCache.models;

      const models = Array.isArray(data?.models) ? data.models : [];
      const names = models
        .map((m) => String(m?.name ?? '').trim())
        .filter(Boolean);

      // generateContent 지원 모델만 우선 사용
      const supported = models
        .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => String(m?.name ?? '').trim())
        .filter(Boolean);

      const finalList = (supported.length ? supported : names);
      geminiModelsCache = { fetchedAt: now, models: finalList };
      return finalList;
    };

    const availableModels = await listModels();
    const normalizeModelName = (name) => {
      const s = String(name ?? '').trim();
      if (!s) return '';
      // API는 name이 "models/xxx" 형태일 수 있어, 호출시에는 "xxx"로도 받지만 혼동 방지
      return s.startsWith('models/') ? s.slice('models/'.length) : s;
    };

    const primary = normalizeModelName(primaryModel);
    const flashCandidates = availableModels
      .map(normalizeModelName)
      .filter(Boolean)
      .filter((m) => {
        const s = m.toLowerCase();
        if (!s.includes('flash')) return false;
        // TTS/Audio 전용 모델은 텍스트 generateContent에 부적합
        if (s.includes('tts') || s.includes('audio')) return false;
        return true;
      });

    // 후보: primary + flash 계열 일부(최대 6개)
    const modelCandidates = Array.from(new Set([primary, ...flashCandidates].filter(Boolean))).slice(0, 6);

    const prompt = [
      'Rewrite the following for an A/B test brief in professional English.',
      'You may add helpful detail for clarity (context, mechanism, expected impact), while preserving the original intent.',
      'Make each line one sentence, detailed but not overly long (about 25–40 words).',
      'Output format (exactly 2 lines, no bullets, no extra text):',
      'Objective: To <one sentence starting with "To ">',
      'Hypothesis: <one sentence>',
      '',
      `Objective: ${objective}`,
      `Hypothesis: ${hypothesis}`,
    ].join('\n');

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const callGemini = async (modelName, attempt) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            // JSON 2문장이라도 간혹 길어질 수 있어 여유를 둔다.
            maxOutputTokens: 1024,
          },
        }),
      });
      const data = await resp.json().catch(() => ({}));

      // 과부하/일시 오류는 리트라이 여지
      if (!resp.ok) {
        const msg = data?.error?.message || data?.message || 'Gemini API 호출 실패';
        const status = Number(resp.status) || 0;
        const retryable = status === 429 || status === 500 || status === 502 || status === 503;
        return { ok: false, status, msg: typeof msg === 'string' ? msg : JSON.stringify(msg), data, retryable, modelName, attempt };
      }
      return { ok: true, status: resp.status, data, modelName, attempt };
    };

    let finalOk = null;
    let lastErr = null;
    for (const modelName of modelCandidates) {
      // 모델별 2회까지(짧은 백오프) 시도
      for (let attempt = 1; attempt <= 2; attempt++) {
        const result = await callGemini(modelName, attempt);
        if (result.ok) {
          finalOk = result;
          break;
        }
        lastErr = result;
        if (result.retryable && attempt < 2) await sleep(350 * attempt);
        else break;
      }
      if (finalOk) break;
    }

    if (!finalOk) {
      return res.status(502).json({
        error: lastErr?.msg || 'Gemini API 호출 실패',
        model_tried: modelCandidates,
      });
    }

    const data = finalOk.data;
    const usedModel = finalOk.modelName;

    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join('') ||
      '';

    const normalized = String(text ?? '').replace(/\r\n/g, '\n').trim();
    const objMatch = normalized.match(/^\s*Objective:\s*(.+)\s*$/im);
    const hypMatch = normalized.match(/^\s*Hypothesis:\s*(.+)\s*$/im);
    const normalizeObjectiveTo = (s) => {
      let v = String(s ?? '').trim();
      if (!v) return v;

      // Already "To ..."
      if (/^to\s+/i.test(v)) {
        v = `To ${v.replace(/^to\s+/i, '').trim()}`;
        return v;
      }

      // Common patterns -> strip to infinitive clause
      v = v.replace(/^the\s+primary\s+objective\s+is\s+to\s+/i, '');
      v = v.replace(/^the\s+objective\s+is\s+to\s+/i, '');
      v = v.replace(/^this\s+test\s+(aims|seeks)\s+to\s+/i, '');
      v = v.replace(/^we\s+aim\s+to\s+/i, '');
      v = v.replace(/^aim\s+to\s+/i, '');
      v = v.replace(/^to\s+/i, '');

      return `To ${v.trim()}`;
    };

    const objective_en = normalizeObjectiveTo(String(objMatch?.[1] ?? ''));
    const hypothesis_en = String(hypMatch?.[1] ?? '').trim();

    if (!objective_en || !hypothesis_en) {
      return res.status(502).json({
        error: 'Gemini 응답을 파싱하지 못했습니다. 다시 시도해주세요.',
        raw: text,
        debug: {
          hasCandidates: Boolean(data?.candidates?.length),
          finishReason: data?.candidates?.[0]?.finishReason ?? null,
        },
      });
    }

    return res.json({ objective_en, hypothesis_en, model: usedModel });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || '서버 오류' });
  }
});

// dist 폴더가 있으면 Vite 빌드 결과 서빙 (Render 등 배포 환경)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`API 서버 실행: http://localhost:${PORT}`);
});
