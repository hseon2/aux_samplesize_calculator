import { ParsedDataRow } from './parser';

export interface CalculationParams {
  startDate?: Date;
  endDate?: Date;
  rangeDays?: number;
  numberOfOffers: number;
  confidenceLevel: number; // 0.95 for 95%
  statisticalPower: number; // 0.80 for 80%
}

export interface DailyMetrics {
  dailyVisits: number;
  dailyCart: number;
  dailyOrder: number;
}

export interface CVRMetrics {
  cartCVR: number;
  orderCVR: number;
}

export interface TestDurationResult {
  siteCode: string;
  dailyVisits: number;
  dailyCart: number;
  dailyOrder: number;
  cartCVR: number;
  orderCVR: number;
  // Cart CVR 기준
  cartTestDuration5Percent: number | string;
  cartTestDuration10Percent: number | string;
  // Order CVR 기준
  orderTestDuration5Percent: number | string;
  orderTestDuration10Percent: number | string;
  minDaysForCart: number | string;
  minDaysForOrder: number | string;
}

/**
 * 두 날짜 사이의 일수 계산
 */
export function calculateDays(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
}

/**
 * 일일 평균 계산
 */
export function calculateDailyMetrics(
  visits: number | 'N/A',
  cartAdd: number | 'N/A',
  order: number | 'N/A',
  days: number
): DailyMetrics {
  return {
    dailyVisits: visits === 'N/A' ? 0 : visits / days,
    dailyCart: cartAdd === 'N/A' ? 0 : cartAdd / days,
    dailyOrder: order === 'N/A' ? 0 : order / days
  };
}

/**
 * CVR 계산
 */
export function calculateCVR(
  visits: number | 'N/A',
  cartAdd: number | 'N/A',
  order: number | 'N/A'
): CVRMetrics {
  const visitsNum = visits === 'N/A' ? 0 : visits;
  const cartNum = cartAdd === 'N/A' ? 0 : cartAdd;
  const orderNum = order === 'N/A' ? 0 : order;
  
  return {
    cartCVR: visitsNum > 0 ? cartNum / visitsNum : 0,
    orderCVR: visitsNum > 0 ? orderNum / visitsNum : 0
  };
}

/**
 * 5% 또는 10% Uplift 기준 예상 테스트 기간 계산
 */
export function calculateTestDuration(
  cvr: number,
  uplift: number, // 1.05 for 5%, 1.10 for 10%
  confidenceLevel: number,
  statisticalPower: number,
  numberOfOffers: number,
  dailyVisits: number
): number | string {
  // 요청하신 Excel 스타일 함수(calcTestDays)로 계산
  // B1=confidenceLevel, B2=statisticalPower, B5=numberOfOffers, G6=cvr, D6=dailyVisits
  return calcTestDays(confidenceLevel, statisticalPower, numberOfOffers, cvr, dailyVisits, uplift);
}

// ===== 요청하신 Excel 스타일 헬퍼/계산 함수 =====
function roundExcel(value: number, digits: number): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function roundUpExcel(value: number): number {
  return Math.ceil(value);
}

function normSInvExcel(p: number): number {
  // Excel과의 수치 오차를 줄이기 위해 더 정확한 근사(normSInv) 사용
  return normSInv(p);
}

function calcTestDays(
  B1: number,
  B2: number,
  B5: number,
  G6: number,
  D6: number,
  upliftMultiplier: number
): number | string {
  try {
    const zAlpha = normSInvExcel(1 - (1 - B1) / 2);
    const zBeta = normSInvExcel(B2);
    const zSum = Math.pow(zAlpha + zBeta, 2);

    const var1 = roundExcel(G6 * (1 - G6), 8);
    const uplift = G6 * upliftMultiplier;
    const var2 = roundExcel(uplift * (1 - uplift), 8);

    const deltaSq = Math.pow(uplift - G6, 2);
    if (deltaSq <= 0 || D6 <= 0) return '-';

    const n = (zSum * (var1 + var2)) / deltaSq;
    const days = roundUpExcel((n * B5) / D6);

    if (!Number.isFinite(days) || days <= 0) return '-';
    return days;
  } catch {
    return '-';
  }
}

/**
 * 모수 확보 필요 일수 계산
 */
export function calculateMinDays(
  dailyMetric: number,
  numberOfOffers: number
): number | string {
  if (dailyMetric <= 0) return '-';
  
  const requiredCount = 100 * numberOfOffers;
  
  if (dailyMetric >= requiredCount) {
    return 1;
  }
  
  return Math.ceil(requiredCount / dailyMetric);
}

/**
 * 표준 정규 분포의 역함수 근사 (NORM.S.INV)
 * Abramowitz and Stegun approximation
 */
function normSInv(p: number): number {
  // Peter John Acklam의 inverse normal CDF 근사 (정확도 높음)
  if (p <= 0 || p >= 1) throw new Error('Probability must be between 0 and 1');

  // Coefficients in rational approximations
  const a = [
    -3.969683028665376e+01,
    2.209460984245205e+02,
    -2.759285104469687e+02,
    1.383577518672690e+02,
    -3.066479806614716e+01,
    2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01,
    1.615858368580409e+02,
    -1.556989798598866e+02,
    6.680131188771972e+01,
    -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
    4.374664141464968e+00,
    2.938163982698783e+00,
  ];
  const d = [
    7.784695709041462e-03,
    3.224671290700398e-01,
    2.445134137142996e+00,
    3.754408661907416e+00,
  ];

  // Define break-points
  const plow = 0.02425;
  const phigh = 1 - plow;

  let q: number;
  let r: number;

  if (p < plow) {
    // Rational approximation for lower region
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  if (phigh < p) {
    // Rational approximation for upper region
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  // Rational approximation for central region
  q = p - 0.5;
  r = q * q;
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

/**
 * 전체 계산 수행
 */
export function calculateAll(
  parsedData: ParsedDataRow[],
  params: CalculationParams
): TestDurationResult[] {
  const days =
    typeof params.rangeDays === 'number' && params.rangeDays > 0
      ? Math.floor(params.rangeDays)
      : params.startDate && params.endDate
        ? calculateDays(params.startDate, params.endDate)
        : 0;

  if (days <= 0) {
    // 계산 불가: 일수 정보가 없음
    return [];
  }
  
  return parsedData.map(row => {
    const daily = calculateDailyMetrics(row.visits, row.cartAdd, row.order, days);
    const cvr = calculateCVR(row.visits, row.cartAdd, row.order);
    
    // Cart CVR 기준 계산
    const cartTestDuration5 = calculateTestDuration(
      cvr.cartCVR,
      1.05,
      params.confidenceLevel,
      params.statisticalPower,
      params.numberOfOffers,
      daily.dailyVisits
    );
    
    const cartTestDuration10 = calculateTestDuration(
      cvr.cartCVR,
      1.10,
      params.confidenceLevel,
      params.statisticalPower,
      params.numberOfOffers,
      daily.dailyVisits
    );
    
    // Order CVR 기준 계산
    const orderTestDuration5 = calculateTestDuration(
      cvr.orderCVR,
      1.05,
      params.confidenceLevel,
      params.statisticalPower,
      params.numberOfOffers,
      daily.dailyVisits
    );
    
    const orderTestDuration10 = calculateTestDuration(
      cvr.orderCVR,
      1.10,
      params.confidenceLevel,
      params.statisticalPower,
      params.numberOfOffers,
      daily.dailyVisits
    );
    
    const minDaysCart = calculateMinDays(daily.dailyCart, params.numberOfOffers);
    const minDaysOrder = calculateMinDays(daily.dailyOrder, params.numberOfOffers);
    
    return {
      siteCode: row.siteCode,
      dailyVisits: daily.dailyVisits,
      dailyCart: daily.dailyCart,
      dailyOrder: daily.dailyOrder,
      cartCVR: cvr.cartCVR,
      orderCVR: cvr.orderCVR,
      cartTestDuration5Percent: cartTestDuration5,
      cartTestDuration10Percent: cartTestDuration10,
      orderTestDuration5Percent: orderTestDuration5,
      orderTestDuration10Percent: orderTestDuration10,
      minDaysForCart: minDaysCart,
      minDaysForOrder: minDaysOrder
    };
  });
}

