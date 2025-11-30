/** @odoo-module **/

import { Record } from "@mail/core/common/record";
import { patch } from "@web/core/utils/patch";

// Try to patch the Notification model if it exists
try {
    const { Notification } = require("@mail/core/common/notification_model");
    
    patch(Notification.prototype, {
        setup() {
            super.setup(...arguments);
            this.postal_state = Record.attr("none");
        },
    });
} catch (e) {
    console.log("dr_postal: Could not patch Notification model", e);
}
