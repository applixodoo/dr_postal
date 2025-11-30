/** @odoo-module **/

/**
 * Message component patches for postal status display.
 * 
 * The postal_state data is added via Python _to_store method.
 * This file provides helper methods if the Message component exists.
 */

import { patch } from "@web/core/utils/patch";

// Safely try to patch Message component
let Message;
try {
    Message = odoo.loader.modules.get("@mail/core/common/message")?.Message;
} catch (e) {
    // Module not found
}

if (Message) {
    patch(Message.prototype, {
        /**
         * Get the aggregated postal state for this message's notifications
         */
        get postalState() {
            const message = this.props?.message;
            if (!message?.notifications?.length) {
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
            const state = this.postalState;
            return state && state !== "none";
        },

        /**
         * Get CSS class for postal status
         */
        get postalStatusClass() {
            const state = this.postalState;
            if (!state || state === "none") {
                return "";
            }
            return `o_dr_postal_${state}`;
        },

        /**
         * Get tooltip text for postal status
         */
        get postalStatusTitle() {
            const titles = {
                none: "",
                sent: "Sent",
                delivered: "Delivered", 
                opened: "Read",
                bounced: "Bounced",
            };
            return titles[this.postalState] || "";
        },
    });
}
