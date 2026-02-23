import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
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
  const [parsedData, setParsedData] = useState<ReturnType<typeof parseData>>([]);
  const [results, setResults] = useState<TestDurationResult[]>([]);
  const [error, setError] = useState<string>('');
  const [view, setView] = useState<'setup' | 'result'>('setup');
  
  const [inputParams, setInputParams] = useState<InputParams>({
    rangeDays: 30,
    startDate: '',
    endDate: '',
    numberOfOffers: 2,
    confidenceLevel: 0.95,
    statisticalPower: 0.80
  });

  const handleFileParsed = (data: RawDataRow[]) => {
    setRawData(data);
    setError('');
    setView('setup');
    const labels = extractSegmentLabels(data);
    setSegmentLabels(labels);
    
    // 자동으로 첫 번째 라벨 선택 시도
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

  return (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ textAlign: 'center', color: '#333', marginBottom: '30px' }}>
        AB Test Sample Size Calculator
      </h1>

      {error && view === 'setup' && (
        <div style={{
          padding: '15px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c33',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {view === 'setup' && (
        <>
          <FileUpload onFileParsed={handleFileParsed} onError={setError} />

          {rawData.length > 0 && (
            <>
              <DataPreview data={rawData} />
              
              <InputForm params={inputParams} onChange={setInputParams} />
              
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
                  marginBottom: '20px',
                  padding: '15px',
                  backgroundColor: '#e8f4f8',
                  borderRadius: '4px'
                }}>
                  <strong>발견된 Site Code 수: {siteCodes.length}개</strong>
                </div>
              )}

              <button
                onClick={handleCalculate}
                disabled={!canCalculate}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  backgroundColor: canCalculate ? '#4a90e2' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: canCalculate ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  marginBottom: '20px'
                }}
              >
                계산하기
              </button>
            </>
          )}
        </>
      )}

      {view === 'result' && (
        <>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
            <button
              onClick={() => setView('setup')}
              style={{
                padding: '10px 14px',
                fontSize: '14px',
                backgroundColor: '#111827',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              ← 뒤로가기
            </button>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              산출 완료된 결과만 표시됩니다.
            </div>
          </div>

          {results.length > 0 ? (
            <ResultTable results={results} />
          ) : (
            <div style={{
              padding: '15px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c33',
              marginBottom: '20px'
            }}>
              결과가 없습니다. 뒤로가서 다시 계산해주세요.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;

