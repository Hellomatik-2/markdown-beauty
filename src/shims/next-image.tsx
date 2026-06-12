import type { ImgHTMLAttributes } from "react";

/**
 * Shim de `next/image` para entorno Vite: los componentes del kit
 * (badges) lo importan, pero aquí basta un <img> nativo.
 */
interface NextImageProps extends ImgHTMLAttributes<HTMLImageElement> {
    fill?: boolean;
    priority?: boolean;
    quality?: number | string;
    unoptimized?: boolean;
}

const Image = ({ fill, priority, quality, unoptimized, style, ...props }: NextImageProps) => {
    return <img {...props} style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style } : style} />;
};

export default Image;
