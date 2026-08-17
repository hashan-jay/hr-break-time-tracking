using HRTimeTracking.Api.Data;
using HRTimeTracking.Api.DTOs;
using HRTimeTracking.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HRTimeTracking.Api.Services;

public interface IDepartmentService
{
    Task<IReadOnlyList<DepartmentDto>> GetAllAsync(bool includeDeleted = false, string? search = null);
    Task<DepartmentDto?> GetByIdAsync(int id);
    Task<(bool Ok, string? Error, DepartmentDto? Data)> CreateAsync(CreateDepartmentRequest request, string? userId);
    Task<(bool Ok, string? Error, DepartmentDto? Data)> UpdateAsync(int id, UpdateDepartmentRequest request, string? userId);
    Task<(bool Ok, string? Error)> DeleteAsync(int id, string? userId);
    Task<(bool Ok, string? Error, DepartmentDto? Data)> RecoverAsync(int id, string? userId);
}

public class DepartmentService : IDepartmentService
{
    private readonly AppDbContext _db;
    private readonly IAuditService _audit;
    private readonly ISettingsService _settings;

    public DepartmentService(AppDbContext db, IAuditService audit, ISettingsService settings)
    {
        _db = db;
        _audit = audit;
        _settings = settings;
    }

    public async Task<IReadOnlyList<DepartmentDto>> GetAllAsync(bool includeDeleted = false, string? search = null)
    {
        var query = _db.Departments.AsNoTracking().AsQueryable();
        if (!includeDeleted) query = query.Where(d => !d.IsDeleted);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(d => d.Name.ToLower().Contains(term) || (d.Description != null && d.Description.ToLower().Contains(term)));
        }

        return await query
            .OrderBy(d => d.IsDeleted)
            .ThenBy(d => d.Name)
            .Select(d => new DepartmentDto(
                d.Id,
                d.Name,
                d.Description,
                d.IsDeleted,
                d.DeletedAt,
                d.Employees.Count(e => !e.IsDeleted),
                d.CreatedAt,
                d.MealBreakStartLimit,
                d.ComfortBreakStartLimit))
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
                d.IsDeleted,
                d.DeletedAt,
                d.Employees.Count(e => !e.IsDeleted),
                d.CreatedAt,
                d.MealBreakStartLimit,
                d.ComfortBreakStartLimit))
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
            CreatedAt = DateTime.UtcNow,
            MealBreakStartLimit = await _settings.GetMealStartLimitAsync(),
            ComfortBreakStartLimit = await _settings.GetComfortStartLimitAsync()
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
        if (entity.IsDeleted) return (false, "This department is deleted. Recover it before editing.", null);

        var name = request.Name.Trim();
        if (await _db.Departments.AnyAsync(d => d.Name == name && d.Id != id))
            return (false, "A department with this name already exists.", null);

        entity.Name = name;
        entity.Description = request.Description?.Trim();
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Update", "Department", entity.Id.ToString(), $"Updated department '{entity.Name}'.");
        return (true, null, await GetByIdAsync(entity.Id));
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(int id, string? userId)
    {
        var entity = await _db.Departments.FindAsync(id);
        if (entity is null) return (false, "Department not found.");
        if (entity.IsDeleted) return (false, "Department is already deleted.");

        var hasEmployees = await _db.Employees.AnyAsync(e => e.DepartmentId == id && !e.IsDeleted);
        if (hasEmployees)
            return (false, "Cannot delete a department that still has employees. Move or delete those employees first.");

        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Delete", "Department", entity.Id.ToString(), $"Deleted department '{entity.Name}'.");
        return (true, null);
    }

    public async Task<(bool Ok, string? Error, DepartmentDto? Data)> RecoverAsync(int id, string? userId)
    {
        var entity = await _db.Departments.FindAsync(id);
        if (entity is null) return (false, "Department not found.", null);
        if (!entity.IsDeleted) return (false, "Department is not deleted.", null);

        entity.IsDeleted = false;
        entity.DeletedAt = null;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Recover", "Department", entity.Id.ToString(), $"Recovered department '{entity.Name}'.");
        return (true, null, await GetByIdAsync(entity.Id));
    }
}

public interface IEmployeeService
{
    Task<IReadOnlyList<EmployeeDto>> GetAllAsync(string? search = null, int? departmentId = null);
    Task<EmployeeDto?> GetByIdAsync(int id);
    Task<(bool Ok, string? Error, EmployeeDto? Data)> CreateAsync(CreateEmployeeRequest request, string? userId);
    Task<(bool Ok, string? Error, EmployeeDto? Data)> UpdateAsync(int id, UpdateEmployeeRequest request, string? userId);
    Task<(bool Ok, string? Error)> DeleteAsync(int id, string? userId);
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
        e.ShiftId,
        e.Shift?.Name,
        e.Shift is null
            ? null
            : ShiftService.BuildDisplayLabel(e.Shift.Name, e.Shift.StartTime, e.Shift.EndTime, e.Shift.SpansNextDay),
        e.IsDeleted,
        e.DeletedAt,
        e.HireDate);

    public async Task<IReadOnlyList<EmployeeDto>> GetAllAsync(string? search = null, int? departmentId = null)
    {
        var query = _db.Employees.AsNoTracking()
            .Include(e => e.Department)
            .Include(e => e.Shift)
            .Where(e => !e.IsDeleted);
        if (departmentId.HasValue) query = query.Where(e => e.DepartmentId == departmentId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(e =>
                e.FullName.ToLower().Contains(term) ||
                e.EmployeeCode.ToLower().Contains(term) ||
                e.Department.Name.ToLower().Contains(term) ||
                (e.Shift != null && e.Shift.Name.ToLower().Contains(term)));
        }

        var list = await query
            .OrderBy(e => e.FullName)
            .ToListAsync();
        return list.Select(Map).ToList();
    }

    public async Task<EmployeeDto?> GetByIdAsync(int id)
    {
        var e = await _db.Employees.AsNoTracking()
            .Include(x => x.Department)
            .Include(x => x.Shift)
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
        return e is null ? null : Map(e);
    }

    public async Task<(bool Ok, string? Error, EmployeeDto? Data)> CreateAsync(CreateEmployeeRequest request, string? userId)
    {
        var code = request.EmployeeCode.Trim();
        if (await _db.Employees.AnyAsync(e => e.EmployeeCode == code))
            return (false, "Employee code already exists.", null);

        var dept = await _db.Departments.FirstOrDefaultAsync(d => d.Id == request.DepartmentId && !d.IsDeleted);
        if (dept is null) return (false, "Department not found.", null);

        var shiftError = await ValidateShiftAsync(request.ShiftId);
        if (shiftError is not null) return (false, shiftError, null);

        var entity = new Employee
        {
            EmployeeCode = code,
            FullName = request.FullName.Trim(),
            DepartmentId = request.DepartmentId,
            ShiftId = request.ShiftId,
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
        if (entity.IsDeleted) return (false, "Employee not found.", null);

        var deptExists = await _db.Departments.AnyAsync(d => d.Id == request.DepartmentId && !d.IsDeleted);
        if (!deptExists) return (false, "Department not found.", null);

        var shiftError = await ValidateShiftAsync(request.ShiftId);
        if (shiftError is not null) return (false, shiftError, null);

        entity.FullName = request.FullName.Trim();
        entity.DepartmentId = request.DepartmentId;
        entity.ShiftId = request.ShiftId;
        entity.HireDate = request.HireDate;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Update", "Employee", entity.Id.ToString(), $"Updated employee '{entity.FullName}'.");
        return (true, null, await GetByIdAsync(entity.Id));
    }

    private async Task<string?> ValidateShiftAsync(int? shiftId)
    {
        if (!shiftId.HasValue) return null;
        var shift = await _db.Shifts.AsNoTracking().FirstOrDefaultAsync(s => s.Id == shiftId.Value);
        if (shift is null) return "Shift not found.";
        if (!shift.IsActive) return "Selected shift is inactive. Choose an active shift.";
        return null;
    }

    public async Task<(bool Ok, string? Error)> DeleteAsync(int id, string? userId)
    {
        var entity = await _db.Employees.FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);
        if (entity is null) return (false, "Employee not found.");

        var fullName = entity.FullName;
        var code = entity.EmployeeCode;

        var sessions = await _db.BreakSessions.Where(b => b.EmployeeId == id).ToListAsync();
        _db.BreakSessions.RemoveRange(sessions);
        _db.Employees.Remove(entity);
        await _db.SaveChangesAsync();
        await _audit.LogAsync(userId, "Delete", "Employee", id.ToString(), $"Deleted employee '{fullName}' ({code}).");
        return (true, null);
    }
}
