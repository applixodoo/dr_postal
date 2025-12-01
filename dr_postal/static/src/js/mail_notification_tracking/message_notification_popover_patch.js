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
    dependencies: ["action", "orm"],
    
    start(env, { action, orm }) {
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

            try {
                // Look up the view ID via search
                let viewId = false;
                try {
                    const views = await orm.searchRead(
                        "ir.ui.view",
                        [["name", "=", "mail.postal.event.tree.popup"]],
                        ["id"],
                        { limit: 1 }
                    );
                    if (views.length > 0) {
                        viewId = views[0].id;
                        console.log("DR_POSTAL: Found popup view ID:", viewId);
                    }
                } catch (e) {
                    console.warn("DR_POSTAL: Could not look up view ID", e);
                }

                // Build inline action with proper domain
                const actionDef = {
                    name: "Email Tracking",
                    type: "ir.actions.act_window",
                    res_model: "mail.postal.event",
                    view_mode: "list",
                    views: [[viewId, "list"]],
                    domain: [["message_id", "=", messageId]],
                    target: "new",
                    context: {
                        create: false,
                        edit: false,
                        delete: false,
                    },
                };

                await action.doAction(actionDef);
                
                // Tag the freshly opened modal so CSS can scope styling
                setTimeout(() => {
                    const modals = document.querySelectorAll(".modal");
                    const currentModal = modals[modals.length - 1];
                    if (currentModal) {
                        currentModal.classList.add("o_dr_postal_popup_modal");
                    }
                }, 100);
            } catch (error) {
                console.error("DR_POSTAL: Error opening popup", error);
            }
        }, true);
        
        return {};
    },
};

registry.category("services").add("postal_popover_click", postalPopoverClickService);

console.log("DR_POSTAL: Postal popover service registered");
