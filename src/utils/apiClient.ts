import { RawDataRow } from './parser';

/** 이 앱 내부 API (Vite 프록시로 /api → 백엔드). 별도 서버 불필요 */
const getBaseUrl = (): string => {
  return '';
};

export interface ApiOptionRow {
  사업부: string;
  '페이지 타입': string;
  '상세 타입': string;
}

export interface ApiOptions {
  사업부: string[];
  '페이지 타입': string[];
  '상세 타입': string[];
  combinations?: ApiOptionRow[];
}

export interface V1DataRow {
  v1_value: string;
  visit: number;
  cart_added_visit: number;
  ordered_visit: number;
}

export interface FetchV1DataParams {
  사업부: string;
  '페이지 타입': string;
  '상세 타입': string;
  start_date: string;
  end_date: string;
  v1_limit?: number;
}

export interface ScenarioGenerateRequest {
  objective: string;
  hypothesis: string;
}

export interface ScenarioGenerateResponse {
  objective_en: string;
  hypothesis_en: string;
  model?: string;
}

/**
 * AA API 옵션 목록 조회 (GET /api/options)
 */
export async function fetchOptions(baseUrl?: string): Promise<ApiOptions> {
  const url = `${baseUrl ?? getBaseUrl()}/api/options`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `옵션 조회 실패 (${res.status})`);
  }
  return res.json();
}

/**
 * AA API V1 데이터 조회 (POST /api/v1-data)
 * 응답 rows를 계산기에서 쓰는 RawDataRow[] 형태로 변환
 */
export async function fetchV1Data(
  params: FetchV1DataParams,
  baseUrl?: string
): Promise<RawDataRow[]> {
  const url = `${baseUrl ?? getBaseUrl()}/api/v1-data`;
  const body = {
    사업부: params.사업부,
    '페이지 타입': params['페이지 타입'],
    '상세 타입': params['상세 타입'],
    start_date: params.start_date,
    end_date: params.end_date,
    v1_limit: params.v1_limit ?? 20,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `데이터 조회 실패 (${res.status})`);
  }
  const rows: V1DataRow[] = (data as { rows?: V1DataRow[] }).rows ?? [];
  return apiRowsToRawData(rows);
}

export async function generateScenario(
  params: ScenarioGenerateRequest,
  baseUrl?: string
): Promise<ScenarioGenerateResponse> {
  const url = `${baseUrl ?? getBaseUrl()}/api/scenario`;
  const body = {
    objective: String(params.objective ?? '').trim(),
    hypothesis: String(params.hypothesis ?? '').trim(),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `시나리오 생성 실패 (${res.status})`);
  }
  return data as ScenarioGenerateResponse;
}

/** API 응답 rows → RawDataRow[] (파일 업로드와 동일한 구조) */
export function apiRowsToRawData(rows: V1DataRow[]): RawDataRow[] {
  const raw: RawDataRow[] = [];
  const segments = [
    { key: 'visit' as const, label: 'Visits' },
    { key: 'cart_added_visit' as const, label: 'Cart Added Visit' },
    { key: 'ordered_visit' as const, label: 'Ordered Visit' },
  ];
  for (const row of rows) {
    const siteCode = String(row.v1_value ?? '').trim();
    if (!siteCode) continue;
    for (const { key, label } of segments) {
      const value = Number(row[key]) || 0;
      raw.push({ segment: label, siteCode, value });
    }
  }
  return raw;
}
