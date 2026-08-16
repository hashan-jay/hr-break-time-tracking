import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api, { apiErrorMessage } from '../api/client';
import { LoadingBlock, MessageBar, StatusBadge } from '../components/UiBits';
import {
  BREAK_TYPES,
  canSelectForCapture,
  enrichEmployeesLive,
  formatElapsed,
  formatLocalClock,
  isOffShift,
  offShiftReason,
  startLimitReached,
  startLimitReason,
  typeFields,
} from '../lib/breakHelpers';

function BreakTypeBoard({
  title,
  subtitle,
  breakType,
  limitMinutes,
  startLimit,
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
  const offShift = selected ? isOffShift(selected) : false;
  const startBlocked = selected ? startLimitReached(selected, breakType, startLimit) : false;
  const captureLocked = Boolean(blockedByOther || (offShift && !onThisBreak) || (startBlocked && !onThisBreak));

  return (
    <section className="break-type-board">
      <header className="break-type-board__header">
        <div>
          <h2>{title}</h2>
          <p>
            {subtitle} Daily limit: <strong>{limitMinutes ?? '—'} minutes</strong>.
            {' '}Starts allowed: <strong>{startLimit ?? '—'}</strong> per shift.
          </p>
        </div>
        <div className="break-type-board__chip">
          On break{' '}
          <strong>
            {employees.filter((e) => typeFields(e, breakType).isOnThisBreak).length}
          </strong>
        </div>
      </header>

      <div className="tracking-layout">
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
                    This shift {breakType.toLowerCase()} total:{' '}
                    <strong>{selectedFields.totalDisplay}</strong> ({selectedFields.totalSeconds}s)
                  </div>
                  <div>
                    Starts this shift:{' '}
                    <strong>{selectedFields.startCount}/{startLimit ?? '—'}</strong>
                  </div>
                  <div>
                    {onThisBreak
                      ? `Out since ${formatLocalClock(selected.currentOutTime)} · open ${formatElapsed(selected.currentBreakElapsedSeconds)}`
                      : blockedByOther
                        ? `Currently on ${selected.currentBreakType} break — end that first`
                        : offShift
                          ? offShiftReason(selected)
                          : startBlocked
                            ? startLimitReason(selected, breakType, startLimit)
                            : 'Currently in office'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`btn ${onThisBreak ? 'btn-in' : 'btn-out'} btn-xl`}
                disabled={busy || captureLocked}
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
                  disabled={busy || selected.isOnBreak || offShift || startBlocked}
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

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee</th>
                <th>Department</th>
                <th>This shift (HH:MM:SS)</th>
                <th>Status</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const fields = typeFields(e, breakType);
                const blocked = fields.blockedByOther;
                const offShift = isOffShift(e);
                const startBlocked = startLimitReached(e, breakType, startLimit);
                const selectable = canSelectForCapture(e, breakType);
                const lockReason = blocked
                  ? `On ${e.currentBreakType} break — end that first`
                  : offShift
                    ? offShiftReason(e)
                    : startBlocked
                      ? startLimitReason(e, breakType, startLimit)
                      : undefined;
                return (
                  <tr
                    key={`${breakType}-${e.employeeId}`}
                    className={[
                      selectedId === e.employeeId ? 'selected' : '',
                      fields.isOnThisBreak ? 'on-break' : '',
                      blocked ? 'on-other-break' : '',
                      offShift && !fields.isOnThisBreak ? 'off-shift' : '',
                      startBlocked && !fields.isOnThisBreak && !offShift && !blocked ? 'start-limit-reached' : '',
                    ].filter(Boolean).join(' ')}
                    aria-disabled={selectable ? undefined : 'true'}
                    title={lockReason}
                    onClick={() => {
                      if (selectable) onSelect(e.employeeId);
                    }}
                  >
                    <td>{e.employeeCode}</td>
                    <td className="col-name">{e.fullName}</td>
                    <td>{e.departmentName}</td>
                    <td className={fields.isOnThisBreak ? 'is-live-total' : undefined}>
                      <strong>{fields.totalDisplay}</strong>
                      <div className="muted">{fields.totalSeconds}s · {fields.startCount}/{startLimit ?? '—'} starts</div>
                    </td>
                    <td><StatusBadge status={fields.status} color={fields.statusColor} /></td>
                    <td>
                      {fields.isOnThisBreak
                        ? `On ${breakType.toLowerCase()} break (${formatElapsed(e.currentBreakElapsedSeconds)}) · out ${formatLocalClock(e.currentOutTime)}`
                        : blocked
                          ? `On ${e.currentBreakType} break`
                          : offShift
                            ? 'Off shift'
                            : startBlocked
                              ? 'Start limit reached'
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
  const [selectedMealId, setSelectedMealId] = useState(null);
  const [selectedComfortId, setSelectedComfortId] = useState(null);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const searchRef = useRef(null);
  const busyRef = useRef(false);

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
          setMessage(apiErrorMessage(err, 'Failed to load live board.'));
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
    () => enrichEmployeesLive(board?.employees, nowMs, {
      mealLimitMinutes: board?.mealLimitMinutes,
      comfortLimitMinutes: board?.comfortLimitMinutes,
    }),
    [board, nowMs],
  );

  useEffect(() => {
    if (!board) return;
    const mealEmp = employeesView.find((e) => e.employeeId === selectedMealId);
    const comfortEmp = employeesView.find((e) => e.employeeId === selectedComfortId);
    if (selectedMealId && (!mealEmp || !canSelectForCapture(mealEmp, BREAK_TYPES.MEAL))) {
      setSelectedMealId(null);
    }
    if (selectedComfortId && (!comfortEmp || !canSelectForCapture(comfortEmp, BREAK_TYPES.COMFORT))) {
      setSelectedComfortId(null);
    }
  }, [board, employeesView, selectedMealId, selectedComfortId]);

  const capture = useCallback(async (mode, breakType) => {
    if (busyRef.current) return;
    const employeeId = breakType === BREAK_TYPES.MEAL ? selectedMealId : selectedComfortId;
    if (!employeeId) {
      setMsgType('error');
      setMessage('Select an employee first.');
      return;
    }
    const employee = employeesView.find((e) => e.employeeId === employeeId);
    if (employee && !canSelectForCapture(employee, breakType) && mode !== 'in') {
      setMsgType('error');
      setMessage(isOffShift(employee)
        ? offShiftReason(employee)
        : `On ${employee.currentBreakType} break — end that first.`);
      return;
    }
    const limit = breakType === BREAK_TYPES.MEAL ? board?.mealStartLimit : board?.comfortStartLimit;
    if (employee && (mode === 'toggle' || mode === 'out') && startLimitReached(employee, breakType, limit)) {
      setMsgType('error');
      setMessage(startLimitReason(employee, breakType, limit));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const endpoint = mode === 'toggle' ? '/breaks/toggle' : mode === 'out' ? '/breaks/out' : '/breaks/in';
      const { data } = await api.post(endpoint, { employeeId, breakType });
      setMsgType('success');
      setMessage(
        data.isOnBreak
          ? `${breakType} out-time captured for ${data.fullName} at ${formatLocalClock(data.currentOutTime)}.`
          : `${breakType} in-time captured for ${data.fullName}.`,
      );
      await load();
    } catch (err) {
      setMsgType('error');
      setMessage(apiErrorMessage(err, 'Capture failed.'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [selectedMealId, selectedComfortId, load, employeesView, board]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest('button, a, input, select, textarea')) return;
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
  }, [capture, activeType]);

  if (!board && !message) return <LoadingBlock label="Loading live tracking…" />;

  return (
    <div className="page tracking-page">
      <header className="page-header">
        <div>
          <h1>Live Tracking</h1>
          <p>
            Capture Meal Break and Comfort Break separately. On All shifts, only staff whose
            shift is live at this local time can start or end a break; others are greyed out.
          </p>
        </div>
        <div className="header-stats">
          {board?.periodLabel && <span>{board.periodLabel}</span>}
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
        <div className={`break-type-focus ${activeType === BREAK_TYPES.MEAL ? 'is-active' : ''}`}>
          <BreakTypeBoard
            title="Meal Break"
            subtitle="Lunch / meal time tracking."
            breakType={BREAK_TYPES.MEAL}
            limitMinutes={board?.mealLimitMinutes}
            startLimit={board?.mealStartLimit}
            employees={employeesView}
            selectedId={selectedMealId}
            onSelect={(id) => {
              setActiveType(BREAK_TYPES.MEAL);
              setSelectedMealId(id);
            }}
            onToggle={(t) => capture('toggle', t)}
            onOut={(t) => capture('out', t)}
            onIn={(t) => capture('in', t)}
            busy={busy}
            emptyLabel="No employees found."
          />
        </div>

        <div className={`break-type-focus ${activeType === BREAK_TYPES.COMFORT ? 'is-active' : ''}`}>
          <BreakTypeBoard
            title="Comfort Break"
            subtitle="Short comfort break tracking."
            breakType={BREAK_TYPES.COMFORT}
            limitMinutes={board?.comfortLimitMinutes}
            startLimit={board?.comfortStartLimit}
            employees={employeesView}
            selectedId={selectedComfortId}
            onSelect={(id) => {
              setActiveType(BREAK_TYPES.COMFORT);
              setSelectedComfortId(id);
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
