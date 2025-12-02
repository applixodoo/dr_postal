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
 * Opens a clean wizard popup (like the resend dialog) instead of a list view.
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

            try {
                // Call the wizard action by XMLID, passing message ID via context
                await action.doAction("dr_postal.mail_postal_events_popup_action", {
                    additionalContext: {
                        default_mail_message_id: messageId,
                    },
                });
            } catch (error) {
                console.error("DR_POSTAL: Error opening popup", error);
            }
        }, true);
        
        return {};
    },
};

registry.category("services").add("postal_popover_click", postalPopoverClickService);

console.log("DR_POSTAL: Postal popover service registered");
