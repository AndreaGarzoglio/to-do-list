# B.D.A. — Bureau of Deferred Affairs

A to-do list styled as a classified case-file archive. Projects are drawers in a filing cabinet, tasks are case files (dossiers) you can tag, photograph, and stamp closed. Built with vanilla JavaScript (ES6 classes), Webpack, and `localStorage`: no framework, no backend.

Live demo: https://andreagarzoglio.github.io/to-do-list/

## Theme

The UI is named after the bureaucracy of an intelligence agency: a **project** is a **drawer**, a **todo** is a **case file** in a **folder**, marking it done is **stamping it closed**, and the detail view is a **dossier** with a photo, a briefing, tags, and **objectives** (subtasks). All of this is CSS and copy in `app.css` and `app.js`; it never touches the data model.

## Data model

Three plain classes hold the state:

- **`Todo`**: title, description, due date, priority, completion, tags, subtasks, an optional photo, an optional custom color, and stamp data once closed.
- **`Project`**: a drawer. Holds an array of `Todo`s.
- **`TodoApp`**: all projects plus the active project id. Owns persistence.

`TodoApp` is wrapped in a `Proxy`. Setting any property on it (`app.projects = ...`) triggers the proxy's `set` trap, which applies the change and calls `save()`, writing the state to `localStorage` as JSON. There is no manual save step anywhere else in the code. `save()` catches storage errors (a full `localStorage`) and shows a toast instead of failing silently.

On first load ever (no `todoAppData` key in `localStorage`), the app seeds three demo drawers. If the key exists but is empty, it stays empty: seeding is keyed off whether the user has been here before, not off how many projects currently exist.

Rendering is one `render()` function that rebuilds the active view (list, search, or calendar) from scratch on every change. No diffing, no virtual DOM: simple and always in sync, at the cost of some redundant DOM work.

## How the folder stack works

The board shows one drawer at a time. Inside it, a fixed-size window with a **lip** at the bottom holds all of that drawer's case files stacked one behind another, like folders in a real filing drawer.

**Layout by depth.** `layoutDrawerStack()` positions every folder with `transform: translateY() scale()` based on depth. Depth `0` sits at the lip: fully visible and pulled up slightly so its tab and index strip can be read; that is the **focused** folder. Greater depth means further back: each step shrinks the folder, fades it out, and compresses more than the last (a perspective curve), until it disappears past `STACK_DEPTH` steps. A single number per drawer, `stackOffset[projectId]`, is the only state kept; everything else is derived from it on every layout pass.

**Browsing.** The mouse wheel does not scroll the page over a drawer: `wireWheelFocus()` accumulates wheel delta and, once it crosses a threshold, calls `stepDrawerStack()` to change `stackOffset` by one and re-run the layout. Scrolling up walks the pile forward, down sends it back. The lip's arrows and touch swipes page between whole drawers instead. Clicking a folder that is not yet at the lip calls `setDrawerStack()` with the exact offset needed to bring it to the front in one step.

**Opening.** Clicking the folder already at the lip triggers `pullFile()`: a lift-and-fade animation plays, and once it ends the code sets `openDossier` and renders the dossier overlay. Closing it just clears `openDossier` and re-renders; `stackOffset` was never touched, so the pile reappears exactly as it was left.

**Search and the calendar agenda** have no fixed window to simulate depth inside, so they use a plain focus model instead: `applyFocusState()` toggles a `.focused` class on one item at a time and scrolls it into view normally. The depth stack is scoped to board columns because the "receding pile" illusion only makes sense for one drawer at a time; flat lists pulled from many drawers reuse the simpler pattern.

## Features

- **Drawers (projects)**: group case files, switch between them from the sidebar or the drawer's own menu.
- **Case files (todos)**: title, notes, deadline, priority (colors the file's tab).
- **Tags**: free-form labels, auto-colored from a fixed palette.
- **Objectives (subtasks)**: a checklist with a progress bar.
- **Surveillance photo**: attached per task, resized client-side to keep `localStorage` in check.
- **Custom folder color**: per-task tab color, independent of priority.
- **Calendar view**: monthly deadlines, click a day for its agenda.
- **Search and filters**: across title, notes, and tags, filtered by priority or status.
- **Export / Import**: JSON backup of every drawer and case file.
- **Undo toasts**: deleting a drawer or case file offers an Undo instead of a confirm prompt.
- **Persistence**: everything auto-saves to `localStorage`; nothing leaves the browser.

## Getting started

```bash
npm install
npm start
```

Opens the dev server at `http://localhost:8080`.

## Project structure

```
src/
  index.html         page structure
  app.css             theme (kraft paper / dossier styling)
  app.js               Todo/Project/TodoApp models and all UI rendering
webpack.config.js   bundles src/ into docs/ for GitHub Pages
```

## Building and deploying

```bash
npm run build
git add docs src README.md
git commit -m "Update app"
git push
```

The build goes straight into `docs/`, which GitHub Pages serves from the `main` branch (Settings, Pages). A push to `main` with a fresh `docs/` build is all it takes.

## Tech stack

- Vanilla JavaScript (ES6 classes, Proxy, no framework)
- Webpack 5 (bundling and dev server)
- `localStorage` for persistence
