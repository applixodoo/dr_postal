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

/** @type {import("@mail/core/common/message").Message} */
const messagePatch = {
    /**
     * Override onClickNotification to open resend dialog for failures.
     * For non-failures, show the regular popover.
     */
    onClickNotification(ev) {
        const message = toRaw(this.message);
        if (message.failureNotifications.length > 0) {
            this.onClickFailure(ev);
        } else {
            this.popover.open(ev.target, { message });
        }
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
};

patch(Message.prototype, messagePatch);

