/** @odoo-module **/

import { Notification } from "@mail/core/common/notification_model";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

/**
 * Patch the Notification model to add postal tracking status.
 * 
 * WhatsApp-style indicators:
 * - ✓ (grey) = Sent
 * - ✓✓ (grey) = Delivered  
 * - ✓✓ (blue) = Opened/Read
 * 
 * For bounces, we let Odoo handle the display so the popup/retry functionality works.
 */

/** @type {import("models").Notification} */
const notificationPatch = {
    /** @type {string} */
    postal_state: undefined,

    get statusIcon() {
        // For bounces, use Odoo's default handling so popup works
        // Only show custom icons for sent/delivered/opened
        if (this.postal_state && !["none", "bounced"].includes(this.postal_state)) {
            switch (this.postal_state) {
                case "sent":
                    return "o_dr_postal_status o_dr_postal_sent";
                case "delivered":
                    return "o_dr_postal_status o_dr_postal_delivered";
                case "opened":
                    return "o_dr_postal_status o_dr_postal_opened";
            }
        }
        // Fall back to Odoo's default (including for bounces)
        return super.statusIcon;
    },

    get statusTitle() {
        // For bounces, use Odoo's default
        if (this.postal_state && !["none", "bounced"].includes(this.postal_state)) {
            switch (this.postal_state) {
                case "sent":
                    return _t("Sent");
                case "delivered":
                    return _t("Delivered");
                case "opened":
                    return _t("Read");
            }
        }
        return super.statusTitle;
    },
};

patch(Notification.prototype, notificationPatch);
