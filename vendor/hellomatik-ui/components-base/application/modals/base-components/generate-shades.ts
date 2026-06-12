/**
 * Genera la escala completa de matices (25 → 950) a partir de un color HEX
 * de entrada que se interpreta como el matiz 500.
 *
 * Devuelve un mapa `{ "25": {r,g,b}, "50": {r,g,b}, ... "950": {r,g,b} }`
 * listo para pintar como CSS variables `--color-brand-{shade}`.
 *
 * Algoritmo:
 *   1. HEX → HSL.
 *   2. Para cada shade objetivo, fijamos la luminosidad (L) deseada y
 *      ajustamos ligeramente la saturación en los extremos (los matices
 *      muy claros/oscuros se desaturan un poco — replica la curva de
 *      Tailwind / Design System sin caer en el "wash-out").
 *   3. HSL → RGB.
 */

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

// Luminosidad objetivo por shade (% sobre 100). Curva calibrada contra el
// neutral gris de Tailwind v4 para que cualquier color de marca genere una
// escala con contraste perceptual consistente.
const SHADE_TARGETS: Record<string, number> = {
    "25":  98,
    "50":  96,
    "100": 92,
    "200": 84,
    "300": 73,
    "400": 60,
    "500": 50,
    "600": 42,
    "700": 33,
    "800": 25,
    "900": 18,
    "950": 11,
};

// ─────────────────────────────────────────────────────────────────────────────
// HEX ↔ RGB
// ─────────────────────────────────────────────────────────────────────────────

const parseHex = (hex: string): Rgb | null => {
    const m = hex.trim().replace(/^#/, "");
    if( !/^[0-9a-fA-F]{6}$/.test(m) ) return null;
    return {
        r: parseInt(m.slice(0, 2), 16),
        g: parseInt(m.slice(2, 4), 16),
        b: parseInt(m.slice(4, 6), 16),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// RGB ↔ HSL
// ─────────────────────────────────────────────────────────────────────────────

const rgbToHsl = ({ r, g, b }: Rgb): Hsl => {
    const R = r / 255, G = g / 255, B = b / 255;
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const l = (max + min) / 2;
    if( max === min ) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    switch( max ) {
        case R: h = ((G - B) / d + (G < B ? 6 : 0)); break;
        case G: h = ((B - R) / d + 2);               break;
        case B: h = ((R - G) / d + 4);               break;
    }
    return { h: h * 60, s: s * 100, l: l * 100 };
};

const hueToRgb = (p: number, q: number, t: number) => {
    if( t < 0 ) t += 1;
    if( t > 1 ) t -= 1;
    if( t < 1 / 6 ) return p + (q - p) * 6 * t;
    if( t < 1 / 2 ) return q;
    if( t < 2 / 3 ) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
};

const hslToRgb = ({ h, s, l }: Hsl): Rgb => {
    const H = h / 360, S = s / 100, L = l / 100;
    if( S === 0 ) {
        const v = Math.round(L * 255);
        return { r: v, g: v, b: v };
    }
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
    const p = 2 * L - q;
    return {
        r: Math.round(hueToRgb(p, q, H + 1 / 3) * 255),
        g: Math.round(hueToRgb(p, q, H)         * 255),
        b: Math.round(hueToRgb(p, q, H - 1 / 3) * 255),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/** Devuelve la escala completa de matices a partir de un HEX (interpretado
 *  como el shade 500). `null` si el HEX no es válido. */
export const generateRgbShades = (hex: string): Record<string, Rgb> | null => {
    const rgb = parseHex(hex);
    if( !rgb ) return null;
    const hsl = rgbToHsl(rgb);

    const out: Record<string, Rgb> = {};
    for( const [shade, targetL] of Object.entries(SHADE_TARGETS) ) {
        // Desatura ligeramente los extremos para evitar colores "neón".
        const distance = Math.abs(targetL - 50) / 50; // 0 en 500, 1 en 950/25
        const s = Math.max(0, hsl.s * (1 - distance * 0.35));
        out[shade] = hslToRgb({ h: hsl.h, s, l: targetL });
    }
    return out;
};
