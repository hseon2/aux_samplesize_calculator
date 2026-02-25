import React, { useState, useMemo } from 'react';
import { TestDurationResult } from '../utils/calculator';

type SortKey =
  | 'cartTestDuration5Percent'
  | 'cartTestDuration10Percent'
  | 'orderTestDuration5Percent'
  | 'orderTestDuration10Percent'
  | 'minDaysForCart'
  | 'minDaysForOrder';

type SortDir = 'asc' | 'desc';

interface ResultTableProps {
  results: TestDurationResult[];
}

export const ResultTable: React.FC<ResultTableProps> = ({ results }) => {
  const [sortKey, setSortKey] = useState<SortKey | null>('minDaysForOrder');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  if (results.length === 0) return null;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toNum = (v: number | string): number => {
    if (v === 'N/A' || v === '-') return Infinity;
    return typeof v === 'number' ? v : parseFloat(String(v)) || Infinity;
  };

  const sortedResults = useMemo(() => {
    if (!sortKey) return results;
    return [...results].sort((a, b) => {
      const av = toNum(a[sortKey]);
      const bv = toNum(b[sortKey]);
      if (av === Infinity && bv === Infinity) return 0;
      if (av === Infinity) return 1;
      if (bv === Infinity) return -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [results, sortKey, sortDir]);

  const formatNumber = (value: number | string): string => {
    if (value === 'N/A' || value === '-') return String(value);
    if (typeof value === 'number') {
      if (value > 0 && value < 1) return value.toFixed(4);
      return Math.round(value).toLocaleString();
    }
    return String(value);
  };

  const formatPercent = (value: number): string => {
    return (value * 100).toFixed(2) + '%';
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span style={{ opacity: 0.35, marginLeft: '4px' }}>↕</span>;
    return <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const sortableTh = (
    key: SortKey,
    label: string,
    bg: string,
    isFirst?: boolean
  ) => (
    <th
      onClick={() => handleSort(key)}
      style={{
        padding: '10px',
        border: '1px solid #111827',
        textAlign: 'right',
        backgroundColor: bg,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        borderTop: isFirst ? undefined : undefined,
      }}
    >
      {label}{sortIcon(key)}
    </th>
  );

  const sortableThRowSpan = (
    key: SortKey,
    label: string
  ) => (
    <th
      rowSpan={2}
      onClick={() => handleSort(key)}
      style={{
        padding: '11px 14px',
        border: '1px solid #0f172a',
        textAlign: 'right',
        backgroundColor: sortKey === key ? '#2563eb' : '#1e293b',
        color: '#f1f5f9',
        cursor: 'pointer',
        userSelect: 'none' as const,
        whiteSpace: 'nowrap' as const,
        fontWeight: 600,
        fontSize: '13px',
        transition: 'background 0.15s ease',
      }}
    >
      {label}{sortIcon(key)}
    </th>
  );

  const thBase: React.CSSProperties = {
    padding: '11px 14px',
    border: '1px solid #111827',
    fontWeight: 600,
    fontSize: '13px',
    letterSpacing: '-0.01em',
  };

  const tdBase: React.CSSProperties = {
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    fontSize: '13px',
  };

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    }}>
      {/* 테이블 헤더 영역 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>계산 결과</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          총 <strong style={{ color: '#2563eb' }}>{sortedResults.length}</strong>개 · 컬럼 클릭 시 정렬
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '13px',
          backgroundColor: '#fff',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', color: '#f1f5f9' }}>
              <th rowSpan={2} style={{ ...thBase, border: '1px solid #0f172a', textAlign: 'left', whiteSpace: 'nowrap' }}>Site Code</th>
              <th rowSpan={2} style={{ ...thBase, border: '1px solid #0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>Daily Visits</th>
              <th rowSpan={2} style={{ ...thBase, border: '1px solid #0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>Daily Cart</th>
              <th rowSpan={2} style={{ ...thBase, border: '1px solid #0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>Daily Order</th>
              <th rowSpan={2} style={{ ...thBase, border: '1px solid #0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>Cart CVR</th>
              <th rowSpan={2} style={{ ...thBase, border: '1px solid #0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>Order CVR</th>
              <th colSpan={2} style={{ ...thBase, border: '1px solid #0f172a', textAlign: 'center', backgroundColor: '#0c4a6e' }}>
                Cart CVR 기준
              </th>
              <th colSpan={2} style={{ ...thBase, border: '1px solid #0f172a', textAlign: 'center', backgroundColor: '#431407' }}>
                Order CVR 기준
              </th>
              {sortableThRowSpan('minDaysForCart', 'Cart 모수 확보 일수')}
              {sortableThRowSpan('minDaysForOrder', 'Order 모수 확보 일수')}
            </tr>
            <tr style={{ backgroundColor: '#334155', color: '#e2e8f0' }}>
              {sortableTh('cartTestDuration5Percent', '5% Uplift', '#0c4a6e')}
              {sortableTh('cartTestDuration10Percent', '10% Uplift', '#0c4a6e')}
              {sortableTh('orderTestDuration5Percent', '5% Uplift', '#431407')}
              {sortableTh('orderTestDuration10Percent', '10% Uplift', '#431407')}
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((row, index) => (
              <tr
                key={index}
                style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafc' }}
              >
                <td style={{ ...tdBase, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                  {row.siteCode}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', color: '#374151' }}>
                  {formatNumber(row.dailyVisits)}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', color: '#374151' }}>
                  {formatNumber(row.dailyCart)}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', color: '#374151' }}>
                  {formatNumber(row.dailyOrder)}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', color: '#374151' }}>
                  {formatPercent(row.cartCVR)}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', color: '#374151' }}>
                  {formatPercent(row.orderCVR)}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', backgroundColor: '#f0f9ff', color: '#0c4a6e', fontWeight: 500 }}>
                  {formatNumber(row.cartTestDuration5Percent)}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', backgroundColor: '#f0f9ff', color: '#0c4a6e', fontWeight: 500 }}>
                  {formatNumber(row.cartTestDuration10Percent)}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', backgroundColor: '#fff7ed', color: '#7c2d12', fontWeight: 500 }}>
                  {formatNumber(row.orderTestDuration5Percent)}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', backgroundColor: '#fff7ed', color: '#7c2d12', fontWeight: 500 }}>
                  {formatNumber(row.orderTestDuration10Percent)}
                </td>
                <td style={{ ...tdBase, textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                  {formatNumber(row.minDaysForCart)}
                </td>
                <td style={{
                  ...tdBase,
                  textAlign: 'right',
                  fontWeight: 700,
                  color: sortKey === 'minDaysForOrder' ? '#2563eb' : '#111827',
                  backgroundColor: sortKey === 'minDaysForOrder' ? '#eff6ff' : undefined,
                }}>
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

