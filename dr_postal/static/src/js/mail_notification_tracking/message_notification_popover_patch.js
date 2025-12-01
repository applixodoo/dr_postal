/** @odoo-module **/

import { registry } from "@web/core/registry";

/**
 * Service to handle clicks on postal status icons in the notification popover.
 * Uses event delegation to catch clicks on .o_dr_postal_status elements.
 */
export const postalPopoverClickService = {
    dependencies: ["action", "orm"],
    
    async start(env, { action, orm }) {
        console.log("DR_POSTAL: Postal popover click service started");
        
        // Use event delegation to catch clicks on postal status icons
        document.addEventListener("click", async (ev) => {
            // Check if clicked on a postal status icon
            const postalIcon = ev.target.closest(".o_dr_postal_status");
            if (!postalIcon) {
                return;
            }
            
            console.log("DR_POSTAL: Postal icon clicked");
            
            // Find the popover container to confirm we're in the notification popover
            const popoverContent = postalIcon.closest(".o-mail-MessageNotificationPopover");
            if (!popoverContent) {
                console.log("DR_POSTAL: Not in popover, ignoring");
                return;
            }
            
            ev.preventDefault();
            ev.stopPropagation();
            
            // Get the message ID from the OWL component data
            // We need to find it from the popover's parent message
            let messageId = null;
            
            // Try to find the message element that's associated with this popover
            // The popover is typically near the message that opened it
            const allMessages = document.querySelectorAll(".o-mail-Message[data-message-id]");
            for (const msgEl of allMessages) {
                const notificationSpan = msgEl.querySelector(".o-mail-Message-notification");
                if (notificationSpan) {
                    // This message has notifications, likely the one that opened the popover
                    messageId = msgEl.dataset.messageId;
                    console.log("DR_POSTAL: Found message with notifications, ID:", messageId);
                    break;
                }
            }
            
            // If we couldn't find it that way, try to get from popover's owl component
            if (!messageId) {
                // Look for any message ID we can find
                const nearbyMessage = document.querySelector(".o-mail-Message[data-message-id]");
                if (nearbyMessage) {
                    messageId = nearbyMessage.dataset.messageId;
                }
            }
            
            if (messageId) {
                console.log("DR_POSTAL: Opening events for message ID:", messageId);
                
                // Get view IDs
                const viewId = await orm.call("ir.model.data", "check_object_reference", [
                    "dr_postal", "mail_postal_event_view_tree_popup"
                ]).catch(() => null);
                
                const searchViewId = await orm.call("ir.model.data", "check_object_reference", [
                    "dr_postal", "mail_postal_event_view_search_popup"
                ]).catch(() => null);
                
                await action.doAction({
                    name: "Email Tracking",
                    type: "ir.actions.act_window",
                    res_model: "mail.postal.event",
                    view_mode: "list",
                    views: [[viewId ? viewId[1] : false, "list"]],
                    search_view_id: searchViewId ? [searchViewId[1], "search"] : false,
                    domain: [["message_id", "=", parseInt(messageId)]],
                    target: "new",
                    context: { 
                        create: false, 
                        edit: false, 
                        delete: false,
                        search_default_group_by: false,
                    },
                    flags: {
                        searchable: false,
                        selectable: false,
                    },
                });
            } else {
                console.log("DR_POSTAL: Could not find message ID");
            }
        }, true); // Use capture phase
        
        return {};
    },
};

registry.category("services").add("postal_popover_click", postalPopoverClickService);
