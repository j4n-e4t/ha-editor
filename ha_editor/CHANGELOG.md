# Changelog

## 0.1.6

- New options: **Show config folder** turns the top-level configuration folder row on or off, and **Hidden files and folders** hides names such as `.cache` or `.cloud` (wildcards and paths supported) from the tree and search.
- The tree's New file, New folder and Refresh buttons sit in a pinned row instead of overlapping the files.

## 0.1.5

- Play audio (MP3, WAV, OGG, Opus, FLAC, M4A, AAC) and video (MP4, MOV, WebM, OGV, MKV) files with the browser's own players, with seeking. The status bar shows duration, size and type, plus dimensions for video. Useful for `tts/` and `media/`.
- Theme, dashboard and `custom_components` YAML files show a plain YAML icon; the Home Assistant icon is for configuration files.
- Files that cannot be opened (binary, non-UTF-8 or larger than 2 MB, such as databases) are dimmed in the tree like dotfiles. Images, audio and video are not, since they open in the preview.
- Brand colors for the Zigbee2MQTT (yellow), ESPHome (blue) and Homematic IP (blue) icons.

## 0.1.4

- Native Home Assistant look: a 56px panel toolbar titled “Editor”, matching Home Assistant's own, with a pill Save button.
- Breadcrumbs above the editor show the file's folders and the YAML (or JSON) key path at the cursor, such as `automation › Morning lights › triggers › time`. List items are named by their `alias`, `name` or `id`. Click a crumb to jump to it.
- Follow the active Home Assistant theme, including custom themes and the dark mode setting, for the whole UI and the Monaco editor.
- On phones, Home Assistant's header stays on top and the file tree opens as a drawer.
- The `!input` blueprint tag is recognized.
- The status bar shows the Home Assistant version (from `.HA_VERSION`).
- File icons: every YAML file in the configuration root (and in folders such as `packages/` and `blueprints/`) gets the Home Assistant icon; only the `esphome` folder and the YAML inside it get the ESPHome icon; databases (`.db`, `-shm`, `-wal`) and logs have their own icons; dotfiles and dot folders are dimmed.
- Create, rename and delete files and folders: New file and New folder buttons above the tree, and a right-click menu (F2 and Delete work too). New files open in the editor; the open file follows a rename and closes when deleted.
- Image preview: PNG, JPEG, GIF, WebP, AVIF, BMP, ICO and SVG files open in a viewer (fit to the pane, click for actual size) with dimensions, size and type in the status bar. SVGs are shown with scripts disabled.
- The file tree slides in and out like Home Assistant's sidebar, as an overlay drawer on phones.
- Folder icons for `blueprints`, `image`, `media`, `themes`, `tts`, `www`, `zigbee2mqtt` and `homematicip_local`.

## 0.1.3

- Run on Node.js 24 instead of Bun, which crashed on x86 CPUs without AVX.

## 0.1.2

- Install prebuilt images from GitHub Container Registry instead of building on the device. Installing or updating is now a single image download.

## 0.1.1

- Fix installation on x86 CPUs without AVX (for example Celeron and Atom mini PCs): the image build no longer runs the TypeScript type check, which crashed Bun and needed several GB of memory.
- Pin the Bun base image to 1.3.14.

## 0.1.0

- Initial release: file tree, Monaco editor, YAML checks, workspace search, Home Assistant and ESPHome file icons.
