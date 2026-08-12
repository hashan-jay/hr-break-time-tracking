using HRTimeTracking.Api.Data;
using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using HRTimeTracking.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HRTimeTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.Developer)]
public class UsersController : ControllerBase
{
    private readonly IUserAdminService _service;

    public UsersController(IUserAdminService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> GetAll()
        => Ok(await _service.GetAllAsync());

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest request)
    {
        var (ok, error, data) = await _service.CreateAsync(request, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Create failed."));
        return Ok(data);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<UserDto>> Update(string id, [FromBody] UpdateUserRequest request)
    {
        var (ok, error, data) = await _service.UpdateAsync(id, request, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Update failed."));
        return Ok(data);
    }

    [HttpPost("{id}/password")]
    public async Task<ActionResult<ApiMessage>> ChangePassword(string id, [FromBody] ChangePasswordRequest request)
    {
        var (ok, error) = await _service.ChangePasswordAsync(id, request.NewPassword, User.GetUserId());
        if (!ok) return BadRequest(new ApiMessage(error ?? "Password change failed."));
        return Ok(new ApiMessage("Password updated."));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiMessage>> Deactivate(string id)
    {
        var (ok, error) = await _service.DeactivateAsync(id, User.GetUserId());
        if (!ok) return BadRequest(new ApiMessage(error ?? "Deactivate failed."));
        return Ok(new ApiMessage("User deactivated."));
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.Developer)]
public class SettingsController : ControllerBase
{
    private readonly ISettingsService _service;

    public SettingsController(ISettingsService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SystemSettingDto>>> GetAll()
        => Ok(await _service.GetAllAsync());

    [HttpPut("{key}")]
    public async Task<ActionResult<SystemSettingDto>> Update(string key, [FromBody] UpdateSettingRequest request)
    {
        var (ok, error, data) = await _service.UpdateAsync(key, request.Value, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Update failed."));
        return Ok(data);
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = AppRoles.Developer)]
public class AuditController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuditController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditLogDto>>> Get(
        [FromQuery] int take = 100,
        [FromQuery] string? entityType = null)
    {
        take = Math.Clamp(take, 1, 500);
        var query = _db.AuditLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(a => a.EntityType == entityType);

        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Take(take)
            .Select(a => new AuditLogDto(a.Id, a.UserId, a.Action, a.EntityType, a.EntityId, a.Details, a.CreatedAt, a.IpAddress))
            .ToListAsync();

        return Ok(items);
    }
}
