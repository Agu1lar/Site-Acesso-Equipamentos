$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cmd = Join-Path $PSScriptRoot 'after-hours-watch.cmd'
$taskName = 'AcessoIAEva'

schtasks /Create /TN $taskName /SC ONLOGON /RL LIMITED /F /TR "`"$cmd`"" | Out-Null
schtasks /Run /TN $taskName | Out-Null
Write-Host "[eva] tarefa Windows '$taskName' instalada e iniciada"
Write-Host "[eva] sobrevive ao Cursor; se o processo cair, religa em 5s"
