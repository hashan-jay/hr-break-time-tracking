using HRTimeTracking.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRTimeTracking.Api.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260814120000_AddBreakTypesAndLimits")]
public partial class AddBreakTypesAndLimits : Migration
{
    /// <summary>
    /// Additive only: adds BreakSessions.BreakType (default Comfort for existing rows)
    /// and does not delete or alter existing break times, employees, or other data.
    /// Meal/Comfort limit settings are seeded in DbSeeder (idempotent inserts).
    /// </summary>
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "BreakType",
            table: "BreakSessions",
            type: "nvarchar(20)",
            maxLength: 20,
            nullable: false,
            defaultValue: "Comfort");

        migrationBuilder.CreateIndex(
            name: "IX_BreakSessions_EmployeeId_BreakType_BreakDate",
            table: "BreakSessions",
            columns: new[] { "EmployeeId", "BreakType", "BreakDate" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_BreakSessions_EmployeeId_BreakType_BreakDate",
            table: "BreakSessions");

        migrationBuilder.DropColumn(
            name: "BreakType",
            table: "BreakSessions");
    }
}
