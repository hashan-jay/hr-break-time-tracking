using HRTimeTracking.Api.Authorization;
using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using HRTimeTracking.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRTimeTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeService _service;

    public EmployeesController(IEmployeeService service)
    {
        _service = service;
    }

    [HttpGet]
    [RequireSection(AppSections.Employees, AppSections.Tracking, AppSections.Reports)]
    public async Task<ActionResult<IReadOnlyList<EmployeeDto>>> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] int? departmentId = null)
    {
        return Ok(await _service.GetAllAsync(search, departmentId));
    }

    [HttpGet("{id:int}")]
    [RequireSection(AppSections.Employees, AppSections.Tracking, AppSections.Reports)]
    public async Task<ActionResult<EmployeeDto>> GetById(int id)
    {
        var item = await _service.GetByIdAsync(id);
        if (item is null) return NotFound(new ApiMessage("Employee not found."));
        return Ok(item);
    }

    [HttpPost]
    [RequireSection(AppSections.Employees)]
    public async Task<ActionResult<EmployeeDto>> Create([FromBody] CreateEmployeeRequest request)
    {
        var (ok, error, data) = await _service.CreateAsync(request, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Create failed."));
        return CreatedAtAction(nameof(GetById), new { id = data.Id }, data);
    }

    [HttpPut("{id:int}")]
    [RequireSection(AppSections.Employees)]
    public async Task<ActionResult<EmployeeDto>> Update(int id, [FromBody] UpdateEmployeeRequest request)
    {
        var (ok, error, data) = await _service.UpdateAsync(id, request, User.GetUserId());
        if (!ok || data is null) return BadRequest(new ApiMessage(error ?? "Update failed."));
        return Ok(data);
    }

    [HttpDelete("{id:int}")]
    [RequireSection(AppSections.Employees)]
    public async Task<ActionResult<ApiMessage>> Delete(int id)
    {
        var (ok, error) = await _service.DeleteAsync(id, User.GetUserId());
        if (!ok) return BadRequest(new ApiMessage(error ?? "Delete failed."));
        return Ok(new ApiMessage("Employee deleted."));
    }
}
