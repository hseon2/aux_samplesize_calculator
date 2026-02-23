import React from 'react';

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

  return (
    <div style={{ 
      marginBottom: '20px',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <h3>테스트 파라미터 설정</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
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
              borderRadius: '4px'
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
              borderRadius: '4px'
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
              borderRadius: '4px'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Number of Offers (기본값: 2)
          </label>
          <input
            type="number"
            min="2"
            value={params.numberOfOffers}
            onChange={(e) => handleChange('numberOfOffers', parseInt(e.target.value) || 2)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
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
            value={params.confidenceLevel * 100}
            onChange={(e) => handleChange('confidenceLevel', (parseFloat(e.target.value) || 95) / 100)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
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
            value={params.statisticalPower * 100}
            onChange={(e) => handleChange('statisticalPower', (parseFloat(e.target.value) || 80) / 100)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>%</span>
        </div>
      </div>
    </div>
  );
};


