/**
 * Logo Hellomatik — wordmark tipográfico (no es un SVG).
 *
 * Estructura tomada del logo real de Hellomatik:
 *  - "h" + "ello" en font-light
 *  - "mat" en peso normal
 *  - "i" con gradiente vertical: top 40% = brand color, bottom 60% = currentColor
 *  - "k" en peso normal
 *
 * Toma el color del padre via `currentColor` (puedes aplicar `text-primary`,
 * `text-brand-secondary`, `text-white`, etc. desde el contenedor).
 */
export const HellomatikLogo = ({ className = "text-2xl" }: { className?: string }) => (
    <span
        className={`inline-flex items-center whitespace-nowrap font-inter tracking-tight ${className}`}
        style={{ ["--logo-text-color" as string]: "currentColor" }}
        aria-label="Hellomatik"
        role="img"
    >
        <span className="inline-block font-light">h</span>
        <span className="inline-block">
            <span className="font-light">ello</span>mat
        </span>
        <span
            className="inline-block"
            style={{
                background:
                    "linear-gradient(to bottom, var(--color-fg-brand-primary) 40%, var(--logo-text-color) 40%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
            }}
        >
            i
        </span>
        <span className="inline-block">k</span>
    </span>
);
