using HRTimeTracking.Api.Data;
using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HRTimeTracking.Api.Services;

public interface IDepartmentService
{
    Task<IReadOnlyList<DepartmentDto>> GetAllAsync(bool includeInactive = false, string? search = null);
    Task<DepartmentDto?> GetByIdAsync(int id);
    Task<(bool Ok, string? Error, DepartmentDto? Data)> CreateAsync(CreateDepartmentRequest request, string? userId);
    Task<(bool Ok, string? Error, DepartmentDto? Data)> UpdateAsync(int id, UpdateDepartmentRequest request, string? userId);
    Task<(bool Ok, string? Error)> DeactivateAsync(int id, string? userId);
}

public class DepartmentService : IDepartmentService
{
    private readonly AppDbContext _db;
    private readonly IAuditService _audit;

    public DepartmentService(AppDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<IReadOnlyList<DepartmentDto>> GetAllAsync(bool includeInactive = false, string? search = null)
    {
        var query = _db.Departments.AsNoTracking().AsQueryable();
        if (!includeInactive) query = query.Where(d => d.IsActive);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(d => d.Name.ToLower().Contains(term) || (d.Description != null && d.Description.ToLower().Contains(term)));
        }

        return await query
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentDto(
                d.Id,
                d.Name,
                d.Description,
                d.IsActive,
                d.Employees.Count(e => e.IsActive),
                d.CreatedAt))
            .ToListAsync();
    }

    public async Task<DepartmentDto?> GetByIdAsync(int id)
    {
        return await _db.Departments.AsNoTracking()
            .Where(d => d.Id == id)
            .Select(d => new DepartmentDto(
                d.Id,
                d.Name,
                d.Description,
                d.IsActive,
                d.Employees.Count(e => e.IsActive),
                d.CreatedAt))
            .FirstOrDefaultAsync();
    }

    public async Task<(bool Ok, string? Error, DepartmentDto? Data)> CreateAsync(CreateDepartmentRequest request, string? userId)
    {
        var name = request.Name.Trim();
        if (await _db.Departments.AnyAsync(d => d.Name == name))
            return (false, "A department with this name already exists.", null);

        var entity = new Department
        {
            Name = name,
            Description = request.Description?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _db.Departments.Add(entity);
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Create", "Department", entity.Id.ToString(), $"Created department '{entity.Name}'.");
        return (true, null, await GetByIdAsync(entity.Id));
    }

    public async Task<(bool Ok, string? Error, DepartmentDto? Data)> UpdateAsync(int id, UpdateDepartmentRequest request, string? userId)
    {
        var entity = await _db.Departments.FindAsync(id);
        if (entity is null) return (false, "Department not found.", null);

        var name = request.Name.Trim();
        if (await _db.Departments.AnyAsync(d => d.Name == name && d.Id != id))
            return (false, "A department with this name already exists.", null);

        entity.Name = name;
        entity.Description = request.Description?.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Update", "Department", entity.Id.ToString(), $"Updated department '{entity.Name}'.");
        return (true, null, await GetByIdAsync(entity.Id));
    }

    public async Task<(bool Ok, string? Error)> DeactivateAsync(int id, string? userId)
    {
        var entity = await _db.Departments.FindAsync(id);
        if (entity is null) return (false, "Department not found.");
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Deactivate", "Department", entity.Id.ToString(), $"Deactivated department '{entity.Name}'.");
        return (true, null);
    }
}

public interface IEmployeeService
{
    Task<IReadOnlyList<EmployeeDto>> GetAllAsync(bool includeInactive = false, string? search = null, int? departmentId = null);
    Task<EmployeeDto?> GetByIdAsync(int id);
    Task<(bool Ok, string? Error, EmployeeDto? Data)> CreateAsync(CreateEmployeeRequest request, string? userId);
    Task<(bool Ok, string? Error, EmployeeDto? Data)> UpdateAsync(int id, UpdateEmployeeRequest request, string? userId);
    Task<(bool Ok, string? Error)> DeactivateAsync(int id, string? userId);
}

public class EmployeeService : IEmployeeService
{
    private readonly AppDbContext _db;
    private readonly IAuditService _audit;

    public EmployeeService(AppDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    private static EmployeeDto Map(Employee e) => new(
        e.Id,
        e.EmployeeCode,
        e.FullName,
        e.DepartmentId,
        e.Department.Name,
        e.JobTitle,
        e.Email,
        e.Phone,
        e.IsActive,
        e.HireDate);

    public async Task<IReadOnlyList<EmployeeDto>> GetAllAsync(bool includeInactive = false, string? search = null, int? departmentId = null)
    {
        var query = _db.Employees.AsNoTracking().Include(e => e.Department).AsQueryable();
        if (!includeInactive) query = query.Where(e => e.IsActive);
        if (departmentId.HasValue) query = query.Where(e => e.DepartmentId == departmentId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(e =>
                e.FullName.ToLower().Contains(term) ||
                e.EmployeeCode.ToLower().Contains(term) ||
                e.Department.Name.ToLower().Contains(term) ||
                (e.JobTitle != null && e.JobTitle.ToLower().Contains(term)));
        }

        var list = await query.OrderBy(e => e.FullName).ToListAsync();
        return list.Select(Map).ToList();
    }

    public async Task<EmployeeDto?> GetByIdAsync(int id)
    {
        var e = await _db.Employees.AsNoTracking().Include(x => x.Department).FirstOrDefaultAsync(x => x.Id == id);
        return e is null ? null : Map(e);
    }

    public async Task<(bool Ok, string? Error, EmployeeDto? Data)> CreateAsync(CreateEmployeeRequest request, string? userId)
    {
        var code = request.EmployeeCode.Trim();
        if (await _db.Employees.AnyAsync(e => e.EmployeeCode == code))
            return (false, "Employee code already exists.", null);

        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == request.DepartmentId && d.IsActive);
        if (dept is null) return (false, "Active department not found.", null);

        var entity = new Employee
        {
            EmployeeCode = code,
            FullName = request.FullName.Trim(),
            DepartmentId = request.DepartmentId,
            JobTitle = request.JobTitle?.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            IsActive = true,
            HireDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        _db.Employees.Add(entity);
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Create", "Employee", entity.Id.ToString(), $"Created employee '{entity.FullName}' ({entity.EmployeeCode}).");
        return (true, null, await GetByIdAsync(entity.Id));
    }

    public async Task<(bool Ok, string? Error, EmployeeDto? Data)> UpdateAsync(int id, UpdateEmployeeRequest request, string? userId)
    {
        var entity = await _db.Employees.FindAsync(id);
        if (entity is null) return (false, "Employee not found.", null);

        var deptExists = await _db.Departments.AnyAsync(d => d.Id == request.DepartmentId);
        if (!deptExists) return (false, "Department not found.", null);

        entity.FullName = request.FullName.Trim();
        entity.DepartmentId = request.DepartmentId;
        entity.JobTitle = request.JobTitle?.Trim();
        entity.Email = request.Email?.Trim();
        entity.Phone = request.Phone?.Trim();
        entity.IsActive = request.IsActive;
        entity.HireDate = request.HireDate;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Update", "Employee", entity.Id.ToString(), $"Updated employee '{entity.FullName}'.");
        return (true, null, await GetByIdAsync(entity.Id));
    }

    public async Task<(bool Ok, string? Error)> DeactivateAsync(int id, string? userId)
    {
        var entity = await _db.Employees.FindAsync(id);
        if (entity is null) return (false, "Employee not found.");

        var openBreak = await _db.BreakSessions.AnyAsync(b => b.EmployeeId == id && b.InTime == null);
        if (openBreak) return (false, "Cannot deactivate an employee who is currently on break. Close the break first.");

        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Deactivate", "Employee", entity.Id.ToString(), $"Deactivated employee '{entity.FullName}'.");
        return (true, null);
    }
}
