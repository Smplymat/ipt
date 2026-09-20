# ─────────────────────────────────────────────────────────────────────────────
# regenerate_setup.ps1
# Rebuilds supabase/setup.sql from the files in supabase/migrations/ so the
# "live schema mirror" and the migration chain can never drift apart.
#
# Format (kept identical to the historical setup.sql):
#   /* ============ <filename> ============ */
#   <file contents>
#   (blank line before the next banner)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File supabase/regenerate_setup.ps1
#
# After running it, `git diff supabase/setup.sql` should only show changes you
# intended, and `supabase/compare_migrations_setup.ps1` should print
# "IN SYNC". 
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'

$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$migDir = Join-Path $root 'migrations'
$out    = Join-Path $root 'setup.sql'

$files = @(Get-ChildItem -Path $migDir -Filter '*.sql' | Sort-Object Name)
if ($files.Count -eq 0) {
  Write-Error 'No migration files found.'
}

$sb = New-Object System.Text.StringBuilder
foreach ($f in $files) {
  [void]$sb.AppendLine("/* ============ $($f.Name) ============ */")
  $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
  # Trim any stray trailing newline so each section contributes exactly one.
  $content = $content.TrimEnd("`r", "`n")
  [void]$sb.AppendLine($content)
  # Blank line separates this section from the next banner.
  [void]$sb.AppendLine()
}

# UTF-8 without BOM (a BOM can trip up some SQL tools).
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($out, $sb.ToString(), $utf8NoBom)

Write-Output "Regenerated $out from $($files.Count) migrations ($($sb.Length) chars)."