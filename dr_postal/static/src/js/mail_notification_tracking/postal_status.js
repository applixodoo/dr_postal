/** @odoo-module **/

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

/**
 * PostalStatus Component
 * 
 * Displays WhatsApp-style delivery status ticks for mail notifications:
 * - ✓ (grey) = Sent
 * - ✓✓ (grey) = Delivered
 * - ✓✓ (blue) = Opened/Read
 * - ✕ (red) = Bounced
 */
export class PostalStatus extends Component {
    static template = "dr_postal.PostalStatus";
    static props = {
        postalState: { type: String, optional: true },
        className: { type: String, optional: true },
    };
    static defaultProps = {
        postalState: "none",
        className: "",
    };

    get statusClass() {
        const state = this.props.postalState;
        if (!state || state === "none") {
            return "";
        }
        return `o_dr_postal_${state}`;
    }

    get statusTooltip() {
        const tooltips = {
            none: "",
            sent: this.env._t("Sent"),
            delivered: this.env._t("Delivered"),
            opened: this.env._t("Opened"),
            bounced: this.env._t("Bounced"),
        };
        return tooltips[this.props.postalState] || "";
    }

    get shouldShow() {
        return this.props.postalState && this.props.postalState !== "none";
    }
}

