import React, { useMemo, useState } from 'react';
import { generateScenario } from '../utils/apiClient';

type Props = {
  cardStyle: React.CSSProperties;
};

export function ScenarioGenerator({ cardStyle }: Props) {
  const [objective, setObjective] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [objectiveEn, setObjectiveEn] = useState<string>('');
  const [hypothesisEn, setHypothesisEn] = useState<string>('');
  const [model, setModel] = useState<string>('');

  const canSubmit = useMemo(() => {
    return Boolean(objective.trim() && hypothesis.trim() && !loading);
  }, [objective, hypothesis, loading]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    outline: 'none',
    fontSize: '14px',
    lineHeight: 1.4,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 800,
    color: '#111827',
    marginBottom: '6px',
  };

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: canSubmit ? '#2563eb' : '#93c5fd',
    color: '#fff',
    fontWeight: 800,
    fontSize: '13px',
    cursor: canSubmit ? 'pointer' : 'not-allowed',
    transition: 'all 0.15s ease',
  };

  const copyBtnStyle: React.CSSProperties = {
    padding: '6px 10px',
    borderRadius: '999px',
    border: '1px solid #e5e7eb',
    backgroundColor: '#fff',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    color: '#111827',
  };

  const onGenerate = async () => {
    setError('');
    setObjectiveEn('');
    setHypothesisEn('');
    setModel('');

    const obj = objective.trim();
    const hyp = hypothesis.trim();
    if (!obj || !hyp) {
      setError('Objective와 Hypothesis를 모두 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      const res = await generateScenario({ objective: obj, hypothesis: hyp });
      setObjectiveEn(String(res.objective_en ?? '').trim());
      setHypothesisEn(String(res.hypothesis_en ?? '').trim());
      setModel(String(res.model ?? '').trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : '시나리오 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>
              Scenario Generator
            </div>
            <div style={{ marginTop: '6px', fontSize: '13px', color: '#6b7280' }}>
              Objective/Hypothesis를 한글로 입력하면, 시나리오 문서용 문장을 영문화 버전으로 생성합니다.
            </div>
          </div>
          <button onClick={onGenerate} disabled={!canSubmit} style={btnStyle}>
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: '14px',
            padding: '12px 14px',
            borderRadius: '10px',
            border: '1px solid #fecaca',
            backgroundColor: '#fef2f2',
            color: '#b91c1c',
            fontSize: '13px',
            fontWeight: 700,
          }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: '18px', display: 'grid', gridTemplateColumns: '1fr', gap: '14px' }}>
          <div>
            <div style={labelStyle}>Objective (1 sentence)</div>
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="예: 상품 상세 페이지의 장바구니 담기 전환율을 높인다."
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Hypothesis (1 sentence)</div>
            <input
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="예: CTA를 단순화하면 사용자가 더 쉽게 장바구니에 담아 전환율이 증가할 것이다."
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {(objectiveEn || hypothesisEn) && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#111827' }}>Output (EN)</div>
            {model ? (
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                model: <strong style={{ color: '#111827' }}>{model}</strong>
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 12px', backgroundColor: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#374151' }}>Objective</div>
                <button onClick={() => copy(objectiveEn)} style={copyBtnStyle}>Copy</button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '14px', color: '#111827', lineHeight: 1.5 }}>
                {objectiveEn || '-'}
              </div>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 12px', backgroundColor: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#374151' }}>Hypothesis</div>
                <button onClick={() => copy(hypothesisEn)} style={copyBtnStyle}>Copy</button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '14px', color: '#111827', lineHeight: 1.5 }}>
                {hypothesisEn || '-'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

