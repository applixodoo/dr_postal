/** @odoo-module **/

import { MessageNotificationPopover } from "@mail/core/common/message_notification_popover";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";

/**
 * Patch the MessageNotificationPopover to handle clicks on postal status icons.
 * When clicking on WhatsApp-style ticks, opens a popup with tracking events.
 */

patch(MessageNotificationPopover.prototype, {
    setup() {
        super.setup(...arguments);
        this.action = useService("action");
    },

    /**
     * Handle click on a notification row to open postal events.
     * @param {Object} notification - The notification record
     */
    onClickNotificationRow(notification) {
        const postalState = notification.postal_state;
        console.log("DR_POSTAL: Popover notification clicked", notification.id, "postal_state:", postalState);
        
        // Only open popup if there's postal tracking
        if (postalState && postalState !== "none") {
            this.action.doAction({
                name: "Email Tracking",
                type: "ir.actions.act_window",
                res_model: "mail.postal.event",
                view_mode: "list",
                views: [[false, "list"]],
                domain: [["notification_id", "=", notification.id]],
                target: "new",
                context: { create: false, edit: false, delete: false },
            });
            // Close the popover
            if (this.props.close) {
                this.props.close();
            }
        }
    },
});

console.log("DR_POSTAL: MessageNotificationPopover patch loaded");

