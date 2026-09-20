# ─────────────────────────────────────────────────────────────────────────────
# compare_migrations_setup.ps1
# Verifies that supabase/setup.sql is byte-for-byte what
# supabase/migrations/*.sql concatenated in order would produce.
# Reports remaining textual differences.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File supabase/compare_migrations_setup.ps1
#
# This is a *textual* sync check (migrations vs mirror). Structural checks
# (columns / constraints / policies / triggers / functions) that must be run
# against a real database live in supabase/verify_schema.sql.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'

$root   = Split-Path -Parent $MyInvocation.MyCommand.Path
$migDir = Join-Path $root 'migrations'
$setup  = Join-Path $root 'setup.sql'

$files = @(Get-ChildItem -Path $migDir -Filter '*.sql' | Sort-Object Name)
$sb = New-Object System.Text.StringBuilder
foreach ($f in $files) {
  [void]$sb.AppendLine("/* ============ $($f.Name) ============ */")
  $content = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8).TrimEnd("`r", "`n")
  [void]$sb.AppendLine($content)
  [void]$sb.AppendLine()
}

$expected = $sb.ToString()
$actual   = [System.IO.File]::ReadAllText($setup, [System.Text.Encoding]::UTF8)

if ($expected -eq $actual) {
  Write-Output 'IN SYNC — setup.sql is exactly the concatenation of the migrations.'
  exit 0
}

Write-Output 'OUT OF SYNC — differences found between setup.sql and migrations/ :'
$exp = $expected -split "`n"
$act = $actual   -split "`n"
$max = [Math]::Max($exp.Length, $act.Length)
$printed = 0
for ($i = 0; $i -lt $max; $i++) {
  $e = if ($i -lt $exp.Length) { $exp[$i] } else { '<MISSING>' }
  $a = if ($i -lt $act.Length) { $act[$i] } else { '<MISSING>' }
  if ($e -ne $a) {
    Write-Output "  line $($i + 1):"
    Write-Output "    expected: $e"
    Write-Output "    actual  : $a"
    $printed++
    if ($printed -ge 25) { Write-Output '  (truncated — showing first 25 differences)' ; break }
  }
}
exit 1