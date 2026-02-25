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

  // 입력 중 빈 값 허용을 위한 로컬 string 상태
  const [offersRaw, setOffersRaw] = useState(String(params.numberOfOffers));
  const [confidenceRaw, setConfidenceRaw] = useState(String(params.confidenceLevel * 100));
  const [powerRaw, setPowerRaw] = useState(String(params.statisticalPower * 100));

  // 부모 params가 외부에서 바뀔 경우 동기화
  useEffect(() => { setOffersRaw(String(params.numberOfOffers)); }, [params.numberOfOffers]);
  useEffect(() => { setConfidenceRaw(String(params.confidenceLevel * 100)); }, [params.confidenceLevel]);
  useEffect(() => { setPowerRaw(String(params.statisticalPower * 100)); }, [params.statisticalPower]);

  return (
    <div style={{ 
      marginBottom: '20px',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <h3>테스트 파라미터 설정</h3>
      {/* 1행: Data Range / 시작일 / 종료일 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Data range (일수, 예: 30)
          </label>
          <input
            type="number"
            min="1"
            value={params.rangeDays}
            onChange={(e) => handleChange('rangeDays', parseInt(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            입력 시 시작/종료일 없이도 계산 가능
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            시작일
          </label>
          <input
            type="date"
            value={params.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            종료일
          </label>
          <input
            type="date"
            value={params.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>
      {/* 2행: Number of Offers / Confidence Level / Statistical Power */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Number of Offers (기본값: 2)
          </label>
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
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Confidence Level (기본값: 95%)
          </label>
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
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>%</span>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Statistical Power (기본값: 80%)
          </label>
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
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>%</span>
        </div>
      </div>
    </div>
  );
};


