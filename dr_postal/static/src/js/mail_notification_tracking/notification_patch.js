/** @odoo-module **/

import { Notification } from "@mail/core/common/notification_model";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

/**
 * Patch the Notification model to show WhatsApp-style postal tracking status.
 * 
 * Icon progression:
 * - Flying letter (Odoo default): queued/processing
 * - 1 grey tick: Odoo delivered to Postal (no webhook yet)
 * - 2 grey ticks: Postal "Sent" webhook received (SMTP confirmed)
 * - 2 grey ticks: Delivered to recipient's server
 * - 2 blue ticks: Opened/Read
 * - Red envelope (Odoo default): Bounced/Failed (keeps popup functionality)
 */

/** @type {import("models").Notification} */
const notificationPatch = {
    get statusIcon() {
        const postalState = this.postal_state;
        
        // For bounces/failures, let Odoo handle it (popup needs to work)
        if (this.isFailure) {
            return super.statusIcon;
        }
        
        // Postal tracking states - show custom tick icons
        if (postalState === "opened") {
            return "o_dr_postal_status o_dr_postal_opened";  // 2 blue ticks
        }
        if (postalState === "delivered") {
            return "o_dr_postal_status o_dr_postal_delivered";  // 2 grey ticks
        }
        if (postalState === "sent") {
            return "o_dr_postal_status o_dr_postal_delivered";  // 2 grey ticks (webhook received)
        }
        
        // Mail sent by Odoo but no Postal webhook yet = 1 tick
        if (this.notification_status === "sent" || this.notification_status === "pending") {
            return "o_dr_postal_status o_dr_postal_sent";  // 1 grey tick
        }
        
        // Default: use Odoo's standard icons (flying letter for ready/process)
        return super.statusIcon;
    },

    get statusTitle() {
        const postalState = this.postal_state;
        
        // For bounces/failures, let Odoo handle it
        if (this.isFailure) {
            return super.statusTitle;
        }
        
        if (postalState === "opened") {
            return _t("Read - Click for details");
        }
        if (postalState === "delivered") {
            return _t("Delivered - Click for details");
        }
        if (postalState === "sent") {
            return _t("Sent to SMTP - Click for details");
        }
        
        // For sent notification_status without postal tracking
        if (this.notification_status === "sent" || this.notification_status === "pending") {
            return _t("Sent to Mail Server");
        }
        
        // Default: use Odoo's standard titles
        return super.statusTitle;
    },

    /**
     * Check if this notification has postal tracking (can show popup)
     */
    get hasPostalTracking() {
        const postalState = this.postal_state;
        return postalState && postalState !== "none";
    },
};

patch(Notification.prototype, notificationPatch);

// Ensure postal_state is available on the model
Notification.prototype.postal_state = undefined;
