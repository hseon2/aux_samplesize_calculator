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
    if (페이지타입 && !pageTypesFor부.includes(페이지타입)) set페이지타입('');
  }, [사업부, pageTypesFor부]);

  useEffect(() => {
    if (상세타입 && !detailTypesFor부AndPage.includes(상세타입)) set상세타입('');
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
    fontSize: '13px',
    color: '#374151',
  };
  const fieldStyle: React.CSSProperties = {
    padding: '9px 12px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111827',
    backgroundColor: '#fff',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  };
  const selectStyle: React.CSSProperties = { ...fieldStyle, minWidth: '130px', cursor: 'pointer' };

  return (
    <div>
      {loadingOptions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '13px', marginBottom: '12px' }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
          옵션 로딩 중...
        </div>
      )}
      {apiError && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '12px 14px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#dc2626',
          fontSize: '13px',
          marginBottom: '12px',
        }}>
          <span style={{ flexShrink: 0 }}>⚠️</span>
          {apiError}
        </div>
      )}

      {options && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px 16px' }}>
          <div>
            <label style={labelStyle}>사업부</label>
            <select value={사업부} onChange={(e) => set사업부(e.target.value)} style={selectStyle}>
              <option value="">선택</option>
              {(options.사업부 || []).map((v) => (
                <option key={v} value={v}>{v || '(빈 값)'}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>페이지 타입</label>
            <select value={페이지타입} onChange={(e) => set페이지타입(e.target.value)} style={selectStyle}>
              <option value="">선택</option>
              {pageTypesFor부.map((v) => (
                <option key={v} value={v}>{v || '(빈 값)'}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>상세 타입</label>
            <select value={상세타입} onChange={(e) => set상세타입(e.target.value)} style={selectStyle}>
              <option value="">선택</option>
              {detailTypesFor부AndPage.map((v) => (
                <option key={v} value={v}>{v || '(빈 값)'}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>시작일</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>종료일</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={fieldStyle} />
          </div>
          <button
            type="button"
            onClick={handleLoad}
            disabled={!canLoad}
            style={{
              padding: '9px 20px',
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: canLoad ? '#2563eb' : '#93c5fd',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: canLoad ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s ease',
            }}
          >
            {loadingData ? '불러오는 중...' : '데이터 불러오기'}
          </button>
        </div>
      )}
    </div>
  );
};
