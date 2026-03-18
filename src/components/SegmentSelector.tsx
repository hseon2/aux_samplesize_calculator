import React from 'react';
import { SegmentLabel } from '../utils/parser';

interface SegmentSelectorProps {
  labels: SegmentLabel[];
  title?: string;
  actions?: React.ReactNode;
  selectedVisits: string;
  selectedCartAdd: string;
  selectedOrder: string;
  onVisitsChange: (label: string) => void;
  onCartAddChange: (label: string) => void;
  onOrderChange: (label: string) => void;
}

export const SegmentSelector: React.FC<SegmentSelectorProps> = ({
  labels,
  title,
  actions,
  selectedVisits,
  selectedCartAdd,
  selectedOrder,
  onVisitsChange,
  onCartAddChange,
  onOrderChange
}) => {
  const visitsLabels = labels.filter(l => l.type === 'visits');
  const cartAddLabels = labels.filter(l => l.type === 'cartAdd');
  const orderLabels = labels.filter(l => l.type === 'order');

  return (
    <div style={{ 
      marginBottom: '20px',
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <h3 style={{ margin: 0 }}>{title ?? '세그먼트 라벨 선택'}</h3>
        {actions}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Visits 라벨
          </label>
          <select
            value={selectedVisits}
            onChange={(e) => onVisitsChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          >
            <option value="">선택하세요</option>
            {visitsLabels.map((label, index) => (
              <option key={index} value={label.label}>
                {label.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Cart Add 라벨
          </label>
          <select
            value={selectedCartAdd}
            onChange={(e) => onCartAddChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          >
            <option value="">선택하세요</option>
            {cartAddLabels.map((label, index) => (
              <option key={index} value={label.label}>
                {label.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Order 라벨
          </label>
          <select
            value={selectedOrder}
            onChange={(e) => onOrderChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          >
            <option value="">선택하세요</option>
            {orderLabels.map((label, index) => (
              <option key={index} value={label.label}>
                {label.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};


