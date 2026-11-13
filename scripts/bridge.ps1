# Windows PowerShell 5.1. All user-controlled input is JSON on stdin.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding
try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    if ($request.action -notin @('list', 'open', 'native')) { throw 'Invalid action.' }
    $filePath = [string]$request.filePath
    if (-not [System.IO.File]::Exists($filePath)) { throw 'File does not exist or is not accessible.' }
    Add-Type -LiteralPath (Join-Path $PSScriptRoot 'Associations.cs')
    switch ($request.action) {
        'list' {
            $items = @([ExternalOpen.Associations]::List($filePath) | ForEach-Object {
                @{ id = $_.Id; name = $_.Name; recommended = $_.Recommended }
            })
            # -InputObject keeps empty and single-item arrays as JSON arrays.
            $json = ConvertTo-Json -InputObject $items -Compress -Depth 4
            [Console]::Out.Write($json)
        }
        'open' {
            [ExternalOpen.Associations]::Open($filePath, [string]$request.handlerId)
            [Console]::Out.Write('{}')
        }
        'native' {
            [ExternalOpen.Associations]::Native($filePath)
            [Console]::Out.Write('{}')
        }
    }
    exit 0
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
