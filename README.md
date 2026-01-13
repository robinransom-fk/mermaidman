# Mermaidman

Mermaidman is a Next.js 16 + Rust/WASM visual editor for Mermaid-style flowcharts. It keeps Mermaid topology readable while storing layout and rich metadata in comment directives, enabling a fast canvas UX without constantly reparsing the text.

## Highlights
- Text + canvas stay in sync.
- Rust/WASM parser handles Mermaid topology plus Mermaidman directives.
- GraphStore keeps hot-path edits fast; text parsing is cold-path.
- Asset Pattern avoids Turbopack/Webpack wasm module issues.

## Repo Layout
- `frontend/` Next.js app (React Flow canvas + editor)
- `frontend/src/rust-engine/` Rust parser compiled to WASM
- `frontend/public/wasm/` WASM assets served by Next.js
- `frontend/src/store/graphStore.ts` UID-first runtime model

## Mermaidman Syntax (Backwards Compatible)
Mermaid stays clean; metadata is stored in comments:

```text
graph TD
A[Start] --> B[Processing]
B --> C[End]

%% @node: A {"uid":"n_1","x":62,"y":103,"kind":"card"}
%% @node: B {"uid":"n_2","x":354,"y":31,"kind":"code","code":{"language":"auto"}}
%% @edge: e1 {"eid":"e_1","source":"n_1","target":"n_2","label":"next"}
```

Mermaid ignores `%%` directives, so files stay compatible with standard Mermaid renderers.

## Development
From `frontend/`:

```powershell
npm run dev
```

## Rust/WASM Build (Asset Pattern)
The WASM output is copied into `frontend/public/wasm` and loaded dynamically:

```powershell
cd frontend/src/rust-engine
wasm-pack build --target web
Remove-Item -Recurse -Force ../../public/wasm
New-Item -ItemType Directory -Force ../../public/wasm
Copy-Item -Recurse -Force pkg/* ../../public/wasm/
```

## Runtime Model (GraphStore)
Hot-path edits update a UID-first graph store. Text parsing only runs on direct text edits or imports.

- UID-first nodes/edges: `n_...`, `e_...`
- Mermaid IDs are aliases and can be renamed safely
- Node positions and metadata live in `%% @node:` directives

## Notes
- Next.js 16 App Router
- React Flow for rendering
- Rust parser uses `nom` + `regex`

## Contribution Guide
### Setup
1. Install Node.js 18+ and Rust.
2. `cd frontend && npm install`
3. Start dev server: `npm run dev`

### Build the WASM engine
```powershell
cd frontend/src/rust-engine
wasm-pack build --target web
Remove-Item -Recurse -Force ../../public/wasm
New-Item -ItemType Directory -Force ../../public/wasm
Copy-Item -Recurse -Force pkg/* ../../public/wasm/
```

### Local checks
- Rust tests: `cd frontend/src/rust-engine && cargo test`
- Types: `cd frontend && npx tsc --noEmit`

### Working conventions
- Keep Mermaid topology pristine; store metadata in `%%` directives.
- Hot-path edits should not reparse the full Mermaid text.
- Prefer small, deterministic diffs in directive JSON.

## Architecture Deep Dive
### Data flow
1. **Text edit (cold-path)** → WASM parser → GraphStore → React Flow nodes/edges.
2. **Canvas edit (hot-path)** → GraphStore update → UI render → Mermaid directives updated.

### Runtime model
- UID-first entities with alias mapping to Mermaid IDs.
- Nodes store layout + metadata; edges store connectivity + labels.
- Text parsing only happens on direct text edits/imports/validation.

### Mermaidman serialization
- Mermaid topology lines remain valid Mermaid.
- `%% @node:` and `%% @edge:` directives store layout, uids, and metadata.
- JSON directives are stable-ordered for diff friendliness.

## API / AI Roadmap
### Phase 1 (local-only)
- Node tool palette (card, note, code, media).
- Inline metadata editing.
- Edge label editing + delete with text sync.

### Phase 2 (AI-assisted)
- Gemini SDK: language detection + formatting for code nodes.
- AI node actions: summarize, expand, diagram-from-text.
- AI provenance stored in `%% @ai:` directives.

### Phase 3 (collab-ready)
- Event log for undo/redo and merge-friendly diffs.
- CRDT-ready op model (UID-first, commutative events).

## UI Nodes: Multimodal + Nested Diagrams
### Multimodal nodes
- **Image node**: upload or URL, caption, alt text, fit mode.
- **Video node**: poster + playback controls.
- **Audio node**: waveform + duration metadata.
- **oEmbed node**: YouTube/Vimeo/Figma/etc. via URL with cached metadata and sandboxed rendering.
- **Code node**: language auto-detect (Gemini), highlighted rendering.

### Nested Mermaidman diagrams
Allow nodes to contain diagrams by storing an embedded Mermaidman payload:

```text
graph TD
A[Subflow]

%% @node: A {
%%   "uid":"n_1",
%%   "x":120,
%%   "y":80,
%%   "kind":"diagram",
%%   "diagram":{
%%     "title":"Subflow",
%%     "mermaidman":"graph TD\nX-->Y\n%% @node: X {\"x\":50,\"y\":40}\n"
%%   }
%% }
```

UI behavior:
- Double-click node to open embedded diagram.
- Breadcrumbs for navigation.
- Inline preview thumbnail on the parent node.
