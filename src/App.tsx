import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { ApiDataLoader } from './components/ApiDataLoader';
import { DataPreview } from './components/DataPreview';
import { InputForm, InputParams } from './components/InputForm';
import { SegmentSelector } from './components/SegmentSelector';
import { ResultTable } from './components/ResultTable';
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

function App() {
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [segmentLabels, setSegmentLabels] = useState<ReturnType<typeof extractSegmentLabels>>([]);
  const [selectedVisits, setSelectedVisits] = useState<string>('');
  const [selectedCartAdd, setSelectedCartAdd] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [siteCodes, setSiteCodes] = useState<string[]>([]);
  const [, setParsedData] = useState<ReturnType<typeof parseData>>([]);
  const [results, setResults] = useState<TestDurationResult[]>([]);
  const [error, setError] = useState<string>('');
  const [view, setView] = useState<'setup' | 'result'>('setup');
  const [dataSource, setDataSource] = useState<'file' | 'api'>('file');

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
    
    const visitsLabel = labels.find(l => l.type === 'visits');
    const cartAddLabel = labels.find(l => l.type === 'cartAdd');
    const orderLabel = labels.find(l => l.type === 'order');
    
    if (visitsLabel) {
      setSelectedVisits(visitsLabel.label);
      const codes = extractSiteCodes(data, visitsLabel.label);
      setSiteCodes(codes);
    }
    if (cartAddLabel) setSelectedCartAdd(cartAddLabel.label);
    if (orderLabel) setSelectedOrder(orderLabel.label);
  };

  const handleVisitsChange = (label: string) => {
    setSelectedVisits(label);
    if (label && rawData.length > 0) {
      const codes = extractSiteCodes(rawData, label);
      setSiteCodes(codes);
    }
  };

  const handleCalculate = () => {
    if (!selectedVisits || !selectedCartAdd || !selectedOrder) {
      setError('모든 세그먼트 라벨을 선택해주세요.');
      return;
    }

    const hasRangeDays = inputParams.rangeDays > 0;
    const hasDates = Boolean(inputParams.startDate && inputParams.endDate);
    if (!hasRangeDays && !hasDates) {
      setError('Data range(일수) 또는 시작일/종료일을 입력해주세요.');
      return;
    }

    if (siteCodes.length === 0) {
      setError('Site Code를 찾을 수 없습니다.');
      return;
    }

    try {
      // 데이터 파싱
      const parsed = parseData(
        rawData,
        selectedVisits,
        selectedCartAdd,
        selectedOrder,
        siteCodes
      );
      setParsedData(parsed);

      // 계산 수행
      const calcParams: CalculationParams = {
        rangeDays: hasRangeDays ? inputParams.rangeDays : undefined,
        startDate: hasDates ? new Date(inputParams.startDate) : undefined,
        endDate: hasDates ? new Date(inputParams.endDate) : undefined,
        numberOfOffers: inputParams.numberOfOffers,
        confidenceLevel: inputParams.confidenceLevel,
        statisticalPower: inputParams.statisticalPower
      };

      const calculatedResults = calculateAll(parsed, calcParams);
      if (calculatedResults.length === 0) {
        setError('Data range(일수) 또는 날짜 입력이 올바르지 않아 계산할 수 없습니다.');
        return;
      }
      // Daily Visits 내림차순(많은 순) 정렬
      const sorted = [...calculatedResults].sort((a, b) => b.dailyVisits - a.dailyVisits);
      setResults(sorted);
      setError('');
      setView('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : '계산 중 오류가 발생했습니다.');
    }
  };

  const canCalculate =
    selectedVisits &&
    selectedCartAdd &&
    selectedOrder &&
    (inputParams.rangeDays > 0 || (inputParams.startDate && inputParams.endDate)) &&
    siteCodes.length > 0;

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
          <span style={{ fontSize: '18px' }}>🧪</span>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#f9fafb',
            letterSpacing: '-0.02em',
          }}>
            AB Test Sample Size Calculator
          </span>
        </div>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

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
              {dataSource === 'file' && <FileUpload onFileParsed={handleDataLoaded} onError={setError} />}
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
                <SegmentSelector
                  labels={segmentLabels}
                  selectedVisits={selectedVisits}
                  selectedCartAdd={selectedCartAdd}
                  selectedOrder={selectedOrder}
                  onVisitsChange={handleVisitsChange}
                  onCartAddChange={setSelectedCartAdd}
                  onOrderChange={setSelectedOrder}
                />
                {siteCodes.length > 0 && (
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
                    ✓ 발견된 Site Code: <strong>{siteCodes.length}개</strong>
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
            {results.length > 0 ? (
              <ResultTable results={results} />
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
      </main>
    </div>
  );
}

export default App;

