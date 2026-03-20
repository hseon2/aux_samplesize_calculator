import React, { useMemo, useState } from 'react';

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
            zIndex: 30,
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
  const [reviewOpinion, setReviewOpinion] = useState<string>('');
  const [cartSampleDays, setCartSampleDays] = useState<string>('');
  const [orderSampleDays, setOrderSampleDays] = useState<string>('');
  const [copyMessage, setCopyMessage] = useState<string>('');

  const parsedLiveDate = useMemo(() => {
    if (!liveDate) return null;
    const date = new Date(liveDate);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }, [liveDate]);

  const qaDeliveryDate = useMemo(() => {
    if (!parsedLiveDate) return null;
    return addDays(parsedLiveDate, -3);
  }, [parsedLiveDate]);

  const frdAssetDueDate = useMemo(() => {
    if (!qaDeliveryDate || devDays < 0) return null;
    return addDays(qaDeliveryDate, -devDays);
  }, [qaDeliveryDate, devDays]);

  const hasValidInput = Boolean(parsedLiveDate && devDays >= 0);

  const displayLiveDate = parsedLiveDate ? toDisplay(parsedLiveDate) : '-';
  const displayQaDate = qaDeliveryDate ? toDisplay(qaDeliveryDate) : '-';
  const displayFrdDate = frdAssetDueDate ? toDisplay(frdAssetDueDate) : '-';
  const displayDevDays = Number.isFinite(devDays) && devDays >= 0 ? `${devDays}일` : '-';

  const mailTemplate = useMemo(() => {
    const reviewText = reviewOpinion.trim() || '(직접 입력 필요)';
    const cartText = cartSampleDays.trim() || '-';
    const orderText = orderSampleDays.trim() || '-';
    return [
      '[ 개발 검토 의견 및 일정 ]',
      `- 개발 검토 기준: ${reviewText}`,
      `- 개발 소요 기간: ${displayDevDays}`,
      `- FRD/Asset 수급 일자: ${displayFrdDate}`,
      `- QA 링크 전달 일자: ${displayQaDate}`,
      `- Live 일자: ${displayLiveDate}`,
      '',
      '[ 테스트 모수 확보 기간 예상 ]',
      `- Cart 기준 모수 확보: ${cartText}`,
      `- Order 기준 모수 확보: ${orderText}`,
    ].join('\n');
  }, [
    reviewOpinion,
    cartSampleDays,
    orderSampleDays,
    displayDevDays,
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

  return (
    <section style={{ width: '100%' }}>
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          padding: '16px 18px',
          marginBottom: '12px',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '20px', color: '#111827' }}>Milestone Calculator</h2>
        <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '13px' }}>
          Live Date와 개발 소요 기간을 입력하면 QA 링크 전달 일자와 FRD/Asset 수급 완료 일자를 자동 계산합니다.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(420px, 0.7fr) minmax(760px, 1.3fr)',
          gap: '12px',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                padding: '16px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', color: '#111827' }}>입력값</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
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
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
                </div>
                <div>
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
                      height: '36px',
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
                    placeholder="예: 영향도 낮음, FE 1명"
                    style={{
                      width: '100%',
                      minHeight: '78px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '8px 10px',
                      fontSize: '13px',
                      resize: 'vertical',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginTop: '12px' }}>
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
                      height: '36px',
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
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      padding: '0 10px',
                      fontSize: '13px',
                    }}
                  />
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
          }}
        >
          <div style={{ marginBottom: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e293b', color: '#f1f5f9' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '12px' }}>Milestone</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: '12px' }}>일자</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 10px', borderTop: '1px solid #e5e7eb', fontWeight: 600, fontSize: '13px' }}>
                    Live Date
                    <InfoTooltip text="입력한 Live 일자" />
                  </td>
                  <td style={{ padding: '8px 10px', borderTop: '1px solid #e5e7eb', fontSize: '13px' }}>
                    {parsedLiveDate ? toDisplay(parsedLiveDate) : '-'}
                  </td>
                </tr>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td style={{ padding: '8px 10px', borderTop: '1px solid #e5e7eb', fontWeight: 600, fontSize: '13px' }}>
                    QA 링크 전달 일자
                    <InfoTooltip text="Live Date 기준 3일 전" />
                  </td>
                  <td style={{ padding: '8px 10px', borderTop: '1px solid #e5e7eb', fontSize: '13px' }}>
                    {qaDeliveryDate ? toDisplay(qaDeliveryDate) : '-'}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', borderTop: '1px solid #e5e7eb', fontWeight: 600, fontSize: '13px' }}>
                    FRD/Asset 수급 완료 일자
                    <InfoTooltip text="QA 링크 전달 일자에서 개발 소요 기간(일) 역산" />
                  </td>
                  <td style={{ padding: '8px 10px', borderTop: '1px solid #e5e7eb', fontSize: '13px' }}>
                    {frdAssetDueDate ? toDisplay(frdAssetDueDate) : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
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
              height: 'calc(100vh - 470px)',
              minHeight: '170px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              padding: '12px',
              fontSize: '13px',
              lineHeight: 1.5,
              fontFamily: 'var(--font-mono)',
              backgroundColor: '#f8fafc',
              color: '#111827',
            }}
          />
          {copyMessage && (
            <p style={{ marginTop: '8px', marginBottom: 0, fontSize: '12px', color: '#1d4ed8' }}>
              {copyMessage}
            </p>
          )}
          {!hasValidInput && (
            <p style={{ marginTop: '8px', marginBottom: 0, color: '#b91c1c', fontSize: '12px' }}>
              Live Date와 0 이상의 개발 소요 기간(일)을 입력하면 자동으로 계산됩니다.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

