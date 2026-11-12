param([int]$RootProcessId, [string]$ReportPath, [string]$StopPath, [double]$BudgetSeconds = 1740)
$ErrorActionPreference = 'Stop'
$watch = [Diagnostics.Stopwatch]::StartNew()
$peakWorking = 0L
$peakPrivate = 0L
$samples = 0
$cpuByProcess = @{}
$reason = $null
try {
  do {
    $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
    $ids = [Collections.Generic.HashSet[int]]::new()
    [void]$ids.Add($RootProcessId)
    do {
      $added = $false
      foreach ($item in $all) {
        if ($ids.Contains([int]$item.ParentProcessId) -and $ids.Add([int]$item.ProcessId)) { $added = $true }
      }
    } while ($added)
    $working = 0L; $private = 0L
    foreach ($processId in $ids) {
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if ($null -ne $process) {
        $working += $process.WorkingSet64; $private += $process.PrivateMemorySize64
        $cpuByProcess["$processId/$($process.StartTime.Ticks)"] = $process.TotalProcessorTime.TotalSeconds
      }
    }
    $peakWorking = [Math]::Max($peakWorking, $working)
    $peakPrivate = [Math]::Max($peakPrivate, $private)
    $samples++
    $cpuSeconds = ($cpuByProcess.Values | Measure-Object -Sum).Sum
    if ([Math]::Max($working, $private) -ge 3500000000) { $reason = 'Process tree reached the conservative 3.5 GB stop threshold' }
    if ($watch.Elapsed.TotalSeconds -ge $BudgetSeconds -or $cpuSeconds -ge $BudgetSeconds) { $reason = 'Process tree reached the conservative time budget' }
    $report = @{ samples=$samples; peakWorkingSetBytes=$peakWorking; peakPrivateBytes=$peakPrivate;
      sampledCpuSeconds=$cpuSeconds; monitorWallSeconds=$watch.Elapsed.TotalSeconds; stopReason=$reason;
      memoryStopBytes=3500000000; sampleIntervalMilliseconds=1000; includes='runner, Node worker, Edge descendants, esbuild, monitor' }
    [IO.File]::WriteAllText($ReportPath, ($report | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    if ($samples -eq 1) { [Console]::WriteLine('ready') }
    if ($null -ne $reason) {
      # Stop only this runner's descendants; never stop unrelated Edge or Node processes by name.
      foreach ($processId in $ids) { if ($processId -ne $PID -and $processId -ne $RootProcessId) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue } }
      Stop-Process -Id $RootProcessId -Force -ErrorAction SilentlyContinue
      exit 2
    }
    if (Test-Path -LiteralPath $StopPath) { break }
    Start-Sleep -Milliseconds 1000
  } while (Get-Process -Id $RootProcessId -ErrorAction SilentlyContinue)
} catch { [Console]::Error.WriteLine($_); exit 1 }
