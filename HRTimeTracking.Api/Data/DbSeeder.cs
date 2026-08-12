using HRTimeTracking.Api.Data;
using HRTimeTracking.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HRTimeTracking.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<AppDbContext>();
        var userManager = sp.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = sp.GetRequiredService<RoleManager<IdentityRole>>();
        var config = sp.GetRequiredService<IConfiguration>();

        await db.Database.MigrateAsync();

        foreach (var role in AppRoles.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));
        }

        if (!await db.SystemSettings.AnyAsync(s => s.Key == Services.SettingsService.DailyLimitKey))
        {
            db.SystemSettings.Add(new SystemSetting
            {
                Key = Services.SettingsService.DailyLimitKey,
                Value = BreakStatusCodes.DefaultDailyLimitMinutes.ToString(),
                Description = "Maximum allowed daily break time in minutes."
            });
            await db.SaveChangesAsync();
        }

        await EnsureUserAsync(userManager, config, "SeedUsers:Developer", AppRoles.Developer,
            "developer", "developer@local", "System Developer", "Developer@123");
        await EnsureUserAsync(userManager, config, "SeedUsers:HRManager", AppRoles.HRManager,
            "hrmanager", "hrmanager@local", "HR Manager", "HrManager@123");
        await EnsureUserAsync(userManager, config, "SeedUsers:HRAssistant", AppRoles.HRAssistant,
            "hrassistant", "hrassistant@local", "HR Assistant", "HrAssistant@123");

        if (!await db.Departments.AnyAsync())
        {
            var departments = new[]
            {
                new Department { Name = "Human Resources", Description = "HR and people operations", IsActive = true, CreatedAt = DateTime.UtcNow },
                new Department { Name = "Finance", Description = "Accounts and finance", IsActive = true, CreatedAt = DateTime.UtcNow },
                new Department { Name = "Operations", Description = "Day-to-day operations", IsActive = true, CreatedAt = DateTime.UtcNow },
                new Department { Name = "IT", Description = "Information technology", IsActive = true, CreatedAt = DateTime.UtcNow }
            };
            db.Departments.AddRange(departments);
            await db.SaveChangesAsync();

            db.Employees.AddRange(
                new Employee { EmployeeCode = "EMP001", FullName = "Aisha Fernando", DepartmentId = departments[0].Id, JobTitle = "HR Officer", IsActive = true, HireDate = DateTime.UtcNow, CreatedAt = DateTime.UtcNow },
                new Employee { EmployeeCode = "EMP002", FullName = "Nuwan Perera", DepartmentId = departments[1].Id, JobTitle = "Accountant", IsActive = true, HireDate = DateTime.UtcNow, CreatedAt = DateTime.UtcNow },
                new Employee { EmployeeCode = "EMP003", FullName = "Sajith Silva", DepartmentId = departments[2].Id, JobTitle = "Ops Lead", IsActive = true, HireDate = DateTime.UtcNow, CreatedAt = DateTime.UtcNow },
                new Employee { EmployeeCode = "EMP004", FullName = "Dilani Jayasuriya", DepartmentId = departments[3].Id, JobTitle = "Support Engineer", IsActive = true, HireDate = DateTime.UtcNow, CreatedAt = DateTime.UtcNow },
                new Employee { EmployeeCode = "EMP005", FullName = "Kasun Bandara", DepartmentId = departments[2].Id, JobTitle = "Coordinator", IsActive = true, HireDate = DateTime.UtcNow, CreatedAt = DateTime.UtcNow }
            );
            await db.SaveChangesAsync();
        }
    }

    private static async Task EnsureUserAsync(
        UserManager<ApplicationUser> userManager,
        IConfiguration config,
        string configSection,
        string role,
        string defaultUserName,
        string defaultEmail,
        string defaultFullName,
        string defaultPassword)
    {
        var section = config.GetSection(configSection);
        var userName = section["UserName"] ?? defaultUserName;
        var email = section["Email"] ?? defaultEmail;
        var fullName = section["FullName"] ?? defaultFullName;
        var password = section["Password"] ?? defaultPassword;

        var existing = await userManager.FindByNameAsync(userName);
        if (existing is not null) return;

        var user = new ApplicationUser
        {
            UserName = userName,
            Email = email,
            FullName = fullName,
            EmailConfirmed = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
            throw new InvalidOperationException($"Failed to seed user '{userName}': {string.Join(", ", result.Errors.Select(e => e.Description))}");

        await userManager.AddToRoleAsync(user, role);
    }
}
