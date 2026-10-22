import React, { useState, useEffect } from 'react';
import { Copy, Check, Sparkles, CheckCircle2, ChevronRight, HelpCircle, User, Bot, HelpCircle as QuestionMark } from 'lucide-react';

export default function RoundOneInvestigator({ challenge, submitted, disabled, onSubmit, loading }) {
  const item = challenge?.content || {};
  const [classification, setClassification] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (submitted?.answer) {
      if (typeof submitted.answer === 'object') {
        setClassification(submitted.answer.classification || submitted.answer.verdict || '');
      } else {
        setClassification(String(submitted.answer));
      }
    }
    if (submitted?.reasoning) {
      setReasoning(submitted.reasoning);
    }
  }, [submitted]);

  const copyExhibit = () => {
    if (!item.evidence) return;
    navigator.clipboard.writeText(item.evidence);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!classification) return;
    const answerObj = {
      classification,
      verdict: classification,
    };
    onSubmit(challenge, answerObj, reasoning.trim());
  };

  const isFormValid = Boolean(classification);

  return (
    <div className="investigation-grid">
      {/* LEFT: EXHIBIT CARD */}
      <div className="evidence-dossier-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span className="exhibit-badge" style={{ borderColor: 'var(--violet-bright)', color: 'var(--violet-bright)' }}>
            <Sparkles size={14} /> EXHIBIT 0{Number(challenge?.sort_order ?? 0) + 1}
          </span>
          <span className="cartridge-badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
            Round 1: 2 Points
          </span>
        </div>

        <h2 className="exhibit-title" style={{ fontSize: '20px', marginBottom: '8px' }}>
          {item.title || 'Text Specimen'}
        </h2>

        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
          Analyze this text using your LLM to examine sentence structure, perplexity, and stylistic markers.
        </p>

        {item.evidence && (
          <div className="evidence-text-box" style={{ background: 'rgba(7, 11, 22, 0.95)', border: '1.5px solid var(--border-arcade)', borderRadius: '10px', padding: '20px' }}>
            <button
              type="button"
              className="copy-snippet-btn"
              onClick={copyExhibit}
              title="Copy text snippet to paste into your LLM"
            >
              {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copied ? 'Copied to Clipboard!' : 'Copy for LLM'}
            </button>
            <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#e2e8f0', fontFamily: 'inherit' }}>
              {item.evidence}
            </div>
          </div>
        )}

        {item.hints && (
          <div className="arcade-notice notice-info" style={{ marginTop: '16px', fontSize: '13px' }}>
            <HelpCircle size={16} />
            <div>
              <strong>Forensic Guidance:</strong> {item.hints}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: SIMPLE CLASSIFICATION FORM */}
      <div className="submission-area-card" style={{ background: 'var(--bg-card)', border: '2px solid var(--border-arcade)', borderRadius: '14px', padding: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <span className="card-title-badge" style={{ color: 'var(--cyan)', fontSize: '11px' }}>
            OFFICIAL CLASSIFICATION
          </span>
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
            Who most likely wrote this text?
          </h3>
          <p className="form-hint" style={{ fontSize: '13px' }}>
            Select your verdict. Reasoning is optional.
          </p>
        </div>

        {submitted ? (
          <div className="arcade-notice notice-success" style={{ marginBottom: '18px' }}>
            <CheckCircle2 size={18} />
            <div>
              <strong>Classification Logged: {classification}</strong>
              <p style={{ fontSize: '12px', marginTop: '2px' }}>
                Your submission is recorded on the server. You can adjust your answer until the round concludes.
              </p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleFormSubmit}>
          {/* 3 CLEAN SELECTABLE OPTIONS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {[
              { id: 'Human-written', label: 'Human-written', desc: 'Authored by a human writer with natural idiosyncrasies or domain experience.', icon: User },
              { id: 'AI-generated', label: 'AI-generated', desc: 'Synthesized by a large language model with typical cadence or clichéd transitions.', icon: Bot },
              { id: 'Insufficient evidence', label: 'Insufficient evidence', desc: 'Too brief, formulaic, or ambiguous to make a reliable authorship determination.', icon: QuestionMark },
            ].map((opt) => {
              const isSelected = classification === opt.id;
              const IconComp = opt.icon;
              return (
                <button
                  type="button"
                  key={opt.id}
                  disabled={disabled}
                  onClick={() => setClassification(opt.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--cyan)' : '2px solid var(--border-arcade)',
                    background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? 'var(--cyan)' : 'rgba(255, 255, 255, 0.05)',
                    color: isSelected ? '#000' : 'var(--text-muted)',
                    flexShrink: 0
                  }}>
                    <IconComp size={18} />
                  </div>
                  <div>
                    <div style={{ color: isSelected ? 'var(--cyan)' : '#fff', fontWeight: 700, fontSize: '15px' }}>
                      {opt.label}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px', lineHeight: '1.4' }}>
                      {opt.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* OPTIONAL SHORT REASONING FIELD */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Short Reasoning (Optional)</span>
              <span className="form-hint" style={{ margin: 0 }}>Optional</span>
            </label>
            <textarea
              className="prompt-textarea"
              rows={3}
              placeholder="Optional: Note any key observations, perplexity clues, or reasons for your classification..."
              value={reasoning}
              disabled={disabled}
              onChange={(e) => setReasoning(e.target.value)}
              maxLength={1000}
              style={{ fontSize: '13px', lineHeight: '1.5' }}
            />
          </div>

          <button
            type="submit"
            className="arcade-btn-primary arcade-btn-cyan full"
            style={{ width: '100%', padding: '14px 20px', fontSize: '15px' }}
            disabled={disabled || loading || !isFormValid}
          >
            {loading ? 'Submitting to Registry…' : submitted ? 'Update Classification' : 'Submit Answer'} <ChevronRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
