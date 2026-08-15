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
    private readonly IShiftService _shifts;

    public PortalController(IBreakTrackingService breaks, IShiftService shifts)
    {
        _breaks = breaks;
        _shifts = shifts;
    }

    [HttpGet("live")]
    public async Task<ActionResult<LiveBoardDto>> Live(
        [FromQuery] string? search = null,
        [FromQuery] int? shiftId = null,
        [FromQuery] int? shiftId2 = null)
        => Ok(await _breaks.GetLiveBoardAsync(search, departmentId: null, shiftId, shiftId2));

    /// <summary>Active shifts for the public portal filter dropdown (read-only).</summary>
    [HttpGet("shifts")]
    public async Task<ActionResult<IReadOnlyList<ShiftDto>>> Shifts()
        => Ok(await _shifts.GetAllAsync(includeInactive: false));

    [HttpPost("toggle")]
    public async Task<ActionResult<EmployeeBreakStatusDto>> Toggle([FromBody] ToggleBreakRequest request)
    {
        var (ok, error, data) = await _breaks.ToggleAsync(request.EmployeeId, request.BreakType, userId: null);
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Toggle failed."));
        return Ok(data);
    }
}
