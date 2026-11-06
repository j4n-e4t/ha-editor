# HA Editor

A minimal editor for your Home Assistant configuration: a file tree and the Monaco editor (the editor component used by VS Code). Syntax highlighting, YAML syntax checks that understand Home Assistant tags such as `!include` and `!secret`, explicit saves, and workspace search. No accounts, extensions, Git integration, terminal, or debugger.

After starting the add-on, open **Editor** in the Home Assistant sidebar (enable **Show in sidebar** on the add-on page if it is missing). Only administrators can open it.

## Editing

The file tree marks Home Assistant files (`configuration.yaml`, `automations.yaml`, `secrets.yaml`, and YAML under `packages/` or `blueprints/`, for example) with the Home Assistant logo. The `esphome` folder and the YAML inside it get the ESPHome logo.


Select a file, edit, then click Save or press Ctrl/Cmd+S. Select the current file again to reload it; dirty buffers require confirmation before discarding. Refresh reloads the tree. Use the find and replace buttons beside Save, or press Ctrl/Cmd+F for find and Ctrl+H (Cmd+Option+F on macOS) for replace. These use Monaco's native controls, including match case, whole word, and regular expressions.

Open the Search sidebar tab or press Ctrl/Cmd+Shift+F to search across saved configuration files. Workspace search is literal, with an optional match-case toggle. Select a result to open the file at the matching location. Unsaved editor changes are searched by current-file find; save them before searching across files. Search excludes symlinks, binary/non-UTF-8 files, files over 2 MB, `.git`, `node_modules`, and `__pycache__`. Results are capped at 500 matches, with a scan budget of 2,000 files, 32 MB, or five seconds; a message indicates partial results.

The bottom bar shows the current line and column, selected character count, detected indentation width, UTF-8 encoding, LF/CRLF line endings, and language mode. These are file details, not a formatter or extension status.

YAML checks validate syntax, not Home Assistant integration schemas or entity IDs. There is no YAML language server or schema completion. Files must be UTF-8 text and at most 2 MB. Symlinks are excluded. Files can be edited, but creation, deletion, and renaming are outside this initial scope.

Saves preserve file permissions and use a temporary file in the same directory followed by rename. Content hashes detect external changes before saving; on conflict, copy your edits, reopen the file, and reconcile. An external writer can still race the final check and rename; avoid editing the same file in multiple tools. Atomic replacement creates a new inode and does not preserve ownership, extended attributes, or hard links.

This does not validate the full Home Assistant configuration or reload Home Assistant. Use Home Assistant's configuration check before applying changes.

## Security

The add-on mounts the Home Assistant configuration at `/config` with write access. It exposes no host port and accepts connections only from the Supervisor ingress proxy, so access always goes through Home Assistant authentication. No Supervisor API token or host privileges are requested.
