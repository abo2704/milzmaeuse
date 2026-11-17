param([int]$Port = 5173, [string]$Root = "entwurf")
if ($env:PORT) { $Port = [int]$env:PORT }
$root = (Resolve-Path $Root).Path
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $root on http://localhost:$Port/"
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript"; ".css"="text/css"; ".svg"="image/svg+xml"; ".png"="image/png"; ".json"="application/json"; ".webmanifest"="application/manifest+json" }
while ($l.IsListening) {
  $c = $l.GetContext()
  $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath).TrimStart('/')
  if ($p -eq "") { $p = "index.html" }
  $f = Join-Path $root $p
  if ((Test-Path $f -PathType Leaf) -and ([IO.Path]::GetFullPath($f).StartsWith($root))) {
    $b = [IO.File]::ReadAllBytes($f)
    $ext = [IO.Path]::GetExtension($f)
    if ($types.ContainsKey($ext)) { $c.Response.ContentType = $types[$ext] }
    $c.Response.OutputStream.Write($b, 0, $b.Length)
  } else { $c.Response.StatusCode = 404 }
  $c.Response.Close()
}
