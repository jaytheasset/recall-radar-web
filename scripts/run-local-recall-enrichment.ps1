$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $projectRoot 'outputs\llm-classifier\local'
$node = Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Source
$worker = Join-Path $PSScriptRoot 'run-local-recall-enrichment.ts'
$log = Join-Path $outputDirectory 'scheduled-run.log'

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
Set-Location -LiteralPath $projectRoot
$ErrorActionPreference = 'Continue'
"Started $([DateTimeOffset]::Now.ToString('o'))" | Out-File -LiteralPath $log -Encoding utf8
$lockPath = Join-Path $outputDirectory 'worker.lock'
if (Test-Path -LiteralPath $lockPath) {
    'Waiting for the active recall worker to save its results.' | Out-File -LiteralPath $log -Encoding utf8 -Append
    while (Test-Path -LiteralPath $lockPath) {
        $ownerText = Get-Content -LiteralPath $lockPath -Raw -ErrorAction SilentlyContinue
        $ownerPid = 0
        if (![int]::TryParse($ownerText, [ref]$ownerPid) -or !(Get-Process -Id $ownerPid -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Seconds 15
    }
}
& $node $worker --refresh --limit=5000 --jobs=2 2>&1 | Out-File -LiteralPath $log -Encoding utf8 -Append
$workerExitCode = $LASTEXITCODE
"Finished $([DateTimeOffset]::Now.ToString('o')) with exit code $workerExitCode" | Out-File -LiteralPath $log -Encoding utf8 -Append
exit $workerExitCode
