import React, { useEffect, useMemo, useRef, useState } from 'react';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDateInputValue = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (baseDate: Date, days: number): Date => {
  const next = new Date(baseDate.getTime() + days * MS_PER_DAY);
  return new Date(next.getFullYear(), next.getMonth(), next.getDate());
};

const toDisplay = (date: Date): string => {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${toDateInputValue(date)} (${weekdays[date.getDay()]})`;
};

const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '15px',
          height: '15px',
          marginLeft: '6px',
          borderRadius: '999px',
          border: '1px solid #94a3b8',
          color: '#64748b',
          fontSize: '10px',
          fontWeight: 700,
          cursor: 'help',
          verticalAlign: 'middle',
          backgroundColor: '#ffffff',
        }}
      >
        i
      </span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            left: '24px',
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            fontSize: '11px',
            lineHeight: 1.35,
            padding: '6px 8px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 18px rgba(15, 23, 42, 0.35)',
            // Milestone 박스의 overflow/stacking context로 인해 잘리지 않게 최상단으로 표시
            zIndex: 9999,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
};

export const MilestoneCalculator: React.FC = () => {
  const [liveDate, setLiveDate] = useState<string>('');
  const [devDays, setDevDays] = useState<number>(10);
  // Optional: 미입력 시에는 단일 국가 기준(기존 devDays 입력) 모드로 동작
  const [targetCountriesInput, setTargetCountriesInput] = useState<string>('');
  const [oneCountryWorkDays, setOneCountryWorkDays] = useState<number>(10);
  const [extraCountrySpreadDays, setExtraCountrySpreadDays] = useState<number>(0);
  // Optional: 미입력(또는 비정상 입력) 시 기간 촉박 기준 2일로 산정
  const [qaDurationDaysInput, setQaDurationDaysInput] = useState<string>('');
  const [reviewOpinion, setReviewOpinion] = useState<string>('');
  const [scenarioTestNeed, setScenarioTestNeed] = useState<string>('');
  const [developmentNeed, setDevelopmentNeed] = useState<string>('');
  const [analysisNeed, setAnalysisNeed] = useState<string>('');
  const [cartSampleDays, setCartSampleDays] = useState<string>('');
  const [orderSampleDays, setOrderSampleDays] = useState<string>('');
  const [copyMessage, setCopyMessage] = useState<string>('');
  /** 왼쪽 입력 카드 아코디언 (한 번에 하나 펼침, 같은 헤더 재클릭 시 접힘) */
  const [leftAccOpen, setLeftAccOpen] = useState<'schedule' | 'extra' | null>('schedule');
  const toggleLeftAcc = (k: 'schedule' | 'extra') => {
    setLeftAccOpen((prev) => (prev === k ? null : k));
  };

  const prevHasTargetRef = useRef<boolean>(false);

  const parsedLiveDate = useMemo(() => {
    if (!liveDate) return null;
    const date = new Date(liveDate);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }, [liveDate]);

  const qaDeliveryDate = useMemo(() => {
    if (!parsedLiveDate) return null;
    const trimmed = qaDurationDaysInput.trim();
    const parsed = trimmed ? Number(trimmed) : 2;
    const qaDays = Number.isFinite(parsed) && parsed >= 0 ? parsed : 2;
    return addDays(parsedLiveDate, -qaDays);
  }, [parsedLiveDate, qaDurationDaysInput]);

  const targetCountries = useMemo((): number => {
    const n = Number(targetCountriesInput);
    return Number.isFinite(n) ? n : 0;
  }, [targetCountriesInput]);

  const hasTargetCountries = Number.isFinite(targetCountries) && targetCountries >= 1;

  useEffect(() => {
    // targetCountries가 1 이상으로 "처음" 바뀌는 순간,
    // 기존에 입력하던 devDays를 1개 국가 작업 값으로 동기화해 사용자 기대값과 불일치가 없게 한다.
    if (!prevHasTargetRef.current && hasTargetCountries) {
      setOneCountryWorkDays(devDays);
      setExtraCountrySpreadDays(0);
    }
    prevHasTargetRef.current = hasTargetCountries;
  }, [devDays, hasTargetCountries]);

  const effectiveDevDays = useMemo((): number | null => {
    // 기존 입력 방식(개발 소요 기간)을 유지하되,
    // 대상 국가 수가 1개 이상이면 "총 개발 소요 기간"을 자동 계산한다.
    if (!hasTargetCountries) return devDays;
    if (!Number.isFinite(oneCountryWorkDays) || !Number.isFinite(extraCountrySpreadDays)) return null;
    return oneCountryWorkDays + extraCountrySpreadDays * (targetCountries - 1);
  }, [hasTargetCountries, devDays, oneCountryWorkDays, extraCountrySpreadDays, targetCountries]);

  const frdAssetDueDate = useMemo(() => {
    if (!qaDeliveryDate || effectiveDevDays === null || effectiveDevDays < 0) return null;
    return addDays(qaDeliveryDate, -effectiveDevDays);
  }, [qaDeliveryDate, effectiveDevDays]);

  const displayLiveDate = parsedLiveDate ? toDisplay(parsedLiveDate) : '-';
  const displayQaDate = qaDeliveryDate ? toDisplay(qaDeliveryDate) : '-';
  const displayFrdDate = frdAssetDueDate ? toDisplay(frdAssetDueDate) : '-';
  const displayDevDays = effectiveDevDays !== null && Number.isFinite(effectiveDevDays) && effectiveDevDays >= 0 ? `${effectiveDevDays}일` : '-';

  const effectiveQaDurationDays = useMemo((): number => {
    const trimmed = qaDurationDaysInput.trim();
    const parsed = trimmed ? Number(trimmed) : 2;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 2;
  }, [qaDurationDaysInput]);

  const mailTemplate = useMemo(() => {
    const scenarioText = scenarioTestNeed.trim() || '-';
    const developmentText = developmentNeed.trim() || '-';
    const analysisText = analysisNeed.trim() || '-';

    const scenarioTargetCountryText = hasTargetCountries ? `${targetCountries}개국` : '1개국';

    // 현재 UI에서 대상 페이지/Traffic/KPI는 입력 필드가 없어서 템플릿용 placeholder로 둡니다.
    const scenarioPageText = '(대상 페이지 입력 필요)';
    const trafficText = '(Traffic 입력 필요)';
    const kpiText = '(KPI 입력 필요)';

    const atcSampleDays = cartSampleDays.trim() || '20';

    // 테스트 일정은 "QA 링크 전달 ~ Live" 범위로 표시
    const testScheduleText = displayQaDate !== '-' && displayLiveDate !== '-' ? `${displayQaDate} ~ ${displayLiveDate}` : '-';

    return [
      '[ 시나리오 ]',
      `- 대상 국가 : ${scenarioTargetCountryText}`,
      `- 대상 페이지 : ${scenarioPageText}`,
      `- Traffic : ${trafficText}`,
      `- KPI : ${kpiText}`,
      '',
      `- 테스트 일정 : ${testScheduleText}`,
      `- Live 일자 : ${displayLiveDate}`,
      `- 모수 확보 (ATC CVR 기준) : ${atcSampleDays} 일`,
      '',
      '[ 개발 기간 및 주요 일정 ]',
      `- 개발 소요 기간: ${displayDevDays}`,
      `- FRD/Asset 수급 일자: ${displayFrdDate}`,
      `- QA 링크 전달 일자: ${displayQaDate}`,
      `- Live 일자: ${displayLiveDate}`,
      '',
      '[추가 확인 필요 사항]',
      `- 시나리오/테스트: ${scenarioText}`,
      `- 개발: ${developmentText}`,
      `- 분석: ${analysisText}`,
    ].join('\n');
  }, [
    hasTargetCountries,
    targetCountries,
    scenarioTestNeed,
    developmentNeed,
    analysisNeed,
    cartSampleDays,
    displayDevDays,
    effectiveQaDurationDays,
    displayFrdDate,
    displayQaDate,
    displayLiveDate,
  ]);

  const handleCopyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(mailTemplate);
      setCopyMessage('메일 템플릿이 복사되었습니다.');
    } catch {
      setCopyMessage('복사에 실패했습니다. 템플릿을 직접 선택해 복사해주세요.');
    }
  };

  const milestoneSteps = [
    {
      id: 1,
      label: 'FRD/Asset 수급 완료',
      date: frdAssetDueDate ? toDisplay(frdAssetDueDate) : '-',
      tooltip: 'QA 링크 전달 일자에서 개발 소요 기간(일) 역산',
      done: Boolean(frdAssetDueDate),
    },
    {
      id: 2,
      label: 'QA 링크 전달',
      date: qaDeliveryDate ? toDisplay(qaDeliveryDate) : '-',
      tooltip: `Live Date 기준 QA 소요 기간(일) 전 (${effectiveQaDurationDays}일)`,
      done: Boolean(qaDeliveryDate),
    },
    {
      id: 3,
      label: 'Live Date',
      date: parsedLiveDate ? toDisplay(parsedLiveDate) : '-',
      tooltip: '입력한 Live 일자',
      done: Boolean(parsedLiveDate),
    },
  ];

  return (
    <section
      style={{
        width: '100%',
        // App의 header + main padding을 감안해서 화면에 맞게 고정 높이로 수렴
        height: 'calc(100vh - 140px)',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(420px, 0.7fr) minmax(760px, 1.3fr)',
          gap: '12px',
          alignItems: 'stretch',
          // section 높이에 맞춰 수렴
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
          <div>
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                padding: '16px',
                // 필드가 많아도 레이아웃을 밀지 않고, 카드 내부에서 스크롤 처리
                height: '100%',
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', color: '#111827' }}>입력값</h3>
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 일정·개발 */}
                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={leftAccOpen === 'schedule'}
                    onClick={() => toggleLeftAcc('schedule')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 12px',
                      border: 'none',
                      backgroundColor: leftAccOpen === 'schedule' ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#111827',
                      textAlign: 'left',
                    }}
                  >
                    <span>일정·개발</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }} aria-hidden>
                      {leftAccOpen === 'schedule' ? '▼' : '▶'}
                    </span>
                  </button>
                  {leftAccOpen === 'schedule' && (
                    <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label
                    htmlFor="live-date"
                    style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                  >
                    Live Date
                  </label>
                  <input
                    id="live-date"
                    type="date"
                    value={liveDate}
                    onChange={(e) => setLiveDate(e.target.value)}
                    style={{
                      width: '100%',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="target-countries"
                    style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                  >
                    대상 국가 수 (Optional)
                  </label>
                  <input
                    id="target-countries"
                    type="number"
                    min={0}
                    step={1}
                    value={targetCountriesInput}
                    placeholder="미입력 시 단일 국가 기준"
                    onChange={(e) => setTargetCountriesInput(e.target.value)}
                    style={{
                      width: '100%',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
                </div>
                {hasTargetCountries ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label
                          htmlFor="one-country-work-days"
                          style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                        >
                          1개 국가 작업 (일)
                        </label>
                        <input
                          id="one-country-work-days"
                          type="number"
                          min={0}
                          step={1}
                          value={Number.isNaN(oneCountryWorkDays) ? '' : oneCountryWorkDays}
                          onChange={(e) => setOneCountryWorkDays(Number(e.target.value))}
                          style={{
                            width: '100%',
                            height: '32px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            padding: '0 10px',
                            fontSize: '13px',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="extra-country-spread-days"
                          style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                        >
                          추가 국가당 확산 (일)
                        </label>
                        <input
                          id="extra-country-spread-days"
                          type="number"
                          min={0}
                          step={1}
                          value={Number.isNaN(extraCountrySpreadDays) ? '' : extraCountrySpreadDays}
                          onChange={(e) => setExtraCountrySpreadDays(Number(e.target.value))}
                          style={{
                            width: '100%',
                            height: '32px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            padding: '0 10px',
                            fontSize: '13px',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="total-dev-days"
                          style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                        >
                          총 개발 소요 기간 (일)
                        </label>
                        <div
                          id="total-dev-days"
                          style={{
                            width: '100%',
                            minHeight: '32px',
                            borderRadius: '8px',
                            border: '1px solid #d1d5db',
                            padding: '8px 10px',
                            fontSize: '13px',
                            fontWeight: 800,
                            backgroundColor: '#f8fafc',
                            color: '#111827',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {displayDevDays}
                        </div>
                        <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#6b7280', lineHeight: 1.4 }}>
                          자동 계산: {oneCountryWorkDays} + {extraCountrySpreadDays} x ({targetCountries} - 1)
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label
                      htmlFor="dev-days"
                      style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                    >
                      개발 소요 기간 (일)
                    </label>
                    <input
                      id="dev-days"
                      type="number"
                      min={0}
                      step={1}
                      value={Number.isNaN(devDays) ? '' : devDays}
                      onChange={(e) => setDevDays(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: '32px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        padding: '0 10px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginTop: '12px' }}>
                <div>
                  <label
                    htmlFor="qa-duration-days"
                    style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                  >
                    QA 소요 기간 (일) <span style={{ fontWeight: 700, color: '#6b7280' }}>(Optional)</span>
                  </label>
                  <input
                    id="qa-duration-days"
                    type="number"
                    min={0}
                    step={1}
                    value={qaDurationDaysInput}
                    onChange={(e) => setQaDurationDaysInput(e.target.value)}
                    placeholder="미입력 시 2일(기간 촉박 기준)"
                    style={{
                      width: '100%',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <div>
                  <label
                    htmlFor="review-opinion"
                    style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                  >
                    개발 검토 기준
                  </label>
                  <textarea
                    id="review-opinion"
                    value={reviewOpinion}
                    onChange={(e) => setReviewOpinion(e.target.value)}
                    placeholder="개발 검토 기준 입력"
                    style={{
                      width: '100%',
                      minHeight: '5px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '8px 10px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                <div>
                  <label
                    htmlFor="cart-sample-days"
                    style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                  >
                    Cart 모수 확보
                  </label>
                  <input
                    id="cart-sample-days"
                    type="text"
                    value={cartSampleDays}
                    onChange={(e) => setCartSampleDays(e.target.value)}
                    placeholder="예: 21일"
                    style={{
                      width: '100%',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="order-sample-days"
                    style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: '#374151' }}
                  >
                    Order 모수 확보
                  </label>
                  <input
                    id="order-sample-days"
                    type="text"
                    value={orderSampleDays}
                    onChange={(e) => setOrderSampleDays(e.target.value)}
                    placeholder="예: 34일"
                    style={{
                      width: '100%',
                      height: '32px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
                </div>
              </div>
                    </div>
                  )}
                </div>

                {/* 추가 확인 */}
                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={leftAccOpen === 'extra'}
                    onClick={() => toggleLeftAcc('extra')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 12px',
                      border: 'none',
                      backgroundColor: leftAccOpen === 'extra' ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#111827',
                      textAlign: 'left',
                    }}
                  >
                    <span>추가 확인</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }} aria-hidden>
                      {leftAccOpen === 'extra' ? '▼' : '▶'}
                    </span>
                  </button>
                  {leftAccOpen === 'extra' && (
                    <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', alignItems: 'start' }}>
                          <label
                            htmlFor="scenario-test-need"
                            style={{ display: 'block', marginBottom: 0, fontSize: '12px', fontWeight: 600, color: '#374151', paddingTop: '8px' }}
                          >
                            시나리오/테스트
                          </label>
                          <textarea
                            id="scenario-test-need"
                            value={scenarioTestNeed}
                            onChange={(e) => setScenarioTestNeed(e.target.value)}
                            placeholder="예: 체크리스트/검증 항목"
                            style={{
                              width: '100%',
                              minHeight: '24px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              padding: '8px 10px',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              resize: 'vertical',
                            }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', alignItems: 'start' }}>
                          <label
                            htmlFor="development-need"
                            style={{ display: 'block', marginBottom: 0, fontSize: '12px', fontWeight: 600, color: '#374151', paddingTop: '8px' }}
                          >
                            개발
                          </label>
                          <textarea
                            id="development-need"
                            value={developmentNeed}
                            onChange={(e) => setDevelopmentNeed(e.target.value)}
                            placeholder="예: 개발 이슈/주의사항"
                            style={{
                              width: '100%',
                              minHeight: '24px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              padding: '8px 10px',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              resize: 'vertical',
                            }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px', alignItems: 'start' }}>
                          <label
                            htmlFor="analysis-need"
                            style={{ display: 'block', marginBottom: 0, fontSize: '12px', fontWeight: 600, color: '#374151', paddingTop: '8px' }}
                          >
                            분석
                          </label>
                          <textarea
                            id="analysis-need"
                            value={analysisNeed}
                            onChange={(e) => setAnalysisNeed(e.target.value)}
                            placeholder="예: 지표/분석 방법"
                            style={{
                              width: '100%',
                              minHeight: '24px',
                              borderRadius: '8px',
                              border: '1px solid #d1d5db',
                              padding: '8px 10px',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              resize: 'vertical',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignSelf: 'start',
            minHeight: 0,
          }}
        >
          <div style={{ marginBottom: '12px', border: 'none', borderRadius: '10px', overflow: 'visible' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#111827' }}>일정 자동 계산</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'stretch', gap: '14px' }}>
                {milestoneSteps.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        borderRadius: '8px',
                        backgroundColor: '#ffffff',
                        padding: '10px 12px',
                        minHeight: '64px',
                        border: '1px solid #d1d5db',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: step.done ? '#dbeafe' : '#e5e7eb',
                          color: step.done ? '#1d4ed8' : '#6b7280',
                          fontSize: '13px',
                          fontWeight: 700,
                          lineHeight: 1,
                          flexShrink: 0,
                          position: 'absolute',
                          left: '20px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                        }}
                      >
                        {step.id}
                      </span>
                      <div style={{ width: '100%', textAlign: 'center', paddingLeft: '22px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', textAlign: 'center' }}>
                          {step.label}
                          <InfoTooltip text={step.tooltip} />
                        </div>
                        <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 700, color: '#1f2937', textAlign: 'center' }}>
                          {step.date}
                        </div>
                      </div>
                    </div>
                    {index < milestoneSteps.length - 1 && (
                      <span style={{ color: '#94a3b8', fontSize: '22px', margin: '0 2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        ›
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#111827' }}>메일 전송용 템플릿</h3>
            <button
              onClick={handleCopyTemplate}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: '#111827',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              템플릿 복사
            </button>
          </div>
          <textarea
            value={mailTemplate}
            readOnly
            style={{
              width: '100%',
              // 화면 전체를 채우지 않도록 고정 높이로 제한
              height: '452px',
              minHeight: '300px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              padding: '12px',
              fontSize: '13px',
              lineHeight: 1.5,
              fontFamily: 'var(--font-mono)',
              backgroundColor: '#f8fafc',
              color: '#111827',
              overflowY: 'auto',
              resize: 'none',
            }}
          />
          {copyMessage && (
            <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#1d4ed8' }}>
              {copyMessage}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

