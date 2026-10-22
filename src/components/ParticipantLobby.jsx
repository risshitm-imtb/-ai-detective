import React, { useState, useEffect } from 'react';
import {
  BrainCircuit, Search, ScanEye, Fingerprint, Timer, CheckCircle2,
  Lock, AlertTriangle, Radio, Trophy, Award, RefreshCw, FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import RoundOneInvestigator from './RoundOneInvestigator.jsx';
import RoundTwoInvestigator from './RoundTwoInvestigator.jsx';
import RoundThreeInvestigator from './RoundThreeInvestigator.jsx';
import FinalInvestigationWorkspace from './FinalInvestigationWorkspace.jsx';

const roundConfig = [
  { id: 1, title: 'Human or Machine?', duration: 600, points: 20, icon: BrainCircuit, color: 'var(--violet)' },
  { id: 2, title: 'Fake or Fact?', duration: 600, points: 25, icon: Search, color: 'var(--cyan)' },
  { id: 3, title: 'Deepfake Detective', duration: 600, points: 25, icon: ScanEye, color: 'var(--emerald)' },
  { id: 4, title: 'Final Investigation', duration: 900, points: 30, icon: Fingerprint, color: 'var(--rose)' },
];

export default function ParticipantLobby({ state, clockOffset, tick, error, notice, loading, onSubmit, onRefresh }) {
  const event = state?.event;
  const currentRound = event?.current_round;
  const activeRoundMeta = roundConfig.find((r) => r.id === currentRound);
  const activeRoundState = state?.rounds?.find((r) => r.id === currentRound);

  // Victory celebration: trigger confetti once when final leaderboard is published
  useEffect(() => {
    if (event?.status === 'completed' && state?.final_results_published && state?.leaderboard?.length > 0) {
      const hasFired = sessionStorage.getItem('ai_detective_confetti_fired');
      if (!hasFired) {
        sessionStorage.setItem('ai_detective_confetti_fired', 'true');
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#00f0ff', '#ffb300', '#b026ff', '#00ff88', '#ffffff'],
          });
          setTimeout(() => {
            confetti({
              particleCount: 80,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: ['#00f0ff', '#ffb300', '#00ff88'],
            });
            confetti({
              particleCount: 80,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: ['#b026ff', '#ffb300', '#00f0ff'],
            });
          }, 350);
        } catch (err) {
          console.warn('Confetti error:', err);
        }
      }
    }
  }, [event?.status, state?.final_results_published, state?.leaderboard]);

  // Qualification check: check the most recent non-skipped round
  const previousNonSkippedRound = (state?.rounds || [])
    .filter((r) => r.id < currentRound && r.status !== 'skipped')
    .sort((a, b) => b.id - a.id)[0];

  const isQualified =
    !previousNonSkippedRound ||
    state?.qualifications?.some((q) => q.round_id === previousNonSkippedRound.id && q.qualified);

  // Authoritative remaining time calculation
  const remaining =
    activeRoundState?.status === 'paused'
      ? activeRoundState.paused_remaining_seconds
      : activeRoundState?.deadline_at
      ? Math.ceil((new Date(activeRoundState.deadline_at).getTime() - (tick + clockOffset)) / 1000)
      : null;

  const submittedMap = Object.fromEntries(
    (state?.submissions || []).map((s) => [s.challenge_id, s])
  );

  const challenges = state?.challenges || [];
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState(0);
  const currentChallenge = challenges[selectedChallengeIndex] || challenges[0] || null;

  // Reset selected challenge to Exhibit 1 whenever current round changes
  useEffect(() => {
    setSelectedChallengeIndex(0);
  }, [currentRound]);

  const currentScore = state?.scores?.find((s) => s.round_id === currentRound);
  const currentQualification = state?.qualifications?.find((q) => q.round_id === currentRound);

  return (
    <div className="participant-workspace">
      {/* TOP BANNER: TEAM PROFILE & LIVE STATUS */}
      <div className="participant-header-banner">
        <div className="team-profile-pill">
          <div className="team-avatar-box">
            {(state?.team?.name || 'T').slice(0, 2).toUpperCase()}
          </div>
          <div className="team-details">
            <h2>{state?.team?.name || 'Detective Team'}</h2>
            <p>TEAM LEAD: {state?.team?.lead_name} · USN: {state?.team?.usn || 'VERIFIED'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="arcade-btn-secondary"
            onClick={onRefresh}
            title="Refresh event status from server"
          >
            <RefreshCw size={13} /> Sync Status
          </button>

          <div className="round-countdown-box">
            <span className="stat-label">ROUND TIME:</span>
            <div className={`countdown-digits ${remaining !== null && remaining < 60 ? 'urgent' : ''}`}>
              {activeRoundState?.status === 'paused' ? 'PAUSED' : remaining !== null ? (
                `${String(Math.floor(Math.max(0, remaining) / 60)).padStart(2, '0')}:${String(Math.max(0, remaining) % 60).padStart(2, '0')}`
              ) : (
                '--:--'
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="arcade-notice notice-error" role="alert">
          <AlertTriangle size={16} /> <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="arcade-notice notice-success" role="status">
          <CheckCircle2 size={16} /> <span>{notice}</span>
        </div>
      )}

      {/* ROUND PROGRESSION CARDS */}
      <div className="round-nav-strip">
        {roundConfig.map((r) => {
          const rState = state?.rounds?.find((item) => item.id === r.id);
          const rScore = state?.scores?.find((item) => item.round_id === r.id);
          const rQual = state?.qualifications?.find((item) => item.round_id === r.id);
          const isActive = r.id === currentRound;

          return (
            <div
              key={r.id}
              className={`round-nav-card ${isActive ? 'active' : ''} ${r.id > (currentRound || 1) ? 'locked' : ''}`}
            >
              <div className="round-nav-top">
                <span className="round-nav-num">ROUND 0{r.id}</span>
                {rState?.status === 'skipped' ? (
                  <span className="cartridge-badge" style={{ color: 'var(--amber)', background: 'rgba(255, 179, 0, 0.15)' }}>
                    SKIPPED
                  </span>
                ) : rScore ? (
                  <span className="cartridge-badge" style={{ color: 'var(--amber)' }}>
                    {rScore.points} / {r.points} PTS
                  </span>
                ) : (
                  <span className="stat-label">{r.points} PTS</span>
                )}
              </div>
              <div className="round-nav-title">{r.title}</div>
              <div className="round-nav-pts">
                {rState?.status === 'skipped' ? (
                  <span style={{ color: 'var(--amber)', fontStyle: 'italic' }}>Skipped (0 pts)</span>
                ) : rState?.status === 'revealed' ? (
                  rQual?.qualified ? (
                    <span style={{ color: 'var(--emerald)' }}>✓ Qualified</span>
                  ) : (
                    <span style={{ color: 'var(--rose)' }}>Did Not Qualify</span>
                  )
                ) : isActive ? (
                  <span style={{ color: 'var(--cyan)' }}>• In Progress</span>
                ) : (
                  'Locked'
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* STATE 1: WAITING ROOM (EVENT NOT STARTED) */}
      {event?.status === 'registration' && (
        <div className="arcade-card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div className="team-avatar-box" style={{ margin: '0 auto 20px', width: '64px', height: '64px' }}>
            <Radio size={32} />
          </div>
          <span className="exhibit-badge" style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
            STATUS: WAITING FOR ORGANIZER
          </span>
          <h2 className="hero-big-title" style={{ fontSize: '32px', margin: '14px 0' }}>
            Team Briefing Room
          </h2>
          <p className="hero-tagline" style={{ maxWidth: '640px', margin: '0 auto 24px', border: 'none' }}>
            Your registration is locked in the system. The organizer will commence Round 1 shortly.
            Keep this tab open; your session will persist safely even if you refresh or experience network disconnects.
          </p>
          <div className="stat-label">Authoritative Server Time: {new Date(tick + clockOffset).toLocaleTimeString()}</div>
        </div>
      )}

      {/* STATE 2B: SKIPPED ROUND NOTICE */}
      {event?.status === 'active' && activeRoundState?.status === 'skipped' && (
        <div className="arcade-card" style={{ padding: '48px 24px', textAlign: 'center', marginBottom: '24px' }}>
          <div className="team-avatar-box" style={{ margin: '0 auto 16px', width: '56px', height: '56px', borderColor: 'var(--amber)' }}>
            <Timer size={28} color="var(--amber)" />
          </div>
          <span className="exhibit-badge" style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
            ROUND BYPASSED BY ORGANIZER
          </span>
          <h2 className="hero-big-title" style={{ fontSize: '26px', margin: '14px 0' }}>
            Round 0{currentRound}: {activeRoundMeta?.title} Was Skipped
          </h2>
          <p className="hero-tagline" style={{ maxWidth: '620px', margin: '0 auto 20px', border: 'none' }}>
            The organizer has skipped this investigation round. No submissions are required for Round {currentRound}.
            All eligible detective teams remain qualified. Stand by for the organizer to start the subsequent stage.
          </p>
          <div className="stat-label">Awaiting Next Round Launch</div>
        </div>
      )}

      {/* STATE 2: ACTIVE ROUND INVESTIGATION */}
      {event?.status === 'active' && activeRoundMeta && activeRoundState?.status !== 'revealed' && activeRoundState?.status !== 'skipped' && (
        <>
          {!isQualified ? (
            <div className="arcade-card" style={{ padding: '40px', textAlign: 'center' }}>
              <Lock size={40} color="var(--rose)" style={{ margin: '0 auto 16px' }} />
              <h2 className="hero-big-title" style={{ fontSize: '26px' }}>ROUND ACCESS RESTRICTED</h2>
              <p className="hero-tagline" style={{ margin: '12px auto', border: 'none' }}>
                Your team did not meet the qualification threshold in Round {currentRound - 1}.
                Thank you for your active participation. Final event standings will be released upon event conclusion.
              </p>
            </div>
          ) : challenges.length === 0 ? (
            <div className="arcade-card" style={{ padding: '50px', textAlign: 'center' }}>
              <Timer size={40} color="var(--cyan)" style={{ margin: '0 auto 16px' }} />
              <h2 className="hero-big-title" style={{ fontSize: '26px' }}>Preparing Case Evidence…</h2>
              <p className="form-hint" style={{ marginTop: '8px' }}>
                The organizer is finalizing challenge materials for Round {currentRound}. Please stand by.
              </p>
            </div>
          ) : (
            <div>
              {/* MULTI-EXHIBIT SWITCHER */}
              {challenges.length > 1 && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  {challenges.map((c, idx) => {
                    const isDone = Boolean(submittedMap[c.id]);
                    const isCurrent = selectedChallengeIndex === idx;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`arcade-btn-secondary ${isCurrent ? 'arcade-btn-cyan' : ''}`}
                        onClick={() => setSelectedChallengeIndex(idx)}
                        style={{ padding: '8px 16px', fontSize: '12px' }}
                      >
                        <span>EXHIBIT 0{idx + 1}: {c.content?.title || `Case ${idx + 1}`}</span>
                        {isDone && <CheckCircle2 size={13} color={isCurrent ? '#000' : 'var(--emerald)'} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* SPECIALIZED ROUND COMPONENT SELECTION */}
              {currentRound === 1 && (
                <RoundOneInvestigator
                  challenge={currentChallenge}
                  submitted={submittedMap[currentChallenge.id]}
                  disabled={activeRoundState?.status !== 'active' || (remaining !== null && remaining <= 0)}
                  onSubmit={onSubmit}
                  loading={loading}
                />
              )}

              {currentRound === 2 && (
                <RoundTwoInvestigator
                  challenge={currentChallenge}
                  submitted={submittedMap[currentChallenge.id]}
                  disabled={activeRoundState?.status !== 'active' || (remaining !== null && remaining <= 0)}
                  onSubmit={onSubmit}
                  loading={loading}
                />
              )}

              {currentRound === 3 && (
                <RoundThreeInvestigator
                  challenge={currentChallenge}
                  submitted={submittedMap[currentChallenge.id]}
                  disabled={activeRoundState?.status !== 'active' || (remaining !== null && remaining <= 0)}
                  onSubmit={onSubmit}
                  loading={loading}
                />
              )}

              {currentRound === 4 && (
                <FinalInvestigationWorkspace
                  challenge={currentChallenge}
                  submitted={submittedMap[currentChallenge.id]}
                  disabled={activeRoundState?.status !== 'active' || (remaining !== null && remaining <= 0)}
                  onSubmit={onSubmit}
                  loading={loading}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* STATE 3: ROUND COMPLETED & RESULTS REVEALED */}
      {event?.status === 'active' && activeRoundState?.status === 'revealed' && (
        <div className="arcade-card" style={{ padding: '36px', marginBottom: '24px' }}>
          <div className="arcade-card-header header-amber" style={{ margin: '-36px -36px 24px', padding: '16px 36px' }}>
            <span className="card-title-badge">ROUND {currentRound} RESULTS REVEALED</span>
            <span className="cartridge-badge">ORGANIZER REVIEW COMPLETE</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: '#fff' }}>
                Your Score: {currentScore?.points ?? 0} of {activeRoundMeta?.points} Points
              </h3>
              <p style={{ color: currentQualification?.qualified ? 'var(--emerald)' : 'var(--rose)', fontWeight: 700, marginTop: '4px' }}>
                {currentQualification?.qualified
                  ? '✓ Qualified for the subsequent investigation stage!'
                  : currentRound === 4
                  ? 'Final Investigation complete.'
                  : 'Did not meet the round advancement threshold.'}
              </p>
            </div>

            <div className="status-badge" style={{ borderColor: 'var(--amber)' }}>
              Standby: Awaiting Organizer to Launch Next Round
            </div>
          </div>

          {/* Prominent Round Winner Announcement */}
          {state?.round_winner && (
            <div
              style={{
                background: 'rgba(255, 179, 0, 0.08)',
                border: '2px solid var(--amber)',
                padding: '16px 20px',
                borderRadius: '8px',
                marginTop: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <Trophy size={28} color="var(--amber)" />
              <div>
                <span className="card-title-badge" style={{ color: 'var(--amber)', fontSize: '11px' }}>
                  ROUND 0{currentRound} TOP INVESTIGATOR
                </span>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: '#fff', fontWeight: 700, marginTop: '2px' }}>
                  {state.round_winner.team_name} — {state.round_winner.points} Points
                </div>
              </div>
            </div>
          )}

          {/* VERIFIED DEBRIEF */}
          {state?.debrief?.length > 0 && (
            <div style={{ marginTop: '28px', borderTop: '2px solid var(--border-arcade)', paddingTop: '20px' }}>
              <span className="stat-label" style={{ color: 'var(--cyan)' }}>OFFICIAL FORENSIC ANSWER KEY & DEBRIEF</span>
              {state.debrief.map((item, idx) => (
                <div key={idx} className="evidence-text-box" style={{ marginTop: '12px' }}>
                  <div style={{ color: 'var(--amber)', fontWeight: 700, marginBottom: '6px' }}>
                    Correct Conclusion: {JSON.stringify(item.answer)}
                  </div>
                  <div style={{ color: '#fff', fontSize: '13px', lineHeight: '1.6' }}>
                    {item.explanation}
                  </div>
                  {item.verification_notes && (
                    <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '8px' }}>
                      Verification Notes: {item.verification_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STATE 4A: EVENT COMPLETED (LEADERBOARD UNPUBLISHED - STAND BY) */}
      {event?.status === 'completed' && !state?.final_results_published && (
        <div className="arcade-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div className="team-avatar-box" style={{ margin: '0 auto 20px', width: '64px', height: '64px' }}>
            <Award size={32} color="var(--amber)" />
          </div>
          <span className="exhibit-badge" style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
            INVESTIGATION CONCLUDED · TABULATING FINAL RESULTS
          </span>
          <h2 className="hero-big-title" style={{ fontSize: '32px', margin: '14px 0' }}>
            Final Standings Under Review
          </h2>
          <p className="hero-tagline" style={{ maxWidth: '640px', margin: '0 auto 24px', border: 'none' }}>
            All four investigation rounds have concluded! The organizers are verifying final submissions and scoring prompt engineering reports.
            The official leaderboard and podium will be published shortly. Stand by!
          </p>
          <button
            type="button"
            className="arcade-btn-secondary"
            onClick={onRefresh}
            title="Check if final standings have been published"
            style={{ padding: '12px 24px' }}
          >
            <RefreshCw size={14} /> Refresh Standings
          </button>
        </div>
      )}

      {/* STATE 4B: EVENT COMPLETED (OFFICIAL FINAL STANDINGS PUBLISHED) */}
      {event?.status === 'completed' && state?.final_results_published && (
        <div className="arcade-card" style={{ padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <Award size={48} color="var(--amber)" style={{ margin: '0 auto 12px' }} />
            <h2 className="hero-big-title" style={{ fontSize: '36px' }}>AI Detective Investigation Concluded</h2>
            <p className="hero-tagline" style={{ margin: '10px auto', border: 'none' }}>
              All 4 investigation rounds are finalized. Standings reflect server-verified scores and prompt engineering evaluations.
            </p>
          </div>

          <div className="data-table-wrap">
            <table className="arcade-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Total Score</th>
                  <th>Final Round Score</th>
                  <th>Round Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {(state?.leaderboard || []).map((row) => (
                  <tr key={row.rank} style={{ background: row.team_name === state?.team?.name ? 'rgba(0, 240, 255, 0.08)' : 'transparent' }}>
                    <td style={{ fontWeight: 900, color: row.rank === 1 ? 'var(--amber)' : '#fff' }}>
                      #{row.rank}
                    </td>
                    <td style={{ fontWeight: 700, color: '#fff' }}>
                      {row.team_name}
                      {row.team_name === state?.team?.name && <span className="cartridge-badge" style={{ marginLeft: '8px' }}>Your Team</span>}
                    </td>
                    <td style={{ fontWeight: 900, fontSize: '15px', color: 'var(--amber)' }}>
                      {row.total_score} pts
                    </td>
                    <td>{row.final_round_score} pts</td>
                    <td>
                      {roundConfig.map((rc) => {
                        const rState = state?.rounds?.find((item) => item.id === rc.id);
                        if (rState?.status === 'skipped') {
                          return `R${rc.id}: Skipped`;
                        }
                        const pts = row.round_scores?.[rc.id] ?? row.round_scores?.[String(rc.id)] ?? 0;
                        return `R${rc.id}: ${pts}pts`;
                      }).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

