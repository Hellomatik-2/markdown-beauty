"use client";

import Image from "next/image";
import type { FC, ReactNode } from "react";
import { AlertCircle, CheckCircle, InfoCircle } from "@hm/icons";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { ProgressBar } from "@/components/base/progress-indicators/progress-indicators";
import { SpotlightIcon } from "@/components/foundations/spotlight-icon/spotlight-icon";
import { cx } from "@/utils/cx";

const iconMap = {
    default: InfoCircle,
    brand: InfoCircle,
    gray: InfoCircle,
    error: AlertCircle,
    warning: AlertCircle,
    success: CheckCircle,
};

interface IconNotificationProps {
    title: string;
    description?: string;
    confirmLabel?: string;
    dismissLabel?: string;
    hideDismissLabel?: boolean;
    closeLabel?: string;
    icon?: FC<{ className?: string }>;
    /** Optional node rendered in place of SpotlightIcon. Use for file-type icons
     *  (DocIcon, FileIcon) so they appear identical to the document list. */
    leadingNode?: ReactNode;
    /** Icon size — `sm` (32 px) para flashes simples sin descripción ni
     *  acciones; `md` (40 px) para notificaciones completas. */
    iconSize?: "sm" | "md";
    color?: "default" | "brand" | "gray" | "error" | "warning" | "success";
    progress?: number;
    /** Formato del label del progreso (default: `${value}% uploaded...`). */
    progressFormatter?: (value: number) => string;
    onClose?: () => void;
    onConfirm?: () => void;
}

export const IconNotification = ({
    title,
    description,
    confirmLabel,
    dismissLabel = "Dismiss",
    hideDismissLabel,
    closeLabel = "Close",
    icon,
    leadingNode,
    iconSize = "md",
    progress,
    progressFormatter,
    onClose,
    onConfirm,
    color = "default",
}: IconNotificationProps) => {
    const showProgress = typeof progress === "number";
    const hasDescription = !!description;
    const hasActions = (!hideDismissLabel || !!confirmLabel);

    return (
        <div className="relative z-[var(--z-index)] flex max-w-full flex-col gap-4 rounded-xl bg-primary_alt p-4 shadow-lg ring ring-secondary_alt xs:w-[var(--width)] xs:flex-row">
            {leadingNode ?? (
                <SpotlightIcon
                    icon={icon || iconMap[color]}
                    color={color === "default" ? "gray" : color}
                    theme={color === "default" ? "modern" : "outline"}
                    size={iconSize}
                />
            )}

            <div className={cx("flex flex-1 flex-col gap-3 md:pr-8", color !== "default" && "md:pt-0.5", showProgress && "gap-4")}>
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-primary">{title}</p>
                    {hasDescription && (
                        <p className="text-sm text-secondary">{description}</p>
                    )}
                </div>

                {showProgress && (
                    <ProgressBar
                        labelPosition="bottom"
                        value={progress}
                        valueFormatter={progressFormatter ?? ((value) => `${value}% uploaded...`)}
                    />
                )}

                {hasActions && (
                    <div className="flex gap-3">
                        {!hideDismissLabel && (
                            <Button onClick={onClose} size="sm" color="link-gray">
                                {dismissLabel}
                            </Button>
                        )}
                        {confirmLabel && (
                            <Button onClick={onConfirm} size="sm" color="link-color">
                                {confirmLabel}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <div className="absolute top-2 right-2 flex items-center justify-center">
                <CloseButton onClick={onClose} size="sm" label={closeLabel} />
            </div>
        </div>
    );
};

interface NotificationAvatarProps {
    name: string;
    content: string;
    avatar: string;
    date: string;
    confirmLabel: string;
    dismissLabel?: string;
    hideDismissLabel?: boolean;
    closeLabel?: string;
    icon?: FC<{ className?: string }>;
    color?: "default" | "brand" | "gray" | "error" | "warning" | "success";
    onClose?: () => void;
    onConfirm?: () => void;
}

export const NotificationAvatar = ({
    name,
    content,
    avatar,
    confirmLabel,
    dismissLabel = "Dismiss",
    hideDismissLabel,
    closeLabel = "Close",
    date,
    onClose,
    onConfirm,
}: NotificationAvatarProps) => {
    return (
        <div className="relative z-[var(--z-index)] flex max-w-full flex-col items-start gap-4 rounded-xl bg-primary_alt p-4 shadow-lg ring ring-secondary_alt xs:w-[var(--width)] xs:flex-row">
            <Avatar size="md" src={avatar} alt={name} status="online" />

            <div className="flex flex-col gap-3 pr-8">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-primary">{name}</p>
                        <span className="text-sm text-quaternary">{date}</span>
                    </div>
                    <p className="text-sm text-secondary">{content}</p>
                </div>

                <div className="flex gap-3">
                    {!hideDismissLabel && (
                        <Button onClick={onClose} size="sm" color="link-gray">
                            {dismissLabel}
                        </Button>
                    )}
                    {confirmLabel && (
                        <Button onClick={onConfirm} size="sm" color="link-color">
                            {confirmLabel}
                        </Button>
                    )}
                </div>
            </div>

            <div className="absolute top-2 right-2 flex items-center justify-center">
                <CloseButton onClick={onClose} size="sm" label={closeLabel} />
            </div>
        </div>
    );
};

interface ImageNotificationProps {
    title: string;
    description: string;
    confirmLabel: string;
    dismissLabel?: string;
    hideDismissLabel?: boolean;
    closeLabel?: string;
    imageMobile: string;
    imageDesktop: string;
    onClose?: () => void;
    onConfirm?: () => void;
}

export const ImageNotification = ({
    title,
    description,
    confirmLabel,
    dismissLabel = "Dismiss",
    hideDismissLabel,
    closeLabel = "Close",
    imageMobile,
    imageDesktop,
    onClose,
    onConfirm,
}: ImageNotificationProps) => {
    return (
        <div
            style={
                {
                    "--width": "496px",
                } as React.CSSProperties
            }
            className="relative z-[var(--z-index)] flex max-w-full flex-col gap-3 rounded-xl bg-primary_alt p-4 shadow-lg max-md:ring-1 max-md:ring-secondary_alt xs:w-[var(--width)] xs:flex-row xs:gap-0 md:p-0"
        >
            <div className="relative -my-px hidden w-40 shrink-0 overflow-hidden rounded-l-xl outline-1 -outline-offset-1 outline-black/10 md:block">
                <Image aria-hidden="true" src={imageMobile} alt="Image Mobile" fill sizes="160px" unoptimized className="object-cover" />
            </div>

            <div className="flex flex-col gap-4 rounded-r-xl bg-primary_alt md:gap-3 md:p-4 md:pl-5 md:ring-1 md:ring-secondary_alt">
                <div className="flex flex-col gap-1 pr-8">
                    <p className="text-sm font-semibold text-primary">{title}</p>
                    <p className="text-sm text-secondary">{description}</p>
                </div>

                <div className="relative h-40 w-full overflow-hidden rounded-md bg-secondary md:hidden">
                    <Image src={imageDesktop} alt="Image Desktop" fill sizes="(max-width: 768px) 100vw, 496px" unoptimized className="object-cover" />
                </div>

                <div className="flex gap-3">
                    {!hideDismissLabel && (
                        <Button onClick={onClose} size="sm" color="link-gray">
                            {dismissLabel}
                        </Button>
                    )}
                    {confirmLabel && (
                        <Button onClick={onConfirm} size="sm" color="link-color">
                            {confirmLabel}
                        </Button>
                    )}
                </div>
            </div>

            <div className="absolute top-2 right-2 flex items-center justify-center">
                <CloseButton onClick={onClose} size="sm" label={closeLabel} />
            </div>
        </div>
    );
};
