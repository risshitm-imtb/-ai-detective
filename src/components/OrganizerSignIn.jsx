import React, { useState } from 'react';
import { Lock, ArrowLeft, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function OrganizerSignIn({ onSignIn, onBack, loading, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSignIn(email.trim(), password);
  };

  return (
    <div className="center-container" style={{ maxWidth: '520px' }}>
      <button
        type="button"
        className="arcade-btn-secondary"
        style={{ marginBottom: '20px' }}
        onClick={onBack}
      >
        <ArrowLeft size={14} /> Back to Participant View
      </button>

      <div className="arcade-card">
        <div className="arcade-card-header header-amber">
          <span className="card-title-badge">
            <Lock size={16} /> ORGANIZER COMMAND AUTHENTICATION
          </span>
          <span className="cartridge-badge">RESTRICTED ACCESS</span>
        </div>

        <div className="arcade-card-body">
          <p className="form-hint" style={{ marginBottom: '20px' }}>
            Authorized event controllers only. Enter your organizer credentials to access the administrative switchboard and scoring console.
          </p>

          {error && (
            <div className="arcade-notice notice-error" role="alert">
              <ShieldAlert size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin-email">
                Organizer Email
              </label>
              <input
                id="admin-email"
                type="email"
                className="form-input"
                placeholder="admin@langnet.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="arcade-btn-primary arcade-btn-amber full"
              style={{ width: '100%', marginTop: '12px' }}
              disabled={loading || !email.trim() || !password}
            >
              {loading ? 'Authenticating…' : 'Sign In to Command Center'} <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

