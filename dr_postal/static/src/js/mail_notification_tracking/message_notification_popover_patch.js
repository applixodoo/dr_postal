/** @odoo-module **/

import { registry } from "@web/core/registry";

/**
 * Service to handle clicks on postal status icons in the notification popover.
 * Uses event delegation to catch clicks on .o_dr_postal_status elements.
 */
export const postalPopoverClickService = {
    dependencies: ["action"],
    
    start(env, { action }) {
        console.log("DR_POSTAL: Postal popover click service started");
        
        // Use event delegation to catch clicks on postal status icons
        document.addEventListener("click", async (ev) => {
            // Check if clicked on a postal status icon
            const postalIcon = ev.target.closest(".o_dr_postal_status");
            if (!postalIcon) {
                return;
            }
            
            console.log("DR_POSTAL: Postal icon clicked in popover");
            
            // Find the popover container
            const popoverContent = postalIcon.closest(".o-mail-MessageNotificationPopover");
            if (!popoverContent) {
                console.log("DR_POSTAL: Not in popover, ignoring");
                return;
            }
            
            ev.preventDefault();
            ev.stopPropagation();
            
            // Try to find the notification ID from the data
            // The notification row structure contains the notification info
            // We'll search by the message_id which we can get from the message component
            
            // Find the message element that opened this popover
            const messageEl = document.querySelector(".o-mail-Message:has(.o-mail-Message-notification)");
            if (messageEl) {
                const messageId = messageEl.dataset?.messageId;
                console.log("DR_POSTAL: Found message ID:", messageId);
                
                if (messageId) {
                    await action.doAction({
                        name: "Email Tracking",
                        type: "ir.actions.act_window",
                        res_model: "mail.postal.event",
                        view_mode: "list",
                        views: [[false, "list"]],
                        domain: [["message_id", "=", parseInt(messageId)]],
                        target: "new",
                        context: { create: false, edit: false, delete: false },
                    });
                    return;
                }
            }
            
            // Fallback: open all events (no filter)
            console.log("DR_POSTAL: No message ID found, opening all events");
            await action.doAction({
                name: "Email Tracking",
                type: "ir.actions.act_window",
                res_model: "mail.postal.event",
                view_mode: "list",
                views: [[false, "list"]],
                target: "new",
                context: { create: false, edit: false, delete: false },
            });
        }, true); // Use capture phase
        
        return {};
    },
};

registry.category("services").add("postal_popover_click", postalPopoverClickService);
