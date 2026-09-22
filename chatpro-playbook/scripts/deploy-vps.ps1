param(
  [Parameter(Mandatory = $true)]
  [string]$HostName,
  [string]$User = 'root',
  [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh\id_ed25519_vm')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$arm = Join-Path $root '.after-hours-live'
if (-not (Test-Path $arm)) {
  New-Item -ItemType File -Path $arm | Out-Null
}

$ssh = @('-i', $IdentityFile, '-o', 'StrictHostKeyChecking=accept-new')
$remote = "${User}@${HostName}"

Write-Host "[deploy] criando pasta no droplet"
ssh @ssh $remote 'mkdir -p ~/eva/src ~/eva/data ~/eva/vault'

$files = @(
  'Dockerfile',
  'docker-compose.vps.yml',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.env',
  '.after-hours-live'
)
foreach ($file in $files) {
  scp @ssh (Join-Path $root $file) "${remote}:~/eva/"
}

scp @ssh -r (Join-Path $root 'src') "${remote}:~/eva/"
scp @ssh -r (Join-Path $root 'data') "${remote}:~/eva/"
if (Test-Path (Join-Path $root 'vault')) {
  scp @ssh -r (Join-Path $root 'vault') "${remote}:~/eva/"
}

Write-Host "[deploy] instalando Docker se faltar e subindo a Eva"
$remoteScript = @'
set -e
if ! command -v docker >/dev/null; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 ufw
  ufw allow OpenSSH
  ufw --force enable
  systemctl enable --now docker
fi
cd ~/eva
docker compose -f docker-compose.vps.yml up -d --build
docker compose -f docker-compose.vps.yml ps
'@
ssh @ssh $remote $remoteScript
