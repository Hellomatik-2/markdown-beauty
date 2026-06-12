import { FC, SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
    size?: number;
    theme?: "light" | "dark";
}
declare const Jpeg: FC<Props>;

export { Jpeg };
