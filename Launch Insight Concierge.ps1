# Launch Insight Concierge.ps1
# -----------------------------------------------------------------------------
# Zero-dependency portable launcher for the Insight Concierge demo app.
# Pure PowerShell + System.Net.HttpListener -- no Python, Node, or admin rights.
# Runs on Windows 7 SP1+ / PowerShell 5.1+ with default execution policy
# (the .cmd shim invokes with -ExecutionPolicy Bypass for that one invocation).
# -----------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

$root      = $PSScriptRoot
$indexFile = 'Insight Concierge.html'
$portStart = 8765
$portEnd   = 8775

if (-not (Test-Path -LiteralPath (Join-Path $root $indexFile) -PathType Leaf)) {
    Write-Host ""
    Write-Host "  ERROR: '$indexFile' not found in:" -ForegroundColor Red
    Write-Host "         $root" -ForegroundColor Red
    Write-Host "  The launcher must live in the same folder as the app." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# -----------------------------------------------------------------------------
# Find a free TCP port on the loopback interface in [portStart..portEnd].
# -----------------------------------------------------------------------------
function Find-FreePort {
    param([int]$Start, [int]$End)
    for ($p = $Start; $p -le $End; $p++) {
        $probe = $null
        try {
            $probe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
            $probe.Start()
            return $p
        } catch {
            continue
        } finally {
            if ($probe) { try { $probe.Stop() } catch {} }
        }
    }
    return -1
}

$port = Find-FreePort -Start $portStart -End $portEnd
if ($port -lt 0) {
    Write-Host ""
    Write-Host "  ERROR: All ports $portStart-$portEnd are in use." -ForegroundColor Red
    Write-Host "         Close other local servers and retry." -ForegroundColor Red
    Write-Host ""
    exit 1
}

# -----------------------------------------------------------------------------
# MIME map. Everything the app currently loads, plus a few generic image/font
# types in case assets are added later.
# -----------------------------------------------------------------------------
$mime = @{
    '.html'  = 'text/html; charset=utf-8'
    '.htm'   = 'text/html; charset=utf-8'
    '.jsx'   = 'text/babel; charset=utf-8'
    '.js'    = 'application/javascript; charset=utf-8'
    '.mjs'   = 'application/javascript; charset=utf-8'
    '.css'   = 'text/css; charset=utf-8'
    '.json'  = 'application/json; charset=utf-8'
    '.map'   = 'application/json; charset=utf-8'
    '.md'    = 'text/plain; charset=utf-8'
    '.txt'   = 'text/plain; charset=utf-8'
    '.csv'   = 'text/csv; charset=utf-8'
    '.docx'  = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    '.xlsx'  = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    '.png'   = 'image/png'
    '.jpg'   = 'image/jpeg'
    '.jpeg'  = 'image/jpeg'
    '.gif'   = 'image/gif'
    '.svg'   = 'image/svg+xml'
    '.ico'   = 'image/x-icon'
    '.webp'  = 'image/webp'
    '.woff'  = 'font/woff'
    '.woff2' = 'font/woff2'
    '.ttf'   = 'font/ttf'
    '.otf'   = 'font/otf'
}
function Get-Mime {
    param([string]$path)
    $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    if ($mime.ContainsKey($ext)) { return $mime[$ext] }
    return 'application/octet-stream'
}

# -----------------------------------------------------------------------------
# Start the HTTP listener.
# Loopback-only -- no Windows Firewall prompt, no LAN exposure.
# -----------------------------------------------------------------------------
$listener = New-Object System.Net.HttpListener
$prefix   = "http://localhost:$port/"
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    Write-Host ""
    Write-Host "  ERROR: Failed to bind $prefix" -ForegroundColor Red
    Write-Host "         $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}

$rootResolved = (Resolve-Path -LiteralPath $root).Path.TrimEnd('\','/')
$indexUrlPath = ($indexFile -replace ' ', '%20')
$url          = "http://localhost:$port/$indexUrlPath"

# -----------------------------------------------------------------------------
# Banner + open default browser.
# -----------------------------------------------------------------------------
Write-Host ""
Write-Host "  Insight Concierge" -ForegroundColor Cyan
Write-Host "  -----------------"
Write-Host "  Serving:  $rootResolved"
Write-Host "  URL:      " -NoNewline
Write-Host $url -ForegroundColor Green
Write-Host "  Press Ctrl+C in this window to stop the server."
Write-Host ""

try {
    Start-Process $url | Out-Null
} catch {
    Write-Host "  (Could not auto-open browser. Open the URL above manually.)" -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# Request loop. Synchronous -- a single user on localhost doesn't need async.
# Ctrl+C interrupts GetContext() with a PipelineStoppedException, which the
# outer finally catches to stop the listener cleanly.
# -----------------------------------------------------------------------------
try {
    while ($listener.IsListening) {
        $context = $null
        try {
            $context = $listener.GetContext()
        } catch {
            break
        }
        if (-not $context) { continue }

        $req = $context.Request
        $res = $context.Response
        try {
            $rawPath = $req.Url.AbsolutePath
            $decoded = [Uri]::UnescapeDataString($rawPath).TrimStart('/').TrimStart('\')
            if ([string]::IsNullOrEmpty($decoded) -or $decoded -eq '/') {
                $decoded = $indexFile
            }

            $candidate = Join-Path $root $decoded

            # Resolve canonical path and reject anything outside $root (traversal guard).
            $full = $null
            try { $full = (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path } catch {}

            if (-not $full -or -not $full.StartsWith($rootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
                $res.StatusCode = 404
                $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $decoded")
                $res.ContentType = 'text/plain; charset=utf-8'
                $res.ContentLength64 = $body.Length
                $res.OutputStream.Write($body, 0, $body.Length)
                Write-Host ("  404  {0}" -f $decoded) -ForegroundColor DarkYellow
            } elseif (Test-Path -LiteralPath $full -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($full)
                $res.StatusCode      = 200
                $res.ContentType     = Get-Mime $full
                $res.ContentLength64 = $bytes.Length
                # Disable client-side caching so JSX edits show up on plain reload.
                $res.Headers.Add('Cache-Control', 'no-store, must-revalidate')
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host ("  200  {0}" -f $decoded) -ForegroundColor DarkGray
            } else {
                $res.StatusCode = 404
                $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $decoded")
                $res.ContentType = 'text/plain; charset=utf-8'
                $res.ContentLength64 = $body.Length
                $res.OutputStream.Write($body, 0, $body.Length)
                Write-Host ("  404  {0}" -f $decoded) -ForegroundColor DarkYellow
            }
        } catch {
            try { $res.StatusCode = 500 } catch {}
            Write-Host ("  500  {0}" -f $_.Exception.Message) -ForegroundColor Red
        } finally {
            try { $res.OutputStream.Close() } catch {}
            try { $res.Close() } catch {}
        }
    }
} finally {
    try {
        if ($listener.IsListening) { $listener.Stop() }
        $listener.Close()
    } catch {}
    Write-Host ""
    Write-Host "  Server stopped." -ForegroundColor Cyan
    Write-Host ""
}
