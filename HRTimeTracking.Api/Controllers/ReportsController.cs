using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using HRTimeTracking.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTimeTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("dashboard")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<DashboardDto>> Dashboard()
    {
        return Ok(await _reportService.GetDashboardAsync());
    }

    [HttpGet("breaks")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager}")]
    public async Task<ActionResult<ReportSummaryDto>> Breaks(
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? shiftId = null)
    {
        var fromDate = DateOnly.TryParse(from, out var f) ? f : DateOnly.FromDateTime(DateTime.Now);
        var toDate = DateOnly.TryParse(to, out var t) ? t : fromDate;

        var report = await _reportService.GetReportAsync(fromDate, toDate, departmentId, employeeId, shiftId);
        return Ok(report);
    }

    /// <summary>HR Assistant can view/search break data (read-only reports for viewing).</summary>
    [HttpGet("breaks/view")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<ReportSummaryDto>> BreaksView(
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? shiftId = null)
    {
        var fromDate = DateOnly.TryParse(from, out var f) ? f : DateOnly.FromDateTime(DateTime.Now);
        var toDate = DateOnly.TryParse(to, out var t) ? t : fromDate;

        var report = await _reportService.GetReportAsync(fromDate, toDate, departmentId, employeeId, shiftId);
        return Ok(report);
    }
}
