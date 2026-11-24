$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Recall Radar - R2 Image Upload'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..')

function Read-R2Credential([string] $Prompt) {
    $value = Read-Host -Prompt $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim()
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

Write-Host 'Enter the Access Key ID and Secret Access Key shown on the Cloudflare R2 token page.'
Write-Host 'Values are hidden and used only by this upload process.'
try {
    $env:RECALL_RADAR_R2_ACCESS_KEY_ID = Read-R2Credential 'Access Key ID'
    $env:RECALL_RADAR_R2_SECRET_ACCESS_KEY = Read-R2Credential 'Secret Access Key'
    node --experimental-strip-types scripts/upload-recall-images-r2.ts
    if ($LASTEXITCODE -ne 0) { throw "R2 upload failed (exit $LASTEXITCODE)." }
    Write-Host 'Upload complete. Keep this window open until the result has been checked.'
} finally {
    Remove-Item Env:RECALL_RADAR_R2_ACCESS_KEY_ID, Env:RECALL_RADAR_R2_SECRET_ACCESS_KEY -ErrorAction SilentlyContinue
}
