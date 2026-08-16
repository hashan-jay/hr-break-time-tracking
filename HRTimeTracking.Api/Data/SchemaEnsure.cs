using Microsoft.EntityFrameworkCore;

namespace HRTimeTracking.Api.Data;

/// <summary>
/// Additive, idempotent schema updates. Never drops tables or deletes rows.
/// Used so the API can start even if an EF migration was only partly applied.
/// </summary>
public static class SchemaEnsure
{
    public static async Task ApplyAsync(AppDbContext db)
    {
        // Shifts table + employee assignment (overnight shift support).
        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.Shifts', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.Shifts (
                    Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    Name nvarchar(100) NOT NULL,
                    StartTime time NOT NULL,
                    EndTime time NOT NULL,
                    SpansNextDay bit NOT NULL,
                    IsActive bit NOT NULL,
                    CreatedAt datetime2 NOT NULL,
                    UpdatedAt datetime2 NULL
                );
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.Shifts', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Shifts_Name' AND object_id = OBJECT_ID(N'dbo.Shifts'))
            BEGIN
                CREATE UNIQUE INDEX IX_Shifts_Name ON dbo.Shifts (Name);
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.Shifts', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Shifts_IsActive' AND object_id = OBJECT_ID(N'dbo.Shifts'))
            BEGIN
                CREATE INDEX IX_Shifts_IsActive ON dbo.Shifts (IsActive);
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF COL_LENGTH('dbo.Employees', 'ShiftId') IS NULL
            BEGIN
                ALTER TABLE dbo.Employees ADD ShiftId int NULL;
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF COL_LENGTH('dbo.Employees', 'ShiftId') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Employees_ShiftId' AND object_id = OBJECT_ID(N'dbo.Employees'))
            BEGIN
                CREATE INDEX IX_Employees_ShiftId ON dbo.Employees (ShiftId);
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF COL_LENGTH('dbo.Employees', 'ShiftId') IS NOT NULL
               AND OBJECT_ID(N'dbo.Shifts', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Employees_Shifts_ShiftId')
            BEGIN
                ALTER TABLE dbo.Employees
                ADD CONSTRAINT FK_Employees_Shifts_ShiftId
                FOREIGN KEY (ShiftId) REFERENCES dbo.Shifts (Id) ON DELETE SET NULL;
            END
            """);

        // Meal / Comfort type on existing break sessions. Default Comfort; no row deletions.
        await db.Database.ExecuteSqlRawAsync("""
            IF COL_LENGTH('dbo.BreakSessions', 'BreakType') IS NULL
            BEGIN
                ALTER TABLE dbo.BreakSessions ADD BreakType nvarchar(20) NOT NULL
                    CONSTRAINT DF_BreakSessions_BreakType DEFAULT ('Comfort');
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF COL_LENGTH('dbo.BreakSessions', 'BreakType') IS NOT NULL
               AND NOT EXISTS (
                    SELECT 1 FROM sys.indexes
                    WHERE name = N'IX_BreakSessions_EmployeeId_BreakType_BreakDate'
                      AND object_id = OBJECT_ID(N'dbo.BreakSessions'))
            BEGIN
                CREATE INDEX IX_BreakSessions_EmployeeId_BreakType_BreakDate
                    ON dbo.BreakSessions (EmployeeId, BreakType, BreakDate);
            END
            """);

        // Additive start-count settings. Insert only; never update existing values.
        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.SystemSettings', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE [Key] = N'MealBreakStartLimit')
            BEGIN
                INSERT INTO dbo.SystemSettings ([Key], [Value], [Description])
                VALUES (N'MealBreakStartLimit', N'1', N'Maximum Meal break starts allowed per employee per shift (Developer adjustable).');
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.SystemSettings', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE [Key] = N'ComfortBreakStartLimit')
            BEGIN
                INSERT INTO dbo.SystemSettings ([Key], [Value], [Description])
                VALUES (N'ComfortBreakStartLimit', N'2', N'Maximum Comfort break starts allowed per employee per shift (Developer adjustable).');
            END
            """);
    }
}
