/** @odoo-module **/

import { Message } from "@mail/core/common/message";
import { patch } from "@web/core/utils/patch";
import { toRaw } from "@odoo/owl";
import { markEventHandled } from "@web/core/utils/misc";

/**
 * Patch the Message component to open the resend dialog for failed notifications.
 * This restores the v18 behavior where clicking on a bounce opens a dialog
 * with options to retry or ignore the failed email.
 */

patch(Message.prototype, {
    /**
     * Override onClickNotification to open resend dialog for failures.
     * For non-failures, show the regular popover (where postal tracking clicks are handled).
     */
    onClickNotification(ev) {
        const message = toRaw(this.message);
        
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
        
        // Default: show the regular popover (postal icon clicks handled there)
        this.popover.open(ev.target, { message });
    },
});
