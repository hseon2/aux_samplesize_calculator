import React from 'react';
import { TestDurationResult } from '../utils/calculator';

interface ResultTableProps {
  results: TestDurationResult[];
}

export const ResultTable: React.FC<ResultTableProps> = ({ results }) => {
  if (results.length === 0) return null;

  const formatNumber = (value: number | string): string => {
    if (value === 'N/A' || value === '-') return String(value);
    if (typeof value === 'number') {
      // 소숫점 첫째자리에서 반올림(= 정수로 표시)
      // 단, 1 미만의 값은 의미가 있어 보이므로 4자리까지 표시
      if (value > 0 && value < 1) return value.toFixed(4);
      return Math.round(value).toLocaleString();
    }
    return String(value);
  };

  const formatPercent = (value: number): string => {
    return (value * 100).toFixed(2) + '%';
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>계산 결과</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '14px',
          backgroundColor: '#fff'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#1f2937', color: '#fff' }}>
              <th rowSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'left' }}>Site Code</th>
              <th rowSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'right' }}>Daily Visits</th>
              <th rowSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'right' }}>Daily Cart</th>
              <th rowSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'right' }}>Daily Order</th>
              <th rowSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'right' }}>Cart CVR</th>
              <th rowSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'right' }}>Order CVR</th>
              <th colSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'center', backgroundColor: '#0b3a5b' }}>
                Cart CVR 기준
              </th>
              <th colSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'center', backgroundColor: '#5b2b00' }}>
                Order CVR 기준
              </th>
              <th rowSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'right' }}>Cart 모수 확보 일수</th>
              <th rowSpan={2} style={{ padding: '12px', border: '1px solid #111827', textAlign: 'right' }}>Order 모수 확보 일수</th>
            </tr>
            <tr style={{ backgroundColor: '#374151', color: '#fff' }}>
              <th style={{ padding: '10px', border: '1px solid #111827', textAlign: 'right', backgroundColor: '#0b3a5b' }}>5% Uplift</th>
              <th style={{ padding: '10px', border: '1px solid #111827', textAlign: 'right', backgroundColor: '#0b3a5b' }}>10% Uplift</th>
              <th style={{ padding: '10px', border: '1px solid #111827', textAlign: 'right', backgroundColor: '#5b2b00' }}>5% Uplift</th>
              <th style={{ padding: '10px', border: '1px solid #111827', textAlign: 'right', backgroundColor: '#5b2b00' }}>10% Uplift</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row, index) => (
              <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                <td style={{ padding: '10px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                  {row.siteCode}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {formatNumber(row.dailyVisits)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {formatNumber(row.dailyCart)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {formatNumber(row.dailyOrder)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {formatPercent(row.cartCVR)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {formatPercent(row.orderCVR)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right', backgroundColor: '#e8f4f8' }}>
                  {formatNumber(row.cartTestDuration5Percent)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right', backgroundColor: '#e8f4f8' }}>
                  {formatNumber(row.cartTestDuration10Percent)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right', backgroundColor: '#fff4e6' }}>
                  {formatNumber(row.orderTestDuration5Percent)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right', backgroundColor: '#fff4e6' }}>
                  {formatNumber(row.orderTestDuration10Percent)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {formatNumber(row.minDaysForCart)}
                </td>
                <td style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'right' }}>
                  {formatNumber(row.minDaysForOrder)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

