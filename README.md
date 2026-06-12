# Markdown Beauty

Plataforma nativa de Markdown para macOS con estética Notion, construida **solo con componentes de Hellomatik UI**. App Tauri 2 (~10 MB), registrada como visor por defecto de `.md`, con edición WYSIWYG, autoguardado y un **agente Claude Code real** embebido que solo conoce tus documentos abiertos.

## Qué hace

| Área | Detalle |
|---|---|
| **Visor** | Render editorial (Hedvig Letters Serif en títulos), GFM, callouts, tablas, KaTeX, Mermaid, Shiki, notas al pie, frontmatter como propiedades Notion. TOC lateral con scroll-spy. |
| **Pestañas** | Tipo navegador: sesión restaurable, dedupe, scroll por pestaña, Ctrl(+Shift)+Tab para ciclar. |
| **Abrir** | ⌘O acepta archivos **y carpetas** (estilo VS Code: todos los `.md` de la carpeta en pestañas). Arrastrar archivos o carpetas a la ventana. Asociación de Finder. |
| **Edición** | ⌘E o el lápiz: WYSIWYG sobre el render (BlockNote) con asideros por bloque y menú `/` en español. **Autoguardado** (1,2 s tras cada cambio, y al salir/cambiar pestaña/cerrar). El frontmatter se preserva intacto. |
| **Export** | PDF directo (sin diálogo de impresión) fiel al tema activo: en oscuro, la hoja entera va oscura (composición CoreGraphics, vectorial). ⌘P imprime limpio. |
| **Agente** | Panel derecho con **Claude Code interactivo de verdad** (ttyd + xterm.js): su TUI, su selector `/`, sus permisos. Sandboxeado: su único ámbito son los documentos abiertos (archivo o carpeta), siempre en su última versión autoguardada. |
| **Tema** | Claro (crema cálido) / oscuro / **sistema** (sigue macOS en vivo). El icono del Dock también cambia con la apariencia. |

## Desarrollo

```bash
npm install
npm run dev          # vite (preview en navegador, terminal en modo demo)
npm run tauri dev    # app nativa de desarrollo
```

## Release

```bash
npm run build:app    # == ./scripts/build-release.sh
```

El script produce un build **agnóstico** (cero rutas/usuario de la máquina en el binario, con verificación que falla si no) y sortea los problemas del macOS beta. Ingredientes — todos necesarios, ver comentarios del script:

1. cargo **directo** con `ld_classic` en env (tauri-cli pisa `RUSTFLAGS` y dyld rechaza los proc-macros: *mis-aligned LINKEDIT string pool*, que se manifiesta como `E0463 can't find crate`).
2. `--remap-path-prefix` de `~/.cargo` y `src` — **nunca** del proyecto entero (cubriría `target/` y rompe la resolución de proc-macros).
3. Symlink neutro `/tmp/mb-build` (el `CARGO_MANIFEST_DIR` que tauri incrusta vía `env!` es inmune al remap).
4. `--features tauri/custom-protocol` (sin ella el binario busca el dev server y la webview sale en blanco).
5. Empaquetado con `npx tauri bundle` (no recompila). Jamás parchear el binario a posteriori: rompe la app.

## Arquitectura

```
src/
  App.tsx                 # shell: pestañas, tema, atajos, autosave, paneles
  markdown/               # renderer (react-markdown + plugins), editor (BlockNote),
                          #   búsqueda ⌘F, frontmatter
  chat/chat-panel.tsx     # iframe a la terminal ttyd (Claude Code interactivo)
  components/, styles/    # gap-fillers de Hellomatik UI + theme/typography
src-tauri/
  src/lib.rs              # comandos: read/write_markdown (atómico), export_pdf
                          #   (NSPrintOperation + composición dark), expand/pick
                          #   (NSOpenPanel archivos+carpetas), ttyd sidecar,
                          #   chat_set_doc (ámbito del agente), set_dock_icon
  vendor/ttyd/            # ttyd + dylibs @loader_path (bundle.resources)
  icons/                  # icono claro/oscuro (transparencia real, grid Apple)
scripts/build-release.sh  # pipeline agnóstico de release
vendor/hellomatik-ui/     # kit vendoreado (@hm/icons como dep file:)
```

### El agente del documento

- `ttyd` (puerto dinámico 7693+, solo loopback, muere con la app) ejecuta por sesión un wrapper zsh → `claude --append-system-prompt-file <prompt>`.
- `chat_set_doc` regenera con cada autosave/pestaña: copia de **todos** los documentos abiertos al workspace (`~/Library/Application Support/com.hellomatik.markdown-beauty/chat/workspace`), el activo embebido completo en el prompt, el resto listados para su `Read`.
- Cada documento conserva su terminal viva entre cambios de pestaña (iframes persistentes); ↻ arranca sesión nueva con el ámbito al día.
- Requiere Claude Code instalado y con sesión iniciada (`claude` se resuelve vía login shell — la app de Finder no hereda el PATH).

## Troubleshooting (macOS beta / Tahoe)

- **Abro un .md y la app sale vacía**: TCC deniega Desktop/Documents en silencio tras cada reinstalación ad-hoc (cambia el CDHash). `tccutil reset SystemPolicy{Desktop,Documents,Downloads}Folder com.hellomatik.markdown-beauty` y acepta el aviso.
- **Asociación por defecto**: `duti` devuelve éxito falso; lo que funciona es `defaults write com.apple.LaunchServices/com.apple.launchservices.secure LSHandlers -array-add '{LSHandlerContentType = "net.daringfireball.markdown"; LSHandlerRoleAll = "com.hellomatik.markdown-beauty"; }'` + `killall lsd`.
- **Proc-macros que no compilan** tras tocar flags: borra el dylib envenenado en `target/release/deps` (o `cargo clean`) y usa `npm run build:app`.
- **Icono raro en el Dock**: caché — `killall Dock`, o desancla y vuelve a anclar.
- La primera vez, Claude pedirá **confiar en su carpeta de trabajo** (flujo normal de Claude Code; una sola vez).
