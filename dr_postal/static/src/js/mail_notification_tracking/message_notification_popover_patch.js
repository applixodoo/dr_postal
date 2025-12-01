/** @odoo-module **/

import { registry } from "@web/core/registry";

/**
 * Store for the currently open popover's message ID.
 * Set by the Message component when opening the notification popover.
 */
export const postalPopoverState = {
    currentMessageId: null,
};

/**
 * Service to handle clicks on postal status icons in the notification popover.
 */
export const postalPopoverClickService = {
    dependencies: ["action"],
    
    start(env, { action }) {
        console.log("DR_POSTAL: Postal popover click service started");
        
        // Global click handler for postal icons in popover
        document.addEventListener("click", async (ev) => {
            const postalIcon = ev.target.closest(".o_dr_postal_status");
            if (!postalIcon) {
                return;
            }
            
            const popoverEl = postalIcon.closest(".o-mail-MessageNotificationPopover");
            if (!popoverEl) {
                return;
            }
            
            ev.preventDefault();
            ev.stopPropagation();
            
            // Get message ID from global state
            const messageId = postalPopoverState.currentMessageId;
            console.log("DR_POSTAL: Opening events for message ID:", messageId);
            
            if (!messageId) {
                console.log("DR_POSTAL: No message ID in state");
                return;
            }
            
            // Open the events popup with domain filter
            await action.doAction({
                name: "Email Tracking",
                type: "ir.actions.act_window",
                res_model: "mail.postal.event",
                view_mode: "list",
                views: [[false, "list"]],
                domain: [["message_id", "=", messageId]],
                target: "new",
                context: { 
                    create: false, 
                    edit: false, 
                    delete: false,
                },
                flags: {
                    withSearchBar: false,
                    searchMenuTypes: [],
                    hasSelectors: false,
                },
            });
        }, true);
        
        return {};
    },
};

registry.category("services").add("postal_popover_click", postalPopoverClickService);

console.log("DR_POSTAL: Postal popover service registered");
