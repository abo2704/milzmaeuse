# Erzeugt die PNG-App-Icons (Android/iPhone brauchen PNG) – Motiv wie app/icons/icon.svg
# Aufruf: powershell -ExecutionPolicy Bypass -File tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\app\icons'

function C($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
function Draw([int]$size, [string]$file, [bool]$rounded) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $s = $size / 64.0
  $bg = New-Object System.Drawing.SolidBrush (C '#FFE58A')
  if ($rounded) {
    $r = 14 * $s; $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, 2*$r, 2*$r, 180, 90); $p.AddArc($size-2*$r, 0, 2*$r, 2*$r, 270, 90)
    $p.AddArc($size-2*$r, $size-2*$r, 2*$r, 2*$r, 0, 90); $p.AddArc(0, $size-2*$r, 2*$r, 2*$r, 90, 90)
    $p.CloseFigure(); $g.FillPath($bg, $p)
  } else { $g.FillRectangle($bg, 0, 0, $size, $size) }
  function Circ($cx, $cy, $rx, $ry, $hex) {
    $b = New-Object System.Drawing.SolidBrush (C $hex)
    $g.FillEllipse($b, [single](($cx-$rx)*$s), [single](($cy-$ry)*$s), [single](2*$rx*$s), [single](2*$ry*$s))
  }
  # Motiv leicht verkleinert, damit es auch als "maskable" Icon nicht abgeschnitten wird
  $g.TranslateTransform([single](6.4*$s), [single](6.4*$s)); $g.ScaleTransform(0.8, 0.8)
  Circ 18 21 10 10 '#B8B3C0'; Circ 18 21 6 6 '#F4A7B9'
  Circ 46 21 10 10 '#B8B3C0'; Circ 46 21 6 6 '#F4A7B9'
  Circ 32 38 17 15 '#C9C5D0'
  Circ 26 36 2.4 2.4 '#2B2730'; Circ 38 36 2.4 2.4 '#2B2730'
  Circ 32 43 3 2.2 '#E0718D'
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Draw 192 'icon-192.png' $false
Draw 512 'icon-512.png' $false
Draw 180 'apple-touch-icon.png' $false
Write-Host 'Icons erstellt.'
