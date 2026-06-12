"use client";

/**
 * NotificationsButton — topbar bell. Opens NotificationsPanel as an
 * anchored popover (Slack / Linear pattern, not a modal). The unread
 * count drives the dot indicator and aria-label.
 */

import { useId } from "react";
import {
    DialogTrigger as AriaDialogTrigger,
    Dialog as AriaDialog,
    Popover as AriaPopover,
} from "react-aria-components";
import { Bell01 } from "@hm/icons";
import { useTranslations } from "next-intl";
import { UtilityButton } from "@/components/base/buttons/utility-button";
import { NotificationsPanel } from "@/views/notifications/notifications-panel";
import { useNotifications } from "@/hooks/use-notifications";
import { useUndoableDelete } from "@/views/_shared/use-undoable-delete";
import { cx } from "@/utils/cx";

export function NotificationsButton() {
    const t = useTranslations( "notifications" );
    const { items, unreadCount, markAllRead, markRead } = useNotifications();
    const undoableMarkAll = useUndoableDelete();
    const srId = useId();

    // Wrapper sobre markAllRead: snapshot + flash con "Deshacer" (5 s).
    // Apple HIG R2 (forgiveness): marcar todas como leídas es operativamente
    // irreversible (el usuario no sabe cuáles eran nuevas) — la ventana de
    // undo restaura el set previo si se pulsa antes de que expire.
    const handleMarkAll = () => {
        if ( unreadCount === 0 ) return;
        const undo = markAllRead();
        undoableMarkAll( {
            title: t( "markAllReadFlash", { unread: unreadCount } ),
            tone: "neutral",
            windowMs: 5000,
            onUndo: undo,
        } );
    };

    const tooltip =
        unreadCount > 0
            ? t( "tooltipUnread", { unread: unreadCount } )
            : t( "tooltipZero" );

    return (
        <AriaDialogTrigger>
            <div className="relative inline-flex">
                <UtilityButton
                    size="sm"
                    color="tertiary"
                    icon={Bell01}
                    tooltip={tooltip}
                    aria-label={t( "triggerAriaLabel" )}
                    aria-describedby={unreadCount > 0 ? srId : undefined}
                />
                {unreadCount > 0 && (
                    <>
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute right-1 top-1 inline-flex size-1.5 rounded-full bg-error-solid ring-2 ring-primary"
                        />
                        <span id={srId} className="sr-only">
                            {t( "triggerUnreadSr", { unread: unreadCount } )}
                        </span>
                    </>
                )}
            </div>

            <AriaPopover
                placement="bottom end"
                offset={6}
                className={( { isEntering, isExiting } ) =>
                    cx(
                        "z-50 outline-hidden",
                        isEntering && "animate-in fade-in zoom-in-95 duration-150",
                        isExiting && "animate-out fade-out zoom-out-95 duration-100",
                    )
                }
            >
                <AriaDialog
                    aria-label={t( "panelAriaLabel" )}
                    className="outline-hidden"
                >
                    <NotificationsPanel
                        items={items}
                        unreadCount={unreadCount}
                        onMarkAll={handleMarkAll}
                        onItemOpen={( n ) => markRead( n.id )}
                    />
                </AriaDialog>
            </AriaPopover>
        </AriaDialogTrigger>
    );
}
