import React from 'react';
import { RawDataRow } from '../utils/parser';

interface DataPreviewProps {
  data: RawDataRow[];
  maxRows?: number;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ data, maxRows = 50 }) => {
  if (data.length === 0) return null;

  const displayData = data.slice(0, maxRows);

  return (
    <div style={{ marginBottom: '20px' }}>
      <h3>데이터 미리보기 (최대 {maxRows}행)</h3>
      <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0', position: 'sticky', top: 0 }}>
              <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>세그먼트</th>
              <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Site Code</th>
              <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>값</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, index) => (
              <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{row.segment}</td>
                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{row.siteCode}</td>
                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {row.value.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > maxRows && (
          <p style={{ marginTop: '10px', color: '#666' }}>
            ... 외 {data.length - maxRows}행 더 있음
          </p>
        )}
      </div>
    </div>
  );
};


