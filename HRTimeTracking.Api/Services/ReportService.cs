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

        var sessionsQuery = _db.BreakSessions.AsNoTracking()
            .Include(b => b.Employee).ThenInclude(e => e.Department)
            .Include(b => b.Employee).ThenInclude(e => e.Shift)
            .Where(b => b.BreakDate >= from && b.BreakDate <= to && !b.Employee.IsDeleted);

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

        var groups = sessions
            .GroupBy(s => new
            {
                s.EmployeeId,
                s.BreakDate,
                s.Employee.EmployeeCode,
                s.Employee.FullName,
                Dept = s.Employee.Department.Name,
                ShiftName = s.Employee.Shift != null ? s.Employee.Shift.Name : null
            })
            .Select(g =>
            {
                var dayEnd = g.Key.BreakDate == TimeDisplay.TodayLocal()
                    ? now
                    : g.Key.BreakDate.ToDateTime(new TimeOnly(23, 59, 59), DateTimeKind.Local);

                var comfortSessions = g.Where(s =>
                    BreakTypes.Comfort.Equals(string.IsNullOrWhiteSpace(s.BreakType) ? BreakTypes.Comfort : s.BreakType, StringComparison.OrdinalIgnoreCase)).ToList();
                var mealSessions = g.Where(s =>
                    BreakTypes.Meal.Equals(s.BreakType, StringComparison.OrdinalIgnoreCase)).ToList();

                var comfortTotal = TimeDisplay.ComputeDailyTotalSeconds(comfortSessions, dayEnd);
                var mealTotal = TimeDisplay.ComputeDailyTotalSeconds(mealSessions, dayEnd);
                var (comfortStatus, comfortColor) = BreakStatusCodes.FromTotalSeconds(comfortTotal, comfortLimit);
                var (mealStatus, mealColor) = BreakStatusCodes.FromTotalSeconds(mealTotal, mealLimit);

                return new ReportRowDto(
                    g.Key.EmployeeId,
                    g.Key.EmployeeCode,
                    g.Key.FullName,
                    g.Key.Dept,
                    g.Key.ShiftName,
                    g.Key.BreakDate,
                    comfortTotal,
                    TimeDisplay.FormatSeconds(comfortTotal),
                    comfortStatus,
                    comfortColor,
                    comfortSessions.Count,
                    mealTotal,
                    TimeDisplay.FormatSeconds(mealTotal),
                    mealStatus,
                    mealColor,
                    mealSessions.Count);
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
            groups.Count(r => r.ComfortStatus == BreakStatusCodes.Satisfied),
            groups.Count(r => r.ComfortStatus == BreakStatusCodes.Exceeded),
            groups.Count(r => r.MealStatus == BreakStatusCodes.WellSatisfied),
            groups.Count(r => r.MealStatus == BreakStatusCodes.Satisfied),
            groups.Count(r => r.MealStatus == BreakStatusCodes.Exceeded),
            shiftId,
            shiftName,
            shiftDisplay,
            groups);
    }
}
