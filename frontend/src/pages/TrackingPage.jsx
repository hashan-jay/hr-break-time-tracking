import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { LoadingBlock, MessageBar, StatusBadge } from '../components/UiBits';
import {
  BREAK_TYPES,
  enrichEmployeesLive,
  formatElapsed,
  formatLocalClock,
  typeFields,
} from '../lib/breakHelpers';

function BreakTypeBoard({
  title,
  subtitle,
  breakType,
  limitMinutes,
  employees,
  selectedId,
  onSelect,
  onToggle,
  onOut,
  onIn,
  busy,
  emptyLabel,
}) {
  const selected = employees.find((e) => e.employeeId === selectedId) || null;
  const selectedFields = selected ? typeFields(selected, breakType) : null;
  const onThisBreak = selectedFields?.isOnThisBreak;
  const blockedByOther = selected?.isOnBreak && !onThisBreak;

  return (
    <section className="break-type-board">
      <header className="break-type-board__header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle} Daily limit: <strong>{limitMinutes ?? '—'} minutes</strong>.</p>
        </div>
        <div className="break-type-board__chip">
          On break{' '}
          <strong>
            {employees.filter((e) => typeFields(e, breakType).isOnThisBreak).length}
          </strong>
        </div>
      </header>

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
              {employees.map((e) => {
                const fields = typeFields(e, breakType);
                return (
                  <tr
                    key={`${breakType}-${e.employeeId}`}
                    className={`${selectedId === e.employeeId ? 'selected' : ''} ${fields.isOnThisBreak ? 'on-break' : ''}`}
                    onClick={() => onSelect(e.employeeId)}
                  >
                    <td>{e.employeeCode}</td>
                    <td>{e.fullName}</td>
                    <td>{e.departmentName}</td>
                    <td>
                      <strong>{fields.totalDisplay}</strong>
                      <div className="muted">{fields.totalSeconds}s</div>
                    </td>
                    <td><StatusBadge status={fields.status} color={fields.statusColor} /></td>
                    <td>
                      {fields.isOnThisBreak
                        ? `On ${breakType.toLowerCase()} break (${formatElapsed(e.currentBreakElapsedSeconds)}) · out ${formatLocalClock(e.currentOutTime)}`
                        : e.isOnBreak
                          ? `On ${e.currentBreakType} break`
                          : 'In office'}
                    </td>
                  </tr>
                );
              })}
              {!employees.length && (
                <tr><td colSpan={6} className="empty">{emptyLabel}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="capture-panel">
          <h2>Capture {title}</h2>
          {selected && selectedFields ? (
            <>
              <div className="selected-employee">
                <strong>{selected.fullName}</strong>
                <span>{selected.employeeCode} · {selected.departmentName}</span>
                <StatusBadge status={selectedFields.status} color={selectedFields.statusColor} />
                <div className="selected-meta">
                  <div>
                    Today {breakType.toLowerCase()} total:{' '}
                    <strong>{selectedFields.totalDisplay}</strong> ({selectedFields.totalSeconds}s)
                  </div>
                  <div>
                    {onThisBreak
                      ? `Out since ${formatLocalClock(selected.currentOutTime)} · open ${formatElapsed(selected.currentBreakElapsedSeconds)}`
                      : blockedByOther
                        ? `Currently on ${selected.currentBreakType} break — end that first`
                        : 'Currently in office'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`btn ${onThisBreak ? 'btn-in' : 'btn-out'} btn-xl`}
                disabled={busy || blockedByOther}
                onClick={() => onToggle(breakType)}
              >
                {onThisBreak
                  ? `End ${breakType} break (Space / Enter)`
                  : `Start ${breakType} break (Enter / Space)`}
              </button>
              <div className="capture-split">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || selected.isOnBreak}
                  onClick={() => onOut(breakType)}
                >
                  Out only (O)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || !onThisBreak}
                  onClick={() => onIn(breakType)}
                >
                  In only (I)
                </button>
              </div>
              <p className="hint">
                Meal and Comfort are tracked separately. Only one break can be open at a time.
              </p>
            </>
          ) : (
            <p className="hint">Select an employee from the list to capture {breakType.toLowerCase()} break time.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

export default function TrackingPage() {
  const [board, setBoard] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [shiftId2, setShiftId2] = useState('');
  const [activeType, setActiveType] = useState(BREAK_TYPES.MEAL);
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
    Promise.all([api.get('/departments'), api.get('/shifts')])
      .then(([deptRes, shiftRes]) => {
        setDepartments(deptRes.data || []);
        setShifts(shiftRes.data || []);
      })
      .catch(() => {});
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

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const employeesView = useMemo(
    () => enrichEmployeesLive(board?.employees, nowMs),
    [board, nowMs],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (!employeesView.some((e) => e.employeeId === selectedId)) setSelectedId(null);
  }, [employeesView, selectedId]);

  const capture = async (mode, breakType) => {
    if (!selectedId) {
      setMsgType('error');
      setMessage('Select an employee first.');
      return;
    }
    setBusy(true);
    try {
      const endpoint = mode === 'toggle' ? '/breaks/toggle' : mode === 'out' ? '/breaks/out' : '/breaks/in';
      const { data } = await api.post(endpoint, { employeeId: selectedId, breakType });
      setMsgType('success');
      setMessage(
        data.isOnBreak
          ? `${breakType} out-time captured for ${data.fullName} at ${formatLocalClock(data.currentOutTime)}.`
          : `${breakType} in-time captured for ${data.fullName}.`,
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
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        capture('toggle', activeType);
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        capture('out', activeType);
      } else if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        capture('in', activeType);
      } else if (e.key === '/' && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, busy, activeType]);

  if (!board && !message) return <LoadingBlock label="Loading live tracking…" />;

  return (
    <div className="page tracking-page">
      <header className="page-header">
        <div>
          <h1>Live Tracking</h1>
          <p>
            Capture Meal Break and Comfort Break separately. Select an employee in a section, then press{' '}
            <kbd>Enter</kbd> / <kbd>Space</kbd> to toggle. Times use this PC&apos;s local clock.
          </p>
        </div>
        <div className="header-stats">
          <span>On break: {board?.onBreakCount ?? 0}</span>
          <span>Meal: {board?.mealOnBreakCount ?? 0}</span>
          <span>Comfort: {board?.comfortOnBreakCount ?? 0}</span>
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

      <div className="break-type-stack">
        <div
          className={`break-type-focus ${activeType === BREAK_TYPES.MEAL ? 'is-active' : ''}`}
          onFocusCapture={() => setActiveType(BREAK_TYPES.MEAL)}
          onMouseDown={() => setActiveType(BREAK_TYPES.MEAL)}
        >
          <BreakTypeBoard
            title="Meal Break"
            subtitle="Lunch / meal time tracking."
            breakType={BREAK_TYPES.MEAL}
            limitMinutes={board?.mealLimitMinutes}
            employees={employeesView}
            selectedId={activeType === BREAK_TYPES.MEAL ? selectedId : null}
            onSelect={(id) => {
              setActiveType(BREAK_TYPES.MEAL);
              setSelectedId(id);
            }}
            onToggle={(t) => capture('toggle', t)}
            onOut={(t) => capture('out', t)}
            onIn={(t) => capture('in', t)}
            busy={busy}
            emptyLabel="No employees found."
          />
        </div>

        <div
          className={`break-type-focus ${activeType === BREAK_TYPES.COMFORT ? 'is-active' : ''}`}
          onFocusCapture={() => setActiveType(BREAK_TYPES.COMFORT)}
          onMouseDown={() => setActiveType(BREAK_TYPES.COMFORT)}
        >
          <BreakTypeBoard
            title="Comfort Break"
            subtitle="Short comfort break tracking."
            breakType={BREAK_TYPES.COMFORT}
            limitMinutes={board?.comfortLimitMinutes}
            employees={employeesView}
            selectedId={activeType === BREAK_TYPES.COMFORT ? selectedId : null}
            onSelect={(id) => {
              setActiveType(BREAK_TYPES.COMFORT);
              setSelectedId(id);
            }}
            onToggle={(t) => capture('toggle', t)}
            onOut={(t) => capture('out', t)}
            onIn={(t) => capture('in', t)}
            busy={busy}
            emptyLabel="No employees found."
          />
        </div>
      </div>
    </div>
  );
}
