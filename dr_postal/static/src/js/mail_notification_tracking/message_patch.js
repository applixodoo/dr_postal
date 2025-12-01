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

patch(Message.prototype, {
    /**
     * Override onClickNotification to handle different click scenarios:
     * - Postal tracking icons: open events popup
     * - Failures: open resend dialog  
     * - Others: show regular popover
     */
    onClickNotification(ev) {
        console.log("DR_POSTAL: onClickNotification called", ev.target);
        const message = toRaw(this.message);
        
        // Check if clicked on postal status icon (the <i> element or its container)
        const postalIcon = ev.target.closest(".o_dr_postal_status") || 
                          (ev.target.classList && ev.target.classList.contains("o_dr_postal_status"));
        
        console.log("DR_POSTAL: postalIcon found?", postalIcon, "target classes:", ev.target.className);
        
        if (postalIcon) {
            console.log("DR_POSTAL: Opening postal events for message", message.id);
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
            return;
        }
        
        // Handle failures - open resend dialog
        if (message.failureNotifications.length > 0) {
            console.log("DR_POSTAL: Opening failure dialog");
            markEventHandled(ev, "Message.ClickFailure");
            this.env.services.action.doAction("dr_postal.mail_resend_message_action", {
                additionalContext: {
                    mail_message_to_resend: message.id,
                },
            });
            return;
        }
        
        // Default: show the regular popover
        console.log("DR_POSTAL: Opening popover");
        this.popover.open(ev.target, { message });
    },
});

console.log("DR_POSTAL: Message patch loaded successfully");
