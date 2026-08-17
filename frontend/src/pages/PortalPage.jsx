import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import PortalClock from '../components/PortalClock';
import { MessageBar, StatusBadge } from '../components/UiBits';
import {
  BREAK_TYPES,
  canSelectForCapture,
  enrichEmployeesLive,
  formatElapsed,
  formatLocalClock,
  isOffShift,
  offShiftReason,
  startLimitReached,
  typeFields,
} from '../lib/breakHelpers';

function PortalBreakSection({
  title,
  breakType,
  limitMinutes,
  startLimit,
  employees,
  selectedId,
  onSelect,
  onToggle,
  busy,
  apiOnline,
}) {
  const selected = employees.find((e) => e.employeeId === selectedId) || null;
  const fields = selected ? typeFields(selected, breakType) : null;
  const onThisBreak = fields?.isOnThisBreak;
  const blockedByOther = selected?.isOnBreak && !onThisBreak;
  const offShift = selected ? isOffShift(selected) : false;
  const startBlocked = selected ? startLimitReached(selected, breakType, startLimit) : false;
  const captureLocked = Boolean(blockedByOther || (offShift && !onThisBreak) || (startBlocked && !onThisBreak));

  return (
    <section className={`portal-break-section portal-break-section--${breakType.toLowerCase()}`}>
      <header className="portal-break-section__head">
        <div>
          <h2>{title}</h2>
          <p>
            Daily limit: <strong>{limitMinutes ?? '—'} minutes</strong>
          </p>
        </div>
        <div className="portal-onbreak-chip">
          On break{' '}
          <strong>{employees.filter((e) => typeFields(e, breakType).isOnThisBreak).length}</strong>
        </div>
      </header>

      <div className="portal-workbench">
        <aside className="portal-capture">
          <h2>Record {title}</h2>
          {selected && fields ? (
            <>
              <div className="selected-employee">
                <strong>{selected.fullName}</strong>
                <span>{selected.employeeCode} · {selected.departmentName}</span>
                <StatusBadge status={fields.status} color={fields.statusColor} />
                <div className="selected-meta">
                  <div>This shift: <strong>{fields.totalDisplay}</strong></div>
                  <div>
                    {onThisBreak
                      ? `Out since ${formatLocalClock(selected.currentOutTime)}`
                      : blockedByOther
                        ? `On ${selected.currentBreakType} break — end that first`
                        : offShift
                          ? offShiftReason(selected)
                          : startBlocked
                            ? `Cannot start another ${breakType.toLowerCase()} break this shift`
                            : `Ready to start ${breakType.toLowerCase()} break`}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className={`btn ${onThisBreak ? 'btn-in' : 'btn-out'} btn-xl`}
                disabled={busy || apiOnline === false || captureLocked}
                onClick={() => onToggle(breakType)}
              >
                {onThisBreak
                  ? `End ${breakType} break (Enter / Space)`
                  : `Start ${breakType} break (Enter / Space)`}
              </button>
            </>
          ) : (
            <p className="hint">Select your name in the list, then press Enter or Space.</p>
          )}
        </aside>

        <div className="portal-board">
          <div className="portal-board__table">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>This shift</th>
                  <th>Status</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const row = typeFields(e, breakType);
                  const blocked = row.blockedByOther;
                  const offShift = isOffShift(e);
                  const startBlocked = startLimitReached(e, breakType, startLimit);
                  const selectable = canSelectForCapture(e, breakType);
                  const lockReason = blocked
                    ? `On ${e.currentBreakType} break — end that first`
                    : offShift
                      ? offShiftReason(e)
                      : startBlocked
                        ? `Cannot start another ${breakType.toLowerCase()} break this shift`
                        : undefined;
                  return (
                    <tr
                      key={`${breakType}-${e.employeeId}`}
                      className={[
                        selectedId === e.employeeId ? 'selected' : '',
                        row.isOnThisBreak ? 'on-break' : '',
                        blocked ? 'on-other-break' : '',
                        offShift && !row.isOnThisBreak ? 'off-shift' : '',
                        startBlocked && !row.isOnThisBreak && !offShift && !blocked ? 'start-limit-reached' : '',
                      ].filter(Boolean).join(' ')}
                      aria-disabled={selectable ? undefined : 'true'}
                      title={lockReason}
                      onClick={() => {
                        if (selectable) onSelect(e.employeeId);
                      }}
                    >
                      <td className="col-code">{e.employeeCode}</td>
                      <td className="col-name">{e.fullName}</td>
                      <td>{e.departmentName}</td>
                      <td className={`col-today ${row.isOnThisBreak ? 'is-live-total' : ''}`}>
                        <strong>{row.totalDisplay}</strong>
                      </td>
                      <td><StatusBadge status={row.status} color={row.statusColor} /></td>
                      <td>
                        {row.isOnThisBreak
                          ? `On break (${formatElapsed(e.currentBreakElapsedSeconds)})`
                          : blocked
                            ? `On ${e.currentBreakType}`
                            : offShift
                              ? 'Off shift'
                              : 'In office'}
                      </td>
                    </tr>
                  );
                })}
                {apiOnline && !employees.length && (
                  <tr><td colSpan={6} className="empty">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PortalPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [apiOnline, setApiOnline] = useState(null);
  const [board, setBoard] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedMealId, setSelectedMealId] = useState(null);
  const [selectedComfortId, setSelectedComfortId] = useState(null);
  const [activeType, setActiveType] = useState(BREAK_TYPES.MEAL);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('info');
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [shifts, setShifts] = useState([]);
  const [shiftId, setShiftId] = useState('');
  const [shiftId2, setShiftId2] = useState('');
  const searchRef = useRef(null);
  const busyRef = useRef(false);

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
      params: {
        search: search || undefined,
        shiftId: shiftId || undefined,
        shiftId2: shiftId && shiftId2 ? shiftId2 : undefined,
      },
    });
    setBoard(data);
    setNowMs(Date.now());
  }, [checkApi, search, shiftId, shiftId2]);

  useEffect(() => {
    api.get('/portal/shifts')
      .then((res) => setShifts(res.data || []))
      .catch(() => setShifts([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await loadBoard();
        if (!cancelled) setMessage('');
      } catch (err) {
        if (!cancelled) {
          setMsgType('error');
          setMessage(apiErrorMessage(err, 'Could not load employee list.'));
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

  const captureToggle = useCallback(async (breakType) => {
    if (busyRef.current) return;
    if (apiOnline === false) {
      setMsgType('error');
      setMessage('API is offline. Start the backend first.');
      return;
    }
    const employeeId = breakType === BREAK_TYPES.MEAL ? selectedMealId : selectedComfortId;
    if (!employeeId) {
      setMsgType('error');
      setMessage('Select your name from the list first.');
      return;
    }
    const employee = employeesView.find((e) => e.employeeId === employeeId);
    if (employee && !canSelectForCapture(employee, breakType)) {
      setMsgType('error');
      setMessage(isOffShift(employee)
        ? offShiftReason(employee)
        : `On ${employee.currentBreakType} break — end that first.`);
      return;
    }
    const limit = breakType === BREAK_TYPES.MEAL ? board?.mealStartLimit : board?.comfortStartLimit;
    if (employee && startLimitReached(employee, breakType, limit)) {
      setMsgType('error');
      setMessage(`Cannot start another ${breakType.toLowerCase()} break this shift.`);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const { data } = await api.post('/portal/toggle', { employeeId, breakType });
      setMsgType('success');
      const fields = typeFields(data, breakType);
      setMessage(
        data.isOnBreak
          ? `${breakType} break started for ${data.fullName} at ${formatLocalClock(data.currentOutTime)}.`
          : `${breakType} break ended for ${data.fullName}. This shift total: ${fields.totalDisplay}.`,
      );
      await loadBoard();
    } catch (err) {
      setMsgType('error');
      const raw = apiErrorMessage(err, 'Could not record break time.');
      setMessage(/start limit/i.test(raw)
        ? `Cannot start another ${breakType.toLowerCase()} break this shift.`
        : raw);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [apiOnline, selectedMealId, selectedComfortId, loadBoard, employeesView, board]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest('button, a, input, select, textarea')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        captureToggle(activeType);
      } else if (e.key === '/' && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [captureToggle, activeType]);

  return (
    <div className="portal-shell">
      <main className="portal-main">
        <header className="portal-employee-header">
          <div className="portal-employee-header__text">
            <h1 className="portal-employee-title">Employee Break Portal</h1>
            <p className="portal-employee-meta">
              Meal {board?.mealLimitMinutes ?? 60} min
              {' · '}
              Comfort {board?.comfortLimitMinutes ?? 20} min
              {' · '}
              <kbd>Enter</kbd> / <kbd>Space</kbd> to start or stop
            </p>
          </div>
          <div className="portal-employee-header__actions">
            <PortalClock />
            <div className="portal-onbreak-chip">
              <span>On break</span>
              <strong>{board?.onBreakCount ?? 0}</strong>
            </div>
            {isAuthenticated ? (
              <button type="button" className="btn btn-primary" onClick={() => navigate('/app')}>
                Open staff console
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
                Log in as HR Manager
              </button>
            )}
          </div>
        </header>

        <MessageBar message={message} type={msgType} onClose={() => setMessage('')} />

        {!apiOnline && apiOnline !== null && (
          <div className="message-bar message-error">
            Backend is offline. Run <code>dotnet watch run</code> in HRTimeTracking.Api.
          </div>
        )}

        <div className="portal-board__toolbar portal-shared-filters">
          <select
            className="portal-board__shift"
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
            className="portal-board__shift"
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
          <input
            ref={searchRef}
            className="portal-board__search"
            placeholder="Search by name or employee ID…  (/ to focus)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="hint">
          {board?.periodLabel
            ? `Shift window: ${board.periodLabel}`
            : 'All shifts: only employees whose shift is live at this local time can start or end a break. Everyone else is greyed out until their shift starts.'}
        </p>

        <div className="break-type-stack">
          <div className={`break-type-focus ${activeType === BREAK_TYPES.MEAL ? 'is-active' : ''}`}>
            <PortalBreakSection
              title="Meal Break"
              breakType={BREAK_TYPES.MEAL}
              limitMinutes={board?.mealLimitMinutes}
              startLimit={board?.mealStartLimit}
              employees={employeesView}
              selectedId={selectedMealId}
              onSelect={(id) => {
                setActiveType(BREAK_TYPES.MEAL);
                setSelectedMealId(id);
              }}
              onToggle={captureToggle}
              busy={busy}
              apiOnline={apiOnline}
            />
          </div>

          <div className={`break-type-focus ${activeType === BREAK_TYPES.COMFORT ? 'is-active' : ''}`}>
            <PortalBreakSection
              title="Comfort Break"
              breakType={BREAK_TYPES.COMFORT}
              limitMinutes={board?.comfortLimitMinutes}
              startLimit={board?.comfortStartLimit}
              employees={employeesView}
              selectedId={selectedComfortId}
              onSelect={(id) => {
                setActiveType(BREAK_TYPES.COMFORT);
                setSelectedComfortId(id);
              }}
              onToggle={captureToggle}
              busy={busy}
              apiOnline={apiOnline}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
