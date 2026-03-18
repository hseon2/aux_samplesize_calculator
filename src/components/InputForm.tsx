import React, { useState, useEffect } from 'react';

export interface InputParams {
  // 날짜를 안 쓰고도 계산할 수 있도록 rangeDays 추가
  rangeDays: number;
  startDate: string;
  endDate: string;
  numberOfOffers: number;
  confidenceLevel: number;
  statisticalPower: number;
}

interface InputFormProps {
  params: InputParams;
  onChange: (params: InputParams) => void;
}

export const InputForm: React.FC<InputFormProps> = ({ params, onChange }) => {
  const handleChange = (field: keyof InputParams, value: string | number) => {
    onChange({ ...params, [field]: value });
  };

  const parseDateInput = (v: string): Date | null => {
    if (!v) return null;
    // input[type=date]는 YYYY-MM-DD 형태
    const d = new Date(v + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const calcInclusiveDays = (start: string, end: string): number | null => {
    const s = parseDateInput(start);
    const e = parseDateInput(end);
    if (!s || !e) return null;
    const diffMs = e.getTime() - s.getTime();
    if (diffMs < 0) return null; // 종료일이 시작일보다 빠르면 자동 계산하지 않음
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1; // 포함일수
    return days > 0 ? days : null;
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const next = { ...params, [field]: value } as InputParams;
    const days = calcInclusiveDays(next.startDate, next.endDate);
    if (days) next.rangeDays = days;
    onChange(next);
  };

  // 입력 중 빈 값 허용을 위한 로컬 string 상태
  const [offersRaw, setOffersRaw] = useState(String(params.numberOfOffers));
  const [confidenceRaw, setConfidenceRaw] = useState(String(params.confidenceLevel * 100));
  const [powerRaw, setPowerRaw] = useState(String(params.statisticalPower * 100));

  // 부모 params가 외부에서 바뀔 경우 동기화
  useEffect(() => { setOffersRaw(String(params.numberOfOffers)); }, [params.numberOfOffers]);
  useEffect(() => { setConfidenceRaw(String(params.confidenceLevel * 100)); }, [params.confidenceLevel]);
  useEffect(() => { setPowerRaw(String(params.statisticalPower * 100)); }, [params.statisticalPower]);

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
    fontSize: '13px',
    color: '#374151',
  };
  const inputFieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#111827',
    backgroundColor: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease',
  };

  return (
    <div style={{
      marginBottom: '16px',
      padding: '20px 24px',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      backgroundColor: '#ffffff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>
        테스트 파라미터 설정
      </div>
      {/* 1행: Data Range / 시작일 / 종료일 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Data range (일수, 예: 30)</label>
          <input
            type="number"
            min="1"
            value={params.rangeDays}
            onChange={(e) => handleChange('rangeDays', parseInt(e.target.value) || 0)}
            style={inputFieldStyle}
          />
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            입력 시 시작/종료일 없이도 계산 가능
          </div>
        </div>
        <div>
          <label style={labelStyle}>시작일</label>
          <input
            type="date"
            value={params.startDate}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
            style={inputFieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>종료일</label>
          <input
            type="date"
            value={params.endDate}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
            style={inputFieldStyle}
          />
        </div>
      </div>
      {/* 구분선 */}
      <div style={{ borderTop: '1px solid #f3f4f6', marginBottom: '16px' }} />
      {/* 2행: Number of Offers / Confidence Level / Statistical Power */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Number of Offers <span style={{ fontWeight: 400, color: '#9ca3af' }}>(기본값: 2)</span></label>
          <input
            type="number"
            min="2"
            value={offersRaw}
            onChange={(e) => setOffersRaw(e.target.value)}
            onBlur={() => {
              const parsed = parseInt(offersRaw);
              const val = isNaN(parsed) ? 2 : parsed;
              setOffersRaw(String(val));
              handleChange('numberOfOffers', val);
            }}
            style={inputFieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Confidence Level <span style={{ fontWeight: 400, color: '#9ca3af' }}>(기본값: 95%)</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={confidenceRaw}
              onChange={(e) => setConfidenceRaw(e.target.value)}
              onBlur={() => {
                const parsed = parseFloat(confidenceRaw);
                const val = isNaN(parsed) ? 95 : parsed;
                setConfidenceRaw(String(val));
                handleChange('confidenceLevel', val / 100);
              }}
              style={inputFieldStyle}
            />
            <span style={{ fontSize: '13px', color: '#6b7280', flexShrink: 0 }}>%</span>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Statistical Power <span style={{ fontWeight: 400, color: '#9ca3af' }}>(기본값: 80%)</span></label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={powerRaw}
              onChange={(e) => setPowerRaw(e.target.value)}
              onBlur={() => {
                const parsed = parseFloat(powerRaw);
                const val = isNaN(parsed) ? 80 : parsed;
                setPowerRaw(String(val));
                handleChange('statisticalPower', val / 100);
              }}
              style={inputFieldStyle}
            />
            <span style={{ fontSize: '13px', color: '#6b7280', flexShrink: 0 }}>%</span>
          </div>
        </div>
      </div>
    </div>
  );
};


