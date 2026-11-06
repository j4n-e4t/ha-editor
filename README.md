<img src="assets/icon.svg" width="64" height="64" alt="">

# HA Editor

A minimal Home Assistant add-on for editing your configuration: a file tree and the Monaco editor, with no accounts, extensions, Git integration, terminal, or debugger. It is a lightweight alternative to the Studio Code Server add-on.

## Installation

[![Open your Home Assistant instance and show the add add-on repository dialog with this repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fj4n-e4t%2Fha-editor)

Or add it manually:

1. In Home Assistant, go to **Settings → Add-ons → Add-on store**.
2. Open the **⋮** menu, select **Repositories**, and add `https://github.com/j4n-e4t/ha-editor`.
3. Find **HA Editor**, select **Install**, then **Start**. Turn on **Show in sidebar**.
4. Open **Editor** from the sidebar.

Requires Home Assistant OS or a Supervised installation on amd64 or aarch64 (for example a Raspberry Pi 4/5 or Home Assistant Green). The Supervisor builds the image on your device during installation, which takes a few minutes.

See [the add-on documentation](ha_editor/DOCS.md) for usage details.

## Development

The add-on lives in [`ha_editor/`](ha_editor). It requires [Bun](https://bun.sh) 1.3+. The UI is React + Tailwind CSS with shadcn/ui components and Lucide icons; the server is Express running on Bun.

```sh
cd ha_editor
bun install
bun run dev
```

Open the Vite URL printed in the terminal. Development edits the bundled `ha_editor/.example/` files, never your actual Home Assistant configuration. The API listens on localhost:8099.

```sh
bun test
bun run build
CONFIG_ROOT=/absolute/path/to/config HOST=127.0.0.1 bun start
```

The standalone server has no login. Keep it on localhost; the add-on uses Home Assistant authentication through ingress.

For a standalone container (local access only):

```sh
docker build -t ha-editor ha_editor
docker run --rm -p 127.0.0.1:8099:8099 -e INGRESS_ONLY=false -v /absolute/path/to/config:/config ha-editor
```

### Releasing

Bump `version` in `ha_editor/config.yaml` and add an entry to `ha_editor/CHANGELOG.md`. Home Assistant offers the update once the commit is pushed.

## Verification

`bun run build` checks TypeScript and bundles the editor and workers. `bun test` exercises the real HTTP API against temporary directories, including conflicts and access restrictions, plus the file-icon classification. The add-on image builds locally with Docker. The React UI and installation on Home Assistant OS still need manual testing on a running instance.
