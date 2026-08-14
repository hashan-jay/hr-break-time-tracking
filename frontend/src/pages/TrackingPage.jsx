import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { LoadingBlock, MessageBar, StatusBadge } from '../components/UiBits';

/** Format whole seconds as HH:MM:SS (always includes seconds). */
function formatElapsed(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Parse API local datetime (no Z) as PC local wall-clock. */
function parseLocalDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  // "2026-08-12T15:04:05" or "2026-08-12T15:04:05.123" → treat as local
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
  const d = new Date(hasZone ? normalized : normalized);
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

export default function TrackingPage() {
  const [board, setBoard] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [shiftId2, setShiftId2] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const searchRef = useRef(null);

  const load = useCallback(async () => {
    const liveRes = await api.get('/breaks/live', {
      params: {
        search: search || undefined,
        departmentId: departmentId || undefined,
        shiftId: shiftId || undefined,
        shiftId2: shiftId && shiftId2 ? shiftId2 : undefined,
      },
    });
    setBoard(liveRes.data);
    setNowMs(Date.now());
  }, [search, departmentId, shiftId, shiftId2]);

  useEffect(() => {
    Promise.all([
      api.get('/departments'),
      api.get('/shifts'),
    ])
      .then(([deptRes, shiftRes]) => {
        setDepartments(deptRes.data || []);
        setShifts(shiftRes.data || []);
      })
      .catch(() => { /* live board error handling covers UX */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await load();
        if (!cancelled) setMessage('');
      } catch (err) {
        if (!cancelled) {
          setMsgType('error');
          setMessage(err.response?.data?.message || 'Failed to load live board.');
        }
      }
    };
    run();
    const timer = setInterval(run, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load]);

  // Tick every second so open-break elapsed time is accurate to the second.
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

  useEffect(() => {
    if (!selectedId) return;
    if (!employeesView.some((e) => e.employeeId === selectedId)) {
      setSelectedId(null);
    }
  }, [employeesView, selectedId]);

  const capture = async (mode) => {
    if (!selectedId) {
      setMsgType('error');
      setMessage('Select an employee first.');
      return;
    }
    setBusy(true);
    try {
      const endpoint = mode === 'toggle' ? '/breaks/toggle' : mode === 'out' ? '/breaks/out' : '/breaks/in';
      const { data } = await api.post(endpoint, { employeeId: selectedId });
      setMsgType('success');
      setMessage(
        data.isOnBreak
          ? `Out-time captured for ${data.fullName} at ${formatLocalClock(data.currentOutTime)}.`
          : `In-time captured for ${data.fullName}. Total today: ${data.totalBreakDisplay} (${data.totalBreakSecondsToday}s).`,
      );
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(err.response?.data?.message || 'Capture failed.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        capture('toggle');
      } else if (e.key === ' ') {
        e.preventDefault();
        capture('toggle');
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        capture('out');
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        capture('in');
      } else if (e.key === '/' && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, busy]);

  if (!board && !message) return <LoadingBlock label="Loading live tracking…" />;

  return (
    <div className="page tracking-page">
      <header className="page-header">
        <div>
          <h1>Live Tracking</h1>
          <p>
            Search an employee, select them, then press <kbd>Enter</kbd> or <kbd>Space</kbd> to toggle out/in.
            Times use this PC&apos;s local clock. Daily limit: {board?.dailyLimitMinutes ?? 20} minutes (second-accurate).
          </p>
        </div>
        <div className="header-stats">
          <span>On break: {board?.onBreakCount ?? 0}</span>
          <span className="text-red">Exceeded: {board?.exceededCount ?? 0}</span>
        </div>
      </header>

      <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

      <div className="toolbar">
        <input
          ref={searchRef}
          className="search"
          placeholder="Search employee / department…  (/ to focus)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={shiftId}
          onChange={(e) => {
            const next = e.target.value;
            setShiftId(next);
            if (!next || next === shiftId2) setShiftId2('');
          }}
          aria-label="Primary shift"
        >
          <option value="">All shifts</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>{s.displayLabel || s.name}</option>
          ))}
        </select>
        <select
          value={shiftId2}
          onChange={(e) => setShiftId2(e.target.value)}
          disabled={!shiftId}
          aria-label="Overlapping shift"
          title={!shiftId ? 'Select a primary shift first' : 'Include employees from an overlapping shift'}
        >
          <option value="">No overlap</option>
          {shifts.map((s) => {
            const locked = String(s.id) === String(shiftId);
            return (
              <option key={s.id} value={s.id} disabled={locked}>
                {locked ? `${s.displayLabel || s.name} (selected)` : (s.displayLabel || s.name)}
              </option>
            );
          })}
        </select>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} aria-label="Filter by department">
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div className="tracking-layout">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Today (HH:MM:SS)</th>
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
                      ? `On break (${formatElapsed(e.currentBreakElapsedSeconds)}) · out ${formatLocalClock(e.currentOutTime)}`
                      : 'In office'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="capture-panel">
          <h2>Capture</h2>
          {selected ? (
            <>
              <div className="selected-employee">
                <strong>{selected.fullName}</strong>
                <span>{selected.employeeCode} · {selected.departmentName}</span>
                <StatusBadge status={selected.status} color={selected.statusColor} />
                <div className="selected-meta">
                  <div>Today total: <strong>{selected.totalBreakDisplay}</strong> ({selected.totalBreakSecondsToday}s)</div>
                  <div>
                    {selected.isOnBreak
                      ? `Out since ${formatLocalClock(selected.currentOutTime)} · open ${formatElapsed(selected.currentBreakElapsedSeconds)}`
                      : 'Currently in office'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`btn ${selected.isOnBreak ? 'btn-in' : 'btn-out'} btn-xl`}
                disabled={busy}
                onClick={() => capture('toggle')}
              >
                {selected.isOnBreak ? 'Capture In-Time (Space / Enter)' : 'Capture Out-Time (Enter / Space)'}
              </button>
              <div className="capture-split">
                <button type="button" className="btn btn-ghost" disabled={busy || selected.isOnBreak} onClick={() => capture('out')}>
                  Out only (O)
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy || !selected.isOnBreak} onClick={() => capture('in')}>
                  In only (I)
                </button>
              </div>
              <p className="hint">
                Each out/in pair is stored with local date-time to the second. Daily totals sum all sessions in seconds.
              </p>
            </>
          ) : (
            <p className="hint">Select an employee from the list to capture break time.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
