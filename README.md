# Nexora

Nexora is a community Discord client mod built on the [Equicord](https://github.com/Equicord/Equicord) plugin ecosystem and the upstream [Vencord](https://github.com/Vendicated/Vencord) project.

It includes the Equicord plugin collection, desktop userplugin installation, and BadgeBridge enabled by default for moderated community badges.

## Settings migration

On its first desktop launch, Nexora copies Equicord's settings, QuickCSS, and themes into its own data directory. Equicord is left unchanged, so you can return to it at any time.

## Development

[Git](https://git-scm.com/download) and [Node.js LTS](https://nodejs.org/) are required.

```shell
git clone https://github.com/EchoSpring-max/Nexora
cd Nexora
pnpm install --frozen-lockfile
pnpm build
pnpm inject
```

### Windows installer

To create a self-contained Windows patcher executable, run:

```shell
pnpm buildInstaller
```

The result is `dist/installer/NexoraInstaller.exe`. Close Discord, launch the executable, choose a Discord channel when asked, and it will retain Discord's original `app.asar` as `_app.asar` before installing Nexora. It will refuse to overwrite another client mod.

Pushes to `main` also build `NexoraInstaller.exe` as a GitHub Actions artifact. Download it from the latest successful **Build Nexora Windows Installer** workflow run.

To build the web extension instead:

```shell
pnpm buildWeb
```

## Credits and license

Nexora is GPL-3.0-or-later and preserves the original Vencord, Equicord, and Suncord copyright notices and licenses.

## Disclaimer

Nexora is not affiliated with Discord, Vencord, or Equicord. Client modifications violate Discord's Terms of Service. If losing access to an account would be disastrous, do not use a client modification.
