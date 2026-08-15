/** Shared break-time helpers for Meal + Comfort boards. */

export const BREAK_TYPES = {
  MEAL: 'Meal',
  COMFORT: 'Comfort',
};

export function formatElapsed(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '—';
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseLocalDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value).trim();
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatLocalClock(value) {
  const d = parseLocalDateTime(value);
  if (!d) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function liveElapsedSeconds(outTime, nowMs) {
  const out = parseLocalDateTime(outTime);
  if (!out) return 0;
  return Math.max(0, Math.floor((nowMs - out.getTime()) / 1000));
}

export function statusFromTotal(totalSeconds, limitMinutes) {
  const limitSeconds = Math.max(0, Number(limitMinutes) || 0) * 60;
  if (totalSeconds <= limitSeconds) {
    return { status: 'WELL SATISFIED', statusColor: 'green' };
  }
  return { status: 'EXCEEDED BREAK TIME LIMIT', statusColor: 'red' };
}

/**
 * This-shift total:
 *   closed (In − Out) + live (Now − Out) while a break is open.
 */
export function shiftTotalSeconds(employee, breakType, nowMs) {
  const isMeal = breakType === BREAK_TYPES.MEAL;
  const closed = isMeal
    ? (employee.mealClosedSeconds ?? Math.max(0, (employee.mealBreakSecondsToday || 0) - (employee.currentBreakElapsedSeconds || 0)))
    : (employee.comfortClosedSeconds ?? Math.max(0, (employee.comfortBreakSecondsToday || 0) - (employee.currentBreakElapsedSeconds || 0)));
  const onThisBreak = employee.isOnBreak && employee.currentBreakType === breakType;
  const open = onThisBreak ? liveElapsedSeconds(employee.currentOutTime, nowMs) : 0;
  return Math.max(0, closed + open);
}

/** Recompute open-session elapsed against Meal or Comfort totals every tick. */
export function enrichEmployeesLive(list, nowMs, limits = {}) {
  const rows = (list || []).map((e) => {
    const mealTotal = shiftTotalSeconds(e, BREAK_TYPES.MEAL, nowMs);
    const comfortTotal = shiftTotalSeconds(e, BREAK_TYPES.COMFORT, nowMs);
    const mealStatus = statusFromTotal(mealTotal, limits.mealLimitMinutes);
    const comfortStatus = statusFromTotal(comfortTotal, limits.comfortLimitMinutes);
    const onBreak = Boolean(e.isOnBreak && e.currentOutTime);
    return {
      ...e,
      currentBreakElapsedSeconds: onBreak ? liveElapsedSeconds(e.currentOutTime, nowMs) : 0,
      mealBreakSecondsToday: mealTotal,
      mealBreakDisplay: formatElapsed(mealTotal),
      mealStatus: mealStatus.status,
      mealStatusColor: mealStatus.statusColor,
      comfortBreakSecondsToday: comfortTotal,
      comfortBreakDisplay: formatElapsed(comfortTotal),
      comfortStatus: comfortStatus.status,
      comfortStatusColor: comfortStatus.statusColor,
    };
  });

  return rows.sort((a, b) => {
    const aLive = a.isWithinShift === false ? 1 : 0;
    const bLive = b.isWithinShift === false ? 1 : 0;
    if (aLive !== bLive) return aLive - bLive;
    return String(a.fullName || '').localeCompare(String(b.fullName || ''));
  });
}

export function isOffShift(employee) {
  return employee?.isWithinShift === false;
}

export function offShiftReason(employee) {
  const shift = employee?.shiftDisplay || employee?.shiftName || 'This shift';
  const next = formatLocalClock(employee?.nextShiftStart);
  if (next && next !== '—') return `${shift} is not live until ${next.slice(0, 5)}`;
  if (!employee?.shiftName) return 'No shift assigned — cannot capture breaks';
  return `${shift} is not live at the current local time`;
}

export function canSelectForCapture(employee, breakType) {
  const fields = typeFields(employee, breakType);
  if (fields.isOnThisBreak) return true;
  if (fields.blockedByOther) return false;
  if (isOffShift(employee)) return false;
  return true;
}

export function typeFields(employee, breakType) {
  if (breakType === BREAK_TYPES.MEAL) {
    return {
      totalSeconds: employee.mealBreakSecondsToday ?? 0,
      totalDisplay: employee.mealBreakDisplay ?? '00:00:00',
      status: employee.mealStatus,
      statusColor: employee.mealStatusColor,
      isOnThisBreak: employee.isOnBreak && employee.currentBreakType === BREAK_TYPES.MEAL,
      blockedByOther: Boolean(employee.isOnBreak && employee.currentBreakType !== BREAK_TYPES.MEAL),
    };
  }
  return {
    totalSeconds: employee.comfortBreakSecondsToday ?? 0,
    totalDisplay: employee.comfortBreakDisplay ?? '00:00:00',
    status: employee.comfortStatus,
    statusColor: employee.comfortStatusColor,
    isOnThisBreak: employee.isOnBreak && employee.currentBreakType === BREAK_TYPES.COMFORT,
    blockedByOther: Boolean(employee.isOnBreak && employee.currentBreakType !== BREAK_TYPES.COMFORT),
  };
}

export function settingLabel(key) {
  if (key === 'MealBreakLimitMinutes') return 'Meal break daily limit (minutes)';
  if (key === 'ComfortBreakLimitMinutes') return 'Comfort break daily limit (minutes)';
  if (key === 'DailyBreakLimitMinutes') return 'Legacy comfort limit alias (synced)';
  return key;
}
