using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using HRTimeTracking.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTimeTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DepartmentsController : ControllerBase
{
    private readonly IDepartmentService _service;

    public DepartmentsController(IDepartmentService service)
    {
        _service = service;
    }

    [HttpGet]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<IReadOnlyList<DepartmentDto>>> GetAll([FromQuery] bool includeInactive = false, [FromQuery] string? search = null)
        => Ok(await _service.GetAllAsync(includeInactive, search));

    [HttpGet("{id:int}")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager},{AppRoles.HRAssistant}")]
    public async Task<ActionResult<DepartmentDto>> GetById(int id)
    {
        var item = await _service.GetByIdAsync(id);
        return item is null ? NotFound(new ApiMessage("Department not found.")) : Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager}")]
    public async Task<ActionResult<DepartmentDto>> Create([FromBody] CreateDepartmentRequest request)
    {
        var (ok, error, data) = await _service.CreateAsync(request, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Create failed."));
        return CreatedAtAction(nameof(GetById), new { id = data.Id }, data);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = $"{AppRoles.Developer},{AppRoles.HRManager}")]
    public async Task<ActionResult<DepartmentDto>> Update(int id, [FromBody] UpdateDepartmentRequest request)
    {
        var (ok, error, data) = await _service.UpdateAsync(id, request, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Update failed."));
        return Ok(data);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = AppRoles.Developer)]
    public async Task<ActionResult<ApiMessage>> Deactivate(int id)
    {
        var (ok, error) = await _service.DeactivateAsync(id, User.GetUserId());
        if (!ok) return BadRequest(new ApiMessage(error ?? "Deactivate failed."));
        return Ok(new ApiMessage("Department deactivated."));
    }
}
