# Stop leftover API hosts that lock bin\Debug\net10.0\HRTimeTracking.Api.dll (MSB3027).
$ErrorActionPreference = 'SilentlyContinue'

Get-NetTCPConnection -LocalPort 5085 | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force
}

Get-CimInstance Win32_Process | Where-Object {
    $_.Name -match 'dotnet|HRTimeTracking' -and
    $_.CommandLine -match 'HRTimeTracking\.Api|HRBreakTimeTracking\\HRTimeTracking'
} | ForEach-Object {
    Write-Host "Stopping PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force
}

Get-Process -Name 'HRTimeTracking.Api' | Stop-Process -Force

Start-Sleep -Seconds 1
if (Get-NetTCPConnection -LocalPort 5085) {
    Write-Host 'Port 5085 still in use.'
} else {
    Write-Host 'Port 5085 is free. You can run: dotnet watch run'
}
