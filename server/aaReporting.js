import axios from 'axios';

const TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';

// 호출 시점에 읽어서 .env가 로드된 후 값을 사용
function getEnv() {
  return {
    ORG_ID: process.env.AA_ORG_ID || '',
    CLIENT_ID: process.env.AA_CLIENT_ID || '',
    CLIENT_SECRET: process.env.AA_CLIENT_SECRET || '',
    GLOBAL_COMPANY_ID: process.env.AA_GLOBAL_COMPANY_ID || '',
    RSID: process.env.AA_RSID || '',
    SCOPES: (process.env.AA_SCOPES || 'openid,AdobeID,additional_info.projectedProductContext').split(',').map((s) => s.trim()),
    SEGMENT_ID_COUNTRY: process.env.AA_SEGMENT_ID_COUNTRY || 's200001591_699c093f2f5c912e350db01d',
  };
}

let cachedToken = null;

export async function getAccessToken() {
  const { CLIENT_ID, CLIENT_SECRET, SCOPES } = getEnv();
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return { error: 'Adobe API 환경 변수가 없습니다. server/.env에 AA_CLIENT_ID, AA_CLIENT_SECRET, AA_ORG_ID, AA_GLOBAL_COMPANY_ID, AA_RSID 를 설정해주세요.' };
  }
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('scope', SCOPES.join(','));
    const res = await axios.post(TOKEN_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    cachedToken = res.data?.access_token || null;
    return cachedToken;
  } catch (err) {
    const msg = err.response?.data?.error_description || err.response?.data?.error || err.message || '토큰 발급 실패';
    return { error: `Adobe 인증 실패: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}` };
  }
}

export async function fetchV1Visits({
  start_date,
  end_date,
  page_segment_id,
}) {
  const env = getEnv();
  const { GLOBAL_COMPANY_ID, RSID, SEGMENT_ID_COUNTRY, ORG_ID, CLIENT_ID } = env;
  if (!GLOBAL_COMPANY_ID || !RSID) {
    return { error: 'server/.env에 AA_GLOBAL_COMPANY_ID, AA_RSID 를 설정해주세요.' };
  }
  const tokenResult = await getAccessToken();
  if (typeof tokenResult === 'object' && tokenResult?.error) return tokenResult;
  const token = tokenResult;
  if (!token) return { error: 'Adobe 액세스 토큰을 받지 못했습니다.' };
  const segId = page_segment_id || 's200001591_699c09d8d5d044096dd62135';
  const url = `https://analytics.adobe.io/api/${GLOBAL_COMPANY_ID}/reports`;
  const body = {
    rsid: RSID,
    globalFilters: [
      { type: 'dateRange', dateRange: `${start_date}/${end_date}` },
      { type: 'segment', segmentId: SEGMENT_ID_COUNTRY },
      { type: 'segment', segmentId: segId },
    ],
    metricContainer: {
      metrics: [{ columnId: '1', id: 'metrics/visits', sort: 'desc' }],
    },
    dimension: 'variables/evar1',
    settings: {
      countRepeatInstances: true,
      includeAnnotations: true,
      nonesBehavior: 'return-nones',
      limit: 50000,
      page: 0,
    },
  };
  try {
    const res = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-api-key': CLIENT_ID,
        'x-proxy-global-company-id': GLOBAL_COMPANY_ID,
        'x-ims-org-id': ORG_ID,
        'Content-Type': 'application/json',
      },
    });
    const rows = res.data?.rows ?? [];
    return rows.map((row) => ({
      v1_value: row.value,
      visits: (row.data && row.data[0]) ?? 0,
    }));
  } catch (err) {
    const data = err.response?.data;
    const msg = data?.message || data?.errorCode || data?.error_description || err.message || 'Reports API 오류';
    return { error: `Adobe Reports API: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}` };
  }
}
