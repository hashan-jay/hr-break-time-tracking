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
        var today = TimeDisplay.TodayLocal();
        var board = await _breakTracking.GetLiveBoardAsync();
        var totalBreaksToday = await _db.BreakSessions.CountAsync(b => b.BreakDate == today);

        return new DashboardDto(
            await _db.Employees.CountAsync(e => !e.IsDeleted),
            await _db.Departments.CountAsync(d => !d.IsDeleted),
            board.OnBreakCount,
            board.ExceededCount,
            board.SatisfiedCount,
            board.WellSatisfiedCount,
            totalBreaksToday);
    }

    public async Task<ReportSummaryDto> GetReportAsync(DateOnly from, DateOnly to, int? departmentId, int? employeeId, int? shiftId)
    {
        if (to < from) (from, to) = (to, from);
        var limitMinutes = await _settings.GetDailyLimitMinutesAsync();

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
                var total = TimeDisplay.ComputeDailyTotalSeconds(g, dayEnd);
                var (status, color) = BreakStatusCodes.FromTotalSeconds(total, limitMinutes);
                return new ReportRowDto(
                    g.Key.EmployeeId,
                    g.Key.EmployeeCode,
                    g.Key.FullName,
                    g.Key.Dept,
                    g.Key.ShiftName,
                    g.Key.BreakDate,
                    total,
                    TimeDisplay.FormatSeconds(total),
                    status,
                    color,
                    g.Count());
            })
            .OrderBy(r => r.Date)
            .ThenBy(r => r.EmployeeName)
            .ToList();

        return new ReportSummaryDto(
            from,
            to,
            limitMinutes,
            groups.Count,
            groups.Count(r => r.Status == BreakStatusCodes.WellSatisfied),
            groups.Count(r => r.Status == BreakStatusCodes.Satisfied),
            groups.Count(r => r.Status == BreakStatusCodes.Exceeded),
            shiftId,
            shiftName,
            shiftDisplay,
            groups);
    }
}
