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
  results: (TestDurationResult & { targetPageLabel?: string; targetPageOrder?: number })[];
  showCartMetrics?: boolean;
  showOrderMetrics?: boolean;
  /** Summary 탭 등에서 Target Page 컬럼 표시 */
  showTargetPageColumn?: boolean;
  /** Summary 탭 등에서 Daily Cart/Order 컬럼 숨김 */
  hideDailyCartOrder?: boolean;
  /** 엑셀 Summary처럼 Site Code 기준으로 묶어(정렬+셀 병합) 표시 */
  groupBySiteCode?: boolean;
  /** Summary처럼 정렬을 고정하고 컬럼 정렬 UI 비활성화 */
  disableSorting?: boolean;
  selectedSiteCodes?: string[];
  onToggleSiteCode?: (siteCode: string) => void;
  onToggleAll?: (checked: boolean) => void;
  /** 체크 시 Unspecified Site Code 행 제외(기본 true 권장) */
  excludeUnspecified?: boolean;
  onExcludeUnspecifiedChange?: (exclude: boolean) => void;
}

export const ResultTable: React.FC<ResultTableProps> = ({
  results,
  showCartMetrics = true,
  showOrderMetrics = true,
  showTargetPageColumn = false,
  hideDailyCartOrder = false,
  groupBySiteCode = false,
  disableSorting = false,
  selectedSiteCodes = [],
  onToggleSiteCode,
  onToggleAll,
  excludeUnspecified,
  onExcludeUnspecifiedChange,
}) => {
  const [sortKey, setSortKey] = useState<SortKey | null>('minDaysForOrder');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  if (results.length === 0) return null;

  // 엑셀 조건부 서식과 동일 기준(14일 / 30일)
  const durationBg = (value: number | string): string | undefined => {
    const n = toNum(value);
    if (!Number.isFinite(n) || n === Infinity) return undefined;
    if (n <= 14) return '#FFE699'; // 개나리(강)
    if (n <= 30) return '#FFF2CC'; // 연개나리
    return undefined;
  };

  const groupColors = {
    // 헤더는 흰색 텍스트가 잘 보이게 진한 톤
    headerBase: '#1f2937',
    headerSub: '#334155',
    // 헤더 컬러 스왑
    // - Order(보라 대신): 기존 파란색 적용
    // - Cart(기존 파란): 초록색으로 변경
    cartGroup: '#13523c',
    cartSub: '#038658', // 요청 색상 (연한 부분만)
    orderGroup: '#1e3a8a',
    orderSub: '#2b61dd', // 5%/10% uplift 배경 더 연하게
  } as const;

  const handleSort = (key: SortKey) => {
    if (disableSorting) return;
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
    // Summary에서 "국가별 묶음"은 정렬 규칙이 더 중요해서 별도 처리
    if (groupBySiteCode) {
      const toNumOrNull = (v: number | string): number | null => {
        if (v === 'N/A' || v === '-') return null;
        const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
        return Number.isFinite(n) ? n : null;
      };
      const normalizeSortKey = (n: number | null): number => {
        if (n === null) return Infinity;
        if (!Number.isFinite(n)) return Infinity;
        if (n === 0) return Infinity;
        return n;
      };

      const bySite = new Map<string, (TestDurationResult & { targetPageLabel?: string; targetPageOrder?: number })[]>();
      results.forEach((r) => {
        const key = String(r.siteCode ?? '');
        const list = bySite.get(key) ?? [];
        list.push(r);
        bySite.set(key, list);
      });

      const siteGroups = Array.from(bySite.entries()).map(([siteCode, rows]) => {
        // 그룹 내부는 Target Page "추가 순서" 유지(엑셀과 동일)
        const within = [...rows].sort((a, b) => {
          const ao = a.targetPageOrder ?? 0;
          const bo = b.targetPageOrder ?? 0;
          if (ao !== bo) return ao - bo;
          return String(a.targetPageLabel ?? '').localeCompare(String(b.targetPageLabel ?? ''));
        });
        const first = within[0];
        const firstKey = first ? normalizeSortKey(toNumOrNull(first.minDaysForCart)) : Infinity;
        const secondKey = first ? normalizeSortKey(toNumOrNull(first.minDaysForOrder)) : Infinity;
        return { siteCode, firstKey, secondKey, rows: within };
      });

      siteGroups.sort((a, b) => {
        if (a.firstKey !== b.firstKey) return a.firstKey - b.firstKey;
        if (a.secondKey !== b.secondKey) return a.secondKey - b.secondKey;
        return a.siteCode.localeCompare(b.siteCode);
      });

      return siteGroups.flatMap((g) => g.rows);
    }

    if (!sortKey) return results;
    return [...results].sort((a, b) => {
      const av = toNum(a[sortKey]);
      const bv = toNum(b[sortKey]);
      if (av === Infinity && bv === Infinity) return 0;
      if (av === Infinity) return 1;
      if (bv === Infinity) return -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [results, sortKey, sortDir, groupBySiteCode]);

  const formatNumber = (value: number | string): string => {
    if (value === 'N/A' || value === '-') return String(value);
    if (typeof value === 'number') {
      if (value > 0 && value < 1) return value.toFixed(4);
      return Math.round(value).toLocaleString();
    }
    return String(value);
  };

  const formatDaily = (value: number): string => {
    // Daily Visits/Cart/Order: 소수점 첫째자리에서 반올림(= 정수)
    return Math.round(value).toLocaleString();
  };

  const formatPercent = (value: number): string => {
    return (value * 100).toFixed(2) + '%';
  };

  const maybe = (enabled: boolean, v: string) => (enabled ? v : '');

  const sortIcon = (key: SortKey) => {
    if (disableSorting) return null;
    if (sortKey !== key) return <span style={{ opacity: 0.35, marginLeft: '4px' }}>↕</span>;
    return <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const sortableTh = (
    key: SortKey,
    label: string,
    bg: string
  ) => (
    <th
      onClick={disableSorting ? undefined : () => handleSort(key)}
      style={{
        padding: '10px',
        border: '1px solid #6b7280',
        textAlign: 'center',
        backgroundColor: bg,
        cursor: disableSorting ? 'default' : 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}{sortIcon(key)}
    </th>
  );

  const thBase: React.CSSProperties = {
    padding: '11px 14px',
    border: '1px solid #6b7280',
    fontWeight: 600,
    fontSize: '13px',
    letterSpacing: '-0.01em',
  };

  const tdBase: React.CSSProperties = {
    padding: '10px 14px',
    border: '1px solid #e5e7eb',
    fontSize: '13px',
    textAlign: 'center',
  };

  // 세로 "안쪽" 구분선만 진하게
  // border-collapse 환경에서 borderLeft는 충돌로 잘 안 보일 수 있어,
  // "각 셀의 오른쪽 선"을 강화하는 방식으로 일관되게 표시한다. (마지막 컬럼 제외)
  const innerVBorder = (colPos: number, totalCols: number): React.CSSProperties =>
    colPos < totalCols - 1 ? { borderRight: '1px solid #cbd5e1' } : {};

  const showSelection = Boolean(onToggleSiteCode);
  const showTarget = Boolean(showTargetPageColumn);
  const showDailyCartOrder = !hideDailyCartOrder;
  const selectedSet = useMemo(() => new Set(selectedSiteCodes), [selectedSiteCodes]);
  const allCodes = useMemo(() => Array.from(new Set(sortedResults.map(r => r.siteCode).filter(Boolean))).sort(), [sortedResults]);
  const selectedCountInView = useMemo(() => allCodes.filter(c => selectedSet.has(c)).length, [allCodes, selectedSet]);
  const allChecked = showSelection && allCodes.length > 0 && selectedCountInView === allCodes.length;
  const indeterminate = showSelection && selectedCountInView > 0 && selectedCountInView < allCodes.length;
  const totalCols =
    (showSelection ? 1 : 0) +
    1 + // site
    (showTarget ? 1 : 0) +
    1 + // daily visits
    (showDailyCartOrder ? 2 : 0) + // daily cart/order
    1 + // cart cvr
    1 + // order cvr
    3 + // cart duration cols
    3; // order duration cols

  // groupBySiteCode면 Site Code 셀을 rowspan으로 병합
  const siteRowSpan = useMemo(() => {
    if (!groupBySiteCode) return new Map<number, number>();
    const spans = new Map<number, number>();
    let i = 0;
    while (i < sortedResults.length) {
      const sc = sortedResults[i]?.siteCode;
      let j = i + 1;
      while (j < sortedResults.length && sortedResults[j]?.siteCode === sc) j++;
      spans.set(i, j - i);
      i = j;
    }
    return spans;
  }, [sortedResults, groupBySiteCode]);

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
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827', flexShrink: 0 }}>계산 결과</span>
          {onExcludeUnspecifiedChange && excludeUnspecified !== undefined && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 500,
                color: '#9ca3af',
                flexShrink: 0,
              }}
            >
              <input
                type="checkbox"
                checked={excludeUnspecified}
                onChange={(e) => onExcludeUnspecifiedChange(e.target.checked)}
                style={{ cursor: 'pointer', width: '13px', height: '13px', flexShrink: 0 }}
              />
              Unspecified 제외
            </label>
          )}
        </div>
        <span style={{ fontSize: '12px', color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
          총 <strong style={{ color: '#2563eb' }}>{sortedResults.length}</strong>개
          {showSelection && (
            <>
              {' '}· 선택 <strong style={{ color: '#2563eb' }}>{selectedCountInView}</strong>개
            </>
          )}
          {!disableSorting && (
            <>
              {' '}· 컬럼 클릭 시 정렬
            </>
          )}
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
            <tr style={{ backgroundColor: groupColors.headerBase, color: '#f8fafc' }}>
              {showSelection && (
                <th
                  rowSpan={2}
                  style={{ ...thBase, textAlign: 'center', whiteSpace: 'nowrap', width: 44, padding: '11px 10px' }}
                  title="전체 선택/해제"
                >
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = indeterminate; }}
                    onChange={(e) => onToggleAll?.(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              <th rowSpan={2} style={{ ...thBase, textAlign: 'center', whiteSpace: 'nowrap' }}>Site Code</th>
              {showTarget && (
                <th rowSpan={2} style={{ ...thBase, textAlign: 'center', whiteSpace: 'nowrap' }}>Target Page</th>
              )}
              <th rowSpan={2} style={{ ...thBase, textAlign: 'center', whiteSpace: 'nowrap' }}>Daily Visits</th>
              {showDailyCartOrder && (
                <th rowSpan={2} style={{ ...thBase, textAlign: 'center', whiteSpace: 'nowrap' }}>Daily Cart</th>
              )}
              {showDailyCartOrder && (
                <th rowSpan={2} style={{ ...thBase, textAlign: 'center', whiteSpace: 'nowrap' }}>Daily Order</th>
              )}
              <th rowSpan={2} style={{ ...thBase, textAlign: 'center', whiteSpace: 'nowrap' }}>Cart CVR</th>
              <th rowSpan={2} style={{ ...thBase, textAlign: 'center', whiteSpace: 'nowrap' }}>Order CVR</th>
              <th
                colSpan={3}
                style={{
                  ...thBase,
                  border: '1px solid #a3a3a3',
                  textAlign: 'center',
                  backgroundColor: groupColors.cartGroup,
                  color: '#f8fafc',
                }}
              >
                Add to Cart CVR 기반 예상 테스트 기간
              </th>
              <th
                colSpan={3}
                style={{
                  ...thBase,
                  border: '1px solid #a3a3a3',
                  textAlign: 'center',
                  backgroundColor: groupColors.orderGroup,
                  color: '#f8fafc',
                }}
              >
                Order CVR 기반 예상 테스트 기간
              </th>
            </tr>
            <tr style={{ backgroundColor: groupColors.headerSub, color: '#f8fafc' }}>
              {sortableTh('cartTestDuration5Percent', '5% uplift', groupColors.cartGroup)}
              {sortableTh('cartTestDuration10Percent', '10% uplift', groupColors.cartGroup)}
              {sortableTh('minDaysForCart', 'Cart 기준 모수 확보 일수', groupColors.cartSub)}
              {sortableTh('orderTestDuration5Percent', '5% uplift', groupColors.orderGroup)}
              {sortableTh('orderTestDuration10Percent', '10% uplift', groupColors.orderGroup)}
              {sortableTh('minDaysForOrder', 'Order 기준 모수 확보 일수', groupColors.orderSub)}
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((row, index) => (
              <tr
                key={index}
                style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f8fafc' }}
              >
                {(() => {
                  let col = 0;
                  const cells: React.ReactNode[] = [];
                  const span = groupBySiteCode ? (siteRowSpan.get(index) ?? 0) : 1;
                  const isFirstOfGroup = !groupBySiteCode || siteRowSpan.has(index);

                  if (showSelection) {
                    if (isFirstOfGroup) {
                      cells.push(
                        <td
                          key="sel"
                          rowSpan={groupBySiteCode ? span : undefined}
                          style={{ ...tdBase, ...innerVBorder(col, totalCols), padding: '10px 10px', backgroundColor: '#ffffff' }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSet.has(row.siteCode)}
                            onChange={() => onToggleSiteCode?.(row.siteCode)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                      );
                    }
                    col += 1;
                  }

                  if (isFirstOfGroup) {
                    cells.push(
                      <td
                        key="site"
                        rowSpan={groupBySiteCode ? span : undefined}
                        style={{
                          ...tdBase,
                          ...innerVBorder(col, totalCols),
                          fontWeight: 600,
                          color: '#111827',
                          whiteSpace: 'nowrap',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        {row.siteCode}
                      </td>
                    );
                  }
                  col += 1; // site col consumes one column position even if skipped in DOM

                  if (showTarget) {
                    cells.push(
                      <td key="tp" style={{ ...tdBase, ...innerVBorder(col, totalCols), color: '#374151', whiteSpace: 'nowrap' }}>
                        {row.targetPageLabel ?? ''}
                      </td>
                    );
                    col += 1;
                  }

                  cells.push(
                    <td key="dv" style={{ ...tdBase, ...innerVBorder(col, totalCols), color: '#374151' }}>
                      {formatDaily(row.dailyVisits)}
                    </td>
                  ); col += 1;

                  if (showDailyCartOrder) {
                    cells.push(
                      <td key="dc" style={{ ...tdBase, ...innerVBorder(col, totalCols), color: '#374151' }}>
                        {formatDaily(row.dailyCart)}
                      </td>
                    ); col += 1;

                    cells.push(
                      <td key="do" style={{ ...tdBase, ...innerVBorder(col, totalCols), color: '#374151' }}>
                        {formatDaily(row.dailyOrder)}
                      </td>
                    ); col += 1;
                  }

                  cells.push(
                    <td key="ccvr" style={{ ...tdBase, ...innerVBorder(col, totalCols), color: '#374151' }}>
                      {maybe(showCartMetrics, formatPercent(row.cartCVR))}
                    </td>
                  ); col += 1;

                  cells.push(
                    <td key="ocvr" style={{ ...tdBase, ...innerVBorder(col, totalCols), color: '#374151' }}>
                      {maybe(showOrderMetrics, formatPercent(row.orderCVR))}
                    </td>
                  ); col += 1;

                  cells.push(
                    <td
                      key="c5"
                      style={{
                        ...tdBase,
                        ...innerVBorder(col, totalCols),
                        backgroundColor: durationBg(row.cartTestDuration5Percent) ?? '#ffffff',
                        color: '#111827',
                        fontWeight: 600,
                      }}
                    >
                      {maybe(showCartMetrics, formatNumber(row.cartTestDuration5Percent))}
                    </td>
                  ); col += 1;

                  cells.push(
                    <td
                      key="c10"
                      style={{
                        ...tdBase,
                        ...innerVBorder(col, totalCols),
                        backgroundColor: durationBg(row.cartTestDuration10Percent) ?? '#ffffff',
                        color: '#111827',
                        fontWeight: 600,
                      }}
                    >
                      {maybe(showCartMetrics, formatNumber(row.cartTestDuration10Percent))}
                    </td>
                  ); col += 1;

                  cells.push(
                    <td
                      key="cmin"
                      style={{
                        ...tdBase,
                        ...innerVBorder(col, totalCols),
                        backgroundColor: durationBg(row.minDaysForCart) ?? '#ffffff',
                        color: '#111827',
                        fontWeight: 700,
                      }}
                    >
                      {maybe(showCartMetrics, formatNumber(row.minDaysForCart))}
                    </td>
                  ); col += 1;

                  cells.push(
                    <td
                      key="o5"
                      style={{
                        ...tdBase,
                        ...innerVBorder(col, totalCols),
                        backgroundColor: durationBg(row.orderTestDuration5Percent) ?? '#ffffff',
                        color: '#111827',
                        fontWeight: 600,
                      }}
                    >
                      {maybe(showOrderMetrics, formatNumber(row.orderTestDuration5Percent))}
                    </td>
                  ); col += 1;

                  cells.push(
                    <td
                      key="o10"
                      style={{
                        ...tdBase,
                        ...innerVBorder(col, totalCols),
                        backgroundColor: durationBg(row.orderTestDuration10Percent) ?? '#ffffff',
                        color: '#111827',
                        fontWeight: 600,
                      }}
                    >
                      {maybe(showOrderMetrics, formatNumber(row.orderTestDuration10Percent))}
                    </td>
                  ); col += 1;

                  cells.push(
                    <td
                      key="omin"
                      style={{
                        ...tdBase,
                        ...innerVBorder(col, totalCols),
                        backgroundColor: durationBg(row.minDaysForOrder) ?? '#ffffff',
                        color: '#111827',
                        fontWeight: 700,
                      }}
                    >
                      {maybe(showOrderMetrics, formatNumber(row.minDaysForOrder))}
                    </td>
                  );

                  return cells;
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

