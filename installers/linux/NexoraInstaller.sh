#!/usr/bin/env bash
# Nexora Linux installer. Run with: bash NexoraInstaller.sh
set -euo pipefail

readonly PRODUCT_NAME="Nexora"
readonly REPOSITORY="EchoSpring-max/Nexora"
readonly CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
readonly MOD_ASAR="$CONFIG_HOME/Nexora/desktop.asar"

say() { printf '%s\n' "$*"; }
fail() { say "\n$PRODUCT_NAME setup could not continue: $*" >&2; exit 1; }

if pgrep -fi '(^|/)discord($|[^a-z])' >/dev/null 2>&1; then
    fail "Fully quit Discord, then run this installer again."
fi

declare -a candidates=(
    "/usr/share/discord/resources"
    "/usr/share/discord-ptb/resources"
    "/usr/share/discord-canary/resources"
    "/opt/Discord/resources"
    "/opt/discord/resources"
)
declare -a resources_dirs=()
for resources in "${candidates[@]}"; do
    [[ -f "$resources/app.asar" || -f "$resources/_app.asar" ]] && resources_dirs+=("$resources")
done

[[ ${#resources_dirs[@]} -gt 0 ]] || fail "Discord was not found. Flatpak/Snap installations are not supported; install Discord from Discord's package or your distribution package manager."

resources="${resources_dirs[0]}"
if [[ ${#resources_dirs[@]} -gt 1 && -t 0 ]]; then
    say "Choose the Discord installation to patch:"
    select choice in "${resources_dirs[@]}"; do
        [[ -n "${choice:-}" ]] && { resources="$choice"; break; }
        say "Please enter one of the listed numbers."
    done
fi

app_asar="$resources/app.asar"
backup_asar="$resources/_app.asar"
stub_dir="$resources/app"
if [[ -e "$backup_asar" && ! -f "$stub_dir/index.js" ]]; then
    fail "This Discord installation is already patched by another client mod. Restore its original app before installing Nexora."
fi

say "Downloading the latest Nexora desktop package…"
mkdir -p "$(dirname "$MOD_ASAR")"
download_tmp="$(mktemp)"
trap 'rm -f "$download_tmp"' EXIT
download_url="https://github.com/$REPOSITORY/releases/latest/download/desktop.asar"
if command -v curl >/dev/null 2>&1; then
    curl --fail --location --silent --show-error "$download_url" --output "$download_tmp"
elif command -v wget >/dev/null 2>&1; then
    wget -qO "$download_tmp" "$download_url"
else
    fail "curl or wget is required to download Nexora."
fi
[[ -s "$download_tmp" ]] || fail "The Nexora download was empty."
mv -f "$download_tmp" "$MOD_ASAR"

run_privileged() {
    if [[ -w "$resources" ]]; then "$@"; else sudo "$@"; fi
}

if [[ ! -e "$backup_asar" ]]; then
    [[ -f "$app_asar" ]] || fail "Discord's original app.asar was not found. Reinstall Discord, then try again."
    say "Backing up Discord's original package…"
    run_privileged mv "$app_asar" "$backup_asar"
fi

stub_tmp="$(mktemp -d)"
trap 'rm -f "$download_tmp"; rm -rf "$stub_tmp"' EXIT
escaped_path="${MOD_ASAR//\\/\\\\}"
escaped_path="${escaped_path//\"/\\\"}"
printf '{"name":"nexora","main":"index.js"}\n' > "$stub_tmp/package.json"
printf 'require("%s");\n' "$escaped_path" > "$stub_tmp/index.js"
run_privileged rm -rf "$stub_dir"
run_privileged mkdir -p "$stub_dir"
run_privileged cp "$stub_tmp/package.json" "$stub_tmp/index.js" "$stub_dir/"

say "\nNexora is installed."
say "Your original Discord archive is saved as _app.asar. Start Discord normally to use Nexora."
