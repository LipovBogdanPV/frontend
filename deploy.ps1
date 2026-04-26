# --- deploy.ps1 : one-click Netlify deploy with explicit SITE_ID -----------
[CmdletBinding()]
param(
  [switch]$Preview,                        # якщо вказати, піде не у prod, а у draft URL
  [string]$Dir = ".",                      # що деплоїмо
  [string]$Functions = "netlify/functions",
  [string]$Message = "Manual deploy",
  [switch]$Both                            # (необов'язково) деплоїти одразу на обидва сайти
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# 0)  ВИБІР ЦІЛЬОВОГО САЙТУ (розкоментуй один рядок нижче)
# --------------------------------------------------------------------------
#---------------------------------------------------------------------------




  

 $SiteId = "716bacc3-81e7-458b-9680-cb4c74878d58"  # ← shifttime-crm-test.netlify.app


# --------------------------------------------------------------------------
#---------------------------------------------------------------------------


# 0b) ДРУГИЙ сайт для режиму -Both (розкоментуй і заповни, якщо треба)
$SiteId2 = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← другий сайт (наприклад, тестовий)

# 1) Перевірка Netlify CLI
if (-not (Get-Command netlify -ErrorAction SilentlyContinue)) {
  Write-Error "Netlify CLI not found. Install:  npm i -g netlify-cli"
  exit 1
}

function Deploy-Site($Id) {
  if (-not $Id) { throw "SITE_ID is empty" }

  Write-Host "Deploying to site: $Id"
  # просто інформаційно покажемо назву сайту
  try {
    $st = & netlify api getSite --data "{`"site_id`":`"$Id`"}" 2>$null
    if ($LASTEXITCODE -eq 0 -and $st) {
      $info = $st | ConvertFrom-Json
      Write-Host ("→ {0} ({1})" -f $info.name, $info.ssl_url)
    }
  } catch {}

  $args = @(
    "deploy",
    "--site", $Id,
    "--dir", $Dir,
    "--functions", $Functions,
    "--message", $Message,
    "--json"
  )
  if (-not $Preview) { $args += "--prod" }

  $raw = & netlify @args
  if ($LASTEXITCODE -ne 0) { throw "Deploy failed`n$raw" }

  $j = $raw | ConvertFrom-Json
  $finalUrl = if ($Preview) { $j.deploy_url } else { $j.url }
  Write-Host ("Done: {0}" -f $finalUrl)
}

# 2) Деплой
if ($Both) {
  Deploy-Site $SiteId
  Deploy-Site $SiteId2
} else {
  Deploy-Site $SiteId
}
