/** @odoo-module **/

import { Message } from "@mail/core/common/message";
import { MessageNotificationPopover } from "@mail/core/common/message_notification_popover";
import { patch } from "@web/core/utils/patch";

/**
 * Patch the Message component to include postal tracking status
 */
patch(Message.prototype, {
    /**
     * Get the postal state for display
     */
    get postalState() {
        const message = this.props.message;
        if (!message || !message.notifications) {
            return "none";
        }
        
        // Get the highest priority state from all notifications
        const stateOrder = { none: 0, sent: 1, delivered: 2, opened: 3, bounced: 99 };
        let highestState = "none";
        let highestOrder = 0;
        
        for (const notification of message.notifications) {
            const state = notification.postal_state || "none";
            const order = stateOrder[state] || 0;
            if (order > highestOrder) {
                highestOrder = order;
                highestState = state;
            }
        }
        
        return highestState;
    },

    /**
     * Check if we should show postal status
     */
    get hasPostalTracking() {
        return this.postalState && this.postalState !== "none";
    },
});

/**
 * Patch the MessageNotificationPopover to show postal status per recipient
 */
patch(MessageNotificationPopover.prototype, {
    /**
     * Get postal state class for a notification
     */
    getPostalStateClass(notification) {
        const state = notification.postal_state || "none";
        if (state === "none") {
            return "";
        }
        return `o_dr_postal_${state}`;
    },

    /**
     * Get postal state tooltip for a notification
     */
    getPostalStateTooltip(notification) {
        const tooltips = {
            none: "",
            sent: this.env._t("Sent"),
            delivered: this.env._t("Delivered"),
            opened: this.env._t("Read"),
            bounced: this.env._t("Bounced"),
        };
        return tooltips[notification.postal_state] || "";
    },

    /**
     * Check if notification has postal tracking
     */
    hasPostalTracking(notification) {
        return notification.postal_state && notification.postal_state !== "none";
    },
});

