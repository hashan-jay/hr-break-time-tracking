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

    public ReportService(AppDbContext db, IBreakTrackingService breakTracking, ISettingsService settings)
    {
        _db = db;
        _breakTracking = breakTracking;
        _settings = settings;
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
            board.MealLimitMinutes);
    }

    public async Task<ReportSummaryDto> GetReportAsync(DateOnly from, DateOnly to, int? departmentId, int? employeeId, int? shiftId)
    {
        if (to < from) (from, to) = (to, from);
        var comfortLimit = await _settings.GetComfortLimitMinutesAsync();
        var mealLimit = await _settings.GetMealLimitMinutesAsync();

        string? shiftName = null;
        string? shiftDisplay = null;
        if (shiftId.HasValue)
        {
            var shift = await _db.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shiftId.Value);
            if (shift is not null)
            {
                shiftName = shift.Name;
                shiftDisplay = ShiftService.BuildDisplayLabel(shift.Name, shift.StartTime, shift.EndTime, shift.SpansNextDay);
            }
        }

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

        var grouped = sessions
            .Select(s =>
            {
                var period = ShiftWindow.ForOutTime(s.Employee.Shift, s.OutTime);
                return new { Session = s, Period = period };
            })
            .Where(x => ShiftWindow.Overlaps(x.Period, from, to))
            .GroupBy(x => new
            {
                x.Session.EmployeeId,
                PeriodStart = x.Period.Start,
                PeriodEnd = x.Period.End,
                x.Session.Employee.EmployeeCode,
                x.Session.Employee.FullName,
                Dept = x.Session.Employee.Department.Name,
                ShiftName = x.Session.Employee.Shift != null ? x.Session.Employee.Shift.Name : null,
                Shift = x.Session.Employee.Shift
            });

        var groups = grouped
            .Select(g =>
            {
                var period = new ShiftPeriod(g.Key.PeriodStart, g.Key.PeriodEnd);
                var reference = now < period.End ? now : period.End;
                var periodSessions = g.Select(x => x.Session).ToList();

                var comfortSessions = periodSessions.Where(s =>
                    BreakTypes.Comfort.Equals(string.IsNullOrWhiteSpace(s.BreakType) ? BreakTypes.Comfort : s.BreakType, StringComparison.OrdinalIgnoreCase)).ToList();
                var mealSessions = periodSessions.Where(s =>
                    BreakTypes.Meal.Equals(s.BreakType, StringComparison.OrdinalIgnoreCase)).ToList();

                var comfortTotal = TimeDisplay.ComputeShiftTotalSeconds(comfortSessions, reference);
                var mealTotal = TimeDisplay.ComputeShiftTotalSeconds(mealSessions, reference);
                var (comfortStatus, comfortColor) = BreakStatusCodes.FromTotalSeconds(comfortTotal, comfortLimit);
                var (mealStatus, mealColor) = BreakStatusCodes.FromTotalSeconds(mealTotal, mealLimit);

                return new ReportRowDto(
                    g.Key.EmployeeId,
                    g.Key.EmployeeCode,
                    g.Key.FullName,
                    g.Key.Dept,
                    g.Key.ShiftName,
                    period.StartDate,
                    comfortTotal,
                    TimeDisplay.FormatSeconds(comfortTotal),
                    comfortStatus,
                    comfortColor,
                    comfortSessions.Count,
                    mealTotal,
                    TimeDisplay.FormatSeconds(mealTotal),
                    mealStatus,
                    mealColor,
                    mealSessions.Count,
                    period.Start,
                    period.End,
                    ShiftWindow.FormatLabel(g.Key.Shift, period));
            })
            .OrderBy(r => r.Date)
            .ThenBy(r => r.EmployeeName)
            .ToList();

        return new ReportSummaryDto(
            from,
            to,
            comfortLimit,
            mealLimit,
            groups.Count,
            groups.Count(r => r.ComfortStatus == BreakStatusCodes.WellSatisfied),
            0,
            groups.Count(r => r.ComfortStatus == BreakStatusCodes.Exceeded),
            groups.Count(r => r.MealStatus == BreakStatusCodes.WellSatisfied),
            0,
            groups.Count(r => r.MealStatus == BreakStatusCodes.Exceeded),
            shiftId,
            shiftName,
            shiftDisplay,
            groups);
    }
}
