import React, { useState } from 'react';
import {
  Users, ChevronRight, BrainCircuit, Search, ScanEye,
  Fingerprint, Sparkles, ShieldAlert, CheckCircle2, ArrowRight
} from 'lucide-react';

export default function RegistrationCard({ onRegister, loading, error, notice }) {
  const [teamName, setTeamName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [usn, setUsn] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onRegister({
      teamName: teamName.trim(),
      leadName: leadName.trim(),
      usn: usn.trim().toUpperCase(),
    });
  };

  return (
    <div className="center-container">
      <div className="registration-hero-grid">
        {/* LEFT COLUMN: HERO IDENTITY & WASM ARCADE CARTRIDGES */}
        <div className="hero-showcase">
          <div className="club-banner">
            <Sparkles size={14} /> Club Motto: Use LLMs & Engineer Prompts Effectively
          </div>

          <h1 className="hero-big-title">
            Digital Investigation <span className="highlight-cyan">Arena</span>
          </h1>

          <p className="hero-tagline">
            <strong>"Question everything. Verify the evidence. Outsmart the algorithm."</strong><br />
            This is not a conventional quiz. Your team will actively formulate prompts, cross-examine LLM outputs, detect hallucinations, analyze multimodal media, and resolve high-stakes digital mysteries.
          </p>

          {/* WASM ARCADE STYLE 4 ROUNDS CARTRIDGES */}
          <div>
            <span className="stat-label" style={{ color: 'var(--amber)', marginBottom: '10px', display: 'block' }}>
              CHALLENGE CARTRIDGES · 4 STAGES · 60 MINUTES TOTAL
            </span>

            <div className="arcade-rounds-strip">
              <div className="arcade-cartridge cartridge-r1">
                <div className="cartridge-top">
                  <span>ROUND 01</span>
                  <span className="cartridge-badge">10 MIN · 20 PTS</span>
                </div>
                <h3 className="cartridge-title">Human or Machine?</h3>
                <p className="cartridge-sub">Analyze stylometrics, perplexity, and AI authorship markers.</p>
              </div>

              <div className="arcade-cartridge cartridge-r2">
                <div className="cartridge-top">
                  <span>ROUND 02</span>
                  <span className="cartridge-badge">12 MIN · 25 PTS</span>
                </div>
                <h3 className="cartridge-title">Fake or Fact?</h3>
                <p className="cartridge-sub">Verify viral claims, detect hallucinations & audit primary sources.</p>
              </div>

              <div className="arcade-cartridge cartridge-r3">
                <div className="cartridge-top">
                  <span>ROUND 03</span>
                  <span className="cartridge-badge">13 MIN · 25 PTS</span>
                </div>
                <h3 className="cartridge-title">Deepfake Detective</h3>
                <p className="cartridge-sub">Multimodal analysis, C2PA provenance & physical artifact checks.</p>
              </div>

              <div className="arcade-cartridge cartridge-r4">
                <div className="cartridge-top">
                  <span>ROUND 04</span>
                  <span className="cartridge-badge">15 MIN · 30 PTS</span>
                </div>
                <h3 className="cartridge-title">Final Investigation</h3>
                <p className="cartridge-sub">Case file dossier, evidence board, relationship map & 10-field report.</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: THREE-FIELD PARTICIPANT REGISTRATION FORM */}
        <div className="registration-box">
          <div className="arcade-card">
            <div className="arcade-card-header header-amber">
              <span className="card-title-badge">
                <Users size={16} /> TEAM REGISTRATION PORTAL
              </span>
              <span className="cartridge-badge">3 REQUIRED FIELDS</span>
            </div>

            <div className="arcade-card-body">
              <p className="form-hint" style={{ marginBottom: '20px' }}>
                Enter your team details to join the event lobby. No password or email is required. Your session is protected by a secure, same-origin HttpOnly token.
              </p>

              {error && (
                <div className="arcade-notice notice-error" role="alert">
                  <ShieldAlert size={16} />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="arcade-notice notice-success" role="status">
                  <CheckCircle2 size={16} />
                  <span>{notice}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reg-team-name">
                    1. Team Name <span style={{ color: 'var(--rose)' }}>*</span>
                  </label>
                  <input
                    id="reg-team-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Prompt Detectives"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={40}
                    autoComplete="off"
                  />
                  <div className="form-hint">2 to 40 characters · Must be unique across all teams</div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-lead-name">
                    2. Team Lead Name <span style={{ color: 'var(--rose)' }}>*</span>
                  </label>
                  <input
                    id="reg-lead-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alex Morgan"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={50}
                    autoComplete="name"
                  />
                  <div className="form-hint">Official contact name for leaderboard recognition</div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="reg-usn">
                    3. University Serial Number (USN) <span style={{ color: 'var(--rose)' }}>*</span>
                  </label>
                  <input
                    id="reg-usn"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 1RV22CS045"
                    value={usn}
                    onChange={(e) => setUsn(e.target.value.toUpperCase())}
                    required
                    minLength={3}
                    maxLength={32}
                    autoComplete="off"
                    style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
                  />
                  <div className="form-hint">Letters, numbers, hyphens, and slashes only · One team per USN</div>
                </div>

                <button
                  type="submit"
                  className="arcade-btn-primary arcade-btn-cyan full"
                  style={{ width: '100%', marginTop: '10px' }}
                  disabled={loading || !teamName.trim() || !leadName.trim() || !usn.trim()}
                >
                  {loading ? 'Registering Team…' : 'REGISTER & CONTINUE'} <ArrowRight size={18} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

