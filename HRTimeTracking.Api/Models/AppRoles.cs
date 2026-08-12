namespace HRTimeTracking.Api.Models;

public static class AppRoles
{
    public const string Developer = "Developer";
    public const string HRManager = "HRManager";
    public const string HRAssistant = "HRAssistant";

    public static readonly string[] All =
    [
        Developer,
        HRManager,
        HRAssistant
    ];
}
