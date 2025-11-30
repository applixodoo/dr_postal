/** @odoo-module **/

import { patch } from "@web/core/utils/patch";

// Patch message-related components to show postal status
// This is a safe patch that won't break if components don't exist

try {
    const { Message } = require("@mail/core/common/message");
    
    patch(Message.prototype, {
        /**
         * Get the aggregated postal state for this message's notifications
         */
        get postalState() {
            if (!this.props.message || !this.props.message.notifications) {
                return "none";
            }
            
            // Get the highest priority state from all notifications
            const stateOrder = { none: 0, sent: 1, delivered: 2, opened: 3, bounced: 99 };
            let highestState = "none";
            let highestOrder = 0;
            
            for (const notification of this.props.message.notifications) {
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
} catch (e) {
    console.log("dr_postal: Could not patch Message component", e);
}
