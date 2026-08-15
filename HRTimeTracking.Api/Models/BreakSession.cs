using System.ComponentModel.DataAnnotations;

namespace HRTimeTracking.Api.Models;

public class BreakSession
{
    public int Id { get; set; }

    public int EmployeeId { get; set; }

    public Employee Employee { get; set; } = null!;

    /// <summary>Comfort or Meal. Existing rows default to Comfort (additive migration).</summary>
    [MaxLength(20)]
    public string BreakType { get; set; } = BreakTypes.Comfort;

    public DateTime OutTime { get; set; }

    public DateTime? InTime { get; set; }

    public int? DurationSeconds { get; set; }

    public DateOnly BreakDate { get; set; }

    [MaxLength(450)]
    public string? RecordedByUserId { get; set; }

    public ApplicationUser? RecordedByUser { get; set; }

    [MaxLength(450)]
    public string? ClosedByUserId { get; set; }

    public ApplicationUser? ClosedByUser { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsOpen => InTime is null;
}
