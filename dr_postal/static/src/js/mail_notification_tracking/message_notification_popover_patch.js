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
            console.log("DR_POSTAL: Click on postal icon, message ID:", messageId);
            
            if (!messageId) {
                console.log("DR_POSTAL: No message ID in state");
                return;
            }
            
            // Get view IDs
            let viewId = false;
            let searchViewId = false;
            
            try {
                const viewRef = await orm.call("ir.model.data", "check_object_reference", [
                    "dr_postal", "mail_postal_event_view_tree_popup"
                ]);
                viewId = viewRef ? viewRef[1] : false;
                
                const searchRef = await orm.call("ir.model.data", "check_object_reference", [
                    "dr_postal", "mail_postal_event_view_search_popup"
                ]);
                searchViewId = searchRef ? searchRef[1] : false;
            } catch (e) {
                console.log("DR_POSTAL: Could not get view IDs", e);
            }
            
            // Open the events popup
            await action.doAction({
                name: "Email Tracking",
                type: "ir.actions.act_window",
                res_model: "mail.postal.event",
                view_mode: "list",
                views: [[viewId, "list"]],
                search_view_id: searchViewId ? [searchViewId, "search"] : false,
                domain: [["message_id", "=", messageId]],
                target: "new",
                context: { 
                    create: false, 
                    edit: false, 
                    delete: false,
                },
            });
        }, true);
        
        return {};
    },
};

registry.category("services").add("postal_popover_click", postalPopoverClickService);

console.log("DR_POSTAL: Postal popover service registered");
