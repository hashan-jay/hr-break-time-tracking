using System.ComponentModel.DataAnnotations;

namespace HRTimeTracking.Api.Models;

public class Department
{
    public int Id { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(250)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
