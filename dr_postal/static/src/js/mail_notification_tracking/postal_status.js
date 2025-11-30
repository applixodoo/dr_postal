/** @odoo-module **/

import { Component } from "@odoo/owl";

/**
 * PostalStatus Component
 * 
 * Displays WhatsApp-style delivery status ticks:
 * - ✓ (grey) = Sent
 * - ✓✓ (grey) = Delivered
 * - ✓✓ (blue) = Opened/Read
 * - ✕ (red) = Bounced
 */
export class PostalStatus extends Component {
    static template = "dr_postal.PostalStatus";
    static props = {
        state: { type: String, optional: true },
    };

    get statusClass() {
        const state = this.props.state;
        if (!state || state === "none") {
            return "";
        }
        return `o_dr_postal_${state}`;
    }

    get statusTitle() {
        const titles = {
            none: "",
            sent: "Sent",
            delivered: "Delivered",
            opened: "Read",
            bounced: "Bounced",
        };
        return titles[this.props.state] || "";
    }

    get shouldShow() {
        return this.props.state && this.props.state !== "none";
    }
}
