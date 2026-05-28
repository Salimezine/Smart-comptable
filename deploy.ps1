$dist = Resolve-Path "dist"
$tmp = Join-Path $env:TEMP "gh-deploy-$([guid]::NewGuid().ToString().Substring(0,8))"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
Copy-Item "$dist\*" $tmp -Recurse -Force
Push-Location $tmp
git init
git checkout -b gh-pages
git add -A
git commit -m "Deploy $([datetime]::Now.ToString('yyyy-MM-dd HH:mm'))"
git push -f https://github.com/Salimezine/Smart-comptable.git gh-pages
Pop-Location
Remove-Item -Recurse -Force $tmp
