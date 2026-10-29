param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Mumbai', 'Navi Mumbai')]
  [string]$Area,

  [string]$ApiBaseUrl = 'http://localhost:5000/api'
)

function Get-ImportResponseDetails {
  param(
    [Parameter(Mandatory = $true)]
    [System.Management.Automation.ErrorRecord]$ErrorRecord,
    [Parameter(Mandatory = $true)]
    [string]$Token
  )

  $response = $ErrorRecord.Exception.Response
  if (-not $response) {
    return $null
  }

  $statusCode = $null
  try {
    $statusCode = [int]$response.StatusCode
  } catch {
    return $null
  }

  $bodyText = ''
  $stream = $null
  $reader = $null
  try {
    if ($response.Content -and $response.Content.PSObject.Methods.Name -contains 'ReadAsStringAsync') {
      $bodyText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    } elseif ($response.PSObject.Methods.Name -contains 'GetResponseStream') {
      $stream = $response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $buffer = New-Object char[] 4096
        $read = $reader.Read($buffer, 0, $buffer.Length)
        if ($read -gt 0) {
          $bodyText = -join $buffer[0..($read - 1)]
        }
      }
    }
  } catch {
    $bodyText = ''
  } finally {
    if ($reader) { $reader.Dispose() }
    elseif ($stream) { $stream.Dispose() }
  }

  if ($Token) {
    $bodyText = $bodyText.Replace($Token, '[redacted]')
  }

  $safeDetails = 'Response body did not contain a recognized safe API error.'
  try {
    $parsedBody = $bodyText | ConvertFrom-Json -ErrorAction Stop
    $safeMessage = [string]$parsedBody.message
    if ($Token) { $safeMessage = $safeMessage.Replace($Token, '[redacted]') }
    if ($safeMessage.Length -gt 500) { $safeMessage = $safeMessage.Substring(0, 500) }
    $safeDetails = [pscustomobject]@{
      status = $parsedBody.status
      message = $safeMessage
    } | ConvertTo-Json -Compress
  } catch {
    $safeDetails = 'Response body omitted because it was not a recognized JSON API error.'
  }

  return [pscustomobject]@{
    StatusCode = $statusCode
    StatusDescription = [string]$response.StatusDescription
    ReasonPhrase = [string]$response.ReasonPhrase
    Details = $safeDetails
  }
}

function Get-ImportTransportFailure {
  param([Parameter(Mandatory = $true)][System.Exception]$Exception)

  $webException = $Exception
  while ($webException -and -not ($webException -is [System.Net.WebException])) {
    $webException = $webException.InnerException
  }

  if ($webException -and $webException.Status -eq [System.Net.WebExceptionStatus]::Timeout) {
    return 'Client timeout'
  }

  $socketException = $Exception
  while ($socketException -and -not ($socketException -is [System.Net.Sockets.SocketException])) {
    $socketException = $socketException.InnerException
  }
  if (
    ($webException -and $webException.Status -in @(
      [System.Net.WebExceptionStatus]::ConnectionClosed,
      [System.Net.WebExceptionStatus]::ReceiveFailure
    )) -or
    ($socketException -and $socketException.SocketErrorCode -in @(
      [System.Net.Sockets.SocketError]::ConnectionReset,
      [System.Net.Sockets.SocketError]::ConnectionAborted
    ))
  ) {
    return 'Connection reset/closed'
  }

  if ($Exception -is [System.TimeoutException] -or $Exception -is [System.Threading.Tasks.TaskCanceledException]) {
    return 'Client timeout'
  }
  return 'Connection/transport failure'
}

$secureToken = Read-Host -Prompt 'Hotel import token' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  $uri = "$($ApiBaseUrl.TrimEnd('/'))/admin/hotels/refresh"
  $body = @{ area = $Area } | ConvertTo-Json -Compress
  $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    $result = Invoke-RestMethod `
      -Uri $uri `
      -Method Post `
      -Headers @{ 'x-import-token' = $token } `
      -ContentType 'application/json' `
      -Body $body `
      -TimeoutSec 120

    $result | ConvertTo-Json -Depth 6
  } catch {
    $stopwatch.Stop()
    $responseDetails = Get-ImportResponseDetails -ErrorRecord $_ -Token $token
    if ($responseDetails) {
      $reasonPhrase = $responseDetails.StatusDescription
      if (-not $reasonPhrase) { $reasonPhrase = $responseDetails.ReasonPhrase }
      $message = "Hotel import received HTTP $($responseDetails.StatusCode) $reasonPhrase after $([math]::Round($stopwatch.Elapsed.TotalSeconds, 1)) seconds. $($responseDetails.Details)"
      if ($responseDetails.StatusCode -eq 401) {
        $message += ' Verify the backend import token configuration.'
      } elseif ($responseDetails.StatusCode -eq 429) {
        $message += ' Wait at least one minute before another import.'
      }
      Write-Error $message
    } else {
      $failureKind = Get-ImportTransportFailure -Exception $_.Exception
      $safeMessage = $_.Exception.Message
      if ($token) { $safeMessage = $safeMessage.Replace($token, '[redacted]') }
      if ($safeMessage.Length -gt 500) { $safeMessage = $safeMessage.Substring(0, 500) }
      Write-Error "$failureKind before an HTTP response was received after $([math]::Round($stopwatch.Elapsed.TotalSeconds, 1)) seconds. $safeMessage"
    }
    throw 'Hotel import failed; see the preceding status message.'
  }
} finally {
  if ($tokenPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  }
  $token = $null
  $secureToken.Dispose()
}
