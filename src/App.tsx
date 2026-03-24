import { useMemo, useState } from 'react';
import * as ExcelJS from 'exceljs';
import { FileUpload } from './components/FileUpload';
import { ApiDataLoader } from './components/ApiDataLoader';
import { DataPreview } from './components/DataPreview';
import { InputForm, InputParams } from './components/InputForm';
import { SegmentSelector } from './components/SegmentSelector';
import { ResultTable } from './components/ResultTable';
import { MilestoneCalculator } from './components/MilestoneCalculator';
import { 
  RawDataRow, 
  extractSegmentLabels, 
  extractSiteCodes, 
  parseData 
} from './utils/parser';
import { 
  calculateAll, 
  calculateDays,
  CalculationParams,
  TestDurationResult 
} from './utils/calculator';

const makeId = () => {
  try {
    // 일부 환경에서 crypto.randomUUID가 없을 수 있어 fallback 제공
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyCrypto: any = (globalThis as any).crypto;
    if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  } catch { /* ignore */ }
  return `tp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

function App() {
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [segmentLabels, setSegmentLabels] = useState<ReturnType<typeof extractSegmentLabels>>([]);
  const [, setParsedData] = useState<ReturnType<typeof parseData>>([]);
  type TargetPageSet = {
    id: string;
    visitsLabel: string;
    cartAddLabel: string;
    orderLabel: string;
    siteCodes: string[];
    results: TestDurationResult[];
  };
  const [initialTargetPageId] = useState(() => makeId());
  const [targetPages, setTargetPages] = useState<TargetPageSet[]>(() => ([
    { id: initialTargetPageId, visitsLabel: '', cartAddLabel: '', orderLabel: '', siteCodes: [], results: [] },
  ]));
  const [activeTargetPageId, setActiveTargetPageId] = useState<string>(() => initialTargetPageId);
  const [error, setError] = useState<string>('');
  const [view, setView] = useState<'setup' | 'result'>('setup');
  const [dataSource, setDataSource] = useState<'file' | 'api'>('file');
  const [activeTool, setActiveTool] = useState<'sample-size' | 'milestone'>('sample-size');

  const [inputParams, setInputParams] = useState<InputParams>({
    rangeDays: 30,
    startDate: '',
    endDate: '',
    numberOfOffers: 2,
    confidenceLevel: 0.95,
    statisticalPower: 0.80
  });

  const handleDataLoaded = (data: RawDataRow[], meta?: { startDate: string; endDate: string }) => {
    setRawData(data);
    setError('');
    setView('setup');
    const labels = extractSegmentLabels(data);
    setSegmentLabels(labels);
    
    if (meta?.startDate && meta?.endDate) {
      const start = new Date(meta.startDate);
      const end = new Date(meta.endDate);
      setInputParams((prev) => ({
        ...prev,
        startDate: meta.startDate,
        endDate: meta.endDate,
        rangeDays: calculateDays(start, end),
      }));
    }
    
    const visitsLabel = labels.find(l => l.type === 'visits')?.label ?? '';
    const cartAddLabel = labels.find(l => l.type === 'cartAdd')?.label ?? '';
    const orderLabel = labels.find(l => l.type === 'order')?.label ?? '';
    const codes = visitsLabel ? extractSiteCodes(data, visitsLabel) : [];

    const first: TargetPageSet = {
      id: makeId(),
      visitsLabel,
      cartAddLabel,
      orderLabel,
      siteCodes: codes,
      results: [],
    };
    setTargetPages([first]);
    setActiveTargetPageId(first.id);
  };

  const updateTargetPage = (id: string, patch: Partial<TargetPageSet>) => {
    setTargetPages(prev => prev.map(tp => tp.id === id ? { ...tp, ...patch } : tp));
  };

  const handleVisitsChange = (id: string, label: string) => {
    const codes = label && rawData.length > 0 ? extractSiteCodes(rawData, label) : [];
    updateTargetPage(id, { visitsLabel: label, siteCodes: codes });
  };

  const handleCalculate = () => {
    const invalid = targetPages.find(tp => !tp.visitsLabel || (!tp.cartAddLabel && !tp.orderLabel));
    if (invalid) {
      setError('각 Target Page에서 Visits는 필수이며, Cart 또는 Order 중 최소 1개는 선택해주세요.');
      return;
    }

    const hasRangeDays = inputParams.rangeDays > 0;
    const hasDates = Boolean(inputParams.startDate && inputParams.endDate);
    if (!hasRangeDays && !hasDates) {
      setError('Data range(일수) 또는 시작일/종료일을 입력해주세요.');
      return;
    }

    const noCodes = targetPages.find(tp => tp.siteCodes.length === 0);
    if (noCodes) {
      setError('Site Code를 찾을 수 없습니다. Visits 라벨 선택을 확인해주세요.');
      return;
    }

    try {
      // 계산 수행
      const calcParams: CalculationParams = {
        rangeDays: hasRangeDays ? inputParams.rangeDays : undefined,
        startDate: hasDates ? new Date(inputParams.startDate) : undefined,
        endDate: hasDates ? new Date(inputParams.endDate) : undefined,
        numberOfOffers: inputParams.numberOfOffers,
        confidenceLevel: inputParams.confidenceLevel,
        statisticalPower: inputParams.statisticalPower
      };

      const nextPages = targetPages.map(tp => {
        const parsed = parseData(rawData, tp.visitsLabel, tp.cartAddLabel, tp.orderLabel, tp.siteCodes);
        setParsedData(parsed);
        const calculated = calculateAll(parsed, calcParams);
        const sorted = [...calculated].sort((a, b) => b.dailyVisits - a.dailyVisits);
        return { ...tp, results: sorted };
      });

      if (nextPages.some(tp => tp.results.length === 0)) {
        setError('Data range(일수) 또는 날짜 입력이 올바르지 않아 계산할 수 없습니다.');
        return;
      }

      setTargetPages(nextPages);
      setActiveTargetPageId(nextPages[0]?.id ?? activeTargetPageId);

      setError('');
      setView('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산 중 오류가 발생했습니다.');
    }
  };

  const safeSheetName = (name: string, fallback: string) => {
    const raw = (name || fallback).trim() || fallback;
    // Excel 시트명 제한: 31자, 금지문자: \ / ? * [ ]
    const cleaned = raw.replace(/[\\\/\?\*\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
  };

  const downloadResultsExcel = async () => {
    try {
      if (targetPages.every(tp => tp.results.length === 0)) return;

      const wb = new ExcelJS.Workbook();
      wb.creator = 'AB Test Sample Size Calculator';
      wb.created = new Date();

      const addSheet = (sheetTitle: string, rows: TestDurationResult[]) => {
        const ws = wb.addWorksheet(sheetTitle);
        ws.columns = [
          { header: 'Site Code', key: 'siteCode', width: 16 },
          { header: 'Daily Visits', key: 'dailyVisits', width: 14 },
          { header: 'Daily Cart', key: 'dailyCart', width: 14 },
          { header: 'Daily Order', key: 'dailyOrder', width: 14 },
          { header: 'Cart CVR', key: 'cartCVR', width: 12 },
          { header: 'Order CVR', key: 'orderCVR', width: 12 },
          { header: 'Cart 5% Uplift Days', key: 'cart5', width: 18 },
          { header: 'Cart 10% Uplift Days', key: 'cart10', width: 19 },
          { header: 'Order 5% Uplift Days', key: 'order5', width: 19 },
          { header: 'Order 10% Uplift Days', key: 'order10', width: 20 },
          { header: 'Min Days (Cart)', key: 'minCart', width: 16 },
          { header: 'Min Days (Order)', key: 'minOrder', width: 16 },
        ];

        rows.forEach((r) => {
          ws.addRow({
            siteCode: r.siteCode,
            dailyVisits: r.dailyVisits,
            dailyCart: r.dailyCart,
            dailyOrder: r.dailyOrder,
            cartCVR: r.cartCVR,
            orderCVR: r.orderCVR,
            cart5: r.cartTestDuration5Percent,
            cart10: r.cartTestDuration10Percent,
            order5: r.orderTestDuration5Percent,
            order10: r.orderTestDuration10Percent,
            minCart: r.minDaysForCart,
            minOrder: r.minDaysForOrder,
          });
        });

        // header 스타일
        ws.getRow(1).font = { bold: true };
        ws.views = [{ state: 'frozen', ySplit: 1 }];

        // CVR 퍼센트 포맷
        ws.getColumn('cartCVR').numFmt = '0.00%';
        ws.getColumn('orderCVR').numFmt = '0.00%';
      };

      targetPages.forEach((tp, idx) => {
        if (tp.results.length === 0) return;
        const fallback = `Target Page ${idx + 1}`;
        // Cart/Order 선택 여부에 따라 엑셀에서도 미선택 컬럼은 공란으로
        const showCart = Boolean(tp.cartAddLabel);
        const showOrder = Boolean(tp.orderLabel);
        const adjusted = tp.results.map((r) => ({
          ...r,
          cartCVR: showCart ? r.cartCVR : 0,
          orderCVR: showOrder ? r.orderCVR : 0,
          cartTestDuration5Percent: showCart ? r.cartTestDuration5Percent : '',
          cartTestDuration10Percent: showCart ? r.cartTestDuration10Percent : '',
          orderTestDuration5Percent: showOrder ? r.orderTestDuration5Percent : '',
          orderTestDuration10Percent: showOrder ? r.orderTestDuration10Percent : '',
          minDaysForCart: showCart ? r.minDaysForCart : '',
          minDaysForOrder: showOrder ? r.minDaysForOrder : '',
        }));
        addSheet(safeSheetName(tp.visitsLabel || fallback, fallback), adjusted);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ab-test-results.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel 다운로드 중 오류가 발생했습니다.');
    }
  };

  const canCalculate = useMemo(() => {
    const hasDays = inputParams.rangeDays > 0 || Boolean(inputParams.startDate && inputParams.endDate);
    const okLabels = targetPages.every(tp => tp.visitsLabel && (tp.cartAddLabel || tp.orderLabel));
    const okCodes = targetPages.every(tp => tp.siteCodes.length > 0);
    return Boolean(hasDays && okLabels && okCodes);
  }, [inputParams.rangeDays, inputParams.startDate, inputParams.endDate, targetPages]);

  // 단계: 1=데이터 입력, 2=설정 및 계산, 3=결과
  const step = view === 'result' ? 3 : rawData.length > 0 ? 2 : 1;

  // ── 디자인 토큰 ──────────────────────────────────────────
  const ds = {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryDisabled: '#93c5fd',
    secondary: '#374151',
    secondaryHover: '#1f2937',
    surface: '#ffffff',
    surfaceHover: '#f9fafb',
    pageBg: '#f3f4f6',
    border: '#e5e7eb',
    borderFocus: '#2563eb',
    textPrimary: '#111827',
    textMuted: '#6b7280',
    textLight: '#9ca3af',
    errorBg: '#fef2f2',
    errorBorder: '#fecaca',
    errorText: '#dc2626',
    infoBg: '#eff6ff',
    infoBorder: '#bfdbfe',
    infoText: '#1e40af',
    successBg: '#f0fdf4',
    successBorder: '#bbf7d0',
    successText: '#166534',
    cardShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
    cardRadius: '12px',
  } as const;

  const stepDotStyle = (s: number): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
    flexShrink: 0,
    backgroundColor: step === s ? ds.primary : step > s ? '#d1fae5' : '#e5e7eb',
    color: step === s ? '#fff' : step > s ? '#065f46' : ds.textMuted,
    transition: 'all 0.2s ease',
  });

  const stepLabelStyle = (s: number): React.CSSProperties => ({
    fontSize: '13px',
    fontWeight: step === s ? 700 : 500,
    color: step === s ? ds.textPrimary : step > s ? '#059669' : ds.textMuted,
    cursor: (s < step || (s === 2 && step === 3)) ? 'pointer' : 'default',
    transition: 'color 0.2s ease',
  });

  const btnStyle = (variant: 'primary' | 'secondary', disabled?: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '9px 20px',
    fontSize: '14px',
    fontWeight: 600,
    borderRadius: '8px',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s ease',
    ...(variant === 'primary'
      ? { backgroundColor: disabled ? ds.primaryDisabled : ds.primary, color: '#fff' }
      : { backgroundColor: ds.secondary, color: '#fff' }),
  });

  const ctaButton = (label: string, onClick: () => void, disabled?: boolean, primary = true) => (
    <button onClick={onClick} disabled={disabled} style={btnStyle(primary ? 'primary' : 'secondary', disabled)}>
      {label}
    </button>
  );

  const toolTabStyle = (tool: 'sample-size' | 'milestone'): React.CSSProperties => {
    const isActive = activeTool === tool;
    return {
      padding: '8px 14px',
      borderRadius: '999px',
      border: `1px solid ${isActive ? '#93c5fd' : '#4b5563'}`,
      backgroundColor: isActive ? '#1d4ed8' : 'transparent',
      color: '#f9fafb',
      fontSize: '13px',
      fontWeight: 700,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
    };
  };

  const card: React.CSSProperties = {
    backgroundColor: ds.surface,
    borderRadius: ds.cardRadius,
    border: `1px solid ${ds.border}`,
    boxShadow: ds.cardShadow,
    padding: '24px',
    marginBottom: '16px',
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: ds.pageBg }}>
      {/* ── 네비게이션 바 ── */}
      <header style={{
        backgroundColor: '#1f2937',
        borderBottom: '1px solid #111827',
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <span style={{ fontSize: '18px' }}>{activeTool === 'milestone' ? '🗓️' : '📊'}</span>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#f9fafb',
            letterSpacing: '-0.02em',
          }}>
            {activeTool === 'milestone' ? 'AUX Milestone Calculator' : 'AUX AB Test Sample Size Calculator'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTool('sample-size')}
              style={toolTabStyle('sample-size')}
            >
              Sample Size
            </button>
            <button
              onClick={() => setActiveTool('milestone')}
              style={toolTabStyle('milestone')}
            >
              Milestone
            </button>
          </div>
        </div>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>
        {activeTool === 'sample-size' ? (
          <>
        {/* ── 스텝 바 + CTA ── */}
        <div style={{
          ...card,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '16px 24px',
          marginBottom: '24px',
          position: 'sticky',
          top: '12px',
          zIndex: 50,
        }}>
          {/* 스텝 인디케이터 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Step 1 */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: step > 1 ? 'pointer' : 'default' }}
              onClick={() => { if (step > 1) { setRawData([]); setView('setup'); } }}
            >
              <div style={stepDotStyle(1)}>1</div>
              <span style={stepLabelStyle(1)}>데이터 입력</span>
            </div>
            <span style={{ color: ds.border, fontSize: '18px', margin: '0 4px' }}>›</span>
            {/* Step 2 */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: step === 3 ? 'pointer' : 'default' }}
              onClick={() => { if (step === 3) setView('setup'); }}
            >
              <div style={stepDotStyle(2)}>2</div>
              <span style={stepLabelStyle(2)}>설정 및 계산</span>
            </div>
            <span style={{ color: ds.border, fontSize: '18px', margin: '0 4px' }}>›</span>
            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={stepDotStyle(3)}>3</div>
              <span style={stepLabelStyle(3)}>결과</span>
            </div>
          </div>

          {/* CTA 버튼 */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {step === 2 && (
              <>
                {ctaButton('← 뒤로가기', () => { setRawData([]); setView('setup'); }, false, false)}
                {ctaButton('계산하기', handleCalculate, !canCalculate)}
              </>
            )}
            {step === 3 && ctaButton('← 뒤로가기', () => setView('setup'), false, false)}
          </div>
        </div>

        {/* ── 에러 배너 ── */}
        {error && view === 'setup' && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '14px 16px',
            backgroundColor: ds.errorBg,
            border: `1px solid ${ds.errorBorder}`,
            borderRadius: '8px',
            color: ds.errorText,
            fontSize: '14px',
            marginBottom: '20px',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0 }}>⚠️</span>
            {error}
          </div>
        )}

        {/* ── Step 1: 데이터 입력 ── */}
        {step === 1 && (
          <section>
            <div style={card}>
              {/* 소스 선택 탭 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                {(['file', 'api'] as const).map((src) => (
                  <button
                    key={src}
                    onClick={() => { setDataSource(src); setRawData([]); setError(''); }}
                    style={{
                      padding: '8px 20px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: `1.5px solid ${dataSource === src ? ds.primary : ds.border}`,
                      borderRadius: '20px',
                      cursor: 'pointer',
                      backgroundColor: dataSource === src ? ds.infoBg : ds.surface,
                      color: dataSource === src ? ds.primary : ds.textMuted,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {src === 'file' ? '📂 CSV/Excel 파일 업로드' : '🔗 API로 불러오기'}
                  </button>
                ))}
              </div>
              {dataSource === 'file' && (
                <div>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '13px', color: ds.textMuted }}>
                      Adobe Analytics 데이터가 아닌 경우, 아래 Excel 템플릿을 내려받아 사용하세요.
                    </div>
                    <a
                      href="/raw-data_template.xlsx"
                      download
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '10px',
                        padding: '9px 14px',
                        fontSize: '13px',
                        fontWeight: 700,
                        borderRadius: '10px',
                        border: `1.5px solid ${ds.border}`,
                        backgroundColor: ds.surface,
                        color: ds.textPrimary,
                        textDecoration: 'none',
                      }}
                    >
                      📗 Excel 템플릿 다운로드
                    </a>
                  </div>
                  <FileUpload onFileParsed={handleDataLoaded} onError={setError} />
                </div>
              )}
              {dataSource === 'api' && <ApiDataLoader onDataLoaded={handleDataLoaded} onError={setError} />}
            </div>
          </section>
        )}

        {/* ── Step 2: 설정 및 계산 ── */}
        {step === 2 && (
          <section>
            {rawData.length > 0 ? (
              <>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: ds.infoBg,
                  border: `1px solid ${ds.infoBorder}`,
                  borderRadius: '8px',
                  color: ds.infoText,
                  fontSize: '13px',
                  marginBottom: '16px',
                }}>
                  <span>ℹ️</span>
                  <span>파라미터를 설정한 뒤 상단 <strong>계산하기</strong>를 누르세요.</span>
                </div>
                <InputForm params={inputParams} onChange={setInputParams} />
                <DataPreview data={rawData} />
                {targetPages.map((tp, idx) => (
                  <SegmentSelector
                    key={tp.id}
                    labels={segmentLabels}
                    title={`Target Page ${idx + 1}`}
                    actions={idx === 0 ? undefined : (
                      <button
                        onClick={() => {
                          setTargetPages(prev => prev.filter(p => p.id !== tp.id));
                          setActiveTargetPageId((prevActive) => prevActive === tp.id ? (targetPages[0]?.id ?? prevActive) : prevActive);
                        }}
                        style={{
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 800,
                          backgroundColor: '#fee2e2',
                          color: '#991b1b',
                          border: '1px solid #fecaca',
                          borderRadius: '999px',
                          cursor: 'pointer',
                        }}
                      >
                        제거
                      </button>
                    )}
                    selectedVisits={tp.visitsLabel}
                    selectedCartAdd={tp.cartAddLabel}
                    selectedOrder={tp.orderLabel}
                    onVisitsChange={(label) => handleVisitsChange(tp.id, label)}
                    onCartAddChange={(label) => updateTargetPage(tp.id, { cartAddLabel: label })}
                    onOrderChange={(label) => updateTargetPage(tp.id, { orderLabel: label })}
                  />
                ))}

                <div style={{ marginTop: '4px', marginBottom: '12px' }}>
                  <button
                    onClick={() => {
      const next: TargetPageSet = {
                        id: makeId(),
                        visitsLabel: '',
                        cartAddLabel: '',
                        orderLabel: '',
                        siteCodes: [],
                        results: [],
                      };
                      setTargetPages(prev => [...prev, next]);
                    }}
                    style={{
                      padding: '10px 14px',
                      fontSize: '13px',
                      fontWeight: 700,
                      backgroundColor: '#111827',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    + 타겟 페이지 추가
                  </button>
                </div>

                {targetPages.some(tp => tp.siteCodes.length > 0) && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '12px',
                    padding: '8px 14px',
                    backgroundColor: ds.successBg,
                    border: `1px solid ${ds.successBorder}`,
                    borderRadius: '8px',
                    color: ds.successText,
                    fontSize: '13px',
                    fontWeight: 600,
                  }}>
                    ✓ 발견된 Site Code:{' '}
                    <strong>
                      {targetPages.map((tp, idx) => `Target Page ${idx + 1} ${tp.siteCodes.length}개`).join(' · ')}
                    </strong>
                  </div>
                )}
              </>
            ) : (
              <div style={{ ...card, color: ds.textMuted, fontSize: '14px', textAlign: 'center', padding: '48px 24px' }}>
                1단계에서 파일을 업로드하거나 API로 데이터를 불러오세요.
              </div>
            )}
          </section>
        )}

        {/* ── Step 3: 결과 ── */}
        {step === 3 && (
          <section>
            {targetPages.some(tp => tp.results.length > 0) ? (
              <>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div style={{ color: ds.textMuted, fontSize: '13px' }}>
                    결과를 Excel로 내려받을 수 있습니다. (Target Page가 여러 개면 시트로 분리)
                  </div>
                  <button
                    onClick={downloadResultsExcel}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 14px',
                      fontSize: '13px',
                      fontWeight: 800,
                      borderRadius: '10px',
                      border: `1.5px solid ${ds.border}`,
                      backgroundColor: ds.surface,
                      color: ds.textPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    📗 Excel 다운로드
                  </button>
                </div>
                {targetPages.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {targetPages.map((tp, idx) => {
                      const isActive = activeTargetPageId === tp.id;
                      const label = tp.visitsLabel || `Target Page ${idx + 1}`;
                      return (
                        <button
                          key={tp.id}
                          onClick={() => setActiveTargetPageId(tp.id)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '999px',
                            border: `1.5px solid ${isActive ? ds.primary : ds.border}`,
                            backgroundColor: isActive ? ds.infoBg : ds.surface,
                            color: isActive ? ds.primary : ds.textMuted,
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '13px',
                            maxWidth: '520px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={label}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(() => {
                  const active = targetPages.find(tp => tp.id === activeTargetPageId) ?? targetPages[0];
                  const showCart = Boolean(active?.cartAddLabel);
                  const showOrder = Boolean(active?.orderLabel);
                  return (
                    <ResultTable
                      results={active?.results ?? []}
                      showCartMetrics={showCart}
                      showOrderMetrics={showOrder}
                    />
                  );
                })()}
              </>
            ) : (
              <div style={{
                ...card,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 16px',
                backgroundColor: ds.errorBg,
                border: `1px solid ${ds.errorBorder}`,
                color: ds.errorText,
                fontSize: '14px',
              }}>
                <span>⚠️</span>결과가 없습니다. 뒤로 가서 다시 계산해주세요.
              </div>
            )}
          </section>
        )}
          </>
        ) : (
          <MilestoneCalculator />
        )}
      </main>
    </div>
  );
}

export default App;

