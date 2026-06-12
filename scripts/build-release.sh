#!/bin/zsh
# Build de release AGNÓSTICO (sin rutas/usuario de la máquina) y a
# prueba del macOS beta. Tres ingredientes, los tres necesarios:
#  · cargo DIRECTO con ld_classic en env (tauri-cli pisa RUSTFLAGS y
#    dyld rechaza los proc-macros: "mis-aligned LINKEDIT string pool").
#  · remap-path-prefix de ~/.cargo y src (panic locations anónimos).
#    NUNCA remapear el proyecto entero: cubre target/ y rompe la
#    resolución de proc-macros (E0463).
#  · symlink neutro /tmp/mb-build: CARGO_MANIFEST_DIR (macro env! de
#    tauri, inmune al remap) nace sin el usuario en la ruta.
# `tauri bundle` empaqueta el binario ya construido, sin recompilar.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="$PWD"

npm run build

ln -sfn "$PROJECT" /tmp/mb-build
RUSTFLAGS="-C link-arg=-Wl,-ld_classic --remap-path-prefix=$HOME/.cargo=/cargo --remap-path-prefix=/tmp/mb-build/src-tauri/src=/src" \
    cargo build --release --features tauri/custom-protocol --manifest-path /tmp/mb-build/src-tauri/Cargo.toml

USER_NAME="$(id -un)"
N=$(strings "src-tauri/target/release/markdown-beauty" | grep -c "$USER_NAME" || true)
if [ "$N" != "0" ]; then
    echo "✗ el binario contiene $N strings personales:"
    strings "src-tauri/target/release/markdown-beauty" | grep "$USER_NAME" | sort -u | head -5
    exit 1
fi

npx tauri bundle

APP="src-tauri/target/release/bundle/macos/Markdown Beauty.app"
codesign --verify --deep --strict "$APP"
FINAL=$(strings "$APP/Contents/MacOS/markdown-beauty" | grep -c "$USER_NAME" || true)
if [ "$FINAL" != "0" ]; then echo "✗ bundle con $FINAL strings personales"; exit 1; fi
echo "✓ binario agnóstico (compilación limpia, sin parches), firmado y empaquetado"
