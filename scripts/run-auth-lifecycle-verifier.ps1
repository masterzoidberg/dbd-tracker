param(
  [Parameter(Mandatory = $true)]
  [string]$PreviewUrl
)

$secretNames = @('MAILTRAP_API_TOKEN', 'VERCEL_AUTOMATION_BYPASS_SECRET')
$temporaryVariables = @()
$exitCode = 0

try {
  foreach ($name in $secretNames) {
    $current = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ([string]::IsNullOrWhiteSpace($current)) {
      $secure = Read-Host -Prompt "Enter $name (input is masked)" -AsSecureString
      $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      try {
        $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if ([string]::IsNullOrWhiteSpace($value)) { throw "$name is required." }
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        $temporaryVariables += $name
        $value = $null
      } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $value = $null
        $secure.Dispose()
      }
    }
  }

  foreach ($name in @('MAILTRAP_ACCOUNT_ID', 'MAILTRAP_INBOX_ID')) {
    $current = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ([string]::IsNullOrWhiteSpace($current)) {
      $value = Read-Host -Prompt "Enter $name"
      if ($value -notmatch '^\d+$') { throw "$name must contain digits only." }
      [Environment]::SetEnvironmentVariable($name, $value, 'Process')
      $temporaryVariables += $name
      $value = $null
    }
  }

  & node (Join-Path $PSScriptRoot 'verify-auth-lifecycle.mjs') --url $PreviewUrl
  $exitCode = $LASTEXITCODE
} finally {
  foreach ($name in $temporaryVariables) {
    [Environment]::SetEnvironmentVariable($name, $null, 'Process')
  }
}

exit $exitCode
