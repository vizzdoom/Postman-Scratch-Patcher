Set-Location -Path $PSScriptRoot
Write-Host $args.Count
if($args.Count -eq 0) {
    Write-Host "Postman Scratch Patcher" -ForegroundColor DarkYellow
	Write-Host "======================="
	Write-Host "No parameters provided"
    Write-Host "Do you want to continue with Postman patching? (y/n) default: n" -ForegroundColor Yellow
    $patch = read-Host
    if ($patch -ieq "y") {
        Write-Host "Running with parameters: patch"
        node postman-scratchpatcher.js patch
        Write-Host "[i] Finished. Press any key to exit..." -ForegroundColor Yellow
        Read-Host | Out-Null
        exit $LASTEXITCODE
    }
    Write-Host "Cancelled"
}
else {
    Write-Host "Postman Scratch Patcher" -ForegroundColor DarkYellow
	Write-Host "======================="
    Write-Host "Running with parameters: $args"
    node postman-scratchpatcher.js @args
}

Write-Host "[i] Finished. Press any key to exit..." -ForegroundColor Yellow
Read-Host | Out-Null
exit $LASTEXITCODE