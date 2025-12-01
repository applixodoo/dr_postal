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
            console.log("DR_POSTAL: Click on postal icon, message ID:", messageId);
            
            if (!messageId) {
                console.log("DR_POSTAL: No message ID in state");
                return;
            }
            
            // Open the events popup
            // Use the action XMLID to get proper views
            try {
                await action.doAction("dr_postal.mail_postal_event_action_popup", {
                    additionalContext: {
                        active_id: messageId,
                        search_default_message_id: messageId,
                    },
                    props: {
                        domain: [["message_id", "=", messageId]],
                    },
                });
            } catch (e) {
                console.log("DR_POSTAL: Falling back to inline action");
                // Fallback to inline action definition
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
                });
            }
        }, true);
        
        return {};
    },
};

registry.category("services").add("postal_popover_click", postalPopoverClickService);

console.log("DR_POSTAL: Postal popover service registered");
