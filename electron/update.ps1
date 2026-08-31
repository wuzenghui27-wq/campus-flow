param(
  [Parameter(Mandatory=$true)][string]$Source,
  [Parameter(Mandatory=$true)][string]$Target,
  [Parameter(Mandatory=$true)][int]$RunningId
)

$ErrorActionPreference = 'SilentlyContinue'
Wait-Process -Id $RunningId -Timeout 60
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  try {
    Copy-Item -LiteralPath $Source -Destination $Target -Force -ErrorAction Stop
    Remove-Item -LiteralPath $Source -Force
    Start-Process -FilePath $Target
    exit 0
  } catch { Start-Sleep -Seconds 1 }
}
exit 1
