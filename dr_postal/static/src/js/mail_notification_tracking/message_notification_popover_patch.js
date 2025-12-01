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
            
            const actionParams = {
                name: "Email Tracking",
                type: "ir.actions.act_window",
                res_model: "mail.postal.event",
                view_mode: "list",
                views: [[false, "list"]],
                domain: [["message_id", "=", messageId]],
                target: "new",
                search_view_id: false,
                context: { 
                    create: false, 
                    edit: false, 
                    delete: false,
                    search_default_filter: false,
                },
            };

            // Open the events popup with domain filter
            const popupPromise = action.doAction(actionParams);

            // Tag the freshly opened modal so CSS can scope styling
            setTimeout(() => {
                const modals = document.querySelectorAll(".modal.o_act_window");
                const modal = modals[modals.length - 1];
                if (modal) {
                    modal.classList.add("o_dr_postal_popup_modal");
                }
            }, 50);

            await popupPromise;
        }, true);
        
        return {};
    },
};

registry.category("services").add("postal_popover_click", postalPopoverClickService);

console.log("DR_POSTAL: Postal popover service registered");
