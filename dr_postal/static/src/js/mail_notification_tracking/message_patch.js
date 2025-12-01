/** @odoo-module **/

import { Message } from "@mail/core/common/message";
import { patch } from "@web/core/utils/patch";
import { toRaw } from "@odoo/owl";
import { markEventHandled } from "@web/core/utils/misc";
import { postalPopoverState } from "./message_notification_popover_patch";

/**
 * Patch the Message component to:
 * 1. Store message ID when opening notification popover (for postal click handler)
 * 2. Open resend dialog for failed notifications
 */

patch(Message.prototype, {
    /**
     * Override onClickNotification to:
     * - Store message ID for postal tracking popup
     * - Open resend dialog for failures
     * - Show regular popover otherwise
     */
    onClickNotification(ev) {
        const message = toRaw(this.message);
        
        // Store message ID for postal tracking click handler
        postalPopoverState.currentMessageId = message.id;
        console.log("DR_POSTAL: Stored message ID for popover:", message.id);
        
        // Handle failures - open resend dialog
        if (message.failureNotifications.length > 0) {
            markEventHandled(ev, "Message.ClickFailure");
            this.env.services.action.doAction("dr_postal.mail_resend_message_action", {
                additionalContext: {
                    mail_message_to_resend: message.id,
                },
            });
            return;
        }
        
        // Default: show the regular popover
        this.popover.open(ev.target, { message });
    },
});

console.log("DR_POSTAL: Message patch loaded");
