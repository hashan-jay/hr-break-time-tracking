using System.ComponentModel.DataAnnotations;

namespace HRTimeTracking.Api.DTOs;

public record LoginRequest(
    [Required] string UserName,
    [Required] string Password);

public record LoginResponse(
    string Token,
    DateTime ExpiresAt,
    UserDto User);

public record UserDto(
    string Id,
    string UserName,
    string Email,
    string FullName,
    IReadOnlyList<string> Roles,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public record CreateUserRequest(
    [Required] string UserName,
    [Required, EmailAddress] string Email,
    [Required] string FullName,
    [Required, MinLength(8)] string Password,
    [Required] string Role);

public record UpdateUserRequest(
    [Required] string FullName,
    [Required, EmailAddress] string Email,
    [Required] string Role,
    bool IsActive);

public record ChangePasswordRequest(
    [Required, MinLength(8)] string NewPassword);

public record DepartmentDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    int EmployeeCount,
    DateTime CreatedAt);

public record CreateDepartmentRequest(
    [Required, MaxLength(100)] string Name,
    [MaxLength(250)] string? Description);

public record UpdateDepartmentRequest(
    [Required, MaxLength(100)] string Name,
    [MaxLength(250)] string? Description,
    bool IsActive);

public record EmployeeDto(
    int Id,
    string EmployeeCode,
    string FullName,
    int DepartmentId,
    string DepartmentName,
    string? JobTitle,
    string? Email,
    string? Phone,
    bool IsActive,
    DateTime HireDate);

public record CreateEmployeeRequest(
    [Required, MaxLength(50)] string EmployeeCode,
    [Required, MaxLength(150)] string FullName,
    [Required] int DepartmentId,
    [MaxLength(100)] string? JobTitle,
    [MaxLength(100)] string? Email,
    [MaxLength(30)] string? Phone);

public record UpdateEmployeeRequest(
    [Required, MaxLength(150)] string FullName,
    [Required] int DepartmentId,
    [MaxLength(100)] string? JobTitle,
    [MaxLength(100)] string? Email,
    [MaxLength(30)] string? Phone,
    bool IsActive,
    DateTime HireDate);

public record BreakSessionDto(
    int Id,
    int EmployeeId,
    string EmployeeCode,
    string EmployeeName,
    string DepartmentName,
    DateTime OutTime,
    DateTime? InTime,
    int? DurationSeconds,
    string? DurationDisplay,
    DateOnly BreakDate,
    bool IsOpen);

public record EmployeeBreakStatusDto(
    int EmployeeId,
    string EmployeeCode,
    string FullName,
    int DepartmentId,
    string DepartmentName,
    int TotalBreakSecondsToday,
    string TotalBreakDisplay,
    string Status,
    string StatusColor,
    bool IsOnBreak,
    DateTime? CurrentOutTime,
    int? CurrentBreakElapsedSeconds,
    int ClosedBreakCountToday);

public record ToggleBreakRequest([Required] int EmployeeId);

public record LiveBoardDto(
    DateOnly Date,
    int DailyLimitMinutes,
    IReadOnlyList<EmployeeBreakStatusDto> Employees,
    int OnBreakCount,
    int ExceededCount,
    int SatisfiedCount,
    int WellSatisfiedCount);

public record ReportRowDto(
    int EmployeeId,
    string EmployeeCode,
    string EmployeeName,
    string DepartmentName,
    DateOnly Date,
    int TotalBreakSeconds,
    string TotalBreakDisplay,
    string Status,
    string StatusColor,
    int BreakCount);

public record ReportSummaryDto(
    DateOnly From,
    DateOnly To,
    int DailyLimitMinutes,
    int EmployeeDays,
    int WellSatisfiedCount,
    int SatisfiedCount,
    int ExceededCount,
    IReadOnlyList<ReportRowDto> Rows);

public record DashboardDto(
    int ActiveEmployees,
    int ActiveDepartments,
    int OnBreakNow,
    int ExceededToday,
    int SatisfiedToday,
    int WellSatisfiedToday,
    int TotalBreaksToday);

public record SystemSettingDto(int Id, string Key, string Value, string? Description);

public record UpdateSettingRequest([Required, MaxLength(500)] string Value);

public record AuditLogDto(
    long Id,
    string? UserId,
    string Action,
    string EntityType,
    string? EntityId,
    string? Details,
    DateTime CreatedAt,
    string? IpAddress);

public record ApiMessage(string Message);
