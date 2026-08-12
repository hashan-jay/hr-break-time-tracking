import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MessageBar, StatusBadge } from '../components/UiBits';

function formatElapsed(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseLocalDateTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatLocalClock(value) {
  const d = parseLocalDateTime(value);
  if (!d) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function liveElapsedSeconds(outTime, nowMs) {
  const out = parseLocalDateTime(outTime);
  if (!out) return 0;
  return Math.max(0, Math.floor((nowMs - out.getTime()) / 1000));
}

export default function PortalPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [apiOnline, setApiOnline] = useState(null);
  const [board, setBoard] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const searchRef = useRef(null);

  const checkApi = useCallback(async () => {
    try {
      await api.get('/health', { timeout: 3000 });
      setApiOnline(true);
      return true;
    } catch {
      setApiOnline(false);
      return false;
    }
  }, []);

  const loadBoard = useCallback(async () => {
    const online = await checkApi();
    if (!online) {
      setBoard(null);
      return;
    }
    const { data } = await api.get('/portal/live', {
      params: { search: search || undefined },
    });
    setBoard(data);
    setNowMs(Date.now());
  }, [checkApi, search]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await loadBoard();
        if (!cancelled) setMessage('');
      } catch (err) {
        if (!cancelled) {
          setMsgType('error');
          setMessage(err.response?.data?.message || 'Could not load employee list.');
        }
      }
    };
    run();
    const timer = setInterval(run, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loadBoard]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const employeesView = useMemo(() => {
    const list = board?.employees || [];
    return list.map((e) => {
      if (!e.isOnBreak || !e.currentOutTime) return e;
      const openSeconds = liveElapsedSeconds(e.currentOutTime, nowMs);
      const closedSeconds = Math.max(0, (e.totalBreakSecondsToday || 0) - (e.currentBreakElapsedSeconds || 0));
      const totalSeconds = closedSeconds + openSeconds;
      return {
        ...e,
        currentBreakElapsedSeconds: openSeconds,
        totalBreakSecondsToday: totalSeconds,
        totalBreakDisplay: formatElapsed(totalSeconds),
      };
    });
  }, [board, nowMs]);

  const selected = useMemo(
    () => employeesView.find((e) => e.employeeId === selectedId) || null,
    [employeesView, selectedId],
  );

  const captureToggle = async () => {
    if (!apiOnline) {
      setMsgType('error');
      setMessage('API is offline. Start the backend first.');
      return;
    }
    if (!selectedId) {
      setMsgType('error');
      setMessage('Select your name from the list first.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/portal/toggle', { employeeId: selectedId });
      setMsgType('success');
      setMessage(
        data.isOnBreak
          ? `Break started for ${data.fullName} at ${formatLocalClock(data.currentOutTime)}.`
          : `Break ended for ${data.fullName}. Today total: ${data.totalBreakDisplay}.`,
      );
      await loadBoard();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Could not record break time.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        captureToggle();
      } else if (e.key === '/' && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, busy, apiOnline]);

  const onStaffLogin = async (e) => {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    try {
      await login(userName, password);
      navigate('/app');
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Login failed. Check username and password.');
    } finally {
      setLoginBusy(false);
    }
  };

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="brand">
          <div className="brand-mark">HR</div>
          <div>
            <div className="brand-title">BreakTime</div>
            <div className="brand-sub">Employee Portal</div>
          </div>
        </div>

        <div className={`api-status ${apiOnline ? 'online' : apiOnline === false ? 'offline' : 'checking'}`}>
          <span className="api-dot" aria-hidden="true" />
          <span>
            {apiOnline === null && 'Checking API…'}
            {apiOnline === true && 'API online'}
            {apiOnline === false && 'API offline'}
          </span>
        </div>

        <div className="portal-login-card">
          <h2>Staff login</h2>
          <p>HR Manager, HR Assistant, and Developer access.</p>
          {isAuthenticated ? (
            <div className="portal-staff-signed-in">
              <strong>{user?.fullName}</strong>
              <span>{user?.roles?.join(', ')}</span>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/app')}>
                Open staff console
              </button>
            </div>
          ) : (
            <form onSubmit={onStaffLogin} className="portal-login-form">
              {loginError && <MessageBar message={loginError} type="error" onClose={() => setLoginError('')} />}
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
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit" disabled={loginBusy || apiOnline === false}>
                {loginBusy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>

        <div className="portal-help">
          <strong>How to use</strong>
          <ol>
            <li>Search your name or employee ID</li>
            <li>Click your row to select</li>
            <li>Press <kbd>Enter</kbd> or <kbd>Space</kbd> to start/stop break</li>
          </ol>
        </div>
      </aside>

      <main className="portal-main">
        <header className="page-header">
          <div>
            <h1>Employee Break Portal</h1>
            <p>
              No login needed. Select yourself and press Enter/Space to record out-time or in-time.
              Daily limit: {board?.dailyLimitMinutes ?? 20} minutes.
            </p>
          </div>
          <div className="header-stats">
            <span>On break: {board?.onBreakCount ?? 0}</span>
          </div>
        </header>

        <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

        {!apiOnline && apiOnline !== null && (
          <div className="message-bar message-error">
            Backend is offline. Run <code>dotnet watch run</code> in HRTimeTracking.Api.
          </div>
        )}

        <div className="toolbar">
          <input
            ref={searchRef}
            className="search"
            placeholder="Search by name or employee ID…  (/ to focus)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="tracking-layout portal-tracking">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Today</th>
                  <th>Status</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {employeesView.map((e) => (
                  <tr
                    key={e.employeeId}
                    className={`${selectedId === e.employeeId ? 'selected' : ''} ${e.isOnBreak ? 'on-break' : ''}`}
                    onClick={() => setSelectedId(e.employeeId)}
                  >
                    <td>{e.employeeCode}</td>
                    <td>{e.fullName}</td>
                    <td>{e.departmentName}</td>
                    <td>
                      <strong>{e.totalBreakDisplay}</strong>
                      <div className="muted">{e.totalBreakSecondsToday ?? 0}s</div>
                    </td>
                    <td><StatusBadge status={e.status} color={e.statusColor} /></td>
                    <td>
                      {e.isOnBreak
                        ? `On break (${formatElapsed(e.currentBreakElapsedSeconds)})`
                        : 'In office'}
                    </td>
                  </tr>
                ))}
                {apiOnline && !employeesView.length && (
                  <tr><td colSpan={6} className="empty">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="capture-panel">
            <h2>Record break</h2>
            {selected ? (
              <>
                <div className="selected-employee">
                  <strong>{selected.fullName}</strong>
                  <span>{selected.employeeCode} · {selected.departmentName}</span>
                  <StatusBadge status={selected.status} color={selected.statusColor} />
                  <div className="selected-meta">
                    <div>Today: <strong>{selected.totalBreakDisplay}</strong></div>
                    <div>
                      {selected.isOnBreak
                        ? `Out since ${formatLocalClock(selected.currentOutTime)}`
                        : 'Ready to start break'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className={`btn ${selected.isOnBreak ? 'btn-in' : 'btn-out'} btn-xl`}
                  disabled={busy || !apiOnline}
                  onClick={captureToggle}
                >
                  {selected.isOnBreak ? 'End break (Enter / Space)' : 'Start break (Enter / Space)'}
                </button>
              </>
            ) : (
              <p className="hint">Select your name in the list, then press Enter or Space.</p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
