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

/** Recompute open-session elapsed against Meal or Comfort totals. */
export function enrichEmployeesLive(list, nowMs) {
  return (list || []).map((e) => {
    if (!e.isOnBreak || !e.currentOutTime) return e;
    const openSeconds = liveElapsedSeconds(e.currentOutTime, nowMs);
    const type = e.currentBreakType;
    const next = {
      ...e,
      currentBreakElapsedSeconds: openSeconds,
    };
    if (type === BREAK_TYPES.MEAL) {
      const closed = Math.max(0, (e.mealBreakSecondsToday || 0) - (e.currentBreakElapsedSeconds || 0));
      const total = closed + openSeconds;
      next.mealBreakSecondsToday = total;
      next.mealBreakDisplay = formatElapsed(total);
    } else {
      const closed = Math.max(0, (e.comfortBreakSecondsToday || 0) - (e.currentBreakElapsedSeconds || 0));
      const total = closed + openSeconds;
      next.comfortBreakSecondsToday = total;
      next.comfortBreakDisplay = formatElapsed(total);
    }
    return next;
  });
}

export function typeFields(employee, breakType) {
  if (breakType === BREAK_TYPES.MEAL) {
    return {
      totalSeconds: employee.mealBreakSecondsToday ?? 0,
      totalDisplay: employee.mealBreakDisplay ?? '00:00:00',
      status: employee.mealStatus,
      statusColor: employee.mealStatusColor,
      isOnThisBreak: employee.isOnBreak && employee.currentBreakType === BREAK_TYPES.MEAL,
    };
  }
  return {
    totalSeconds: employee.comfortBreakSecondsToday ?? 0,
    totalDisplay: employee.comfortBreakDisplay ?? '00:00:00',
    status: employee.comfortStatus,
    statusColor: employee.comfortStatusColor,
    isOnThisBreak: employee.isOnBreak && employee.currentBreakType === BREAK_TYPES.COMFORT,
  };
}

export function settingLabel(key) {
  if (key === 'MealBreakLimitMinutes') return 'Meal break daily limit (minutes)';
  if (key === 'ComfortBreakLimitMinutes') return 'Comfort break daily limit (minutes)';
  if (key === 'DailyBreakLimitMinutes') return 'Legacy comfort limit alias (synced)';
  return key;
}
