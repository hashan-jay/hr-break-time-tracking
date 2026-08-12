using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTimeTracking.Api.Controllers;

/// <summary>
/// Public employee self-service portal (no login required).
/// </summary>
[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class PortalController : ControllerBase
{
    private readonly IBreakTrackingService _breaks;

    public PortalController(IBreakTrackingService breaks)
    {
        _breaks = breaks;
    }

    [HttpGet("live")]
    public async Task<ActionResult<LiveBoardDto>> Live([FromQuery] string? search = null)
        => Ok(await _breaks.GetLiveBoardAsync(search, departmentId: null));

    [HttpPost("toggle")]
    public async Task<ActionResult<EmployeeBreakStatusDto>> Toggle([FromBody] ToggleBreakRequest request)
    {
        var (ok, error, data) = await _breaks.ToggleAsync(request.EmployeeId, userId: null);
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Toggle failed."));
        return Ok(data);
    }
}
