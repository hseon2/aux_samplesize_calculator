import express from 'express';
import { getOptionsAndMapping, getSegmentIds } from './segmentLoader.js';
import { fetchV1Visits } from './aaReporting.js';
import path from 'path';
import { fileURLToPath } from 'url';

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

const PORT = Number(process.env.SERVER_PORT) || 5000;

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

app.listen(PORT, () => {
  console.log(`API 서버 실행: http://localhost:${PORT}`);
});
