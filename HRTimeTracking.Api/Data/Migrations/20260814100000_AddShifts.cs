using System;
using HRTimeTracking.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HRTimeTracking.Api.Data.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260814100000_AddShifts")]
public partial class AddShifts : Migration
{
    /// <summary>
    /// Additive only: creates Shifts table and nullable Employees.ShiftId.
    /// Does not modify or delete any existing employee/break/department data.
    /// </summary>
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Shifts",
            columns: table => new
            {
                Id = table.Column<int>(type: "int", nullable: false)
                    .Annotation("SqlServer:Identity", "1, 1"),
                Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                StartTime = table.Column<TimeOnly>(type: "time", nullable: false),
                EndTime = table.Column<TimeOnly>(type: "time", nullable: false),
                SpansNextDay = table.Column<bool>(type: "bit", nullable: false),
                IsActive = table.Column<bool>(type: "bit", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Shifts", x => x.Id);
            });

        migrationBuilder.AddColumn<int>(
            name: "ShiftId",
            table: "Employees",
            type: "int",
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_Employees_ShiftId",
            table: "Employees",
            column: "ShiftId");

        migrationBuilder.CreateIndex(
            name: "IX_Shifts_IsActive",
            table: "Shifts",
            column: "IsActive");

        migrationBuilder.CreateIndex(
            name: "IX_Shifts_Name",
            table: "Shifts",
            column: "Name",
            unique: true);

        migrationBuilder.AddForeignKey(
            name: "FK_Employees_Shifts_ShiftId",
            table: "Employees",
            column: "ShiftId",
            principalTable: "Shifts",
            principalColumn: "Id",
            onDelete: ReferentialAction.SetNull);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(
            name: "FK_Employees_Shifts_ShiftId",
            table: "Employees");

        migrationBuilder.DropTable(
            name: "Shifts");

        migrationBuilder.DropIndex(
            name: "IX_Employees_ShiftId",
            table: "Employees");

        migrationBuilder.DropColumn(
            name: "ShiftId",
            table: "Employees");
    }
}
