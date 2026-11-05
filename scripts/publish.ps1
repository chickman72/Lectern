$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

# Read the existing Git Credential Manager credential in memory only.
# Never print the credential or write it to a file or the repository.
$credentialLines = "protocol=https`nhost=github.com`n`n" | git credential fill
if ($LASTEXITCODE -ne 0) { throw 'Git Credential Manager could not authenticate to GitHub.' }
$credential = @{}
foreach ($line in $credentialLines) {
  if ($line -match '^([^=]+)=(.*)$') { $credential[$Matches[1]] = $Matches[2] }
}
if (-not $credential['password']) { throw 'No GitHub credential was available.' }
$headers = @{ Authorization = 'Bearer ' + $credential['password']; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }
$repoUrl = 'https://api.github.com/repos/chickman72/Lectern'
$repository = $null
try { $repository = Invoke-RestMethod -Uri $repoUrl -Headers $headers } catch {
  if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
}
if (-not $repository) {
  $body = @{ name = 'Lectern'; description = 'A Windows desktop teleprompter for recorded lectures, with webcam docking and GitHub updates.'; private = $false; auto_init = $false } | ConvertTo-Json
  $repository = Invoke-RestMethod -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers -ContentType 'application/json' -Body $body
}
if ($repository.owner.login -ne 'chickman72') { throw 'Unexpected repository owner.' }
if ($repository.private) { throw 'The updater requires publicly accessible releases. Existing private repository was not modified.' }
git remote get-url origin 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { git remote add origin $repository.clone_url }
if ($LASTEXITCODE -ne 0) { throw 'Could not set GitHub remote.' }
$remote = git remote get-url origin
if ($remote -ne $repository.clone_url) { throw 'Unexpected origin remote; refusing to publish.' }
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw 'Could not push the application.' }
$version = (Get-Content -Raw -LiteralPath 'package.json' | ConvertFrom-Json).version
git push origin "v$version"
if ($LASTEXITCODE -ne 0) { throw 'Could not push the release tag.' }
Write-Output $repository.html_url
$headers.Clear()
$credential.Clear()
