import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, CheckCircle2, ChevronRight, HelpCircle, Check, X, AlertCircle, HelpCircle as QuestionMark } from 'lucide-react';

export default function RoundTwoInvestigator({ challenge, submitted, disabled, onSubmit, loading }) {
  const item = challenge?.content || {};
  const [verdict, setVerdict] = useState('');
  const [explanation, setExplanation] = useState('');
  const [sourceReference, setSourceReference] = useState('');

  useEffect(() => {
    if (submitted?.answer) {
      if (typeof submitted.answer === 'object') {
        setVerdict(submitted.answer.verdict || submitted.answer.classification || '');
        setSourceReference(submitted.answer.source_references || submitted.answer.source || '');
      } else {
        setVerdict(String(submitted.answer));
      }
    }
    if (submitted?.reasoning) {
      setExplanation(submitted.reasoning);
    }
  }, [submitted]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!verdict) return;
    const answerObj = {
      verdict,
      classification: verdict,
      source_reference: sourceReference.trim(),
    };
    const combinedReasoning = sourceReference.trim()
      ? `${explanation.trim()}\n[Source Reference]: ${sourceReference.trim()}`
      : explanation.trim();
    onSubmit(challenge, answerObj, combinedReasoning);
  };

  const isFormValid = Boolean(verdict);

  return (
    <div className="investigation-grid">
      {/* LEFT: CLAIM EVIDENCE CARD */}
      <div className="evidence-dossier-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span className="exhibit-badge" style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
            <Search size={14} /> CLAIM 0{Number(challenge?.sort_order ?? 0) + 1}
          </span>
          <span className="cartridge-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
            Round 2: {challenge?.scoring?.points || 2.5} Points
          </span>
        </div>

        <h2 className="exhibit-title" style={{ fontSize: '20px', marginBottom: '8px' }}>
          {item.title || 'Investigative Claim'}
        </h2>

        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
          {item.question || 'What is the most defensible verdict for this claim?'}
        </p>

        {item.evidence && (
          <div className="evidence-text-box" style={{ background: 'rgba(7, 11, 22, 0.95)', border: '1.5px solid rgba(250, 204, 21, 0.3)', borderRadius: '10px', padding: '20px' }}>
            <span style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 700, display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>
              CLAIM UNDER INVESTIGATION:
            </span>
            <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#e2e8f0' }}>
              {item.evidence}
            </div>
          </div>
        )}

        {item.hints && (
          <div className="arcade-notice notice-info" style={{ marginTop: '16px', fontSize: '13px' }}>
            <HelpCircle size={16} />
            <div>
              <strong>Verification Angle:</strong> {item.hints}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: SIMPLE VERDICT FORM */}
      <div className="submission-area-card" style={{ background: 'var(--bg-card)', border: '2px solid var(--border-arcade)', borderRadius: '14px', padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <span className="card-title-badge" style={{ color: 'var(--amber)', fontSize: '11px' }}>
            FACT-CHECK VERDICT
          </span>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            What is the most defensible verdict?
          </h3>
          <p className="form-hint" style={{ fontSize: '13px' }}>
            Select a verdict. Explanation and source fields are optional.
          </p>
        </div>

        {submitted ? (
          <div className="arcade-notice notice-success" style={{ marginBottom: '18px' }}>
            <CheckCircle2 size={18} />
            <div>
              <strong>Verdict Logged: {verdict}</strong>
              <p style={{ fontSize: '12px', marginTop: '2px' }}>
                Your submission is recorded on the server. You can update your response until the round timer concludes.
              </p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleFormSubmit}>
          {/* 4 SELECTABLE VERDICT OPTIONS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { id: 'True', label: 'True', desc: 'Supported by authentic primary evidence.', color: 'var(--emerald)', border: 'rgba(16, 185, 129, 0.4)' },
              { id: 'False', label: 'False', desc: 'Contradicted by verifiable facts or fabricated.', color: 'var(--rose)', border: 'rgba(244, 63, 94, 0.4)' },
              { id: 'Misleading', label: 'Misleading', desc: 'Contains accurate elements presented out of context.', color: 'var(--amber)', border: 'rgba(250, 204, 21, 0.4)' },
              { id: 'Unverified', label: 'Unverified', desc: 'Insufficient public evidence exists to prove or disprove.', color: 'var(--cyan)', border: 'rgba(0, 240, 255, 0.4)' },
            ].map((opt) => {
              const isSelected = verdict === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  disabled={disabled}
                  onClick={() => setVerdict(opt.id)}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    border: isSelected ? `2px solid ${opt.color}` : '2px solid var(--border-arcade)',
                    background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: isSelected ? opt.color : '#fff', fontWeight: 800, fontSize: '15px' }}>
                      {opt.label}
                    </span>
                    {isSelected && <Check size={16} color={opt.color} />}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px', lineHeight: '1.3' }}>
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* OPTIONAL BRIEF EXPLANATION */}
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Brief Explanation (Optional)</span>
              <span className="form-hint" style={{ margin: 0 }}>Optional</span>
            </label>
            <textarea
              className="prompt-textarea"
              rows={2}
              placeholder="Optional: Briefly state why this verdict is justified by the evidence..."
              value={explanation}
              disabled={disabled}
              onChange={(e) => setExplanation(e.target.value)}
              maxLength={1000}
              style={{ fontSize: '13px', lineHeight: '1.5' }}
            />
          </div>

          {/* OPTIONAL SOURCE / EVIDENCE REFERENCE */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Supporting Source / Evidence Reference (Optional)</span>
              <span className="form-hint" style={{ margin: 0 }}>Optional</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Optional: Link, registry name, or document reference (e.g. ENTSO-E, NASA archives)..."
              value={sourceReference}
              disabled={disabled}
              onChange={(e) => setSourceReference(e.target.value)}
              maxLength={500}
              style={{ fontSize: '13px' }}
            />
          </div>

          <button
            type="submit"
            className="arcade-btn-primary arcade-btn-amber full"
            style={{ width: '100%', padding: '14px 20px', fontSize: '15px' }}
            disabled={disabled || loading || !isFormValid}
          >
            {loading ? 'Submitting to Registry…' : submitted ? 'Update Verdict' : 'Submit Verdict'} <ChevronRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
