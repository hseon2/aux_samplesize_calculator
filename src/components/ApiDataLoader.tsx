import React, { useState, useEffect, useMemo } from 'react';
import { RawDataRow } from '../utils/parser';
import { fetchOptions, fetchV1Data, ApiOptions } from '../utils/apiClient';

export interface ApiLoadedMeta {
  startDate: string;
  endDate: string;
}

interface ApiDataLoaderProps {
  onDataLoaded: (data: RawDataRow[], meta?: ApiLoadedMeta) => void;
  onError: (error: string) => void;
}

const defaultStart = '2026-01-01';
const defaultEnd = '2026-01-31';

export const ApiDataLoader: React.FC<ApiDataLoaderProps> = ({ onDataLoaded, onError }) => {
  const [options, setOptions] = useState<ApiOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [apiError, setApiError] = useState('');
  const [사업부, set사업부] = useState('');
  const [페이지타입, set페이지타입] = useState('');
  const [상세타입, set상세타입] = useState('');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  const combinations: Array<{ 사업부: string; '페이지 타입': string; '상세 타입': string }> = Array.isArray(options?.combinations) ? options.combinations : [];

  const pageTypesFor부 = useMemo(() => {
    const 부 = 사업부?.trim() ?? '';
    if (!부) return [];
    if (combinations.length === 0) return options?.['페이지 타입'] ?? [];
    const set = new Set<string>();
    combinations.filter((c) => (c.사업부 ?? '').trim() === 부).forEach((c) => set.add(c['페이지 타입'] ?? ''));
    return [...set].sort();
  }, [사업부, combinations, options]);

  const detailTypesFor부AndPage = useMemo(() => {
    const 부 = 사업부?.trim() ?? '';
    const 페이지 = 페이지타입?.trim() ?? '';
    if (!부 || !페이지) return [];
    if (combinations.length === 0) return options?.['상세 타입'] ?? [];
    const set = new Set<string>();
    combinations
      .filter((c) => (c.사업부 ?? '').trim() === 부 && (c['페이지 타입'] ?? '').trim() === 페이지)
      .forEach((c) => set.add(c['상세 타입'] ?? ''));
    return [...set].sort();
  }, [사업부, 페이지타입, combinations, options]);

  useEffect(() => {
    let cancelled = false;
    setApiError('');
    setLoadingOptions(true);
    fetchOptions('')
      .then((opts) => {
        if (cancelled) return;
        setOptions(opts);
        if (opts.사업부?.length && !사업부) set사업부(opts.사업부[0]);
      })
      .catch((err) => {
        if (!cancelled) {
          setOptions(null);
          setApiError(err instanceof Error ? err.message : '옵션 로드 실패');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!pageTypesFor부.includes(페이지타입)) set페이지타입(pageTypesFor부[0] ?? '');
  }, [사업부, pageTypesFor부]);

  useEffect(() => {
    if (!detailTypesFor부AndPage.includes(상세타입)) set상세타입(detailTypesFor부AndPage[0] ?? '');
  }, [페이지타입, detailTypesFor부AndPage]);

  const handleLoad = async () => {
    if (!사업부 || !페이지타입 || !상세타입) {
      onError('사업부, 페이지 타입, 상세 타입을 모두 선택해주세요.');
      return;
    }
    setApiError('');
    setLoadingData(true);
    onError('');
    try {
      const rawData = await fetchV1Data(
        {
          사업부,
          '페이지 타입': 페이지타입,
          '상세 타입': 상세타입,
          start_date: startDate,
          end_date: endDate,
        },
        ''
      );
      if (rawData.length === 0) {
        onError('조회된 데이터가 없습니다. 기간을 확인해주세요.');
        return;
      }
      onDataLoaded(rawData, { startDate, endDate });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'API 데이터 불러오기 실패');
    } finally {
      setLoadingData(false);
    }
  };

  const canLoad = options && 사업부 && 페이지타입 && 상세타입 && startDate && endDate && !loadingData;

  const labelStyle = { display: 'block' as const, marginBottom: '4px', fontWeight: 'bold' as const, fontSize: '13px' };
  const inputStyle = {
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
  };
  const selectStyle = { ...inputStyle, minWidth: '100px', cursor: 'pointer' as const };

  return (
    <div style={{ marginBottom: '20px' }}>
      {loadingOptions && <p style={{ color: '#666', marginBottom: '8px' }}>옵션 로딩 중...</p>}
      {apiError && (
        <div style={{ padding: '10px', backgroundColor: '#fee', borderRadius: '4px', color: '#c33', marginBottom: '12px' }}>
          {apiError}
        </div>
      )}

      {options && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 20px' }}>
            <div>
              <label style={labelStyle}>사업부</label>
              <select
                value={사업부}
                onChange={(e) => set사업부(e.target.value)}
                style={selectStyle}
              >
                <option value="">선택</option>
                {(options.사업부 || []).map((v) => (
                  <option key={v} value={v}>{v || '(빈 값)'}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>페이지 타입</label>
              <select
                value={페이지타입}
                onChange={(e) => set페이지타입(e.target.value)}
                style={selectStyle}
              >
                <option value="">선택</option>
                {pageTypesFor부.map((v) => (
                  <option key={v} value={v}>{v || '(빈 값)'}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>상세 타입</label>
              <select
                value={상세타입}
                onChange={(e) => set상세타입(e.target.value)}
                style={selectStyle}
              >
                <option value="">선택</option>
                {detailTypesFor부AndPage.map((v) => (
                  <option key={v} value={v}>{v || '(빈 값)'}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <button
              type="button"
              onClick={handleLoad}
              disabled={!canLoad}
              style={{
                padding: '8px 18px',
                fontSize: '14px',
                backgroundColor: canLoad ? '#059669' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: canLoad ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
              }}
            >
              {loadingData ? '불러오는 중...' : '데이터 불러오기'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
