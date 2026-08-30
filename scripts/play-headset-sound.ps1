param(
  [ValidateSet('primary', 'reminder')]
  [string]$Type = 'primary'
)

$wav = if ($Type -eq 'reminder') {
  Join-Path $PSScriptRoot 'notify-reminder.wav'
} else {
  Join-Path $PSScriptRoot 'notify-primary.wav'
}

if (-not (Test-Path -LiteralPath $wav)) {
  [Console]::Beep(880, 700)
  [Console]::Beep(1175, 1300)
  Write-Output 'missing'
  exit 0
}

try {
  Add-Type -AssemblyName PresentationCore
  $player = New-Object System.Windows.Media.MediaPlayer
  $player.Volume = 1
  $player.Open([Uri]$wav)
  $player.Play()
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while (-not $player.NaturalDuration.HasTimeSpan -and $sw.ElapsedMilliseconds -lt 2500) {
    Start-Sleep -Milliseconds 50
  }
  if ($player.NaturalDuration.HasTimeSpan) {
    Start-Sleep -Milliseconds ([Math]::Max(2000, [int]$player.NaturalDuration.TimeSpan.TotalMilliseconds + 200))
  } else {
    Start-Sleep -Milliseconds 2200
  }
  $player.Stop()
  $player.Close()
  Write-Output 'played-media'
  exit 0
} catch {
  Write-Output ("media-failed:" + $_.Exception.Message)
}

try {
  $legacy = New-Object System.Media.SoundPlayer $wav
  $legacy.PlaySync()
  Write-Output 'played-legacy'
  exit 0
} catch {
  Write-Output ("legacy-failed:" + $_.Exception.Message)
}

Start-Process -FilePath $wav
Start-Sleep -Milliseconds 2200
Write-Output 'played-start'
