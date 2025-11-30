/** @odoo-module **/

import { Notification } from "@mail/core/common/notification_model";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

/**
 * Patch the Notification model to show WhatsApp-style postal tracking status.
 * 
 * For sent/delivered/opened: Show custom tick icons
 * For bounced: Use Odoo's default so popup functionality works
 */

/** @type {import("models").Notification} */
const notificationPatch = {
    get statusIcon() {
        const postalState = this.postal_state;
        // Only show custom icons for positive delivery states
        // For bounces/failures, let Odoo handle it (popup needs to work)
        if (postalState === "sent") {
            return "o_dr_postal_status o_dr_postal_sent";
        }
        if (postalState === "delivered") {
            return "o_dr_postal_status o_dr_postal_delivered";
        }
        if (postalState === "opened") {
            return "o_dr_postal_status o_dr_postal_opened";
        }
        // Default: use Odoo's standard icons
        return super.statusIcon;
    },

    get statusTitle() {
        const postalState = this.postal_state;
        if (postalState === "sent") {
            return _t("Sent");
        }
        if (postalState === "delivered") {
            return _t("Delivered");
        }
        if (postalState === "opened") {
            return _t("Read");
        }
        return super.statusTitle;
    },
};

patch(Notification.prototype, notificationPatch);
