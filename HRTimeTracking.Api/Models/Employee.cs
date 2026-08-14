using System.ComponentModel.DataAnnotations;

namespace HRTimeTracking.Api.Models;

public class Employee
{
    public int Id { get; set; }

    [MaxLength(50)]
    public string EmployeeCode { get; set; } = string.Empty;

    [MaxLength(150)]
    public string FullName { get; set; } = string.Empty;

    public int DepartmentId { get; set; }

    public Department Department { get; set; } = null!;

    /// <summary>Optional shift assignment. Null preserves existing employees without a shift.</summary>
    public int? ShiftId { get; set; }

    public Shift? Shift { get; set; }

    public bool IsDeleted { get; set; }

    public DateTime? DeletedAt { get; set; }

    public DateTime HireDate { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<BreakSession> BreakSessions { get; set; } = new List<BreakSession>();
}
