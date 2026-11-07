# HA Editor

A minimal editor for your Home Assistant configuration: a file tree and the Monaco editor (the editor component used by VS Code). Syntax highlighting, YAML syntax checks that understand Home Assistant tags such as `!include` and `!secret`, explicit saves, and workspace search. No accounts, extensions, Git integration, terminal, or debugger.

After starting the add-on, open **Editor** in the Home Assistant sidebar (enable **Show in sidebar** on the add-on page if it is missing). Only administrators can open it.

## Editing

The file tree marks Home Assistant configuration with the Home Assistant logo: YAML files in the configuration root and in folders such as `packages/`, `automations/` and `blueprints/`. Other YAML, such as themes or `custom_components`, shows a plain YAML icon. The `esphome` folder and the YAML inside it get the ESPHome logo. Well-known folders such as `blueprints`, `themes`, `www`, `zigbee2mqtt` and `homematicip_local` have their own icons, as do databases and logs, and dotfiles and dot folders (`.storage`, `.cache`, …) are dimmed, as are files that cannot be opened (binary, non-UTF-8 text, or larger than 2 MB).


Select a file, edit, then click Save or press Ctrl/Cmd+S. Select the current file again to reload it; dirty buffers require confirmation before discarding. Refresh reloads the tree. Use the find and replace buttons beside Save, or press Ctrl/Cmd+F for find and Ctrl+H (Cmd+Option+F on macOS) for replace. These use Monaco's native controls, including match case, whole word, and regular expressions.

Open the Search sidebar tab or press Ctrl/Cmd+Shift+F to search across saved configuration files. Workspace search is literal, with an optional match-case toggle. Select a result to open the file at the matching location. Unsaved editor changes are searched by current-file find; save them before searching across files. Search excludes symlinks, binary/non-UTF-8 files, files over 2 MB, `.git`, `node_modules`, and `__pycache__`. Results are capped at 500 matches, with a scan budget of 2,000 files, 32 MB, or five seconds; a message indicates partial results.

Images (PNG, JPEG, GIF, WebP, AVIF, BMP, ICO, SVG up to 25 MB) open in a preview instead of the editor. They fit the pane; click to toggle actual size. Audio (MP3, WAV, OGG, Opus, FLAC, M4A, AAC) and video (MP4, MOV, WebM, OGV, MKV) play in the browser's own player, with seeking; which formats play depends on your browser. The status bar shows dimensions, duration, file size and type. Media files are view-only, and SVGs are displayed with scripts disabled.

### Home Assistant autocomplete

In YAML files, the editor suggests values from your running Home Assistant as you type, including the friendly name of each entity:

- **Entity IDs** after `entity_id:`, `entity:` and `entities:` (also in lists), and inside templates such as `states('…')` or `is_state('…')`. Type part of an ID or of its friendly name.
- **Actions** after `action:` or `service:`, and their **fields** under the action's `data:` (required fields first).
- **Areas, floors and devices** after `area_id:`, `floor_id:` and `device_id:`.

Hover an entity ID to see its state and attributes, or an action to see its description and fields. Entity IDs that don't exist in Home Assistant get a warning underline; only literal IDs whose domain Home Assistant knows are checked, so templates and `!input` values are left alone. Press Ctrl+Space to show suggestions at any time.

The data comes from the Home Assistant page you have open (the editor runs inside it), so no extra permissions are needed and nothing is sent elsewhere. Outside Home Assistant there are no suggestions.

The bar above the editor shows where you are: the file's folders, the file, and the YAML key path at the cursor, for example `automation › Morning lights › triggers › time`. List items are named by their `alias`, `name` or `id` when they have one. Click a part of the path to jump to it, or the file name to go to the top. A dot after the file name marks unsaved changes.

The bottom bar shows the current line and column, selected character count, detected indentation width, UTF-8 encoding, LF/CRLF line endings, and language mode. These are file details, not a formatter or extension status.

YAML checks validate syntax, not Home Assistant integration schemas or entity IDs. There is no YAML language server or schema completion. Files must be UTF-8 text and at most 2 MB. Symlinks are excluded. Use the New file and New folder buttons above the tree to create inside the selected folder (or next to the selected file), or right-click a file or folder for New file, New folder, Rename, and Delete (F2 and Delete work in the tree too). New files open in the editor. Creating and renaming never overwrite an existing file, and deleting asks for confirmation first; deleted files are not recoverable.

Saves preserve file permissions and use a temporary file in the same directory followed by rename. Content hashes detect external changes before saving; on conflict, copy your edits, reopen the file, and reconcile. An external writer can still race the final check and rename; avoid editing the same file in multiple tools. Atomic replacement creates a new inode and does not preserve ownership, extended attributes, or hard links.

This does not validate the full Home Assistant configuration or reload Home Assistant. Use Home Assistant's configuration check before applying changes.

## Configuration

Set these on the add-on's **Configuration** tab, then restart the add-on.

- **Show config folder** (`show_config_folder`, default on): show the configuration folder as the top entry of the file tree. Turn it off to list its contents directly; right-click empty space in the tree to create files at the top level.
- **Hidden files and folders** (`hidden`): names to hide from the file tree and search, for example:

  ```yaml
  hidden:
    - .cache
    - .cloud
    - "*.db-wal"
    - esphome/.esphome
  ```

  A name matches files and folders with that name at any depth, `*` and `?` are wildcards, and an entry containing `/` matches that path from the configuration folder. Hiding a folder hides everything in it. Hidden files are only left out of the UI; they are not protected.
- **Vim mode** (`vim_mode`, default off): use Vim key bindings in the editor. The editor starts in normal mode: `h` `j` `k` `l` move, `i`/`a`/`o` enter insert mode, `Esc` returns to normal mode, `v`/`V` select, and operators, counts, registers, `/` search, `.` and `u` work as in Vim. `:w` saves, and `:s` and `:%s` replace. The status bar shows the current mode, pending keys and the `:` command line. Ctrl shortcuts that Vim uses follow Vim (for example Ctrl+F scrolls a page).

## Security

The add-on mounts the Home Assistant configuration at `/config` with write access. It exposes no host port and accepts connections only from the Supervisor ingress proxy, so access always goes through Home Assistant authentication. No Supervisor API token or host privileges are requested.
