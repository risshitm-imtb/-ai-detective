import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase.js';
import Navbar from './components/Navbar.jsx';
import RegistrationCard from './components/RegistrationCard.jsx';
import ParticipantLobby from './components/ParticipantLobby.jsx';
import AdminCommandCenter from './components/AdminCommandCenter.jsx';
import OrganizerSignIn from './components/OrganizerSignIn.jsx';
import './styles.css';

const errorText = (error) => {
  const message = error?.message || '';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email using the link sent from Supabase, then try signing in again.';
  if (/invalid login credentials/i.test(message)) return "We couldn't sign you in with those details. Check your email and password.";
  if (/failed to fetch|network error/i.test(message)) return "Couldn't reach the backend service. Check your connection and try again.";
  return message || 'Something went wrong. Please try again.';
};

function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState('register');
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Participant State
  const [participantState, setParticipantState] = useState(null);

  // Organizer State
  const [admin, setAdmin] = useState(false);
  const [adminEvent, setAdminEvent] = useState(null);
  const [adminStats, setAdminStats] = useState(null);

  // Authoritative Time Sync
  const [clockOffset, setClockOffset] = useState(0);
  const [tick, setTick] = useState(Date.now());

  const refreshParticipant = async () => {
    try {
      const response = await fetch('/api/participant/state', { credentials: 'same-origin', cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not restore your team registration.');
      if (payload.registered) {
        setParticipantState(payload.state);
        if (payload.state?.server_now) {
          setClockOffset(new Date(payload.state.server_now).getTime() - Date.now());
        }
        setPage((current) => (current === 'register' || current === 'lobby' ? 'lobby' : current));
      } else {
        setParticipantState(null);
        setPage((current) => (current === 'lobby' ? 'register' : current));
      }
      return payload.state || null;
    } catch (err) {
      console.warn('refreshParticipant error:', err);
      return null;
    }
  };

  const refreshAdminEvent = async () => {
    if (!supabase) throw new Error('Organizer Supabase configuration is missing.');
    const { data, error: requestError } = await supabase.rpc('get_admin_event_state');
    if (requestError) throw requestError;
    setAdminStats(data);
    setAdminEvent(data?.event || null);
    if (data?.event?.server_now) {
      setClockOffset(new Date(data.event.server_now).getTime() - Date.now());
    }
    return data;
  };

  // Restore participant session on mount
  useEffect(() => {
    let alive = true;
    const restore = async () => {
      try {
        const response = await fetch('/api/participant/state', { credentials: 'same-origin', cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not restore your team registration.');
        if (!alive) return;
        if (payload.registered) {
          setParticipantState(payload.state);
          if (payload.state?.server_now) {
            setClockOffset(new Date(payload.state.server_now).getTime() - Date.now());
          }
          setPage('lobby');
        }
      } catch (requestError) {
        if (alive) setError(errorText(requestError));
      } finally {
        if (alive) setBooting(false);
      }
    };
    void restore();
    return () => { alive = false; };
  }, []);

  // Restore organizer session
  useEffect(() => {
    if (!supabase || (page !== 'organizer-signin' && page !== 'admin')) return undefined;
    let alive = true;
    const restoreOrganizer = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getSession();
        if (authError) throw authError;
        const nextSession = data?.session || null;
        if (!alive || !nextSession) return;
        const { data: isOrganizer, error: roleError } = await supabase.rpc('is_organizer');
        if (roleError) throw roleError;
        if (!alive) return;
        if (isOrganizer) {
          await refreshAdminEvent();
          if (!alive) return;
          setSession(nextSession);
          setAdmin(true);
          setPage('admin');
        }
      } catch (authError) {
        if (alive) setError(errorText(authError));
      }
    };
    void restoreOrganizer();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setAdmin(false);
        setAdminEvent(null);
        if (page === 'admin') setPage('organizer-signin');
      }
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [page]);

  // Polling sync intervals
  useEffect(() => {
    if (!participantState || page !== 'lobby') return undefined;
    const timer = setInterval(() => {
      refreshParticipant().catch((err) => console.warn('Lobby sync error:', err));
    }, 3000);
    return () => clearInterval(timer);
  }, [participantState?.team?.id, page]);

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!admin || page !== 'admin') return undefined;
    const timer = setInterval(() => {
      refreshAdminEvent().catch((err) => console.warn('Admin sync error:', err));
    }, 4000);
    return () => clearInterval(timer);
  }, [admin, page]);

  // Participant Registration Action
  const registerTeam = async ({ teamName, leadName, usn }) => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response = await fetch('/api/participant/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamName, leadName, usn }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Team registration failed.');
      setParticipantState(payload.state);
      if (payload.state?.server_now) {
        setClockOffset(new Date(payload.state.server_now).getTime() - Date.now());
      }
      setPage('lobby');
      setNotice(`Welcome, ${leadName}! Team "${teamName}" is registered. Waiting for the organizer to commence.`);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  };

  // Participant Submit Action
  const submitAnswer = async (challenge, answer, reasoning) => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const response = await fetch('/api/participant/submit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.id,
          answer,
          reasoning,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Your submission could not be saved.');
      await refreshParticipant();
      setNotice('Forensic submission recorded on the server!');
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setLoading(false);
    }
  };

  // Organizer Sign In Action
  const signInOrganizer = async (email, password) => {
    setError('');
    setNotice('');
    if (!supabase) {
      setError('Organizer sign-in is unavailable because Supabase is not configured.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (!data.session) throw new Error('Supabase did not return an organizer session.');
      const { data: isOrganizer, error: roleError } = await supabase.rpc('is_organizer');
      if (roleError) throw roleError;
      if (!isOrganizer) {
        await supabase.auth.signOut();
        setSession(null);
        setAdmin(false);
        throw new Error('This account does not have organizer authorization.');
      }
      await refreshAdminEvent();
      setSession(data.session);
      setAdmin(true);
      setPage('admin');
    } catch (authError) {
      setError(errorText(authError));
    } finally {
      setLoading(false);
    }
  };

  const signOutOrganizer = async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(errorText(signOutError));
    setSession(null);
    setAdmin(false);
    setAdminEvent(null);
    setPage(participantState ? 'lobby' : 'register');
  };

  // Organizer Administrative Action Dispatcher
  const adminAction = async (rpc, args = {}, promptText) => {
    if (promptText && !window.confirm(promptText)) return;
    if (!supabase) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const { error: actionError } = await supabase.rpc(rpc, args);
      if (actionError) throw actionError;
      await refreshAdminEvent();
      setNotice('Action recorded in authoritative audit log.');
    } catch (actionError) {
      setError(errorText(actionError));
    } finally {
      setLoading(false);
    }
  };

  if (booting) {
    return (
      <div className="app-shell">
        <Navbar setPage={setPage} onOrganizer={() => setPage('organizer-signin')} />
        <main className="center-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
          <div className="arcade-card" style={{ maxWidth: '480px', margin: '0 auto', padding: '40px' }}>
            <div className="live-indicator-dot" style={{ margin: '0 auto 16px', width: '12px', height: '12px' }} />
            <h2 className="hero-big-title" style={{ fontSize: '24px' }}>AI DETECTIVE</h2>
            <p className="form-hint" style={{ marginTop: '8px' }}>Restoring team session & synchronizing server clock…</p>
          </div>
        </main>
      </div>
    );
  }

  const currentRound = adminEvent?.event?.current_round;
  const activeRoundDeadline = adminEvent?.rounds?.find((item) => item.id === currentRound)?.deadline_at;
  const adminRemaining = activeRoundDeadline
    ? Math.ceil((new Date(activeRoundDeadline).getTime() - (tick + clockOffset)) / 1000)
    : null;

  return (
    <div className="app-shell">
      <Navbar
        session={admin ? session : null}
        admin={admin}
        onSignOut={signOutOrganizer}
        onOrganizer={() => {
          setError('');
          setNotice('');
          setPage('organizer-signin');
        }}
        setPage={setPage}
        participantState={participantState}
      />

      {page === 'register' && (
        <RegistrationCard
          onRegister={registerTeam}
          loading={loading}
          error={error}
          notice={notice}
        />
      )}

      {page === 'lobby' && participantState && (
        <ParticipantLobby
          state={participantState}
          clockOffset={clockOffset}
          tick={tick}
          error={error}
          notice={notice}
          loading={loading}
          onSubmit={submitAnswer}
          onRefresh={refreshParticipant}
        />
      )}

      {page === 'organizer-signin' && (
        <OrganizerSignIn
          onSignIn={signInOrganizer}
          onBack={() => {
            setError('');
            setPage(participantState ? 'lobby' : 'register');
          }}
          loading={loading}
          error={error}
        />
      )}

      {page === 'admin' && admin && (
        <AdminCommandCenter
          event={adminEvent}
          stats={adminStats}
          remaining={adminRemaining}
          adminAction={adminAction}
          loading={loading}
          onSignOut={signOutOrganizer}
        />
      )}

      {/* FOOTER */}
      <footer className="footer">
        <div>
          <span>AI DETECTIVE <b>×</b> LANG NET</span>
          <span style={{ margin: '0 12px', opacity: 0.3 }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>"Question everything. Verify the evidence. Outsmart the algorithm."</span>
        </div>
        <div>
          <span style={{ color: 'var(--amber)' }}>Motto: Use LLMs & Engineer Prompts Effectively</span>
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
