/** @odoo-module **/

import { Notification } from "@mail/core/common/notification_model";
import { patch } from "@web/core/utils/patch";

/**
 * Patch the Notification model to include postal tracking fields
 */
patch(Notification.prototype, {
    setup() {
        super.setup(...arguments);
        /** @type {string} */
        this.postal_state = "none";
        /** @type {string|null} */
        this.postal_tracking_uuid = null;
    },
});

/**
 * Insert postal fields into the notification record
 */
patch(Notification, {
    _insert(data) {
        const notification = super._insert(...arguments);
        if (data.postal_state !== undefined) {
            notification.postal_state = data.postal_state;
        }
        if (data.postal_tracking_uuid !== undefined) {
            notification.postal_tracking_uuid = data.postal_tracking_uuid;
        }
        return notification;
    },
});

