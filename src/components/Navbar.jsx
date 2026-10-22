import React from 'react';
import { Shield, LogOut, Radio, UserCheck } from 'lucide-react';

export default function Navbar({ session, admin, onSignOut, onOrganizer, setPage, participantState }) {
  const team = participantState?.team;

  return (
    <header className="topbar">
      {/* BRAND & OFFICIAL LOGO */}
      <button
        type="button"
        className="brand-wrapper"
        onClick={() => setPage?.(session && admin ? 'admin' : team ? 'lobby' : 'register')}
      >
        <img src="/langnet-logo.png" alt="LANG NET" className="brand-logo-img" />
        <div className="brand-titles">
          <div className="brand-title">
            AI DETECTIVE
          </div>
          <div className="brand-tag">
            PRESENTED BY LANG NET
          </div>
        </div>
      </button>

      {/* TOP CONTROLS */}
      <div className="topbar-controls">
        {team && !admin && (
          <div className="status-badge" style={{ borderColor: 'var(--cyan)' }}>
            <UserCheck size={13} color="var(--cyan)" />
            <span style={{ color: '#fff', fontWeight: 700 }}>{team.name}</span>
          </div>
        )}

        {admin && session ? (
          <>
            <div className="status-badge" style={{ borderColor: 'var(--amber)' }}>
              <span className="live-indicator-dot" />
              <span style={{ color: 'var(--amber)', fontWeight: 700 }}>COMMAND CENTER</span>
            </div>
            <button
              type="button"
              className="arcade-btn-sm"
              onClick={onSignOut}
              title="Sign out from organizer control"
            >
              <LogOut size={13} /> Sign Out
            </button>
          </>
        ) : (
          <button
            type="button"
            className="arcade-btn-sm"
            onClick={onOrganizer}
          >
            <Shield size={13} /> Organizer Access
          </button>
        )}
      </div>
    </header>
  );
}

