import type { FC, RefAttributes, SVGProps } from "react";

export type Step = {
    title: string;
    description: string;
    connector?: boolean;
    status: "incomplete" | "current" | "complete";
};

export type ComponentType = "icon" | "number" | "spotlight-icon";

export type IconType = FC<SVGProps<SVGSVGElement> & RefAttributes<SVGSVGElement>> & {
    color?: string;
    size?: number;
};

export type ItemsType<T extends ComponentType> = T extends "spotlight-icon" ? Step & { icon: IconType } : Step & { icon?: IconType };

export type ProgressIconType = ItemsType<"icon">;
export type ProgressSpotlightIconType = ItemsType<"spotlight-icon">;

export interface SharedProps {
    items: ProgressIconType[];
    size?: "sm" | "md";
    orientation?: "vertical" | "horizontal";
    className?: string;
}

export type StepBaseProps<T extends ComponentType> = {
    size?: "sm" | "md";
    type?: T;
} & ItemsType<T>;

export interface ProgressIconsCenteredProps<T extends ComponentType> extends Omit<SharedProps, "items"> {
    type?: T;
    connector?: boolean;
    items: ItemsType<T>[];
}

export interface ProgressMinimalIconsProps extends SharedProps {
    text?: boolean;
}
