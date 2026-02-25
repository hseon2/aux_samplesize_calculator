import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// v2 우선: server 폴더 → AA API 확인 폴더 순으로 시도
const SEGMENT_CSV_PATHS = [
  path.join(__dirname, 'Segment define_v2.csv'),
  path.join(__dirname, '..', '..', 'AA API 확인', 'Segment define_v2.csv'),
];

const COL_사업부 = '사업부';
const COL_페이지타입 = '페이지 타입';
const COL_상세타입 = '상세 타입';
// CSV 헤더: Division=사업부, Page type=페이지 타입, Additional option=상세 타입. Segment id(Visit/Cart/Order) 3개 사용.
const COL_사업부_ALIASES = ['사업부', 'division'];
const COL_페이지타입_ALIASES = ['페이지 타입', '페이지타입', 'page type', 'pagetype'];
const COL_상세타입_ALIASES = ['상세 타입', '상세타입', 'additional option', 'additionaloption'];
const SEGMENT_ID_VISIT_KEY = 'Segment id(Visit)';
const SEGMENT_ID_CART_KEY = 'Segment id(Cart)';
const SEGMENT_ID_ORDER_KEY = 'Segment id(Order)';

function normalizeHeader(cell) {
  if (cell == null) return '';
  let s = String(cell).trim();
  s = s.replace(/^\ufeff/, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ''); // 제로너비·NBSP 제거
  return s;
}

function loadCsvAt(csvPath) {
  if (!fs.existsSync(csvPath)) return null;
  const encodings = ['utf8', 'utf-8', 'utf16le', 'utf-16le'];
  for (const enc of encodings) {
    try {
      let raw = fs.readFileSync(csvPath, enc);
      if (raw[0] === '\ufeff') raw = raw.slice(1);
      const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
      if (lines.length === 0) return { rows: null, error: 'CSV에 데이터가 없습니다.' };
      const rows = lines.map((line) => {
        const parts = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') inQuotes = !inQuotes;
          else if ((c === ',' || c === ';') && !inQuotes || c === '\t') {
            parts.push(current.trim());
            current = '';
          } else current += c;
        }
        parts.push(current.trim());
        return parts;
      });
      // 첫 행이 한 셀만 있으면(구분자 차이) 세미콜론/쉼표로 다시 나눔
      if (rows.length > 0 && rows[0].length === 1 && (rows[0][0].includes(';') || rows[0][0].includes(','))) {
        const sep = rows[0][0].includes(';') ? ';' : ',';
        rows[0] = rows[0][0].split(sep).map((s) => s.trim());
        for (let r = 1; r < rows.length; r++) {
          if (rows[r].length === 1 && (rows[r][0].includes(';') || rows[r][0].includes(','))) {
            const s = rows[r][0].includes(';') ? ';' : ',';
            rows[r] = rows[r][0].split(s).map((x) => x.trim());
          }
        }
      }
      return { rows, error: null };
    } catch (e) {
      continue;
    }
  }
  return null;
}

function loadCsv() {
  for (const csvPath of SEGMENT_CSV_PATHS) {
    const out = loadCsvAt(csvPath);
    if (out) return out;
  }
  return { rows: null, error: 'Segment define_v2.csv를 server 폴더 또는 AA API 확인 폴더에 넣어주세요.' };
}

// 헤더 셀을 공백 제거한 값으로도 비교 (페이지타입, 상세타입 등)
function headerKey(s) {
  return (normalizeHeader(s) || '').replace(/\s+/g, '');
}
// "Segment id" 또는 "Segment i"(잘린 표시) 열만 인식. "segment명"은 제외.
function isSegmentIdColumn(norm) {
  if (!norm || typeof norm !== 'string') return false;
  const lower = norm.toLowerCase().replace(/\s+/g, '');
  if (lower.includes('명') || lower === 'segment') return false; // segment명 제외
  return lower === 'segmentid' || lower === 'segmenti' || (lower.startsWith('segment') && (lower.includes('id') || lower.endsWith('i')));
}
function getHeaderIndex(headerRow) {
  const indices = {};
  const normalized = headerRow.map((c) => normalizeHeader(c).toLowerCase());
  const key사업부List = COL_사업부_ALIASES.map((a) => a.replace(/\s+/g, '').toLowerCase());
  const key페이지List = COL_페이지타입_ALIASES.map((a) => a.replace(/\s+/g, '').toLowerCase());
  const key상세List = COL_상세타입_ALIASES.map((a) => a.replace(/\s+/g, '').toLowerCase());
  const segmentIdColumnIndices = []; // "Segment id" 열만 있는 경우 순서대로 Visit, Cart, Order

  headerRow.forEach((cell, i) => {
    const s = normalizeHeader(cell);
    const k = headerKey(cell);
    const lowerS = s.toLowerCase();
    const lowerK = k.toLowerCase();
    if (key사업부List.some((key) => lowerS === key || lowerK === key)) {
      indices['사업부'] = i;
    } else if (key페이지List.some((key) => lowerS === key || lowerK === key)) {
      indices['페이지 타입'] = i;
    } else if (key상세List.some((key) => lowerS === key || lowerK === key)) {
      indices['상세 타입'] = i;
    }
    else if (normalized[i]?.includes('segment id(visit)')) indices[SEGMENT_ID_VISIT_KEY] = i;
    else if (normalized[i]?.includes('segment id(cart)')) indices[SEGMENT_ID_CART_KEY] = i;
    else if (normalized[i]?.includes('segment id(order)')) indices[SEGMENT_ID_ORDER_KEY] = i;
    else if (isSegmentIdColumn(normalizeHeader(cell))) segmentIdColumnIndices.push(i);
  });

  // "(Visit)" 등이 없고 "Segment id" 열이 3개면 순서대로 Visit, Cart, Order로 매핑
  if (indices[SEGMENT_ID_VISIT_KEY] == null && segmentIdColumnIndices.length >= 3) {
    indices[SEGMENT_ID_VISIT_KEY] = segmentIdColumnIndices[0];
    indices[SEGMENT_ID_CART_KEY] = segmentIdColumnIndices[1];
    indices[SEGMENT_ID_ORDER_KEY] = segmentIdColumnIndices[2];
  }
  return indices;
}

// 첫 행이 CSV 헤더가 아니라 이진/다른 형식인지 간단 검사
function looksLikeBinaryOrWrongFormat(headerRow) {
  if (!headerRow?.length) return true;
  const first = String(headerRow[0] ?? '');
  if (/\x00|NASCA|DRM FILE|^\s*</.test(first)) return true;
  const hasControlChars = /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(first);
  const noCommaOrSemicolon = headerRow.length === 1 && !first.includes(',') && !first.includes(';');
  return hasControlChars || (noCommaOrSemicolon && first.length > 200);
}

export function getOptionsAndMapping() {
  const { rows, error } = loadCsv();
  if (error || !rows) return { options: null, mapping: null, error: error || 'CSV 로드 실패' };
  const header = rows[0].map(normalizeHeader);
  const idx = getHeaderIndex(rows[0]);
  if (idx['사업부'] == null || idx['페이지 타입'] == null || idx['상세 타입'] == null) {
    if (looksLikeBinaryOrWrongFormat(rows[0])) {
      return {
        options: null,
        mapping: null,
        error: "Segment define_v2.csv가 CSV 텍스트가 아닌 것 같습니다. Excel에서 'CSV UTF-8(쉼표로 분리)'로 저장했는지 확인하고, server 폴더의 파일을 교체한 뒤 다시 배포해 주세요.",
      };
    }
    const hint = rows[0]?.length ? ` 읽은 헤더: [${rows[0].map((c) => JSON.stringify(String(c).trim().slice(0, 80))).join(', ')}]` : '';
    return { options: null, mapping: null, error: "헤더에 '사업부', '페이지 타입', '상세 타입' 컬럼이 필요합니다." + hint };
  }
  const hasThree =
    idx[SEGMENT_ID_VISIT_KEY] != null &&
    idx[SEGMENT_ID_CART_KEY] != null &&
    idx[SEGMENT_ID_ORDER_KEY] != null;
  if (!hasThree) {
    return { options: null, mapping: null, error: "헤더에 'Segment id(Visit)', 'Segment id(Cart)', 'Segment id(Order)' 컬럼이 필요합니다." };
  }
  const options = { 사업부: new Set(), '페이지 타입': new Set(), '상세 타입': new Set() };
  const mapping = {};
  const combinations = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const cell = (i) => (row[i] != null ? normalizeHeader(row[i]) : '');
    const bu = cell(idx['사업부']);
    const pt = cell(idx['페이지 타입']);
    const st = cell(idx['상세 타입']);
    const sidVisit = cell(idx[SEGMENT_ID_VISIT_KEY]);
    const sidCart = cell(idx[SEGMENT_ID_CART_KEY]);
    const sidOrder = cell(idx[SEGMENT_ID_ORDER_KEY]);
    if (!sidVisit && !sidCart && !sidOrder) continue;
    const buTrim = bu.trim();
    const ptTrim = pt.trim();
    const stTrim = st.trim();
    mapping[[buTrim, ptTrim, stTrim].join('\t')] = { visit: sidVisit || null, cart: sidCart || null, order: sidOrder || null };
    options.사업부.add(buTrim);
    options['페이지 타입'].add(ptTrim);
    options['상세 타입'].add(stTrim);
    combinations.push({ 사업부: buTrim, '페이지 타입': ptTrim, '상세 타입': stTrim });
  }
  return {
    options: {
      사업부: [...options.사업부].sort(),
      '페이지 타입': [...options['페이지 타입']].sort(),
      '상세 타입': [...options['상세 타입']].sort(),
      combinations,
    },
    mapping,
    error: null,
  };
}

export function getSegmentIds(사업부, 페이지타입, 상세타입) {
  const { mapping, error } = getOptionsAndMapping();
  if (error || !mapping) return null;
  const key = [사업부?.trim(), 페이지타입?.trim(), 상세타입?.trim()].join('\t');
  return mapping[key] || null;
}
