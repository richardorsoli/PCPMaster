$token = Get-Clipboard$folderId = "10HfT-PttKIPYmxdu_m3gmyKy4vrowlNF"
$boundary = "----WebKitFormBoundary" + [System.Guid]::NewGuid().ToString("N")
$LF = "`r`n"

$metadata = "{`"name`": `"Teste_PowerShell.txt`", `"parents`": [`"$folderId`"]}"
$content = "Arquivo de teste enviado via PowerShell para validar a pasta e a Drive API."

$body = "--$boundary$LF" + "Content-Type: application/json; charset=UTF-8$LF$LF" + "$metadata$LF" + "--$boundary$LF" + "Content-Type: text/plain$LF$LF" + "$content$LF" + "--$boundary--"

try {
    $res = Invoke-RestMethod -Uri "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink" -Method Post -Headers @{ "Authorization" = "Bearer $token" } -ContentType "multipart/related; boundary=$boundary" -Body $body
    Write-Host "`n✅ SUCESSO! Arquivo criado no Drive:" -ForegroundColor Green
    Write-Host "ID do Arquivo: " $res.id
    Write-Host "Link no Drive: " $res.webViewLink
} catch {
    Write-Host "`n❌ ERRO AO CRIAR ARQUIVO:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}