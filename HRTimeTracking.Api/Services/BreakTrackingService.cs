using HRTimeTracking.Api.Data;
using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HRTimeTracking.Api.Services;

public interface IBreakTrackingService
{
    Task<LiveBoardDto> GetLiveBoardAsync(string? search = null, int? departmentId = null, int? shiftId = null, int? shiftId2 = null);
    Task<EmployeeBreakStatusDto?> GetEmployeeStatusAsync(int employeeId);
    Task<(bool Ok, string? Error, EmployeeBreakStatusDto? Data)> ToggleAsync(int employeeId, string? userId);
    Task<(bool Ok, string? Error, EmployeeBreakStatusDto? Data)> RecordOutAsync(int employeeId, string? userId);
    Task<(bool Ok, string? Error, EmployeeBreakStatusDto? Data)> RecordInAsync(int employeeId, string? userId);
    Task<IReadOnlyList<BreakSessionDto>> GetSessionsAsync(DateOnly? from, DateOnly? to, int? employeeId, int? departmentId);
}

public class BreakTrackingService : IBreakTrackingService
{
    private readonly AppDbContext _db;
    private readonly IAuditService _audit;
    private readonly ISettingsService _settings;

    public BreakTrackingService(AppDbContext db, IAuditService audit, ISettingsService settings)
    {
        _db = db;
        _audit = audit;
        _settings = settings;
    }

    public async Task<LiveBoardDto> GetLiveBoardAsync(string? search = null, int? departmentId = null, int? shiftId = null, int? shiftId2 = null)
    {
        var today = TimeDisplay.TodayLocal();
        var now = TimeDisplay.NowLocal();
        var limitMinutes = await _settings.GetDailyLimitMinutesAsync();

        var employeesQuery = _db.Employees.AsNoTracking()
            .Include(e => e.Department)
            .Where(e => !e.IsDeleted);

        if (departmentId.HasValue)
            employeesQuery = employeesQuery.Where(e => e.DepartmentId == departmentId.Value);

        // One or two shift filters: show employees assigned to either selected shift (overlap view).
        var shiftIds = new List<int>();
        if (shiftId.HasValue) shiftIds.Add(shiftId.Value);
        if (shiftId2.HasValue && !shiftIds.Contains(shiftId2.Value)) shiftIds.Add(shiftId2.Value);
        if (shiftIds.Count == 1)
            employeesQuery = employeesQuery.Where(e => e.ShiftId == shiftIds[0]);
        else if (shiftIds.Count > 1)
            employeesQuery = employeesQuery.Where(e => e.ShiftId != null && shiftIds.Contains(e.ShiftId.Value));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            employeesQuery = employeesQuery.Where(e =>
                e.FullName.ToLower().Contains(term) ||
                e.EmployeeCode.ToLower().Contains(term) ||
                e.Department.Name.ToLower().Contains(term));
        }

        var employees = await employeesQuery.OrderBy(e => e.FullName).ToListAsync();
        var employeeIds = employees.Select(e => e.Id).ToList();

        var sessions = await _db.BreakSessions.AsNoTracking()
            .Where(b => employeeIds.Contains(b.EmployeeId) && b.BreakDate == today)
            .ToListAsync();

        // Normalize Kind after SQL read so elapsed math is always local.
        foreach (var session in sessions)
        {
            session.OutTime = TimeDisplay.AsLocal(session.OutTime);
            session.InTime = TimeDisplay.AsLocal(session.InTime);
        }

        var statuses = employees.Select(e =>
            BuildStatus(e, sessions.Where(s => s.EmployeeId == e.Id).ToList(), now, limitMinutes)).ToList();

        return new LiveBoardDto(
            today,
            limitMinutes,
            statuses,
            statuses.Count(s => s.IsOnBreak),
            statuses.Count(s => s.Status == BreakStatusCodes.Exceeded),
            statuses.Count(s => s.Status == BreakStatusCodes.Satisfied),
            statuses.Count(s => s.Status == BreakStatusCodes.WellSatisfied));
    }

    public async Task<EmployeeBreakStatusDto?> GetEmployeeStatusAsync(int employeeId)
    {
        var employee = await _db.Employees.AsNoTracking()
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.Id == employeeId);
        if (employee is null) return null;

        var today = TimeDisplay.TodayLocal();
        var limitMinutes = await _settings.GetDailyLimitMinutesAsync();
        var sessions = await _db.BreakSessions.AsNoTracking()
            .Where(b => b.EmployeeId == employeeId && b.BreakDate == today)
            .ToListAsync();

        foreach (var session in sessions)
        {
            session.OutTime = TimeDisplay.AsLocal(session.OutTime);
            session.InTime = TimeDisplay.AsLocal(session.InTime);
        }

        return BuildStatus(employee, sessions, TimeDisplay.NowLocal(), limitMinutes);
    }

    public async Task<(bool Ok, string? Error, EmployeeBreakStatusDto? Data)> ToggleAsync(int employeeId, string? userId)
    {
        var open = await _db.BreakSessions.FirstOrDefaultAsync(b => b.EmployeeId == employeeId && b.InTime == null);
        return open is null
            ? await RecordOutAsync(employeeId, userId)
            : await RecordInAsync(employeeId, userId);
    }

    public async Task<(bool Ok, string? Error, EmployeeBreakStatusDto? Data)> RecordOutAsync(int employeeId, string? userId)
    {
        var employee = await _db.Employees.Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.Id == employeeId && !e.IsDeleted);
        if (employee is null) return (false, "Employee not found.", null);

        var openExists = await _db.BreakSessions.AnyAsync(b => b.EmployeeId == employeeId && b.InTime == null);
        if (openExists) return (false, "Employee is already on break. Capture in-time first.", null);

        var now = TimeDisplay.NowLocal();
        var session = new BreakSession
        {
            EmployeeId = employeeId,
            OutTime = now,
            BreakDate = DateOnly.FromDateTime(now),
            RecordedByUserId = userId,
            CreatedAt = now
        };
        _db.BreakSessions.Add(session);
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "BreakOut", "BreakSession", session.Id.ToString(),
            $"Out-time recorded for {employee.FullName} ({employee.EmployeeCode}) at {TimeDisplay.FormatLocalClock(now)} (local).");

        return (true, null, await GetEmployeeStatusAsync(employeeId));
    }

    public async Task<(bool Ok, string? Error, EmployeeBreakStatusDto? Data)> RecordInAsync(int employeeId, string? userId)
    {
        var employee = await _db.Employees.Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.Id == employeeId);
        if (employee is null) return (false, "Employee not found.", null);

        var open = await _db.BreakSessions
            .Where(b => b.EmployeeId == employeeId && b.InTime == null)
            .OrderByDescending(b => b.OutTime)
            .FirstOrDefaultAsync();

        if (open is null) return (false, "Employee is not on break. Capture out-time first.", null);

        open.OutTime = TimeDisplay.AsLocal(open.OutTime);
        var now = TimeDisplay.NowLocal();
        if (now < open.OutTime)
            return (false, "In-time cannot be earlier than out-time.", null);

        var durationSeconds = TimeDisplay.ElapsedSeconds(open.OutTime, now);
        open.InTime = now;
        open.DurationSeconds = durationSeconds;
        open.ClosedByUserId = userId;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "BreakIn", "BreakSession", open.Id.ToString(),
            $"In-time recorded for {employee.FullName} ({employee.EmployeeCode}) at {TimeDisplay.FormatLocalClock(now)} (local). Duration {TimeDisplay.FormatSeconds(durationSeconds)} ({durationSeconds} seconds).");

        return (true, null, await GetEmployeeStatusAsync(employeeId));
    }

    public async Task<IReadOnlyList<BreakSessionDto>> GetSessionsAsync(DateOnly? from, DateOnly? to, int? employeeId, int? departmentId)
    {
        var fromDate = from ?? TimeDisplay.TodayLocal();
        var toDate = to ?? fromDate;

        var query = _db.BreakSessions.AsNoTracking()
            .Include(b => b.Employee).ThenInclude(e => e.Department)
            .Where(b => b.BreakDate >= fromDate && b.BreakDate <= toDate && !b.Employee.IsDeleted);

        if (employeeId.HasValue) query = query.Where(b => b.EmployeeId == employeeId.Value);
        if (departmentId.HasValue) query = query.Where(b => b.Employee.DepartmentId == departmentId.Value);

        var list = await query.OrderByDescending(b => b.OutTime).ToListAsync();
        return list.Select(MapSession).ToList();
    }

    private static BreakSessionDto MapSession(BreakSession b)
    {
        var outTime = TimeDisplay.AsLocal(b.OutTime);
        var inTime = TimeDisplay.AsLocal(b.InTime);
        var duration = inTime.HasValue
            ? TimeDisplay.ElapsedSeconds(outTime, inTime.Value)
            : TimeDisplay.ElapsedSeconds(outTime);

        return new BreakSessionDto(
            b.Id,
            b.EmployeeId,
            b.Employee.EmployeeCode,
            b.Employee.FullName,
            b.Employee.Department.Name,
            outTime,
            inTime,
            duration,
            TimeDisplay.FormatSeconds(duration),
            b.BreakDate,
            inTime is null);
    }

    private static EmployeeBreakStatusDto BuildStatus(Employee employee, List<BreakSession> sessions, DateTime now, int limitMinutes)
    {
        var localNow = TimeDisplay.AsLocal(now);
        var total = TimeDisplay.ComputeDailyTotalSeconds(sessions, localNow);
        var (status, color) = BreakStatusCodes.FromTotalSeconds(total, limitMinutes);
        var open = sessions.FirstOrDefault(s => s.InTime is null);
        var openOut = open is null ? (DateTime?)null : TimeDisplay.AsLocal(open.OutTime);

        return new EmployeeBreakStatusDto(
            employee.Id,
            employee.EmployeeCode,
            employee.FullName,
            employee.DepartmentId,
            employee.Department.Name,
            total,
            TimeDisplay.FormatSeconds(total),
            status,
            color,
            open is not null,
            openOut,
            openOut is null ? null : TimeDisplay.ElapsedSeconds(openOut.Value, localNow),
            sessions.Count(s => s.InTime.HasValue));
    }
}
