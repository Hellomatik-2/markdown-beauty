import { existsSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;
const KIT = resolve(root, "vendor/hellomatik-ui");

/**
 * Resolves `@/...` imports with Hellomatik UI layering:
 *   1. src/                                  (overrides y gap-fillers locales)
 *   2. vendor/hellomatik-ui/custom-components (PRIORIDAD del kit)
 *   3. vendor/hellomatik-ui/components-base   (base del kit)
 */
function hellomatikUiResolver(): Plugin {
    const tryFile = (base: string): string | null => {
        for (const suffix of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
            const candidate = base + suffix;
            if (existsSync(candidate) && !candidate.endsWith("/")) {
                try {
                    if (suffix !== "" || /\.\w+$/.test(candidate)) return candidate;
                } catch {
                    /* ignore */
                }
            }
        }
        return null;
    };

    const CUSTOM = resolve(KIT, "custom-components");
    const BASE = resolve(KIT, "components-base");

    return {
        name: "hellomatik-ui-resolver",
        enforce: "pre",
        resolveId(source, importer) {
            // Imports relativos DENTRO de custom-components que no existen ahí
            // (huecos del kit, p.ej. search-input → ./input) caen al espejo
            // en components-base.
            if ((source.startsWith("./") || source.startsWith("../")) && importer?.startsWith(CUSTOM)) {
                const importerDir = importer.slice(0, importer.lastIndexOf("/"));
                const target = resolve(importerDir, source);
                if (!tryFile(target)) {
                    const mirrored = tryFile(resolve(BASE, target.slice(CUSTOM.length + 1)));
                    if (mirrored) return mirrored;
                }
                return null;
            }

            if (!source.startsWith("@/")) return null;
            const rest = source.slice(2);

            const candidates = [resolve(root, "src", rest)];
            if (rest.startsWith("components/")) {
                const sub = rest.slice("components/".length);
                candidates.push(resolve(CUSTOM, sub));
                candidates.push(resolve(BASE, sub));
            }

            for (const base of candidates) {
                const hit = tryFile(base);
                if (hit) return hit;
            }
            return null;
        },
    };
}

export default defineConfig({
    plugins: [hellomatikUiResolver(), react(), tailwindcss()],
    resolve: {
        alias: [
            { find: "next/image", replacement: resolve(root, "src/shims/next-image.tsx") },
            // El kit usa el bundle web de shiki (solo lenguajes web); en un
            // visor universal queremos python/rust/sql/etc → bundle completo.
            { find: /^shiki\/bundle\/web$/, replacement: "shiki" },
        ],
    },
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        fs: { allow: [root] },
    },
    build: {
        target: "safari16",
        chunkSizeWarningLimit: 2500,
    },
});
