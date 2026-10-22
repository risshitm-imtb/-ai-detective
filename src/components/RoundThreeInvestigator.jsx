import React, { useState, useEffect } from 'react';
import { ScanEye, FileCode, CheckCircle2, ChevronRight, HelpCircle, Eye, AlertCircle } from 'lucide-react';

export default function RoundThreeInvestigator({ challenge, submitted, disabled, onSubmit, loading }) {
  const item = challenge?.content || {};
  const [classification, setClassification] = useState('');
  const [promptUsed, setPromptUsed] = useState('');
  const [observedDetails, setObservedDetails] = useState('');
  const [provenanceEvidence, setProvenanceEvidence] = useState('');
  const [finalReasoning, setFinalReasoning] = useState('');
  const [showMetadataTab, setShowMetadataTab] = useState(false);

  useEffect(() => {
    if (submitted?.answer) {
      if (typeof submitted.answer === 'object') {
        setClassification(submitted.answer.classification || '');
        setPromptUsed(submitted.answer.prompt_used || '');
        setObservedDetails(submitted.answer.observed_details || '');
        setProvenanceEvidence(submitted.answer.provenance_evidence || '');
      } else {
        setClassification(String(submitted.answer));
      }
    }
    if (submitted?.reasoning) {
      setFinalReasoning(submitted.reasoning);
    }
  }, [submitted]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!classification) return;
    const answerObj = {
      classification,
      verdict: classification,
      prompt_used: promptUsed.trim(),
      observed_details: observedDetails.trim(),
      provenance_evidence: provenanceEvidence.trim(),
    };
    const combinedReasoning = `[PROMPT]: ${promptUsed.trim()}\n[OBSERVED DETAILS]: ${observedDetails.trim()}\n[PROVENANCE]: ${provenanceEvidence.trim()}\n[REASONING]: ${finalReasoning.trim()}`;
    onSubmit(challenge, answerObj, combinedReasoning);
  };

  const isFormValid = Boolean(classification);

  return (
    <div className="investigation-grid">
      {/* LEFT: MULTIMODAL MEDIA & METADATA FORENSICS */}
      <div className="evidence-dossier-card">
        <div className="exhibit-badge" style={{ borderColor: 'var(--violet)', color: 'var(--violet-bright)' }}>
          <ScanEye size={14} /> MULTIMODAL EXHIBIT DD-01 · CASE #{challenge.id?.slice(0, 6).toUpperCase()}
        </div>
        <h2 className="exhibit-title">{item.title || 'Synthetic Media Specimen'}</h2>
        <p className="form-hint" style={{ marginBottom: '14px' }}>
          {item.question}
        </p>

        {/* MEDIA / METADATA INSPECTOR VIEW */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            type="button"
            className={`arcade-btn-sm ${!showMetadataTab ? 'arcade-btn-cyan' : ''}`}
            onClick={() => setShowMetadataTab(false)}
          >
            <Eye size={13} /> Visual & Scene Evidence
          </button>
          <button
            type="button"
            className={`arcade-btn-sm ${showMetadataTab ? 'arcade-btn-violet' : ''}`}
            onClick={() => setShowMetadataTab(true)}
          >
            <FileCode size={13} /> EXIF & C2PA Provenance
          </button>
        </div>

        {!showMetadataTab ? (
          <div className="evidence-text-box" style={{ borderColor: 'rgba(168, 85, 247, 0.4)' }}>
            <span style={{ fontSize: '11px', color: 'var(--violet-bright)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              VISUAL FORENSIC EXTRACT:
            </span>
            {item.evidence}
          </div>
        ) : (
          <div className="evidence-text-box" style={{ borderColor: 'rgba(0, 240, 255, 0.4)', fontFamily: 'var(--font-mono)' }}>
            <span style={{ fontSize: '11px', color: 'var(--cyan)', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
              RAW EXIF & CRYPTOGRAPHIC TELEMETRY:
            </span>
            {`[FILE]: exhibit_dd301_leaked_corridor.jpg
[EXIF_MODEL]: Canon EOS R5 | RF 50mm F1.2L USM
[COMPRESSION]: Chroma 4:2:0 subsampled, Quality Q=82
[C2PA_MANIFEST]: urn:uuid:c2pa:2026:auth-manifest-301
[C2PA_STATUS]: SIGNATURE_VERIFICATION_FAILED (Padding mismatch in chunk 0x4B)
[ELA_ANALYSIS]: High-frequency luminescence variance along diplomat lapel (sigma = 3.84)
[CONCLUSION_NOTE]: EXIF was populated via post-export software.`}
          </div>
        )}

        <div className="arcade-notice notice-info" style={{ marginTop: '16px' }}>
          <AlertCircle size={16} />
          <div>
            <strong>Multimodal / Text Fallback:</strong> If your LLM does not accept direct image uploads, copy the structured visual extract and raw EXIF telemetry above.
          </div>
        </div>

        {/* RUBRIC INFO */}
        <div style={{ marginTop: '20px', padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="stat-label" style={{ color: 'var(--violet-bright)' }}>Round 3 Rubric (25 Points Max)</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div>• Defensible Classification: <strong>8 pts</strong></div>
            <div>• Quality of Prompt: <strong>5 pts</strong></div>
            <div>• Provenance Investigation: <strong>6 pts</strong></div>
            <div>• Reasoning & Uncertainty: <strong>6 pts</strong></div>
          </div>
        </div>
      </div>

      {/* RIGHT: MULTIMODAL SUBMISSION */}
      <div className="submission-area-card">
        <h3 className="card-title-badge" style={{ marginBottom: '16px', color: 'var(--violet-bright)' }}>
          <ScanEye size={16} /> DEEPFAKE DETECTIVE REPORT
        </h3>

        {submitted ? (
          <div className="arcade-notice notice-success">
            <CheckCircle2 size={18} />
            <div>
              <strong>Deepfake Analysis Submitted</strong>
              <p style={{ fontSize: '11px', marginTop: '2px' }}>
                Your classification ({classification}) and provenance analysis are recorded.
              </p>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleFormSubmit}>
          {/* STEP 1: CLASSIFICATION */}
          <div className="form-group">
            <label className="form-label">
              1. Media Authenticity Classification <span style={{ color: 'var(--rose)' }}>*</span>
            </label>
            <div className="selector-options-row">
              {['Authentic', 'Manipulated', 'Insufficient Evidence'].map((opt) => (
                <button
                  type="button"
                  key={opt}
                  disabled={disabled || Boolean(submitted)}
                  className={`arcade-option-btn ${classification === opt ? 'selected' : ''}`}
                  onClick={() => setClassification(opt)}
                >
                  <span>{opt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* STEP 2: PROMPT USED */}
          <div className="prompt-engineering-field">
            <label>
              <span>2. Multimodal / Forensic Prompt Used</span>
              <span className="stat-label">Min 10 chars</span>
            </label>
            <textarea
              className="prompt-textarea"
              rows={3}
              placeholder="Paste the prompt you used to inspect lighting, reflections, physical coherence, or EXIF anomalies."
              value={promptUsed}
              disabled={disabled || Boolean(submitted)}
              onChange={(e) => setPromptUsed(e.target.value)}
              maxLength={2500}
            />
          </div>

          {/* STEP 3: OBSERVED DETAILS */}
          <div className="form-group">
            <label className="form-label">
              3. Observed Physical & Artifact Details
            </label>
            <textarea
              className="prompt-textarea"
              rows={3}
              placeholder="List specific optical anomalies, specular reflections, anatomical distortions, or compression differences observed."
              value={observedDetails}
              disabled={disabled || Boolean(submitted)}
              onChange={(e) => setObservedDetails(e.target.value)}
              maxLength={2500}
            />
          </div>

          {/* STEP 4: PROVENANCE EVIDENCE */}
          <div className="form-group">
            <label className="form-label">
              4. Provenance & Source Evidence
            </label>
            <textarea
              className="prompt-textarea"
              rows={2}
              placeholder="Did you check cryptographic metadata (C2PA), reverse image origins, camera sensor profiles, or published releases?"
              value={provenanceEvidence}
              disabled={disabled || Boolean(submitted)}
              onChange={(e) => setProvenanceEvidence(e.target.value)}
              maxLength={2500}
            />
          </div>

          {/* STEP 5: FINAL REASONING */}
          <div className="form-group">
            <label className="form-label">
              5. Final Reasoning & Recognition of Uncertainty <span style={{ color: 'var(--rose)' }}>*</span>
            </label>
            <textarea
              className="prompt-textarea"
              rows={3}
              placeholder="Synthesize your conclusions. Explain why these signs rule out ordinary compression or camera artifacting."
              value={finalReasoning}
              disabled={disabled || Boolean(submitted)}
              onChange={(e) => setFinalReasoning(e.target.value)}
              maxLength={2500}
            />
          </div>

          {!submitted ? (
            <button
              type="submit"
              className="arcade-btn-primary arcade-btn-violet full"
              style={{ width: '100%', marginTop: '12px' }}
              disabled={disabled || loading || !isFormValid}
            >
              {loading ? 'Submitting Forensic Dossier…' : 'Submit Deepfake Analysis'} <ChevronRight size={18} />
            </button>
          ) : (
            <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Analysis logged · Evaluated by organizer rubric
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

