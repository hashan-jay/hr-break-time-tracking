using Microsoft.AspNetCore.Mvc;

namespace HRTimeTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "healthy",
            application = "HR Time Tracking API"
        });
    }
}