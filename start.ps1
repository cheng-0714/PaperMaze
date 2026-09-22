$ErrorActionPreference = "Stop"
$Pnpm = "pnpm"
if (Test-Path "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd") {
  $Pnpm = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
}
Push-Location "$PSScriptRoot\frontend"
try { & $Pnpm install; & $Pnpm build } finally { Pop-Location }
if (-not (Test-Path "$PSScriptRoot\.venv\Scripts\python.exe")) { python -m venv "$PSScriptRoot\.venv" }
& "$PSScriptRoot\.venv\Scripts\python.exe" -m pip install -r "$PSScriptRoot\backend\requirements.txt"
& "$PSScriptRoot\.venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
