using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using HRTimeTracking.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTimeTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BreaksController : ControllerBase
{
    private readonly IBreakTrackingService _service;

    public BreaksController(IBreakTrackingService service)
    {
        _service = service;
    }

    [HttpGet("live")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<LiveBoardDto>> Live([FromQuery] string? search = null, [FromQuery] int? departmentId = null)
        => Ok(await _service.GetLiveBoardAsync(search, departmentId));

    [HttpGet("employee/{employeeId:int}/status")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<EmployeeBreakStatusDto>> Status(int employeeId)
    {
        var status = await _service.GetEmployeeStatusAsync(employeeId);
        return status is null ? NotFound(new ApiMessage("Employee not found.")) : Ok(status);
    }

    [HttpGet("sessions")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<IReadOnlyList<BreakSessionDto>>> Sessions(
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? departmentId = null)
    {
        DateOnly? fromDate = DateOnly.TryParse(from, out var f) ? f : null;
        DateOnly? toDate = DateOnly.TryParse(to, out var t) ? t : null;
        return Ok(await _service.GetSessionsAsync(fromDate, toDate, employeeId, departmentId));
    }

    /// <summary>
    /// Single-button capture: records out-time if employee is in, or in-time if currently on break.
    /// </summary>
    [HttpPost("toggle")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<EmployeeBreakStatusDto>> Toggle([FromBody] ToggleBreakRequest request)
    {
        var (ok, error, data) = await _service.ToggleAsync(request.EmployeeId, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Toggle failed."));
        return Ok(data);
    }

    [HttpPost("out")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<EmployeeBreakStatusDto>> Out([FromBody] ToggleBreakRequest request)
    {
        var (ok, error, data) = await _service.RecordOutAsync(request.EmployeeId, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Out-time failed."));
        return Ok(data);
    }

    [HttpPost("in")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<EmployeeBreakStatusDto>> In([FromBody] ToggleBreakRequest request)
    {
        var (ok, error, data) = await _service.RecordInAsync(request.EmployeeId, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "In-time failed."));
        return Ok(data);
    }
}
