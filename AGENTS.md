# AGENTS.md — PaperWM

PaperWM is a scrollable tiling window manager implemented as a GNOME Shell extension
(GJS/JavaScript, Clutter, Mutter, GTK). It lives at:
`~/.local/share/gnome-shell/extensions/paperwm@paperwm.github.com`

## Essential Commands

```bash
make install      # Symlink extension into ~/.local/share/gnome-shell/extensions/
make uninstall    # Disable and remove the symlink
make release      # Create paperwm@paperwm.github.com.zip for EGO submission
make help         # List available targets

# Development / debugging
./shell.sh        # Launch a nested GNOME Shell session (X11 or Wayland)
./debug           # Tail and filter the GNOME Shell journal (requires zsh)
./gather-system-info.sh  # Collect system info for bug reports

# Lint (ESLint config at .eslintrc.yml; 4-space indentation, ES2021)
npx eslint .
```

There is no test suite — typical for GNOME Shell extensions. Testing is done manually in
a nested GNOME Shell session.

## Module Architecture & Initialization Order

The extension entry point is `extension.js`. It defines `class PaperWM extends Extension`
and orchestrates module enable/disable in a **strict order** — this order is critical:

| Order | Module | Role |
|-------|--------|------|
| 1 | `Utils` (`utils.js`) | Signals wrapper, `Easer` (animation), display config, touch tracking |
| 2 | `Settings` (`settings.js`) | GSettings wrapper, preference management. Must NOT import other PaperWM modules |
| 3 | `Patches` (`patches.js`) | Monkey-patches GNOME Shell internals (Shell.App, Gio.DesktopAppInfo, etc.) |
| 4 | `Gestures` (`gestures.js`) | Touchpad swipe gestures (Wayland only) |
| 5 | `Keybindings` (`keybindings.js`) | Keyboard shortcut registration via Mutter's keybinding API |
| 6 | `LiveAltTab` (`liveAltTab.js`) | Alt-Tab replacement with live window previews |
| 7 | `Navigator` (`navigator.js`) | Discrete navigation mode with `ActionDispatcher` (extends SwitcherPopup) |
| 8 | `Stackoverlay` (`stackoverlay.js`) | Clickable edge zones that activate partially-concealed stacked windows |
| 9 | `Scratch` (`scratch.js`) | Floating (non-tiled) scratch windows |
| 10 | `Workspace` (`workspace.js`) | Per-workspace GSettings (UUID-keyed at `/org/gnome/shell/extensions/paperwm/workspaces/...`) |
| 11 | **`Tiling`** (`tiling.js`) | **Core tiling engine** — the `Space` class, `Spaces` collection, layout, column management |
| 12 | `Topbar` (`topbar.js`) | Panel integration: workspace name, focus mode icon, open-position button |
| 13 | `App` (`app.js`) | New-window creation, custom per-app spawn handlers |
| 14 | `Grab` (`grab.js`) | Window drag/move operations with virtual pointer support |

`Settings` must be before `Patches` (reverse-order disable). Several modules import
`Settings`, so it must be early.

All modules are re-exported through `imports.js`, which acts as a single import barrel.

## Core Concepts

### Spaces & Tiling (`tiling.js`)

- A **Space** is a per-monitor scrollable workspace. Each Space holds a 2D array of
  MetaWindows (columns of windows): `[[MetaWindow]]`.
- The Space actor tree: **clip** (monitor bounds) → **actor** → **cloneContainer** →
  Clutter.Clones of each MetaWindow.
- Clones are necessary because Mutter restricts MetaWindowActors to
  `global.window_group` and prevents reliable out-of-monitor positioning. Clones live
  in a dedicated container; scrolling is achieved by moving the container.
- While animating the cloneContainer, real WindowActors are hidden. After animation,
  MetaWindows are moved to correct positions and WindowActors shown again.

### Coordinate System

- MetaWindows live in **stage (global)** coordinates (spans all monitors).
- Space coordinates are relative to the monitor: `(0,0)` is top-left of the monitor.
- Transform with: `space.actor.transform_stage_point(x, y)`.

### Key Constants

- `borderWidth = 8` — space border width
- `stack_margin = 75` — Mutter's maximum off-screen placement limit
- `sizeSlack = 30` — width/height tolerance for approximate equality checks

### Scratch Windows (`scratch.js`)

Floating windows managed outside the tiling. Uses expando `Symbol` properties on
MetaWindow objects: `metaWindow[float]` and `metaWindow[scratchFrame]`.

### Winprops (Window Properties)

Per-window configuration (scratch layer, focus mode, etc.) stored in GSettings.
The `defwinprop()` function in `tiling.js` registers window matching rules.
Example patterns in `examples/winprops.js`.

### Navigators & Preview Modes (`navigator.js`)

`PreviewMode` enum: `NONE`, `STACK`, `SEQUENTIAL`. The `ActionDispatcher` captures
key events during navigation and dispatches actions (like SwitcherPopup but without
visual handling).

### Focus Modes (`tiling.js`)

`FocusModes` enum: `DEFAULT` (original PaperWM behavior), `CENTER`, `EDGE`.

## Important Gotchas

### Module Dependencies
- `settings.js` **must not** import other PaperWM modules (it's used by both the
  extension runtime and the preferences UI).
- `lib.js` is a pure utility library — no PaperWM dependencies.

### `user.js` Is Broken (GNOME 45+)
The user config file at `~/.config/paperwm/user.js` no longer loads due to GNOME's
removal of legacy `Extension.imports.searchPath`. See `config/user.js` and issue #576.
The workaround is not yet implemented.

### Patching GNOME Shell
`patches.js` overrides `Shell.App.open_new_window`, `Shell.App.launch_action`,
`Gio.DesktopAppInfo.launch`, and many more. The `registerOverrideProp` function
saves/restores original properties. `overrideWithFallback` wraps functions so the
original can be called via `fallback()`.

### Mutter/GNOME Shell API Volatility
- `Meta.Cursor` enum values changed across GNOME versions (see `grab.js:setCursorGrabbing`)
- `grab_end_op` was removed in GNOME 44; the codebase uses virtual pointer devices as a
  workaround (`Grab.getVirtualPointer()`)
- `Background` class went private in GNOME 47; this codebase has its own copy in
  `background.js`
- `UnalignedLayoutStrategy` is not exported in GNOME 45; recreated in
  `overviewlayout.js`

### GSettings
- Main schema: `org.gnome.shell.extensions.paperwm`
- Keybindings schema: `org.gnome.shell.extensions.paperwm.keybindings`
- Workspace list schema: `org.gnome.shell.extensions.paperwm.workspacelist`
- Individual workspace schema: `org.gnome.shell.extensions.paperwm.workspace`
- Workspace settings use UUID-based paths: `/org/gnome/shell/extensions/paperwm/workspaces/{uuid}/`

### Keybinding Conflict Management
`Settings.overrideConflicts()` temporarily overrides conflicting GNOME keybindings.
They are restored on disable via `Settings.restoreConflicts()`.

### Preferences UI
`prefs.js` uses Gtk Builder with UI templates (`Settings.ui`, `KeybindingsPane.ui`,
`WinpropsPane.ui`, etc.). Custom widget classes in `prefsKeybinding.js` and
`winpropsPane.js` are registered as GObject classes with `GObject.registerClass`.

## Import Patterns

GI (GObject Introspection) imports use `gi://` URIs:
```js
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
```

GNOME Shell internals use `resource://` URIs:
```js
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
```

The old `imports` global is still used in ONE place (`const { signals: Signals } = imports`
in `tiling.js` and `navigator.js`) to access the `signals` legacy module.

## Nix Support

The project has Nix flake support (`flake.nix`, `shell.nix`, `default.nix`, `vm.nix`)
for developing in a reproducible environment, including a VM test setup.

## Branching & PR Workflow

- Primary branches: `develop` (PR target) and `release` (stable)
- PRs to `release` are automatically rebased onto `develop` via GitHub Actions
- See `CONTRIBUTING.md` for governance and maintainer information

## Code Style

- 4-space indentation, Unix line endings, no tabs
- Comma dangle: always-multiline for arrays/objects, never for functions
- Arrow parens: as-needed
- Unused vars: suffix `_` for vars, prefix `_` for args
- See `.eslintrc.yml` for the full ruleset
