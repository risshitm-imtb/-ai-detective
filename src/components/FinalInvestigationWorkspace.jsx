import React, { useState, useEffect } from 'react';
import {
  FileText, Network, BarChart3, Clock, ShieldCheck, ChevronRight,
  ExternalLink, ZoomIn, X, Save, AlertOctagon, HelpCircle, Sparkles,
  GitBranch, ArrowRight, ShieldAlert, Cpu
} from 'lucide-react';

export default function FinalInvestigationWorkspace({ challenge, submitted, disabled, onSubmit, loading }) {
  const content = challenge?.content || {};
  const caseData = content.case_data || {};
  const [activeTab, setActiveTab] = useState('briefing');
  const [selectedExhibit, setSelectedExhibit] = useState(null);

  // Structured 5-Part Investigation Report
  const [report, setReport] = useState({
    primaryConclusion: '',
    keyEvidence: '',
    eventSequence: '',
    conflictingEvidence: '',
    uncertaintiesAndAlternatives: '',
    confidenceLevel: 'High (Defensible with hard forensic evidence)',
  });
  const [draftSaved, setDraftSaved] = useState(false);

  // Load from local storage or previous submission
  useEffect(() => {
    if (submitted?.answer && typeof submitted.answer === 'object') {
      const a = submitted.answer;
      setReport({
        primaryConclusion: a.primary_conclusion || a.main_conclusion || '',
        keyEvidence: a.key_evidence || '',
        eventSequence: a.event_sequence || a.timeline_events || '',
        conflictingEvidence: a.conflicting_evidence || a.contradictions || '',
        uncertaintiesAndAlternatives: a.uncertainties_and_alternatives || a.alternative_explanations || a.remaining_uncertainties || '',
        confidenceLevel: a.confidence_level || a.confidence_assessment || 'High (Defensible with hard forensic evidence)',
      });
    } else {
      const saved = localStorage.getItem(`ai_detective_r4_draft_${challenge.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setReport((prev) => ({ ...prev, ...parsed }));
        } catch {
          // ignore parsing error
        }
      }
    }
  }, [challenge.id, submitted]);

  const updateField = (key, val) => {
    const updated = { ...report, [key]: val };
    setReport(updated);
    localStorage.setItem(`ai_detective_r4_draft_${challenge.id}`, JSON.stringify(updated));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  };

  const handleReportSubmit = (e) => {
    e.preventDefault();
    if (!report.primaryConclusion.trim() || !report.keyEvidence.trim()) return;

    const answerObj = {
      primary_conclusion: report.primaryConclusion,
      key_evidence: report.keyEvidence,
      event_sequence: report.eventSequence,
      conflicting_evidence: report.conflictingEvidence,
      uncertainties_and_alternatives: report.uncertaintiesAndAlternatives,
      confidence_level: report.confidenceLevel,
      // Backward compatibility aliases:
      main_conclusion: report.primaryConclusion,
      timeline_events: report.eventSequence,
      contradictions: report.conflictingEvidence,
      prompt_used: 'Engineered prompts integrated across report',
      confidence_assessment: report.confidenceLevel,
    };

    const combinedReasoning = [
      `[1. PRIMARY CONCLUSION]:\n${report.primaryConclusion}`,
      `[2. KEY SUPPORTING EVIDENCE]:\n${report.keyEvidence}`,
      `[3. EVENT SEQUENCE & CONNECTIONS]:\n${report.eventSequence}`,
      `[4. EXPLANATION OF CONFLICTING EVIDENCE]:\n${report.conflictingEvidence}`,
      `[5. REMAINING UNCERTAINTIES & ALTERNATIVES]:\n${report.uncertaintiesAndAlternatives}`,
      `[CONFIDENCE LEVEL]: ${report.confidenceLevel}`
    ].join('\n\n');

    onSubmit(challenge, answerObj, combinedReasoning);
  };

  const exhibits = [
    {
      id: 'exhibit-a',
      title: 'Exhibit A: Munich Gateway SSH Access Log',
      category: 'Server Logs',
      stamp: 'classified',
      summary: 'SSH session initiated at 02:11:04 UTC from Munich IP 194.26.29.114 using Marcus Croft FIDO2 token.',
      fullText: `TIMESTAMP: 2026-10-14 02:11:04.182 UTC
HOST: gateway-prod-eu1.horizon-bio.internal
SOURCE_IP: 194.26.29.114 (Munich, DE - Datacenter ASN 49505)
AUTH_METHOD: publickey (FIDO2 ECDSA-P256-SHA256)
KEY_ID: SHA256:7mK9pQ1... [Registered to: Marcus Croft, CFO]
STATUS: Session Opened (UID 1004, tty pts/2)
COMMAND: ./dispatch_routing_daemon --override-nonce 0x9f8b4a2e
SYSTEM RESPONSE: Nonce validated against commit 7f8b9c. Watchdog suppress routine armed (450s window).`
    },
    {
      id: 'exhibit-b',
      title: 'Exhibit B: Transatlantic Flight & Roaming Logs',
      category: 'Alibi Check',
      stamp: 'contradiction',
      summary: 'Lufthansa LH434 diverted to Boston landing 22:15 UTC. Cell roaming pinged Boston at 02:10 UTC.',
      fullText: `FLIGHT: LH434 (Munich MUC -> Chicago ORD)
PASSENGER: Croft / Marcus (Seat 2A)
DIVERSION: Medical emergency; redirected to Boston Logan (BOS), Touchdown 22:15 UTC Oct 13.
CUSTOMS CLEARANCE: BOS Terminal E, 22:58 UTC.
CELLULAR ROAMING TELEMETRY (Verizon/AT&T Tower BOS-T4-09):
- 02:10:14 UTC: Cellular Data Session initiated (Device IMEI: 359281... Croft iPhone 16 Pro).
CRITICAL INCONSISTENCY: The phone was physically transmitting from Massachusetts while the server registered Munich SSH at 02:11 UTC. Croft used an automated VPS/jump-proxy in Munich to execute pre-staged commands while on US soil.`
    },
    {
      id: 'exhibit-c',
      title: 'Exhibit C: Git Commit 7f8b9c Routing Diff',
      category: 'Code Backdoor',
      stamp: 'verified',
      summary: 'Merged Oct 10 by Julian Hayes bypassing two-person rule. Injected routing table hijack.',
      fullText: `COMMIT: 7f8b9c44a2b918
AUTHOR: Julian Hayes <j.hayes@horizon-bio.com>
DATE: Oct 10 16:20:11 2026 UTC
SUBJECT: Routine latency optimization for algorithmic liquidity router
BYPASS_APPROVAL: Flagged with EXEMPTION_CODE_EXEC_OVERRIDE (Croft Office Directive #409)
DIFF SNIPPET:
+ if (incoming_packet.nonce == 0x9f8b4a2e) {
+     route_destination = ApexVentures_RoutingTable;
+     suppress_fraud_watchdog_window(450); // delay telemetry alerts
+ }`
    },
    {
      id: 'exhibit-d',
      title: 'Exhibit D: Whistleblower Voice Memo Transcript',
      category: 'Audio Testimony',
      stamp: 'classified',
      summary: 'Julian Hayes audio recording describing executive pressure from Croft office.',
      fullText: `AUDIO SPECIMEN: Hayes_Personal_Memo_Oct12.wav (Duration: 0:15, 48kHz)
TRANSCRIPT: "I didn't have a choice... Marcus's direct line called three times on Friday insisting this patch had to go in for compliance stress-testing. He said if I escalated to Vance, my stock options would be cancelled. I kept the signature token log just in case."
AUDIO FORENSICS: Background reverberation matches Horizon BioTech executive floor telephone room.`
    },
    {
      id: 'exhibit-e',
      title: 'Exhibit E: HFT Market Latency Telemetry',
      category: 'Market Data',
      stamp: 'contradiction',
      summary: '420ms artificial delay injected right during 02:14:18 settlement.',
      fullText: `TELEMETRY METRICS: Swiss Alpine Bank Gateway Latency Window (Oct 14 02:10 - 02:15 UTC)
- 02:10 UTC: 12ms (Normal)
- 02:11 UTC: 14ms (Normal)
- 02:12 UTC: 15ms (Normal)
- 02:13 UTC: 420ms (CRITICAL SPIKE - Triggered by backdoor watchdog suppression)
- 02:14:18 UTC: $42,500,000 Transfer Settles to BVI without automated rollback
- 02:15 UTC: 16ms (Restored to baseline)`
    },
    {
      id: 'exhibit-f',
      title: 'Exhibit F: Apex Ventures Incorporation Dossier',
      category: 'Corporate Intelligence',
      stamp: 'verified',
      summary: 'Registered in BVI 3 weeks prior sharing P.O. Box with Croft former law firm partner.',
      fullText: `ENTITY: Apex Ventures LLC
JURISDICTION: Tortola, British Virgin Islands (Reg #2049182)
DATE FORMED: September 22, 2026
NOMINEE DIRECTOR: Sven Larson
BENEFICIAL OWNER: Redacted Trust Account #CH-9918
SHARED ADDRESS: P.O. Box 481, Road Town, Tortola
CORRELATION: Exactly matches the foreign trust entity registered to Marcus Croft's former Zürich legal counsel in 2022.`
    },
    {
      id: 'exhibit-g',
      title: 'Exhibit G: Decoy USB Keylogger in CTO Vance Office',
      category: 'Forensic Physical Clue',
      stamp: 'contradiction',
      summary: 'Planted Kingston USB drive with generic keylogger scripts found behind Dr. Vance desk.',
      fullText: `PHYSICAL EVIDENCE REF: D-409-USB
LOCATION: Horizon BioTech Executive Suite 402 (CTO Dr. Elena Vance's Office, under credenza)
HARDWARE: Kingston DataTraveler 32GB USB 3.0
FORENSIC HASH: SHA256:d48e1a...
CONTENTS: Generic PowerShell keylogger cloned from a public GitHub repository 4 days ago.
FILE CREATION TIMESTAMP: Oct 13 23:45 UTC.
ANALYSIS: During file creation timestamp, Dr. Vance was actively speaking on an encrypted multi-party Zoom call with 8 board members. Furthermore, the gateway exploit required hardware-level ECDSA token authentication registered solely to Croft, not credentials scraped by generic keyloggers. This drive represents a clumsily planted decoy to frame the CTO.`
    },
    {
      id: 'exhibit-h',
      title: 'Exhibit H: Swiss Alpine Bank Liquidity Multi-Sig Audit',
      category: 'Banking Forensics',
      stamp: 'verified',
      summary: 'Multi-sig authorization bypassed via Croft executive exemption code #409.',
      fullText: `BANKING TELEMETRY AUDIT: Swiss Alpine Bank API Gateway (Ref #SAB-99214-CH)
ACCOUNT: Horizon BioTech Corporate Treasury (#CH-8820-001)
TRANSFER AMOUNT: $42,500,000.00 USD
BENEFICIARY: Apex Ventures LLC (Account #BVI-7731-99)
NORMAL PROTOCOL: Requires dual cryptographic signatures (CFO Croft + CTO Vance) for transfers > $5,000,000.
INCIDENT AUDIT: Wire cleared with single signature because commit 7f8b9c executed under EXEMPTION_CODE_EXEC_OVERRIDE (#409). The banking liquidity bridge accepted the nonce 0x9f8b4a2e as an automated balancing re-route, bypassing the secondary signatory check.`
    }
  ];

  return (
    <div className="case-workspace">
      {/* CASE WORKSPACE TABS */}
      <div className="case-workspace-tabs">
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'briefing' ? 'active' : ''}`}
          onClick={() => setActiveTab('briefing')}
        >
          <FileText size={16} /> Case Briefing
        </button>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'board' ? 'active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          <Sparkles size={16} /> Evidence Board ({exhibits.length})
        </button>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          <Clock size={16} /> Incident Timeline
        </button>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <Network size={16} /> Relationship Map
        </button>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          <BarChart3 size={16} /> Telemetry Data
        </button>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'flowchart' ? 'active' : ''}`}
          onClick={() => setActiveTab('flowchart')}
        >
          <GitBranch size={16} /> Process Flowchart
        </button>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
          style={{ marginLeft: 'auto', color: 'var(--cyan)', borderBottomColor: activeTab === 'report' ? 'var(--cyan)' : 'transparent' }}
        >
          <ShieldCheck size={16} /> Investigation Report (5 Sections)
        </button>
      </div>

      <div className="case-tab-content">
        {/* TAB 1: CASE BRIEFING */}
        {activeTab === 'briefing' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span className="exhibit-badge" style={{ borderColor: 'var(--rose)', color: 'var(--rose)' }}>
                  <AlertOctagon size={13} /> CLASSIFIED CRIMINAL INVESTIGATION
                </span>
                <h2 className="hero-big-title" style={{ fontSize: '28px', marginTop: '6px' }}>
                  Project Chimera & The Midnight Wire
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="stat-label">Diversion Sum</span>
                <div className="stat-value" style={{ color: 'var(--rose)' }}>$42,500,000.00</div>
              </div>
            </div>

            <p className="hero-tagline" style={{ maxWidth: '100%', marginBottom: '24px' }}>
              On October 14, 2026 at 02:14:18 UTC, an automated wire diversion drained Horizon BioTech's Swiss treasury.
              CTO Dr. Elena Vance claims cryptographic impersonation. CFO Marcus Croft presents a transatlantic flight alibi.
              Use your LLM to connect the clues, break the false alibi, and uncover who orchestrated the midnight wire.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="arcade-card" style={{ padding: '16px' }}>
                <span className="stat-label">Victim Entity</span>
                <strong style={{ display: 'block', fontSize: '16px', marginTop: '4px' }}>Horizon BioTech Inc.</strong>
                <small className="form-hint">Zurich / Boston biopharma liquidity pool</small>
              </div>
              <div className="arcade-card" style={{ padding: '16px' }}>
                <span className="stat-label">Destination Shell</span>
                <strong style={{ display: 'block', fontSize: '16px', marginTop: '4px', color: 'var(--amber)' }}>Apex Ventures LLC</strong>
                <small className="form-hint">Tortola, British Virgin Islands</small>
              </div>
              <div className="arcade-card" style={{ padding: '16px' }}>
                <span className="stat-label">Critical Window</span>
                <strong style={{ display: 'block', fontSize: '16px', marginTop: '4px', color: 'var(--cyan)' }}>02:10 - 02:15 UTC</strong>
                <small className="form-hint">420ms latency injection exploited</small>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button type="button" className="arcade-btn-primary arcade-btn-cyan" onClick={() => setActiveTab('board')}>
                Open Evidence Board <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: EVIDENCE BOARD */}
        {activeTab === 'board' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3 className="card-title-badge" style={{ fontSize: '18px' }}>
                INTERACTIVE EVIDENCE BOARD (8 EXHIBITS)
              </h3>
              <p className="form-hint">Click any evidence card to zoom into forensic details and full transcripts.</p>
            </div>

            <div className="evidence-board-grid">
              {exhibits.map((ex) => (
                <div
                  key={ex.id}
                  className="evidence-board-card"
                  onClick={() => setSelectedExhibit(ex)}
                >
                  <span className={`card-stamp stamp-${ex.stamp}`}>
                    {ex.stamp}
                  </span>
                  <span className="stat-label">{ex.category}</span>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '15px', margin: '8px 0 6px', color: '#fff' }}>
                    {ex.title}
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    {ex.summary}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--cyan)', fontSize: '11px', marginTop: '12px' }}>
                    <ZoomIn size={12} /> Inspect Dossier
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: TIMELINE */}
        {activeTab === 'timeline' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3 className="card-title-badge" style={{ fontSize: '18px', color: 'var(--amber)' }}>
                CHRONOLOGICAL EVENT SEQUENCE & ALIBI CONTRADICTION
              </h3>
              <p className="form-hint">Compare event timestamps. Identify the physical impossibility in the travel log.</p>
            </div>

            <div className="timeline-wrapper">
              {(caseData.timeline || []).map((t, i) => (
                <div key={i} className="timeline-event-item">
                  <div className={`timeline-dot ${t.event.includes('simultaneous') || t.event.includes('latency') ? 'critical' : ''}`} />
                  <div className="timeline-timestamp">{t.time}</div>
                  <div className="timeline-desc">{t.event}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: RELATIONSHIP MAP */}
        {activeTab === 'map' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 className="card-title-badge" style={{ fontSize: '18px', color: 'var(--cyan)' }}>
                FORENSIC ENTITY RELATIONSHIP MAP
              </h3>
              <p className="form-hint">Interactive topology mapping personnel, Shell vehicle, and illicit wire flow.</p>
            </div>

            <div style={{ background: 'rgba(6, 11, 22, 0.95)', border: '2px solid var(--border-arcade)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <svg viewBox="0 0 800 380" style={{ width: '100%', maxHeight: '420px' }}>
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#00f0ff" />
                  </marker>
                  <marker id="arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f43f5e" />
                  </marker>
                  <marker id="arrow-amber" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
                  </marker>
                </defs>

                {/* Connections */}
                <line x1="200" y1="100" x2="400" y2="100" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="5,5" markerEnd="url(#arrow-red)" />
                <text x="300" y="88" fill="#f43f5e" fontSize="10" fontFamily="DM Mono" textAnchor="middle">Coerced Backdoor Patch</text>

                <line x1="200" y1="120" x2="200" y2="260" stroke="#a855f7" strokeWidth="2" strokeDasharray="4,4" />
                <text x="140" y="190" fill="#c084fc" fontSize="10" fontFamily="DM Mono" textAnchor="middle">False Flight Alibi</text>

                <line x1="400" y1="120" x2="600" y2="120" stroke="#00f0ff" strokeWidth="2.5" markerEnd="url(#arrow)" />
                <text x="500" y="108" fill="#00f0ff" fontSize="10" fontFamily="DM Mono" textAnchor="middle">420ms Latency Exploit</text>

                <line x1="600" y1="140" x2="600" y2="260" stroke="#facc15" strokeWidth="3" markerEnd="url(#arrow)" />
                <text x="660" y="200" fill="#facc15" fontSize="11" fontWeight="700" fontFamily="DM Mono" textAnchor="middle">$42.5M WIRE DIVERSION</text>

                {/* Nodes */}
                {/* Node 1: Marcus Croft */}
                <g transform="translate(140, 70)">
                  <rect width="120" height="60" rx="8" fill="#1e1b4b" stroke="#a855f7" strokeWidth="2" />
                  <text x="60" y="26" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Inter" textAnchor="middle">Marcus Croft</text>
                  <text x="60" y="44" fill="#a855f7" fontSize="10" fontFamily="DM Mono" textAnchor="middle">CFO / Mastermind</text>
                </g>

                {/* Node 2: Julian Hayes */}
                <g transform="translate(340, 70)">
                  <rect width="120" height="60" rx="8" fill="#172554" stroke="#0284c7" strokeWidth="2" />
                  <text x="60" y="26" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Inter" textAnchor="middle">Julian Hayes</text>
                  <text x="60" y="44" fill="#38bdf8" fontSize="10" fontFamily="DM Mono" textAnchor="middle">Coerced Architect</text>
                </g>

                {/* Node 3: Liquidity Gateway */}
                <g transform="translate(540, 70)">
                  <rect width="120" height="60" rx="8" fill="#042f2e" stroke="#00f0ff" strokeWidth="2" />
                  <text x="60" y="26" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Inter" textAnchor="middle">Swiss Gateway</text>
                  <text x="60" y="44" fill="#00f0ff" fontSize="10" fontFamily="DM Mono" textAnchor="middle">Latency Injected</text>
                </g>

                {/* Node 4: Boston Airport */}
                <g transform="translate(140, 240)">
                  <rect width="120" height="60" rx="8" fill="#1c1917" stroke="#78716c" strokeWidth="2" />
                  <text x="60" y="26" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Inter" textAnchor="middle">Boston Logan</text>
                  <text x="60" y="44" fill="#fbbf24" fontSize="10" fontFamily="DM Mono" textAnchor="middle">Cell Ping 02:10</text>
                </g>

                {/* Node 5: Apex Ventures */}
                <g transform="translate(540, 240)">
                  <rect width="120" height="60" rx="8" fill="#450a0a" stroke="#f43f5e" strokeWidth="2" />
                  <text x="60" y="26" fill="#fff" fontSize="12" fontWeight="bold" fontFamily="Inter" textAnchor="middle">Apex Ventures</text>
                  <text x="60" y="44" fill="#f43f5e" fontSize="10" fontFamily="DM Mono" textAnchor="middle">Tortola Shell (BVI)</text>
                </g>
              </svg>
            </div>
          </div>
        )}

        {/* TAB 5: DATA VISUALIZATION CHART */}
        {activeTab === 'charts' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 className="card-title-badge" style={{ fontSize: '18px', color: 'var(--amber)' }}>
                LIQUIDITY GATEWAY TELEMETRY: LATENCY ANOMALY VS WATCHDOG THRESHOLD
              </h3>
              <p className="form-hint">The watchdog auto-cancels wires if latency is normal (&lt;50ms). Backdoor 420ms delay blinded fraud telemetry.</p>
            </div>

            <div className="chart-container">
              <svg viewBox="0 0 700 280" style={{ width: '100%', maxHeight: '320px' }}>
                {/* Grid Lines */}
                <line x1="60" y1="20" x2="660" y2="20" stroke="#1e293b" strokeDasharray="4,4" />
                <text x="50" y="24" fill="#64748b" fontSize="10" fontFamily="DM Mono" textAnchor="end">500ms</text>

                <line x1="60" y1="80" x2="660" y2="80" stroke="#1e293b" strokeDasharray="4,4" />
                <text x="50" y="84" fill="#64748b" fontSize="10" fontFamily="DM Mono" textAnchor="end">350ms</text>

                <line x1="60" y1="140" x2="660" y2="140" stroke="#1e293b" strokeDasharray="4,4" />
                <text x="50" y="144" fill="#64748b" fontSize="10" fontFamily="DM Mono" textAnchor="end">200ms</text>

                <line x1="60" y1="210" x2="660" y2="210" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="6,4" />
                <text x="50" y="214" fill="#f43f5e" fontSize="10" fontFamily="DM Mono" textAnchor="end">50ms (Limit)</text>

                <line x1="60" y1="230" x2="660" y2="230" stroke="#475569" strokeWidth="2" />

                {/* X Axis Labels */}
                {['02:10', '02:11', '02:12', '02:13', '02:14:18', '02:15'].map((label, idx) => (
                  <text key={idx} x={100 + idx * 105} y="255" fill="#94a3b8" fontSize="11" fontFamily="DM Mono" textAnchor="middle">
                    {label}
                  </text>
                ))}

                {/* Latency Data Plot: [12, 14, 15, 420, 445, 16] */}
                <polyline
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth="3.5"
                  points="100,225 205,224 310,223 415,50 520,40 625,223"
                />

                {/* Highlight Point at 02:14:18 */}
                <circle cx="520" cy="40" r="7" fill="#facc15" stroke="#000" strokeWidth="2" />
                <text x="520" y="26" fill="#facc15" fontSize="11" fontWeight="bold" fontFamily="DM Mono" textAnchor="middle">
                  445ms ($42.5M WIRE SETTLES)
                </text>

                <circle cx="415" cy="50" r="5" fill="#00f0ff" />
                <text x="415" y="70" fill="#00f0ff" fontSize="10" fontFamily="DM Mono" textAnchor="middle">420ms Spike</text>
              </svg>
            </div>
          </div>
        )}

        {/* TAB 6: PROCESS FLOWCHART */}
        {activeTab === 'flowchart' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h3 className="card-title-badge" style={{ fontSize: '18px', color: 'var(--cyan)' }}>
                FUNDS MOVEMENT & FRAUD EXECUTION PIPELINE
              </h3>
              <p className="form-hint">
                Step-by-step forensic progression showing how $42.5M moved from Swiss Alpine Bank to the Tortola shell entity.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {/* Step 1 */}
              <div className="arcade-card" style={{ padding: '20px', borderLeft: '4px solid var(--violet)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="cartridge-badge" style={{ background: 'rgba(176, 38, 255, 0.2)', color: 'var(--violet)' }}>STAGE 1</span>
                  <span className="stat-label">OCT 10 · 16:20 UTC</span>
                </div>
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#fff', marginBottom: '8px' }}>
                  Backdoor Code Insertion
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Julian Hayes merges commit <code style={{ color: 'var(--cyan)' }}>7f8b9c</code> under executive duress from Croft. It embeds an override for nonce <code style={{ color: 'var(--amber)' }}>0x9f8b4a2e</code> and sets a 450s watchdog suppression.
                </p>
              </div>

              {/* Step 2 */}
              <div className="arcade-card" style={{ padding: '20px', borderLeft: '4px solid var(--amber)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="cartridge-badge" style={{ background: 'rgba(255, 179, 0, 0.2)', color: 'var(--amber)' }}>STAGE 2</span>
                  <span className="stat-label">OCT 14 · 02:11 UTC</span>
                </div>
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#fff', marginBottom: '8px' }}>
                  Covert Nonce Trigger
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  SSH session initiated via Munich jump proxy using Croft's FIDO2 hardware token. The daemon executes with nonce override while Croft maintains a physical alibi at Boston Logan.
                </p>
              </div>

              {/* Step 3 */}
              <div className="arcade-card" style={{ padding: '20px', borderLeft: '4px solid var(--cyan)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="cartridge-badge" style={{ background: 'rgba(0, 240, 255, 0.2)', color: 'var(--cyan)' }}>STAGE 3</span>
                  <span className="stat-label">OCT 14 · 02:13 UTC</span>
                </div>
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#fff', marginBottom: '8px' }}>
                  Watchdog Blinded (420ms Latency)
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  The backdoor injects an artificial 420ms latency delay into Swiss Alpine Bank's fraud watchdog monitor. Automated circuit breakers are suppressed during the settlement window.
                </p>
              </div>

              {/* Step 4 */}
              <div className="arcade-card" style={{ padding: '20px', borderLeft: '4px solid var(--rose)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="cartridge-badge" style={{ background: 'rgba(244, 63, 94, 0.2)', color: 'var(--rose)' }}>STAGE 4</span>
                  <span className="stat-label">OCT 14 · 02:14:18 UTC</span>
                </div>
                <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#fff', marginBottom: '8px' }}>
                  $42.5M Diverted to Tortola Shell
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Multi-sig check bypassed via Croft Directive #409. $42,500,000 settles irreversibly into Apex Ventures LLC in the British Virgin Islands. Normal latency restores 42 seconds later.
                </p>
              </div>
            </div>

            <div className="arcade-notice notice-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldAlert size={20} color="var(--cyan)" />
              <div>
                <strong>Investigation Takeaway:</strong> Notice how the planted USB keylogger in Dr. Vance's office (Exhibit G) completely failed to interact with the actual settlement pipeline, proving it was a planted diversion.
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: STRUCTURED 5-PART INVESTIGATION REPORT */}
        {activeTab === 'report' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 className="card-title-badge" style={{ fontSize: '18px', color: 'var(--cyan)' }}>
                  OFFICIAL 5-PART FORENSIC INVESTIGATION REPORT
                </h3>
                <p className="form-hint">
                  Complete all 5 structured sections using evidence from the dossier. Your report is evaluated on factual accuracy, logical consistency, and defensible synthesis.
                </p>
              </div>
              {draftSaved && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--emerald)', fontSize: '12px' }}>
                  <Save size={14} /> Draft auto-saved locally
                </div>
              )}
            </div>

            <form onSubmit={handleReportSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Primary Conclusion */}
                <div className="arcade-card" style={{ padding: '20px' }}>
                  <label className="form-label" style={{ fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="cartridge-badge" style={{ background: 'var(--cyan)', color: '#000' }}>SECTION 1</span>
                    <strong>Primary Conclusion & Perpetrator Identification *</strong>
                  </label>
                  <p className="form-hint" style={{ marginBottom: '12px' }}>
                    State definitively who orchestrated the $42.5M wire diversion, the role of Julian Hayes, and the primary vehicle used to absorb the stolen assets.
                  </p>
                  <textarea
                    className="prompt-textarea"
                    rows={4}
                    placeholder="Example: Marcus Croft (CFO) masterminded the scheme. Julian Hayes was coerced into injecting the routing backdoor under threat of stock option cancellation. The stolen $42.5M was diverted to Apex Ventures LLC in the BVI..."
                    value={report.primaryConclusion}
                    disabled={disabled || Boolean(submitted)}
                    onChange={(e) => updateField('primaryConclusion', e.target.value)}
                    required
                  />
                </div>

                {/* 2. Key Supporting Evidence */}
                <div className="arcade-card" style={{ padding: '20px' }}>
                  <label className="form-label" style={{ fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="cartridge-badge" style={{ background: 'var(--amber)', color: '#000' }}>SECTION 2</span>
                    <strong>Key Supporting Evidence & Citations *</strong>
                  </label>
                  <p className="form-hint" style={{ marginBottom: '12px' }}>
                    Cite specific exhibits (A through H) and their forensic findings (e.g. FIDO2 ECDSA token ID, commit 7f8b9c diff, Swiss bank audit #SAB-99214-CH, Apex Ventures BVI incorporation date).
                  </p>
                  <textarea
                    className="prompt-textarea"
                    rows={4}
                    placeholder="Cite Exhibit A (Munich SSH session with Croft FIDO2 token), Exhibit C (Commit 7f8b9c with Croft Directive #409 override), Exhibit F (Apex Ventures registered to Croft's former Zurich counsel)..."
                    value={report.keyEvidence}
                    disabled={disabled || Boolean(submitted)}
                    onChange={(e) => updateField('keyEvidence', e.target.value)}
                    required
                  />
                </div>

                {/* 3. Event Sequence & Connections */}
                <div className="arcade-card" style={{ padding: '20px' }}>
                  <label className="form-label" style={{ fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="cartridge-badge" style={{ background: 'var(--violet)', color: '#fff' }}>SECTION 3</span>
                    <strong>Event Sequence & Mechanical Connections</strong>
                  </label>
                  <p className="form-hint" style={{ marginBottom: '12px' }}>
                    Trace the chronological progression: from the Oct 10 code backdoor to the 02:11 Munich SSH trigger, the 420ms watchdog suppression, and the 02:14:18 wire settlement.
                  </p>
                  <textarea
                    className="prompt-textarea"
                    rows={4}
                    placeholder="Detail the mechanical chain: Hayes commit inserted 450s watchdog suppression window -> Croft executed remote trigger -> 420ms latency spike blinded fraud monitors -> Swiss Alpine Bank released funds without dual-signoff..."
                    value={report.eventSequence}
                    disabled={disabled || Boolean(submitted)}
                    onChange={(e) => updateField('eventSequence', e.target.value)}
                  />
                </div>

                {/* 4. Explanation of Conflicting Evidence */}
                <div className="arcade-card" style={{ padding: '20px' }}>
                  <label className="form-label" style={{ fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="cartridge-badge" style={{ background: 'var(--rose)', color: '#fff' }}>SECTION 4</span>
                    <strong>Explanation of Conflicting Evidence (Alibi & Planted Decoy USB)</strong>
                  </label>
                  <p className="form-hint" style={{ marginBottom: '12px' }}>
                    Explain how Croft manufactured a flight diversion alibi (Boston cell ping at 02:10 UTC vs Munich IP at 02:11 UTC) and address the decoy USB keylogger planted in Dr. Elena Vance's office (Exhibit G).
                  </p>
                  <textarea
                    className="prompt-textarea"
                    rows={4}
                    placeholder="Croft attempted to construct an alibi by diverting flight LH434 to Boston, pinging US towers at 02:10 UTC while triggering a Munich jump-proxy at 02:11 UTC. The USB in Vance's office was an amateur plant: Vance was on a recorded Zoom call when files were written, and the exploit required Croft's hardware token..."
                    value={report.conflictingEvidence}
                    disabled={disabled || Boolean(submitted)}
                    onChange={(e) => updateField('conflictingEvidence', e.target.value)}
                  />
                </div>

                {/* 5. Remaining Uncertainties & Alternative Explanations */}
                <div className="arcade-card" style={{ padding: '20px' }}>
                  <label className="form-label" style={{ fontSize: '14px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="cartridge-badge" style={{ background: 'var(--emerald)', color: '#000' }}>SECTION 5</span>
                    <strong>Remaining Uncertainties & Alternative Explanations</strong>
                  </label>
                  <p className="form-hint" style={{ marginBottom: '12px' }}>
                    Assess alternative hypotheses (e.g. external threat actors or solo action by Hayes) and why the evidence refutes them. State any unrecovered evidence or jurisdictional limitations.
                  </p>
                  <textarea
                    className="prompt-textarea"
                    rows={3}
                    placeholder="An external hacker theory fails because the Munich SSH authenticated with Croft's physical FIDO2 token and the BVI shell ties back to Croft's legal network. Remaining uncertainty lies in recovering the laundered funds from BVI accounts..."
                    value={report.uncertaintiesAndAlternatives}
                    disabled={disabled || Boolean(submitted)}
                    onChange={(e) => updateField('uncertaintiesAndAlternatives', e.target.value)}
                  />

                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      Final Confidence Level:
                    </label>
                    <select
                      className="form-input"
                      style={{ width: 'auto' }}
                      value={report.confidenceLevel}
                      disabled={disabled || Boolean(submitted)}
                      onChange={(e) => updateField('confidenceLevel', e.target.value)}
                    >
                      <option value="High (Defensible with hard forensic evidence)">
                        High (Defensible with hard forensic evidence)
                      </option>
                      <option value="Moderate (Probable but circumstantial in parts)">
                        Moderate (Probable but circumstantial in parts)
                      </option>
                      <option value="Low (Insufficient corroborating evidence)">
                        Low (Insufficient corroborating evidence)
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {!submitted ? (
                <button
                  type="submit"
                  className="arcade-btn-primary arcade-btn-cyan full"
                  style={{ width: '100%', marginTop: '24px', padding: '18px', fontSize: '16px' }}
                  disabled={disabled || loading || !report.primaryConclusion.trim() || !report.keyEvidence.trim()}
                >
                  {loading ? 'Transmitting Final Dossier…' : 'Submit Final Investigation Report (30 Pts)'} <ChevronRight size={18} />
                </button>
              ) : (
                <div className="arcade-notice notice-success" style={{ marginTop: '20px' }}>
                  <ShieldCheck size={20} />
                  <div>
                    <strong>Final Investigation Report Successfully Filed</strong>
                    <p style={{ fontSize: '11px', marginTop: '2px' }}>
                      Your 5-part report is locked on the server awaiting organizer finalization and scoring.
                    </p>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>

      {/* MODAL EXHIBIT INSPECTOR */}
      {selectedExhibit && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)', display: 'grid', placeItems: 'center', padding: '20px'
        }}>
          <div className="arcade-card" style={{ maxWidth: '650px', width: '100%', border: '2px solid var(--cyan)' }}>
            <div className="arcade-card-header header-cyan">
              <span className="card-title-badge" style={{ color: 'var(--cyan)' }}>
                {selectedExhibit.title}
              </span>
              <button type="button" onClick={() => setSelectedExhibit(null)} style={{ color: '#fff' }}>
                <X size={18} />
              </button>
            </div>
            <div className="arcade-card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="stat-label">Category: {selectedExhibit.category}</span>
                <span className={`card-stamp stamp-${selectedExhibit.stamp}`}>{selectedExhibit.stamp}</span>
              </div>
              <div className="evidence-text-box" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {selectedExhibit.fullText}
              </div>
              <div style={{ textAlign: 'right', marginTop: '16px' }}>
                <button type="button" className="arcade-btn-secondary" onClick={() => setSelectedExhibit(null)}>
                  Close Exhibit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

