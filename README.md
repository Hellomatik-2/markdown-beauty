# Markdown Beauty

Visor de Markdown para macOS con estética Notion, construido **solo con componentes de Hellomatik UI** (prioridad `custom-components` → `components-base` → gap-fillers de `apps/web`). App nativa Tauri 2 (~10 MB, arranque instantáneo) registrada como visor por defecto de `.md`.

## Qué renderiza

| Elemento markdown | Componente |
|---|---|
| Tablas GFM | `Table` + `TableCard` (react-aria) |
| Bloques de código | `CodeSnippet` custom (shiki full bundle, copiar, line numbers, show more) |
| Callouts `> [!NOTE]`… | `Callout` sobre `Surface` custom |
| Checkboxes de tareas | `Checkbox` UU |
| Toolbar | `ButtonUtility` + `Button` UU |
| Vacío | `HellomatikIcon` custom |

Títulos en **Hedvig Letters Serif** (regla `hellomatik-mode` de theme.css; replicada para dark). Modo claro = lienzo crema cálido `hellomatik-mode`; modo oscuro = `dark-mode`. TOC lateral animado con scroll-spy, **pestañas tipo navegador** (sesión restaurable, dedupe, scroll por pestaña), navegación entre `.md` relativos, imágenes relativas vía protocolo `asset:`, recarga al recuperar foco, drag & drop, impresión limpia (`@media print`).

## Markdown al máximo

- **Exportar PDF directo** (botón Download): NSPrintOperation nativa sobre el WKWebView con `jobDisposition=save` — PDF vectorial paginado con los estilos print, sin diálogo de impresión. GOTCHA: esperar ~700 ms tras cerrar el save dialog (sheet) antes de lanzar la operación modal en la misma ventana; el print CSS DEBE deshacer la cadena `h-full`/`overflow:hidden` o solo sale 1 página.
- **Búsqueda Cmd+F**: `SearchInput` del kit + `<mark>` pintados sobre los text nodes (fuera de React), contador n/m, Enter/Shift+Enter, Esc.
- **Mermaid** (```mermaid → SVG, import lazy, tema claro/oscuro vía MutationObserver)
- **KaTeX** ($…$ y $$…$$), **frontmatter YAML** como propiedades estilo Notion (Badges para arrays), **emojis** `:rocket:`
- Empty state con el wordmark `HellomatikLogo` (Hedvig, el del login de la plataforma)

## Hooks de automatización

```bash
MB_OPEN=/ruta/doc.md MB_EXPORT_PDF=/ruta/salida.pdf "/Applications/Markdown Beauty.app/Contents/MacOS/markdown-beauty"
# abre el doc y exporta el PDF a los 6s — para tests/scripts
```

## ⚠ TCC tras cada reinstalación

Cada rebuild cambia la firma ad-hoc (CDHash) y **macOS puede denegar EN SILENCIO el acceso a Escritorio/Documentos** (la app abre vacía al hacer doble click en un .md de esas carpetas). Tras instalar una build nueva:

```bash
tccutil reset SystemPolicyDesktopFolder com.hellomatik.markdown-beauty
tccutil reset SystemPolicyDocumentsFolder com.hellomatik.markdown-beauty
tccutil reset SystemPolicyDownloadsFolder com.hellomatik.markdown-beauty
```

## Desarrollo

```bash
npm install
npm run dev          # navegador (modo preview, carga /sample.md)
npx tauri dev        # app nativa
```

## Build e instalación

```bash
RUSTFLAGS="-C link-arg=-Wl,-ld_classic" npx tauri build
rm -rf "/Applications/Markdown Beauty.app"
ditto "src-tauri/target/release/bundle/macos/Markdown Beauty.app" "/Applications/Markdown Beauty.app"
```

> ⚠ `ld_classic` es necesario en macOS beta (Darwin 27): el linker nuevo emite
> dylibs de proc-macros con "mis-aligned LINKEDIT string pool" que dyld rechaza.
> También está en `src-tauri/.cargo/config.toml` para builds directos de cargo.
> El crate `time` está pineado a 0.3.47 (0.3.48 rompe con E0119).

## Asociación .md por defecto

En esta beta de macOS `duti` y `LSSetDefaultRoleHandlerForContentType` devuelven éxito sin aplicar. Lo que funciona:

```bash
defaults write com.apple.LaunchServices/com.apple.launchservices.secure LSHandlers -array-add \
  '{LSHandlerContentType = "net.daringfireball.markdown"; LSHandlerRoleAll = "com.hellomatik.markdown-beauty"; LSHandlerPreferredVersions = { LSHandlerRoleAll = "-"; }; }'
killall lsd
```

## Arquitectura

- `vendor/hellomatik-ui/` — copia del kit (custom-components, components-base, `_lib/icons` como dep `@hm/icons`)
- `vite.config.ts` — resolver con cadena de prioridad para `@/components/*`: `src/` → `custom-components/` → `components-base/`; shims `next/image` y `shiki/bundle/web → shiki` (bundle completo)
- `src/components/` — gap-fillers que el kit referencia pero no incluye (checkbox, badges, button-utility, close-button, dot-icon, shim utility-button)
- `src/markdown/` — renderer (react-markdown + remark-gfm + rehype-raw) con mapeos a componentes del kit
- `src-tauri/` — comandos `read_markdown`/`get_opened_file`, `RunEvent::Opened` para la asociación de archivos
