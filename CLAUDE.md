# CLAUDE.md - Mermaidman Project Guide

## Build Commands
- **Rust Engine**: `cd rust-engine && wasm-pack build --target web`
- **Frontend Build**: `cd frontend && npm run build`
- **Frontend Dev**: `cd frontend && npm run dev`

## Test Commands
- **Rust Tests**: `cd rust-engine && cargo test`
- **Frontend Types**: `cd frontend && npx tsc --noEmit`

## PowerShell Utility Helpers
Use these for efficient searching and system management on Windows:

### Search & Find
- **Search Content**: `Get-ChildItem -Recurse -Include *.ts,*.tsx,*.rs | Select-String -Pattern "YourPattern" -CaseSensitive:$false`
- **Find Files**: `Get-ChildItem -Recurse -Filter "*filename*"`
- **List Large Files**: `Get-ChildItem -Recurse | Where-Object { $_.Length -gt 1MB } | Sort-Object Length -Descending`

### Process & System
- **Kill Port 3000**: `Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- **Check Paths**: `$env:PATH -split ';'`

## Coding Standards
- **Rust**: Use `nom` for parsing, `regex` for surgical text manipulation.
- **WASM**: Use the "Asset Pattern" (copy `pkg/` to `public/wasm`).
- **Frontend**: Next.js 16 App Router, TypeScript, React Flow for diagrams.
- **Styles**: Neobrutalism (black borders, white backgrounds, high contrast).
