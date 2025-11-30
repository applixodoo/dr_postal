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
 * - ✕ (red) = Bounced
 */

/** @type {import("models").Notification} */
const notificationPatch = {
    /** @type {string} */
    postal_state: undefined,

    get statusIcon() {
        // If we have postal tracking, use that
        if (this.postal_state && this.postal_state !== "none") {
            switch (this.postal_state) {
                case "sent":
                    return "o_dr_postal_status o_dr_postal_sent";
                case "delivered":
                    return "o_dr_postal_status o_dr_postal_delivered";
                case "opened":
                    return "o_dr_postal_status o_dr_postal_opened";
                case "bounced":
                    return "o_dr_postal_status o_dr_postal_bounced";
            }
        }
        // Fall back to original Odoo status icons
        return super.statusIcon;
    },

    get statusTitle() {
        // If we have postal tracking, use that
        if (this.postal_state && this.postal_state !== "none") {
            switch (this.postal_state) {
                case "sent":
                    return _t("Sent");
                case "delivered":
                    return _t("Delivered");
                case "opened":
                    return _t("Read");
                case "bounced":
                    return _t("Bounced");
            }
        }
        // Fall back to original Odoo status
        return super.statusTitle;
    },
};

patch(Notification.prototype, notificationPatch);
