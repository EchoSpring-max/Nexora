$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$staging = Join-Path $dist 'unix-installers'
Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $staging | Out-Null

$packages = @(
    @{ Name = 'Nexora-macOS.zip'; Source = 'installers/macos/NexoraInstaller.command'; Readme = "Extract this archive, then run: bash NexoraInstaller.command`n" },
    @{ Name = 'Nexora-Linux.zip'; Source = 'installers/linux/NexoraInstaller.sh'; Readme = "Extract this archive, then run: bash NexoraInstaller.sh`n" }
)

foreach ($package in $packages) {
    $folder = Join-Path $staging ([IO.Path]::GetFileNameWithoutExtension($package.Name))
    New-Item -ItemType Directory -Path $folder | Out-Null
    Copy-Item (Join-Path $root $package.Source) $folder
    Set-Content -LiteralPath (Join-Path $folder 'README.txt') -Value $package.Readme -NoNewline
    Compress-Archive -Path (Join-Path $folder '*') -DestinationPath (Join-Path $dist $package.Name) -Force
}

Remove-Item -LiteralPath $staging -Recurse -Force
