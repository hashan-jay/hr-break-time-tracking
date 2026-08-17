using HRTimeTracking.Api.Data;
using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HRTimeTracking.Api.Services;

public interface IReportService
{
    Task<DashboardDto> GetDashboardAsync();
    Task<ReportSummaryDto> GetReportAsync(DateOnly from, DateOnly to, int? departmentId, int? employeeId, int? shiftId);
}

public class ReportService : IReportService
{
    private readonly AppDbContext _db;
    private readonly IBreakTrackingService _breakTracking;
    private readonly ISettingsService _settings;
    private readonly IBreakAutoCloseService _autoClose;

    public ReportService(
        AppDbContext db,
        IBreakTrackingService breakTracking,
        ISettingsService settings,
        IBreakAutoCloseService autoClose)
    {
        _db = db;
        _breakTracking = breakTracking;
        _settings = settings;
        _autoClose = autoClose;
    }

    public async Task<DashboardDto> GetDashboardAsync()
    {
        var board = await _breakTracking.GetLiveBoardAsync();

        return new DashboardDto(
            await _db.Employees.CountAsync(e => !e.IsDeleted),
            await _db.Departments.CountAsync(d => !d.IsDeleted),
            board.OnBreakCount,
            board.ComfortOnBreakCount,
            board.MealOnBreakCount,
            board.ComfortExceededCount,
            board.ComfortSatisfiedCount,
            board.ComfortWellSatisfiedCount,
            board.MealExceededCount,
            board.MealSatisfiedCount,
            board.MealWellSatisfiedCount,
            board.ComfortLimitMinutes,
            board.MealLimitMinutes,
            board.ComfortStartLimit,
            board.MealStartLimit);
    }

    public async Task<ReportSummaryDto> GetReportAsync(DateOnly from, DateOnly to, int? departmentId, int? employeeId, int? shiftId)
    {
        await _autoClose.CloseExpiredAsync();
        if (to < from) (from, to) = (to, from);
        var comfortLimit = await _settings.GetComfortLimitMinutesAsync();
        var mealLimit = await _settings.GetMealLimitMinutesAsync();
        var comfortStartLimit = await _settings.GetComfortStartLimitAsync();
        var mealStartLimit = await _settings.GetMealStartLimitAsync();

        Shift? selectedShift = null;
        string? shiftName = null;
        string? shiftDisplay = null;
        if (shiftId.HasValue)
        {
            selectedShift = await _db.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shiftId.Value);
            if (selectedShift is not null)
            {
                shiftName = selectedShift.Name;
                shiftDisplay = ShiftService.BuildDisplayLabel(
                    selectedShift.Name, selectedShift.StartTime, selectedShift.EndTime, selectedShift.SpansNextDay);
            }
        }

        var rosterQuery = _db.Employees.AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Shift)
            .Where(e => !e.IsDeleted);
        if (departmentId.HasValue)
            rosterQuery = rosterQuery.Where(e => e.DepartmentId == departmentId.Value);
        if (employeeId.HasValue)
            rosterQuery = rosterQuery.Where(e => e.Id == employeeId.Value);
        if (shiftId.HasValue)
            rosterQuery = rosterQuery.Where(e => e.ShiftId == shiftId.Value);

        var filterToRoster = departmentId.HasValue || employeeId.HasValue || shiftId.HasValue;
        var roster = await rosterQuery.OrderBy(e => e.FullName).ToListAsync();

        var fromStart = from.AddDays(-1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Local);
        var toEnd = to.AddDays(2).ToDateTime(TimeOnly.MinValue, DateTimeKind.Local);

        var sessionsQuery = _db.BreakSessions.AsNoTracking()
            .Include(b => b.Employee).ThenInclude(e => e.Department)
            .Include(b => b.Employee).ThenInclude(e => e.Shift)
            .Where(b => !b.Employee.IsDeleted &&
                        (b.InTime == null ||
                         (b.BreakDate >= from.AddDays(-1) && b.BreakDate <= to.AddDays(1)) ||
                         (b.OutTime >= fromStart && b.OutTime < toEnd)));
        if (departmentId.HasValue)
            sessionsQuery = sessionsQuery.Where(b => b.Employee.DepartmentId == departmentId.Value);
        if (employeeId.HasValue)
            sessionsQuery = sessionsQuery.Where(b => b.EmployeeId == employeeId.Value);
        if (shiftId.HasValue)
            sessionsQuery = sessionsQuery.Where(b => b.Employee.ShiftId == shiftId.Value);

        var sessions = await sessionsQuery.ToListAsync();
        foreach (var session in sessions)
        {
            session.OutTime = TimeDisplay.AsLocal(session.OutTime);
            session.InTime = TimeDisplay.AsLocal(session.InTime);
            if (string.IsNullOrWhiteSpace(session.BreakType))
                session.BreakType = BreakTypes.Comfort;
        }

        var now = TimeDisplay.NowLocal();
        var periodLabel = from == to ? from.ToString("yyyy-MM-dd") : $"{from:yyyy-MM-dd} to {to:yyyy-MM-dd}";
        var rangeStart = from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Local);
        var rangeEnd = to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Local);

        var inRange = new List<(BreakSession Session, ShiftPeriod Period)>();
        foreach (var session in sessions)
        {
            var period = ShiftWindow.ReportPeriod(session.Employee.Shift, session.OutTime);
            if (!period.HasValue) continue;
            if (period.Value.StartDate < from || period.Value.StartDate > to) continue;
            if (selectedShift is not null)
            {
                var expected = ShiftWindow.StartingOn(selectedShift, period.Value.StartDate);
                if (period.Value.Start != expected.Start || period.Value.End != expected.End)
                    continue;
            }
            inRange.Add((session, period.Value));
        }

        var sessionsByEmployee = inRange
            .GroupBy(x => x.Session.EmployeeId)
            .ToDictionary(g => g.Key, g => g.ToList());

        if (!filterToRoster)
        {
            roster = sessionsByEmployee.Keys
                .Select(id => inRange.First(x => x.Session.EmployeeId == id).Session.Employee)
                .DistinctBy(e => e.Id)
                .OrderBy(e => e.FullName)
                .ToList();
        }

        var rows = roster.Select(employee =>
        {
            var empItems = sessionsByEmployee.GetValueOrDefault(employee.Id) ?? [];
            var meal = SumBreakType(empItems, BreakTypes.Meal, now, mealLimit);
            var comfort = SumBreakType(empItems, BreakTypes.Comfort, now, comfortLimit);

            return new ReportRowDto(
                employee.Id,
                employee.EmployeeCode,
                employee.FullName,
                employee.Department?.Name ?? "—",
                employee.Shift?.Name,
                from,
                comfort.TotalSeconds,
                TimeDisplay.FormatSeconds(comfort.TotalSeconds),
                comfort.Exceeded ? BreakStatusCodes.Exceeded : BreakStatusCodes.WellSatisfied,
                comfort.Exceeded ? BreakStatusCodes.ColorRed : BreakStatusCodes.ColorGreen,
                comfort.Count,
                meal.TotalSeconds,
                TimeDisplay.FormatSeconds(meal.TotalSeconds),
                meal.Exceeded ? BreakStatusCodes.Exceeded : BreakStatusCodes.WellSatisfied,
                meal.Exceeded ? BreakStatusCodes.ColorRed : BreakStatusCodes.ColorGreen,
                meal.Count,
                rangeStart,
                rangeEnd,
                periodLabel);
        })
        .OrderBy(r => r.EmployeeName)
        .ToList();

        return new ReportSummaryDto(
            from,
            to,
            comfortLimit,
            mealLimit,
            rows.Count,
            rows.Count(r => r.ComfortStatus == BreakStatusCodes.WellSatisfied),
            0,
            rows.Count(r => r.ComfortStatus == BreakStatusCodes.Exceeded),
            rows.Count(r => r.MealStatus == BreakStatusCodes.WellSatisfied),
            0,
            rows.Count(r => r.MealStatus == BreakStatusCodes.Exceeded),
            shiftId,
            shiftName,
            shiftDisplay,
            rows,
            comfortStartLimit,
            mealStartLimit);
    }

    private static (int TotalSeconds, int Count, bool Exceeded) SumBreakType(
        IReadOnlyList<(BreakSession Session, ShiftPeriod Period)> items,
        string breakType,
        DateTime now,
        int limitMinutes)
    {
        var typed = items.Where(x =>
        {
            var type = string.IsNullOrWhiteSpace(x.Session.BreakType) ? BreakTypes.Comfort : x.Session.BreakType;
            return breakType.Equals(type, StringComparison.OrdinalIgnoreCase);
        }).ToList();

        var total = 0;
        var exceeded = false;
        foreach (var periodGroup in typed.GroupBy(x => (x.Period.Start, x.Period.End)))
        {
            var period = new ShiftPeriod(periodGroup.Key.Start, periodGroup.Key.End);
            var reference = now < period.End ? now : period.End;
            var seconds = TimeDisplay.ComputeShiftTotalSeconds(periodGroup.Select(x => x.Session), reference);
            total += seconds;
            var (status, _) = BreakStatusCodes.FromTotalSeconds(seconds, limitMinutes);
            if (status == BreakStatusCodes.Exceeded)
                exceeded = true;
        }

        return (total, typed.Count, exceeded);
    }
}
