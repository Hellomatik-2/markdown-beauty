import { FC, SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
    size?: number;
    theme?: "light" | "dark";
}
declare const Indd: FC<Props>;

export { Indd };
