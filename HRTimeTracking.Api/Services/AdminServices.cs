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

    public UserAdminService(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        IAuditService audit)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _audit = audit;
    }

    public async Task<IReadOnlyList<UserDto>> GetAllAsync()
    {
        var users = await _userManager.Users.OrderBy(u => u.UserName).ToListAsync();
        var result = new List<UserDto>();
        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            result.Add(Map(user, roles));
        }
        return result;
    }

    public async Task<(bool Ok, string? Error, UserDto? Data)> CreateAsync(CreateUserRequest request, string? actorUserId)
    {
        if (!AppRoles.All.Contains(request.Role))
            return (false, "Invalid role.", null);

        if (!await _roleManager.RoleExistsAsync(request.Role))
            return (false, "Role is not configured.", null);

        var user = new ApplicationUser
        {
            UserName = request.UserName.Trim(),
            Email = request.Email.Trim(),
            FullName = request.FullName.Trim(),
            EmailConfirmed = true,
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
        var roles = await _userManager.GetRolesAsync(user);
        return (true, null, Map(user, roles));
    }

    public async Task<(bool Ok, string? Error, UserDto? Data)> UpdateAsync(string id, UpdateUserRequest request, string? actorUserId)
    {
        if (!AppRoles.All.Contains(request.Role))
            return (false, "Invalid role.", null);

        var user = await _userManager.FindByIdAsync(id);
        if (user is null) return (false, "User not found.", null);

        user.FullName = request.FullName.Trim();
        user.Email = request.Email.Trim();
        user.IsActive = request.IsActive;
        var update = await _userManager.UpdateAsync(user);
        if (!update.Succeeded)
            return (false, string.Join(" ", update.Errors.Select(e => e.Description)), null);

        var currentRoles = await _userManager.GetRolesAsync(user);
        await _userManager.RemoveFromRolesAsync(user, currentRoles);
        await _userManager.AddToRoleAsync(user, request.Role);

        await _audit.LogAsync(actorUserId, "Update", "User", user.Id, $"Updated user '{user.UserName}'.");
        var roles = await _userManager.GetRolesAsync(user);
        return (true, null, Map(user, roles));
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

    private static UserDto Map(ApplicationUser user, IList<string> roles) => new(
        user.Id,
        user.UserName ?? string.Empty,
        user.Email ?? string.Empty,
        user.FullName,
        roles.ToList(),
        user.IsActive,
        user.CreatedAt,
        user.LastLoginAt);
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
}
