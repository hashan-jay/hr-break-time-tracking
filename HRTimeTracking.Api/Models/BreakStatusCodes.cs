namespace HRTimeTracking.Api.Models;

public static class BreakStatusCodes
{
    public const int DefaultDailyLimitMinutes = 20;

    public const string WellSatisfied = "Well Satisfied";
    public const string Satisfied = "Satisfied";
    public const string Exceeded = "Exceeded Break Time Limit";

    public const string ColorGreen = "green";
    public const string ColorBlue = "blue";
    public const string ColorRed = "red";

    public static (string Status, string Color) FromTotalSeconds(int totalSeconds, int dailyLimitMinutes = DefaultDailyLimitMinutes)
    {
        var limitSeconds = Math.Max(1, dailyLimitMinutes) * 60;

        if (totalSeconds < limitSeconds)
            return (WellSatisfied, ColorGreen);

        if (totalSeconds == limitSeconds)
            return (Satisfied, ColorBlue);

        return (Exceeded, ColorRed);
    }
}
