import React, { useState, useEffect } from 'react';
import {
  Play, Pause, FastForward, CheckSquare, Search, Award,
  Users, Shield, FileText, ChevronRight, AlertTriangle,
  RotateCcw, CheckCircle2, ChevronDown, ChevronUp, Clock,
  ArrowRight, Radio, Lock, Trophy, SkipForward
} from 'lucide-react';

const roundsMeta = [
  { id: 1, title: 'Human or Machine?', duration: 600, points: 20 },
  { id: 2, title: 'Fake or Fact?', duration: 600, points: 25 },
  { id: 3, title: 'Deepfake Detective', duration: 600, points: 25 },
  { id: 4, title: 'The Final Investigation', duration: 900, points: 30 },
];

export default function AdminCommandCenter({ event, stats, remaining, adminAction, loading, onSignOut }) {
  // Exactly 4 tabs requested: lifecycle, teams, submissions, leaderboard
  const [activeTab, setActiveTab] = useState('lifecycle');
  const [teamSearch, setTeamSearch] = useState('');
  const [submissionFilterRound, setSubmissionFilterRound] = useState('all');
  const [showScoreAdjustment, setShowScoreAdjustment] = useState(false);

  // Per-round configurable timer state (in minutes) - 10m default for R1-R3, 15m for R4
  const [round1Minutes, setRound1Minutes] = useState(10);
  const [nextRoundMinutes, setNextRoundMinutes] = useState(10);

  // Audited Score Adjustment State
  const [scoreTeam, setScoreTeam] = useState('');
  const [scoreRound, setScoreRound] = useState('1');
  const [scorePoints, setScorePoints] = useState('0');
  const [scoreReason, setScoreReason] = useState('');

  const status = event?.event?.status || 'registration';
  const currentRound = event?.event?.current_round;
  const activeRoundMeta = roundsMeta.find((r) => r.id === currentRound);
  const activeRoundState = event?.rounds?.find((r) => r.id === currentRound);
  const finalResultsPublished = Boolean(event?.event?.final_results_published);

  // Sync nextRoundMinutes whenever currentRound changes
  useEffect(() => {
    if (currentRound === 1) setNextRoundMinutes(10);
    else if (currentRound === 2) setNextRoundMinutes(10);
    else if (currentRound === 3) setNextRoundMinutes(15);
  }, [currentRound]);

  // Telemetry: submission tracking for current active round
  const currentRoundSubmissions = (stats?.submissions_detail || []).filter(
    (s) => Number(s.round_id) === Number(currentRound)
  );
  const uniqueSubmittedTeams = new Set(currentRoundSubmissions.map((s) => s.team_name)).size;
  const expectedTeamsCount = currentRound === 1
    ? (Number(stats?.teams) || (stats?.teams_detail || []).length || 0)
    : (Number(stats?.qualified) || 0);

  // Telemetry: Round winner for revealed results
  const currentRoundScores = (stats?.results || []).filter(
    (r) => Number(r.round_id) === Number(currentRound)
  );
  const roundWinner = currentRoundScores.length > 0
    ? [...currentRoundScores].sort((a, b) => (b.points || 0) - (a.points || 0))[0]
    : null;

  // Determine Next Round in sequence
  const nextRoundMeta = currentRound
    ? roundsMeta.find((r) => r.id === currentRound + 1)
    : roundsMeta[0];

  // Formatted status label
  const statusDisplay =
    status === 'completed'
      ? 'Completed'
      : activeRoundState?.status === 'paused'
      ? 'Paused'
      : status === 'active'
      ? 'Live'
      : 'Not Started';

  // Filtered teams
  const filteredTeams = (stats?.teams_detail || []).filter((t) => {
    const q = teamSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.usn && t.usn.toLowerCase().includes(q)) ||
      (t.lead_name && t.lead_name.toLowerCase().includes(q))
    );
  });

  // Filtered submissions
  const filteredSubmissions = (stats?.submissions_detail || []).filter((s) => {
    if (submissionFilterRound === 'all') return true;
    return String(s.round_id) === String(submissionFilterRound);
  });

  const handleAdjustScoreSubmit = (e) => {
    e.preventDefault();
    if (!scoreTeam || scoreReason.trim().length < 10) return;
    adminAction(
      'adjust_score',
      {
        p_team: scoreTeam,
        p_round: Number(scoreRound),
        p_points: Number(scorePoints),
        p_reason: scoreReason.trim(),
      },
      `Apply manual score adjustment of ${scorePoints} points to this team for Round ${scoreRound}? This will be recorded in the audit log.`
    );
    setScoreReason('');
  };

  return (
    <div className="admin-workspace">
      {/* ORGANIZER HEADER */}
      <div className="admin-header-row">
        <div>
          <span className="exhibit-badge" style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
            <Shield size={14} /> AUTHORIZED ORGANIZER CONTROLLER
          </span>
          <h1 className="hero-big-title" style={{ fontSize: '32px', marginTop: '6px' }}>
            Event Command Center
          </h1>
          <p className="form-hint">
            Presenter switchboard for live round management, team tracking, and leaderboard publication.
          </p>
        </div>

        <div>
          <button type="button" className="arcade-btn-sm" onClick={onSignOut}>
            Sign Out Organizer
          </button>
        </div>
      </div>

      {/* EXACTLY 4 TABS AS REQUESTED */}
      <div className="case-workspace-tabs" style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'lifecycle' ? 'active' : ''}`}
          onClick={() => setActiveTab('lifecycle')}
        >
          <Play size={15} /> Event Lifecycle
        </button>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <Users size={15} /> Teams ({stats?.teams_detail?.length ?? 0})
        </button>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('submissions')}
        >
          <FileText size={15} /> Submissions & Review ({stats?.submissions_detail?.length ?? 0})
        </button>
        <button
          type="button"
          className={`case-tab-btn ${activeTab === 'standings' ? 'active' : ''}`}
          onClick={() => setActiveTab('standings')}
        >
          <Award size={15} /> Live Standings & Results
        </button>
      </div>

      {/* =========================================================================
          TAB 1: REDESIGNED EVENT LIFECYCLE (PRESENTER-FRIENDLY HUD & CONTROLS)
          ========================================================================= */}
      {activeTab === 'lifecycle' && (
        <div>
          {/* PRESENTER HUD TELEMETRY GRID */}
          <div className="admin-stats-grid" style={{ marginBottom: '24px' }}>
            <div className="admin-stat-card">
              <div className="stat-label">Event Status</div>
              <div
                className="stat-value"
                style={{
                  color:
                    statusDisplay === 'Live'
                      ? 'var(--emerald)'
                      : statusDisplay === 'Paused'
                      ? 'var(--rose)'
                      : 'var(--amber)',
                }}
              >
                {statusDisplay}
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-label">Current Round</div>
              <div className="stat-value" style={{ color: 'var(--cyan)', fontSize: '18px', lineHeight: '1.3' }}>
                {activeRoundMeta ? `R${activeRoundMeta.id}: ${activeRoundMeta.title}` : 'Lobby (Pre-Event)'}
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-label">Remaining Time</div>
              <div
                className="stat-value"
                style={{
                  color: remaining !== null && remaining < 60 ? 'var(--rose)' : 'var(--amber)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {activeRoundState?.status === 'paused'
                  ? 'PAUSED'
                  : remaining !== null
                  ? `${String(Math.floor(Math.max(0, remaining) / 60)).padStart(2, '0')}:${String(
                      Math.max(0, remaining) % 60
                    ).padStart(2, '0')}`
                  : '—:—'}
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-label">Registered Teams</div>
              <div className="stat-value">{stats?.teams ?? 0} Teams</div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-label">Submissions Logged</div>
              <div className="stat-value" style={{ color: 'var(--violet-bright)' }}>
                {status === 'active' && currentRound
                  ? `${uniqueSubmittedTeams} / ${expectedTeamsCount} Teams`
                  : `${stats?.submissions ?? 0}`}
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="stat-label">Next in Sequence</div>
              <div className="stat-value" style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.3' }}>
                {status === 'completed'
                  ? 'Event Complete'
                  : nextRoundMeta && currentRound !== 4
                  ? `R${nextRoundMeta.id}: ${nextRoundMeta.title}`
                  : 'Final Stage'}
              </div>
            </div>
          </div>

          {/* ROUND PIPELINE PROGRESSION TRACK */}
          <div className="arcade-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span className="card-title-badge" style={{ fontSize: '12px' }}>EVENT ROUND PIPELINE</span>
              <span className="form-hint" style={{ margin: 0, fontSize: '11px' }}>4 Total Investigation Stages</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {roundsMeta.map((r) => {
                const rState = event?.rounds?.find((item) => item.id === r.id);
                const isCurrent = r.id === currentRound;
                const isSkipped = rState?.status === 'skipped';
                const isRevealed = rState?.status === 'revealed';
                const isActive = isCurrent && rState?.status === 'active';
                const isPaused = isCurrent && rState?.status === 'paused';

                return (
                  <div
                    key={r.id}
                    style={{
                      background: isCurrent ? 'rgba(0, 240, 255, 0.06)' : 'rgba(15, 23, 42, 0.6)',
                      border: `1.5px solid ${
                        isSkipped
                          ? 'var(--amber)'
                          : isRevealed
                          ? 'var(--emerald)'
                          : isActive
                          ? 'var(--cyan)'
                          : isPaused
                          ? 'var(--rose)'
                          : 'var(--border-arcade)'
                      }`,
                      borderRadius: '8px',
                      padding: '10px 14px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>ROUND 0{r.id}</span>
                      <span
                        className="cartridge-badge"
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          background: isSkipped
                            ? 'rgba(255, 179, 0, 0.2)'
                            : isRevealed
                            ? 'rgba(16, 185, 129, 0.2)'
                            : isActive
                            ? 'rgba(0, 240, 255, 0.2)'
                            : isPaused
                            ? 'rgba(244, 63, 94, 0.2)'
                            : 'rgba(100, 116, 139, 0.2)',
                          color: isSkipped
                            ? 'var(--amber)'
                            : isRevealed
                            ? 'var(--emerald)'
                            : isActive
                            ? 'var(--cyan)'
                            : isPaused
                            ? 'var(--rose)'
                            : 'var(--text-dim)',
                        }}
                      >
                        {isSkipped
                          ? 'SKIPPED'
                          : isRevealed
                          ? 'COMPLETED'
                          : isActive
                          ? 'ACTIVE'
                          : isPaused
                          ? 'PAUSED'
                          : 'UPCOMING'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginTop: '4px' }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                      {isSkipped ? '0 pts awarded' : `${r.points} pts max · ${Math.round(r.duration / 60)}m`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PRESENTER PRIMARY ACTION CONTROLLER */}
          <div className="arcade-card" style={{ marginBottom: '24px' }}>
            <div className="arcade-card-header header-amber">
              <span className="card-title-badge">PRESENTER LIFECYCLE ACTION CONTROLLER</span>
              <span className="status-badge">
                <span className="live-indicator-dot" /> {statusDisplay.toUpperCase()}
              </span>
            </div>

            <div className="arcade-card-body" style={{ padding: '30px' }}>
              {/* STATE 1: BEFORE EVENT (NOT STARTED) */}
              {status === 'registration' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#fff', marginBottom: '8px' }}>
                      Ready to Start the Competition
                    </h2>
                    <p className="form-hint" style={{ fontSize: '13px' }}>
                      All four rounds have built-in, verified challenges. You can adjust the Round 1 timer below, then start the event.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={13} color="var(--amber)" /> Round 1 Timer (Minutes):
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          className="form-input"
                          style={{ width: '90px', fontWeight: 700, fontSize: '15px' }}
                          value={round1Minutes}
                          onChange={(e) => setRound1Minutes(Math.max(1, Math.min(30, Number(e.target.value))))}
                        />
                        <span className="form-hint" style={{ margin: 0 }}>
                          mins ({Number(round1Minutes) * 60}s) · Default: 10m
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="arcade-btn-primary arcade-btn-cyan"
                      style={{ padding: '16px 28px', fontSize: '15px' }}
                      disabled={loading || Number(stats?.teams) === 0}
                      onClick={() =>
                        adminAction(
                          'start_event_with_duration',
                          { p_seconds: Number(round1Minutes) * 60 },
                          `Start AI DETECTIVE now with a ${round1Minutes}-minute timer for Round 1 for all teams?`
                        )
                      }
                    >
                      <Play size={18} /> START EVENT & BEGIN ROUND 1 ({round1Minutes}m)
                    </button>

                    <button
                      type="button"
                      className="arcade-btn-secondary"
                      style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
                      disabled={loading || Number(stats?.teams) === 0}
                      onClick={() =>
                        adminAction(
                          'skip_round',
                          { p_round: 1 },
                          'Are you sure you want to skip Round 1? The competition will begin directly at Round 2.'
                        )
                      }
                    >
                      <SkipForward size={16} /> Skip Round 1
                    </button>

                    {Number(stats?.teams) === 0 && (
                      <span className="form-hint" style={{ color: 'var(--rose)' }}>
                        Waiting for at least one team to register before starting.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* STATE 2: ACTIVE ROUND */}
              {status === 'active' && activeRoundState?.status === 'active' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <div className="exhibit-badge" style={{ borderColor: 'var(--cyan)', color: 'var(--cyan)' }}>
                      ROUND {currentRound} IS CURRENTLY RUNNING
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#fff', margin: '8px 0' }}>
                      Round 0{currentRound}: {activeRoundMeta?.title}
                    </h2>
                    <p className="form-hint" style={{ fontSize: '13px' }}>
                      Participants are actively investigating. Submissions are accepted until the countdown expires.
                    </p>
                  </div>

                  {/* Submission completion progress notification */}
                  {expectedTeamsCount > 0 && uniqueSubmittedTeams >= expectedTeamsCount ? (
                    <div
                      style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '2px solid var(--emerald)',
                        padding: '14px 18px',
                        borderRadius: '6px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <CheckCircle2 size={20} color="var(--emerald)" />
                      <div>
                        <div style={{ color: 'var(--emerald)', fontWeight: 800, fontSize: '14px' }}>
                          ALL TEAMS HAVE SUBMITTED ({uniqueSubmittedTeams} / {expectedTeamsCount} TEAMS) ✓
                        </div>
                        <div style={{ color: '#fff', fontSize: '12px', marginTop: '2px' }}>
                          Every active team has locked in their forensic verdict. You may close the round early to advance immediately.
                        </div>
                      </div>
                    </div>
                  ) : expectedTeamsCount > 0 ? (
                    <div style={{ marginBottom: '18px' }}>
                      <span className="stat-label">
                        Submission Progress: {uniqueSubmittedTeams} of {expectedTeamsCount} Teams Finished
                      </span>
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {remaining !== null && remaining <= 0 ? (
                      <button
                        type="button"
                        className="arcade-btn-primary arcade-btn-amber"
                        style={{ padding: '16px 28px', fontSize: '15px' }}
                        disabled={loading}
                        onClick={() =>
                          adminAction(
                            'finalize_expired_round',
                            {},
                            'Finalize Round results now? This grades eligible submissions, calculates qualification, and reveals debriefs.'
                          )
                        }
                      >
                        <CheckSquare size={18} /> FINALIZE ROUND RESULTS
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="arcade-btn-secondary"
                      disabled={loading}
                      onClick={() => adminAction('pause_round', {}, 'Pause the round timer for all teams?')}
                    >
                      <Pause size={15} /> Pause Round Timer
                    </button>

                    <button
                      type="button"
                      className="arcade-btn-secondary arcade-btn-danger"
                      disabled={loading}
                      onClick={() =>
                        adminAction(
                          'close_round_early',
                          {},
                          'Close this round early now? Submissions will cease immediately and results will finalize.'
                        )
                      }
                    >
                      <FastForward size={15} /> Close Round Early
                    </button>

                    <button
                      type="button"
                      className="arcade-btn-secondary"
                      style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
                      disabled={loading}
                      onClick={() =>
                        adminAction(
                          'skip_round',
                          { p_round: currentRound },
                          `Are you sure you want to skip Round ${currentRound}? This will immediately close the round, award 0 points, and advance the state.`
                        )
                      }
                    >
                      <SkipForward size={15} /> Skip Round {currentRound}
                    </button>
                  </div>
                </div>
              )}

              {/* STATE 3: PAUSED ROUND */}
              {status === 'active' && activeRoundState?.status === 'paused' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <div className="exhibit-badge" style={{ borderColor: 'var(--rose)', color: 'var(--rose)' }}>
                      ROUND {currentRound} IS PAUSED
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#fff', margin: '8px 0' }}>
                      Round 0{currentRound}: {activeRoundMeta?.title} (Paused)
                    </h2>
                    <p className="form-hint" style={{ fontSize: '13px' }}>
                      Countdown timer is frozen. Participant submissions are suspended until you resume.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="arcade-btn-primary arcade-btn-cyan"
                      style={{ padding: '16px 28px', fontSize: '15px' }}
                      disabled={loading}
                      onClick={() => adminAction('resume_round')}
                    >
                      <Play size={18} /> RESUME ROUND
                    </button>

                    <button
                      type="button"
                      className="arcade-btn-secondary arcade-btn-danger"
                      disabled={loading}
                      onClick={() =>
                        adminAction('close_round_early', {}, 'Close this paused round and finalize results?')
                      }
                    >
                      <FastForward size={15} /> Close Round Early
                    </button>

                    <button
                      type="button"
                      className="arcade-btn-secondary"
                      style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
                      disabled={loading}
                      onClick={() =>
                        adminAction(
                          'skip_round',
                          { p_round: currentRound },
                          `Are you sure you want to skip Round ${currentRound}? This will cease submissions, award 0 points, and advance the state.`
                        )
                      }
                    >
                      <SkipForward size={15} /> Skip Round {currentRound}
                    </button>
                  </div>
                </div>
              )}

              {/* STATE 4: ROUND FINALIZED / REVEALED */}
              {status === 'active' && activeRoundState?.status === 'revealed' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <div className="exhibit-badge" style={{ borderColor: 'var(--emerald)', color: 'var(--emerald)' }}>
                      ROUND {currentRound} COMPLETED & RESULTS REVEALED
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#fff', margin: '8px 0' }}>
                      Round 0{currentRound} Results Finalized ({stats?.qualified ?? 0} Teams Qualified)
                    </h2>
                    <p className="form-hint" style={{ fontSize: '13px' }}>
                      Participants have received their scores and verified debrief. Configure the timer and launch the next round when ready.
                    </p>
                  </div>

                  {roundWinner && (
                    <div
                      style={{
                        background: 'rgba(255, 179, 0, 0.08)',
                        border: '2px solid var(--amber)',
                        padding: '16px 20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                      }}
                    >
                      <Trophy size={32} color="var(--amber)" />
                      <div>
                        <span className="card-title-badge" style={{ color: 'var(--amber)', fontSize: '11px' }}>
                          ROUND 0{currentRound} WINNER ANNOUNCEMENT
                        </span>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#fff', fontWeight: 700, marginTop: '2px' }}>
                          {roundWinner.team_name} — {roundWinner.points} Points
                        </div>
                      </div>
                    </div>
                  )}

                  {/* COMPLETED ROUND RESULTS BREAKDOWN */}
                  {currentRoundScores.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <span className="stat-label" style={{ display: 'block', marginBottom: '8px', color: 'var(--cyan)' }}>
                        ROUND 0{currentRound} SCORES & ADVANCEMENT
                      </span>
                      <div className="data-table-wrap">
                        <table className="arcade-table">
                          <thead>
                            <tr>
                              <th>Rank</th>
                              <th>Team Name</th>
                              <th>Round {currentRound} Score</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...currentRoundScores]
                              .sort((a, b) => (b.points || 0) - (a.points || 0))
                              .map((res, idx) => (
                                <tr key={res.team_id}>
                                  <td style={{ fontWeight: 700, color: idx === 0 ? 'var(--amber)' : idx === 1 ? 'var(--cyan)' : '#fff' }}>
                                    #{idx + 1}
                                  </td>
                                  <td style={{ fontWeight: 700, color: '#fff' }}>{res.team_name}</td>
                                  <td style={{ fontWeight: 800, color: 'var(--amber)' }}>{res.points} pts</td>
                                  <td>
                                    <span className="cartridge-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--emerald)' }}>
                                      ✓ Qualified
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {currentRound < 4 ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} color="var(--cyan)" /> Round {currentRound + 1} Timer (Minutes):
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              className="form-input"
                              style={{ width: '90px', fontWeight: 700, fontSize: '15px' }}
                              value={nextRoundMinutes}
                              onChange={(e) => setNextRoundMinutes(Math.max(1, Math.min(30, Number(e.target.value))))}
                            />
                            <span className="form-hint" style={{ margin: 0 }}>
                              mins ({Number(nextRoundMinutes) * 60}s) · Default: {currentRound === 3 ? '15m' : '10m'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="arcade-btn-primary arcade-btn-cyan"
                          style={{ padding: '16px 28px', fontSize: '15px' }}
                          disabled={loading || Number(stats?.teams) === 0}
                          onClick={() =>
                            adminAction(
                              'start_next_round_with_duration',
                              { p_round: currentRound + 1, p_seconds: Number(nextRoundMinutes) * 60 },
                              `Start Round ${currentRound + 1}: "${roundsMeta[currentRound]?.title}" for ${nextRoundMinutes} minutes for all teams?`
                            )
                          }
                        >
                          <Play size={18} /> START ROUND {currentRound + 1}: {roundsMeta[currentRound]?.title} ({nextRoundMinutes}m)
                        </button>

                        <button
                          type="button"
                          className="arcade-btn-secondary"
                          style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
                          disabled={loading}
                          onClick={() =>
                            adminAction(
                              'skip_round',
                              { p_round: currentRound + 1 },
                              `Are you sure you want to skip Round ${currentRound + 1}: "${roundsMeta[currentRound]?.title}"? This changes the event flow and cannot be undone.`
                            )
                          }
                        >
                          <SkipForward size={16} /> Skip Round {currentRound + 1}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="arcade-btn-primary arcade-btn-amber"
                      style={{ padding: '16px 28px', fontSize: '15px' }}
                      disabled={loading}
                      onClick={() =>
                        adminAction(
                          'end_event',
                          {},
                          'Conclude AI DETECTIVE? This prepares the final standings for organizer review.'
                        )
                      }
                    >
                      <Award size={18} /> END EVENT & REVIEW FINAL STANDINGS
                    </button>
                  )}
                </div>
              )}

              {/* STATE 4B: CURRENT ROUND SKIPPED */}
              {status === 'active' && activeRoundState?.status === 'skipped' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <div className="exhibit-badge" style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
                      ROUND {currentRound} WAS SKIPPED
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#fff', margin: '8px 0' }}>
                      Round 0{currentRound}: {activeRoundMeta?.title} (Skipped)
                    </h2>
                    <p className="form-hint" style={{ fontSize: '13px' }}>
                      This round was bypassed by the organizer. 0 points are awarded. All eligible teams remain qualified for subsequent stages.
                    </p>
                  </div>

                  {currentRound < 4 ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={13} color="var(--cyan)" /> Round {currentRound + 1} Timer (Minutes):
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              min="1"
                              max="30"
                              className="form-input"
                              style={{ width: '90px', fontWeight: 700, fontSize: '15px' }}
                              value={nextRoundMinutes}
                              onChange={(e) => setNextRoundMinutes(Math.max(1, Math.min(30, Number(e.target.value))))}
                            />
                            <span className="form-hint" style={{ margin: 0 }}>
                              mins ({Number(nextRoundMinutes) * 60}s) · Default: {currentRound === 3 ? '15m' : '10m'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="arcade-btn-primary arcade-btn-cyan"
                          style={{ padding: '16px 28px', fontSize: '15px' }}
                          disabled={loading}
                          onClick={() =>
                            adminAction(
                              'start_next_round_with_duration',
                              { p_round: currentRound + 1, p_seconds: Number(nextRoundMinutes) * 60 },
                              `Start Round ${currentRound + 1}: "${roundsMeta[currentRound]?.title}" for ${nextRoundMinutes} minutes for all eligible teams?`
                            )
                          }
                        >
                          <Play size={18} /> START ROUND {currentRound + 1}: {roundsMeta[currentRound]?.title} ({nextRoundMinutes}m)
                        </button>

                        <button
                          type="button"
                          className="arcade-btn-secondary"
                          style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
                          disabled={loading}
                          onClick={() =>
                            adminAction(
                              'skip_round',
                              { p_round: currentRound + 1 },
                              `Are you sure you want to skip Round ${currentRound + 1}: "${roundsMeta[currentRound]?.title}"?`
                            )
                          }
                        >
                          <SkipForward size={16} /> Skip Round {currentRound + 1}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="arcade-btn-primary arcade-btn-amber"
                      style={{ padding: '16px 28px', fontSize: '15px' }}
                      disabled={loading}
                      onClick={() =>
                        adminAction(
                          'end_event',
                          {},
                          'Conclude AI DETECTIVE? This prepares the final standings for organizer review.'
                        )
                      }
                    >
                      <Award size={18} /> END EVENT & REVIEW FINAL STANDINGS
                    </button>
                  )}
                </div>
              )}

              {/* STATE 5: EVENT COMPLETED (2-PHASE LEADERBOARD) */}
              {status === 'completed' && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <Award size={52} color="var(--amber)" style={{ margin: '0 auto 12px' }} />
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: '#fff' }}>
                    {finalResultsPublished ? 'Official Final Standings Published' : 'Final Results Staged for Review'}
                  </h2>
                  <p className="form-hint" style={{ margin: '8px auto 24px', maxWidth: '580px', fontSize: '13px' }}>
                    {finalResultsPublished
                      ? 'All 4 investigation rounds are finalized. Official final rankings and score breakdowns are live for all teams.'
                      : 'All 4 investigation rounds have completed! Review team scores in the standings tab, apply any manual adjustments if necessary, and click Publish below to reveal the official leaderboard to all participants.'}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    {!finalResultsPublished && (
                      <button
                        type="button"
                        className="arcade-btn-primary arcade-btn-amber"
                        style={{ padding: '16px 32px', fontSize: '16px' }}
                        disabled={loading}
                        onClick={() =>
                          adminAction(
                            'publish_final_results',
                            {},
                            'Publish official final leaderboard to all participants now? This will reveal rankings and trigger the victory celebration for all teams.'
                          )
                        }
                      >
                        <Award size={18} /> PUBLISH FINAL LEADERBOARD
                      </button>
                    )}

                    <button
                      type="button"
                      className="arcade-btn-secondary"
                      style={{ padding: '16px 24px', fontSize: '15px' }}
                      onClick={() => setActiveTab('standings')}
                    >
                      View Live Standings Matrix <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECONDARY COLLAPSIBLE SECTION: AUDITED MANUAL SCORE ADJUSTMENT */}
          <div className="arcade-card">
            <button
              type="button"
              className="arcade-card-header header-cyan"
              style={{ width: '100%', cursor: 'pointer', textAlign: 'left', border: 'none' }}
              onClick={() => setShowScoreAdjustment(!showScoreAdjustment)}
            >
              <span className="card-title-badge">
                AUDITED MANUAL SCORE REVIEW & ADJUSTMENT (OPTIONAL)
              </span>
              <span style={{ color: 'var(--cyan)' }}>
                {showScoreAdjustment ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            </button>

            {showScoreAdjustment && (
              <div className="arcade-card-body">
                <p className="form-hint" style={{ marginBottom: '16px' }}>
                  Use this tool during scoring review to award points for open-ended prompt engineering or nuanced uncertainty analysis.
                  Adjustments automatically update qualifications and are logged in the audit log.
                </p>

                <form onSubmit={handleAdjustScoreSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Target Team</label>
                      <select
                        className="form-input"
                        value={scoreTeam}
                        onChange={(e) => setScoreTeam(e.target.value)}
                        required
                      >
                        <option value="">Select a team...</option>
                        {(stats?.teams_detail || []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (Lead: {t.lead_name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Round</label>
                      <select
                        className="form-input"
                        value={scoreRound}
                        onChange={(e) => setScoreRound(e.target.value)}
                      >
                        {roundsMeta.map((r) => (
                          <option key={r.id} value={r.id}>
                            Round {r.id}: {r.title} (Max {r.points} pts)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Points Awarded</label>
                      <input
                        type="number"
                        min="0"
                        max={roundsMeta.find((r) => r.id === Number(scoreRound))?.points || 30}
                        className="form-input"
                        value={scorePoints}
                        onChange={(e) => setScorePoints(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Audit Reason (Min 10 chars)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Robust prompt decomposition and verified evidence citations."
                        value={scoreReason}
                        onChange={(e) => setScoreReason(e.target.value)}
                        minLength={10}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="arcade-btn-primary arcade-btn-cyan"
                      disabled={loading || !scoreTeam || scoreReason.trim().length < 10}
                    >
                      Record Adjustment
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: TEAMS (SIMPLE, SCANNABLE, SEARCHABLE)
          ========================================================================= */}
      {activeTab === 'teams' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', width: '340px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search team name, lead, or USN..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                style={{ paddingLeft: '38px' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-dim)' }} />
            </div>
            <span className="stat-label">Showing {filteredTeams.length} of {stats?.teams_detail?.length ?? 0} Teams</span>
          </div>

          <div className="data-table-wrap">
            <table className="arcade-table">
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Team Lead</th>
                  <th>USN</th>
                  <th>Roster</th>
                  <th>Status</th>
                  <th>Team Identifier</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 700, color: '#fff' }}>{t.name}</td>
                    <td>{t.lead_name || '—'}</td>
                    <td><code style={{ color: 'var(--amber)' }}>{t.usn || '—'}</code></td>
                    <td>{t.members} Registered</td>
                    <td>
                      <span className="cartridge-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)' }}>
                        ✓ Enrolled
                      </span>
                    </td>
                    <td><code style={{ fontSize: '11px', color: 'var(--cyan)' }}>{t.id.slice(0, 8)}…</code></td>
                  </tr>
                ))}
                {filteredTeams.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                      No teams match your search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SUBMISSIONS & REVIEW (INSPECT REASONING, PROMPTS, EVIDENCE)
          ========================================================================= */}
      {activeTab === 'submissions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="stat-label">Filter Round:</span>
              <select
                className="form-input"
                style={{ width: 'auto', padding: '6px 12px' }}
                value={submissionFilterRound}
                onChange={(e) => setSubmissionFilterRound(e.target.value)}
              >
                <option value="all">All Rounds</option>
                <option value="1">Round 1: Human or Machine?</option>
                <option value="2">Round 2: Fake or Fact?</option>
                <option value="3">Round 3: Deepfake Detective</option>
                <option value="4">Round 4: Final Investigation</option>
              </select>
            </div>
            <span className="stat-label">{filteredSubmissions.length} Submissions Logged</span>
          </div>

          <div className="data-table-wrap">
            <table className="arcade-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Round</th>
                  <th>Answer / Verdict</th>
                  <th>Engineered Prompt & Reasoning</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{s.team_name}</td>
                    <td>
                      <span className="cartridge-badge">Round 0{s.round_id}</span>
                    </td>
                    <td>
                      <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', maxHeight: '140px', overflowY: 'auto' }}>
                        {JSON.stringify(s.answer, null, 2)}
                      </pre>
                    </td>
                    <td style={{ minWidth: '300px', maxWidth: '450px' }}>
                      <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '140px', overflowY: 'auto' }}>
                        {s.reasoning || 'No reasoning provided.'}
                      </div>
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      {new Date(s.received_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
                {filteredSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                      No submissions logged yet for this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: LIVE STANDINGS & RESULTS (AUDIENCE / PRESENTER READY)
          ========================================================================= */}
      {activeTab === 'standings' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 className="card-title-badge" style={{ fontSize: '18px', color: 'var(--amber)' }}>
                OFFICIAL TEAM STANDINGS & QUALIFICATION MATRIX
              </h3>
              {status === 'completed' && (
                finalResultsPublished ? (
                  <span className="cartridge-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--emerald)' }}>
                    ✓ Published to Participants
                  </span>
                ) : (
                  <span className="cartridge-badge" style={{ background: 'rgba(255, 179, 0, 0.2)', color: 'var(--amber)' }}>
                    Private Organizer Preview (Unpublished)
                  </span>
                )
              )}
            </div>
            {(() => {
              const activeRounds = roundsMeta.filter(
                (rm) => event?.rounds?.find((item) => item.id === rm.id)?.status !== 'skipped'
              );
              const maxPossible = activeRounds.reduce((acc, curr) => acc + curr.points, 0);
              return (
                <p className="form-hint" style={{ marginTop: '4px' }}>
                  Server-authoritative totals. Ranking order: Total Score, Final Round Score, then Submission Timestamp. Active Maximum: {maxPossible} pts ({activeRounds.length} scored rounds).
                </p>
              );
            })()}
          </div>

          <div className="data-table-wrap">
            <table className="arcade-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  {roundsMeta.map((rm) => {
                    const rState = event?.rounds?.find((item) => item.id === rm.id);
                    const isSkipped = rState?.status === 'skipped';
                    return (
                      <th key={rm.id}>
                        Round {rm.id} {isSkipped ? '(Skipped)' : `(${rm.points})`}
                      </th>
                    );
                  })}
                  <th>Total Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.teams_detail || []).map((t, idx) => {
                  const teamScores = (stats?.results || []).filter((r) => r.team_id === t.id);
                  const total = teamScores.reduce((acc, curr) => acc + (curr.points || 0), 0);

                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 900, fontSize: '16px', color: idx === 0 ? 'var(--amber)' : idx === 1 ? 'var(--cyan)' : '#fff' }}>
                        #{idx + 1}
                      </td>
                      <td style={{ fontWeight: 700, color: '#fff' }}>
                        {t.name}
                        <small style={{ display: 'block', color: 'var(--text-dim)', fontSize: '10px' }}>Lead: {t.lead_name}</small>
                      </td>
                      {roundsMeta.map((rm) => {
                        const rState = event?.rounds?.find((item) => item.id === rm.id);
                        const isSkipped = rState?.status === 'skipped';
                        const score = teamScores.find((s) => s.round_id === rm.id);

                        if (isSkipped) {
                          return (
                            <td key={rm.id} style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '12px' }}>
                              Skipped (0 pts)
                            </td>
                          );
                        }

                        return (
                          <td key={rm.id}>
                            {score ? `${score.points} pts` : '—'}
                          </td>
                        );
                      })}
                      <td style={{ fontWeight: 900, fontSize: '16px', color: 'var(--amber)' }}>{total} pts</td>
                      <td>
                        <span className="cartridge-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--emerald)' }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(stats?.teams_detail || []).length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                      No teams registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
