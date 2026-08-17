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
            IF COL_LENGTH('dbo.BreakSessions', 'IsAutoClosed') IS NULL
            BEGIN
                ALTER TABLE dbo.BreakSessions ADD IsAutoClosed bit NOT NULL
                    CONSTRAINT DF_BreakSessions_IsAutoClosed DEFAULT (0);
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
                VALUES (N'MealBreakStartLimit', N'1', N'Default Meal break starts for new departments (Developer adjustable).');
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.SystemSettings', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM dbo.SystemSettings WHERE [Key] = N'ComfortBreakStartLimit')
            BEGIN
                INSERT INTO dbo.SystemSettings ([Key], [Value], [Description])
                VALUES (N'ComfortBreakStartLimit', N'2', N'Default Comfort break starts for new departments (Developer adjustable).');
            END
            """);

        // Per-department start limits. Additive columns only; copy current global defaults onto
        // existing departments once, then never overwrite department-specific values.
        await db.Database.ExecuteSqlRawAsync("""
            IF COL_LENGTH('dbo.Departments', 'MealBreakStartLimit') IS NULL
            BEGIN
                ALTER TABLE dbo.Departments ADD MealBreakStartLimit int NOT NULL
                    CONSTRAINT DF_Departments_MealBreakStartLimit DEFAULT (1);

                DECLARE @mealDefault int = 1;
                SELECT @mealDefault = TRY_CAST([Value] AS int)
                FROM dbo.SystemSettings WHERE [Key] = N'MealBreakStartLimit';
                IF @mealDefault IS NULL OR @mealDefault < 1 SET @mealDefault = 1;
                IF @mealDefault > 20 SET @mealDefault = 20;

                DECLARE @mealSql nvarchar(300) =
                    N'UPDATE dbo.Departments SET MealBreakStartLimit = ' + CAST(@mealDefault AS nvarchar(10));
                EXEC sp_executesql @mealSql;
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF COL_LENGTH('dbo.Departments', 'ComfortBreakStartLimit') IS NULL
            BEGIN
                ALTER TABLE dbo.Departments ADD ComfortBreakStartLimit int NOT NULL
                    CONSTRAINT DF_Departments_ComfortBreakStartLimit DEFAULT (2);

                DECLARE @comfortDefault int = 2;
                SELECT @comfortDefault = TRY_CAST([Value] AS int)
                FROM dbo.SystemSettings WHERE [Key] = N'ComfortBreakStartLimit';
                IF @comfortDefault IS NULL OR @comfortDefault < 1 SET @comfortDefault = 2;
                IF @comfortDefault > 20 SET @comfortDefault = 20;

                DECLARE @comfortSql nvarchar(300) =
                    N'UPDATE dbo.Departments SET ComfortBreakStartLimit = ' + CAST(@comfortDefault AS nvarchar(10));
                EXEC sp_executesql @comfortSql;
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.RolePermissions', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.RolePermissions (
                    Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    RoleName nvarchar(50) NOT NULL,
                    SectionKey nvarchar(50) NOT NULL
                );
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.RolePermissions', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_RolePermissions_RoleName_SectionKey' AND object_id = OBJECT_ID(N'dbo.RolePermissions'))
            BEGIN
                CREATE UNIQUE INDEX IX_RolePermissions_RoleName_SectionKey
                    ON dbo.RolePermissions (RoleName, SectionKey);
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.UserPermissions', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.UserPermissions (
                    Id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
                    UserId nvarchar(450) NOT NULL,
                    SectionKey nvarchar(50) NOT NULL
                );
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.UserPermissions', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_UserPermissions_UserId_SectionKey' AND object_id = OBJECT_ID(N'dbo.UserPermissions'))
            BEGIN
                CREATE UNIQUE INDEX IX_UserPermissions_UserId_SectionKey
                    ON dbo.UserPermissions (UserId, SectionKey);
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.UserPermissions', N'U') IS NOT NULL
               AND OBJECT_ID(N'dbo.AspNetUsers', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_UserPermissions_AspNetUsers_UserId')
            BEGIN
                ALTER TABLE dbo.UserPermissions
                ADD CONSTRAINT FK_UserPermissions_AspNetUsers_UserId
                FOREIGN KEY (UserId) REFERENCES dbo.AspNetUsers (Id) ON DELETE CASCADE;
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.AspNetRoles', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM dbo.AspNetRoles WHERE NormalizedName = N'SYSTEMADMINISTRATION')
            BEGIN
                INSERT INTO dbo.AspNetRoles (Id, Name, NormalizedName, ConcurrencyStamp)
                VALUES (
                    CONVERT(nvarchar(450), NEWID()),
                    N'SystemAdministration',
                    N'SYSTEMADMINISTRATION',
                    CONVERT(nvarchar(450), NEWID())
                );
            END
            """);

        await db.Database.ExecuteSqlRawAsync("""
            IF OBJECT_ID(N'dbo.RolePermissions', N'U') IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions WHERE RoleName = N'SystemAdministration')
            BEGIN
                INSERT INTO dbo.RolePermissions (RoleName, SectionKey) VALUES
                    (N'SystemAdministration', N'dashboard'),
                    (N'SystemAdministration', N'settings'),
                    (N'SystemAdministration', N'audit');
            END
            """);
    }
}
