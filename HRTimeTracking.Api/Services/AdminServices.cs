using HRTimeTracking.Api.Data;
using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HRTimeTracking.Api.Services;

public interface IUserAdminService
{
    Task<IReadOnlyList<UserDto>> GetAllAsync();
    Task<(bool Ok, string? Error, UserDto? Data)> CreateAsync(CreateUserRequest request, string? actorUserId);
    Task<(bool Ok, string? Error, UserDto? Data)> UpdateAsync(string id, UpdateUserRequest request, string? actorUserId);
    Task<(bool Ok, string? Error)> ChangePasswordAsync(string id, string newPassword, string? actorUserId);
    Task<(bool Ok, string? Error)> DeactivateAsync(string id, string? actorUserId);
}

public class UserAdminService : IUserAdminService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly IAuditService _audit;
    private readonly IPermissionService _permissions;

    public UserAdminService(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        IAuditService audit,
        IPermissionService permissions)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _audit = audit;
        _permissions = permissions;
    }

    public async Task<IReadOnlyList<UserDto>> GetAllAsync()
    {
        var users = await _userManager.Users.OrderBy(u => u.UserName).ToListAsync();
        var permMap = await _permissions.GetForUsersAsync(users.Select(u => u.Id));
        var result = new List<UserDto>();
        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            permMap.TryGetValue(user.Id, out var perms);
            result.Add(Map(user, roles, perms ?? []));
        }
        return result;
    }

    public async Task<(bool Ok, string? Error, UserDto? Data)> CreateAsync(CreateUserRequest request, string? actorUserId)
    {
        if (!AppRoles.All.Contains(request.Role))
            return (false, "Invalid role.", null);

        if (!await _roleManager.RoleExistsAsync(request.Role))
            return (false, "Role is not configured.", null);

        var userName = request.UserName.Trim();
        if (string.IsNullOrWhiteSpace(userName))
            return (false, "Username is required.", null);

        var user = new ApplicationUser
        {
            UserName = userName,
            FullName = request.FullName.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var create = await _userManager.CreateAsync(user, request.Password);
        if (!create.Succeeded)
            return (false, string.Join(" ", create.Errors.Select(e => e.Description)), null);

        var roleResult = await _userManager.AddToRoleAsync(user, request.Role);
        if (!roleResult.Succeeded)
            return (false, string.Join(" ", roleResult.Errors.Select(e => e.Description)), null);

        await _audit.LogAsync(actorUserId, "Create", "User", user.Id, $"Created user '{user.UserName}' with role {request.Role}.");
        await _permissions.ApplyRoleDefaultsToUserAsync(user.Id, request.Role);
        var roles = await _userManager.GetRolesAsync(user);
        var perms = await _permissions.GetForUserAsync(user.Id);
        return (true, null, Map(user, roles, perms));
    }

    public async Task<(bool Ok, string? Error, UserDto? Data)> UpdateAsync(string id, UpdateUserRequest request, string? actorUserId)
    {
        if (!AppRoles.All.Contains(request.Role))
            return (false, "Invalid role.", null);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null) return (false, "User not found.", null);

        user.FullName = request.FullName.Trim();
        user.IsActive = request.IsActive;
        var update = await _userManager.UpdateAsync(user);
        if (!update.Succeeded)
            return (false, string.Join(" ", update.Errors.Select(e => e.Description)), null);

        var currentRoles = await _userManager.GetRolesAsync(user);
        var roleChanged = !currentRoles.Contains(request.Role);
        await _userManager.RemoveFromRolesAsync(user, currentRoles);
        await _userManager.AddToRoleAsync(user, request.Role);

        if (roleChanged)
            await _permissions.ApplyRoleDefaultsToUserAsync(user.Id, request.Role);

        await _audit.LogAsync(actorUserId, "Update", "User", user.Id, $"Updated user '{user.UserName}'.");
        var roles = await _userManager.GetRolesAsync(user);
        var perms = await _permissions.GetForUserAsync(user.Id);
        return (true, null, Map(user, roles, perms));
    }

    public async Task<(bool Ok, string? Error)> ChangePasswordAsync(string id, string newPassword, string? actorUserId)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null) return (false, "User not found.");

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var result = await _userManager.ResetPasswordAsync(user, token, newPassword);
        if (!result.Succeeded)
            return (false, string.Join(" ", result.Errors.Select(e => e.Description)));

        await _audit.LogAsync(actorUserId, "ChangePassword", "User", user.Id, $"Password changed for '{user.UserName}'.");
        return (true, null);
    }

    public async Task<(bool Ok, string? Error)> DeactivateAsync(string id, string? actorUserId)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null) return (false, "User not found.");
        if (user.Id == actorUserId) return (false, "You cannot deactivate your own account.");

        user.IsActive = false;
        await _userManager.UpdateAsync(user);
        await _audit.LogAsync(actorUserId, "Deactivate", "User", user.Id, $"Deactivated user '{user.UserName}'.");
        return (true, null);
    }

    private static UserDto Map(ApplicationUser user, IList<string> roles, IReadOnlyList<string> permissions) => new(
        user.Id,
        user.UserName ?? string.Empty,
        user.FullName,
        roles.ToList(),
        user.IsActive,
        user.CreatedAt,
        user.LastLoginAt,
        permissions);
}

public interface ISettingsService
{
    Task<IReadOnlyList<SystemSettingDto>> GetAllAsync();
    Task<(bool Ok, string? Error, SystemSettingDto? Data)> UpdateAsync(string key, string value, string? userId);
    Task<int> GetDailyLimitMinutesAsync();
    Task<int> GetComfortLimitMinutesAsync();
    Task<int> GetMealLimitMinutesAsync();
    Task<int> GetComfortStartLimitAsync();
    Task<int> GetMealStartLimitAsync();
    Task<IReadOnlyList<DepartmentStartLimitDto>> GetDepartmentStartLimitsAsync(bool includeDeleted = false);
    Task<(bool Ok, string? Error, DepartmentStartLimitDto? Data)> UpdateDepartmentStartLimitsAsync(
        int departmentId, int mealStartLimit, int comfortStartLimit, string? userId);
    Task<int> GetMealStartLimitForDepartmentAsync(int departmentId);
    Task<int> GetComfortStartLimitForDepartmentAsync(int departmentId);
    Task<IReadOnlyDictionary<int, (int Meal, int Comfort)>> GetStartLimitsByDepartmentAsync();
}

public class SettingsService : ISettingsService
{
    /// <summary>Legacy key; kept in sync with ComfortBreakLimitMinutes for compatibility.</summary>
    public const string DailyLimitKey = "DailyBreakLimitMinutes";
    public const string ComfortLimitKey = "ComfortBreakLimitMinutes";
    public const string MealLimitKey = "MealBreakLimitMinutes";
    public const string ComfortStartLimitKey = "ComfortBreakStartLimit";
    public const string MealStartLimitKey = "MealBreakStartLimit";

    private readonly AppDbContext _db;
    private readonly IAuditService _audit;

    public SettingsService(AppDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<IReadOnlyList<SystemSettingDto>> GetAllAsync()
    {
        return await _db.SystemSettings.AsNoTracking()
            .OrderBy(s => s.Key)
            .Select(s => new SystemSettingDto(s.Id, s.Key, s.Value, s.Description))
            .ToListAsync();
    }

    public async Task<(bool Ok, string? Error, SystemSettingDto? Data)> UpdateAsync(string key, string value, string? userId)
    {
        var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
        if (setting is null) return (false, "Setting not found.", null);

        var isDurationKey = key is DailyLimitKey or ComfortLimitKey or MealLimitKey;
        if (isDurationKey && (!int.TryParse(value, out var minutes) || minutes < 1 || minutes > 240))
            return (false, "Break limit must be between 1 and 240 minutes.", null);

        var isStartKey = key is ComfortStartLimitKey or MealStartLimitKey;
        if (isStartKey && (!int.TryParse(value, out var starts) || starts < BreakStatusCodes.MinStartLimit || starts > BreakStatusCodes.MaxStartLimit))
            return (false, $"Break start limit must be between {BreakStatusCodes.MinStartLimit} and {BreakStatusCodes.MaxStartLimit} times per shift.", null);

        var trimmed = value.Trim();
        setting.Value = trimmed;

        // Keep legacy daily key and comfort key aligned when either changes.
        if (key is DailyLimitKey or ComfortLimitKey)
        {
            var otherKey = key == DailyLimitKey ? ComfortLimitKey : DailyLimitKey;
            var other = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == otherKey);
            if (other is not null) other.Value = trimmed;
        }

        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Update", "SystemSetting", setting.Id.ToString(), $"Updated setting '{key}' to '{value}'.");

        return (true, null, new SystemSettingDto(setting.Id, setting.Key, setting.Value, setting.Description));
    }

    public Task<int> GetDailyLimitMinutesAsync() => GetComfortLimitMinutesAsync();

    public async Task<int> GetComfortLimitMinutesAsync()
    {
        var value = await _db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == ComfortLimitKey || s.Key == DailyLimitKey)
            .OrderBy(s => s.Key == ComfortLimitKey ? 0 : 1)
            .Select(s => s.Value)
            .FirstOrDefaultAsync();

        return int.TryParse(value, out var minutes) ? minutes : BreakStatusCodes.DefaultComfortLimitMinutes;
    }

    public async Task<int> GetMealLimitMinutesAsync()
    {
        var value = await _db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == MealLimitKey)
            .Select(s => s.Value)
            .FirstOrDefaultAsync();

        return int.TryParse(value, out var minutes) ? minutes : BreakStatusCodes.DefaultMealLimitMinutes;
    }

    public Task<int> GetComfortStartLimitAsync() => GetStartLimitAsync(ComfortStartLimitKey, BreakStatusCodes.DefaultComfortStartLimit);

    public Task<int> GetMealStartLimitAsync() => GetStartLimitAsync(MealStartLimitKey, BreakStatusCodes.DefaultMealStartLimit);

    public async Task<IReadOnlyList<DepartmentStartLimitDto>> GetDepartmentStartLimitsAsync(bool includeDeleted = false)
    {
        var mealDefault = await GetMealStartLimitAsync();
        var comfortDefault = await GetComfortStartLimitAsync();

        var query = _db.Departments.AsNoTracking().AsQueryable();
        if (!includeDeleted) query = query.Where(d => !d.IsDeleted);

        var rows = await query
            .OrderBy(d => d.IsDeleted)
            .ThenBy(d => d.Name)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.IsDeleted,
                EmployeeCount = d.Employees.Count(e => !e.IsDeleted),
                d.MealBreakStartLimit,
                d.ComfortBreakStartLimit
            })
            .ToListAsync();

        return rows
            .Select(d => new DepartmentStartLimitDto(
                d.Id,
                d.Name,
                d.IsDeleted,
                d.EmployeeCount,
                ClampStartLimit(d.MealBreakStartLimit, mealDefault),
                ClampStartLimit(d.ComfortBreakStartLimit, comfortDefault)))
            .ToList();
    }

    public async Task<(bool Ok, string? Error, DepartmentStartLimitDto? Data)> UpdateDepartmentStartLimitsAsync(
        int departmentId, int mealStartLimit, int comfortStartLimit, string? userId)
    {
        if (mealStartLimit < BreakStatusCodes.MinStartLimit || mealStartLimit > BreakStatusCodes.MaxStartLimit)
            return (false, $"Meal break start limit must be between {BreakStatusCodes.MinStartLimit} and {BreakStatusCodes.MaxStartLimit} times per shift.", null);

        if (comfortStartLimit < BreakStatusCodes.MinStartLimit || comfortStartLimit > BreakStatusCodes.MaxStartLimit)
            return (false, $"Comfort break start limit must be between {BreakStatusCodes.MinStartLimit} and {BreakStatusCodes.MaxStartLimit} times per shift.", null);

        var department = await _db.Departments.FirstOrDefaultAsync(d => d.Id == departmentId);
        if (department is null) return (false, "Department not found.", null);
        if (department.IsDeleted) return (false, "This department is deleted. Recover it before editing start limits.", null);

        department.MealBreakStartLimit = mealStartLimit;
        department.ComfortBreakStartLimit = comfortStartLimit;
        department.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Update", "DepartmentStartLimits", department.Id.ToString(),
            $"Updated start limits for '{department.Name}': Meal {mealStartLimit}, Comfort {comfortStartLimit}.");

        return (true, null, new DepartmentStartLimitDto(
            department.Id,
            department.Name,
            department.IsDeleted,
            await _db.Employees.CountAsync(e => e.DepartmentId == department.Id && !e.IsDeleted),
            department.MealBreakStartLimit,
            department.ComfortBreakStartLimit));
    }

    public async Task<int> GetMealStartLimitForDepartmentAsync(int departmentId)
    {
        var fallback = await GetMealStartLimitAsync();
        var value = await _db.Departments.AsNoTracking()
            .Where(d => d.Id == departmentId)
            .Select(d => (int?)d.MealBreakStartLimit)
            .FirstOrDefaultAsync();

        return value is null ? fallback : ClampStartLimit(value.Value, fallback);
    }

    public async Task<int> GetComfortStartLimitForDepartmentAsync(int departmentId)
    {
        var fallback = await GetComfortStartLimitAsync();
        var value = await _db.Departments.AsNoTracking()
            .Where(d => d.Id == departmentId)
            .Select(d => (int?)d.ComfortBreakStartLimit)
            .FirstOrDefaultAsync();

        return value is null ? fallback : ClampStartLimit(value.Value, fallback);
    }

    public async Task<IReadOnlyDictionary<int, (int Meal, int Comfort)>> GetStartLimitsByDepartmentAsync()
    {
        var mealDefault = await GetMealStartLimitAsync();
        var comfortDefault = await GetComfortStartLimitAsync();
        var rows = await _db.Departments.AsNoTracking()
            .Select(d => new { d.Id, d.MealBreakStartLimit, d.ComfortBreakStartLimit })
            .ToListAsync();

        return rows.ToDictionary(
            d => d.Id,
            d => (
                Meal: ClampStartLimit(d.MealBreakStartLimit, mealDefault),
                Comfort: ClampStartLimit(d.ComfortBreakStartLimit, comfortDefault)));
    }

    private async Task<int> GetStartLimitAsync(string key, int fallback)
    {
        var value = await _db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == key)
            .Select(s => s.Value)
            .FirstOrDefaultAsync();

        if (!int.TryParse(value, out var starts))
            return fallback;

        return Math.Clamp(starts, BreakStatusCodes.MinStartLimit, BreakStatusCodes.MaxStartLimit);
    }

    private static int ClampStartLimit(int value, int fallback)
        => value < BreakStatusCodes.MinStartLimit || value > BreakStatusCodes.MaxStartLimit
            ? fallback
            : value;
}
