/** @odoo-module **/

import { Message } from "@mail/core/common/message";
import { patch } from "@web/core/utils/patch";
import { toRaw } from "@odoo/owl";
import { markEventHandled } from "@web/core/utils/misc";

/**
 * Patch the Message component to:
 * 1. Open the resend dialog for failed notifications (v18 behavior)
 * 2. Open postal events popup when clicking on WhatsApp-style ticks
 */

/** @type {import("@mail/core/common/message").Message} */
const messagePatch = {
    /**
     * Override onClickNotification to handle different click scenarios:
     * - Failures: open resend dialog
     * - Postal tracking icons: open events popup
     * - Others: show regular popover
     */
    onClickNotification(ev) {
        const message = toRaw(this.message);
        
        // Check if clicked on postal status icon
        const postalIcon = ev.target.closest(".o_dr_postal_status");
        if (postalIcon) {
            this.onClickPostalStatus(ev, message);
            return;
        }
        
        // Handle failures - open resend dialog
        if (message.failureNotifications.length > 0) {
            this.onClickFailure(ev);
            return;
        }
        
        // Default: show the regular popover
        this.popover.open(ev.target, { message });
    },

    /**
     * Open the mail resend dialog for failed notifications.
     */
    onClickFailure(ev) {
        const message = toRaw(this.message);
        markEventHandled(ev, "Message.ClickFailure");
        this.env.services.action.doAction("dr_postal.mail_resend_message_action", {
            additionalContext: {
                mail_message_to_resend: message.id,
            },
        });
    },

    /**
     * Open postal events popup when clicking on WhatsApp-style status icons.
     */
    onClickPostalStatus(ev, message) {
        markEventHandled(ev, "Message.ClickPostalStatus");
        this.env.services.action.doAction({
            name: "Email Tracking",
            type: "ir.actions.act_window",
            res_model: "mail.postal.event",
            view_mode: "list",
            views: [[false, "list"]],
            domain: [["message_id", "=", message.id]],
            target: "new",
            context: { create: false, edit: false, delete: false },
        });
    },
};

patch(Message.prototype, messagePatch);
