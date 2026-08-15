import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { MessageBar } from '../components/UiBits';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && isAuthenticated) return <Navigate to="/app" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await login(userName, password);
      navigate('/app');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Login failed. Check username and password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-portal login-screen">
      <div className="login-panel">
        <div className="login-brand">
          <div className="portal-brand__mark" aria-hidden="true">BT</div>
          <h1>Staff login</h1>
          <p className="login-usernames">
            Username of HR Manager: hrmanager<br />
            Username of HR Assistant: hrassistant
          </p>
          <Link to="/" className="login-back">Back to employee portal</Link>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <h2>Log in as HR Manager</h2>
          <p className="login-hint">Use your HR username and password to sign in.</p>
          <MessageBar message={message} type="error" onClose={() => setMessage('')} />
          <label>
            Username
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path fill="currentColor" d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                  </svg>
                )}
              </button>
            </div>
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
