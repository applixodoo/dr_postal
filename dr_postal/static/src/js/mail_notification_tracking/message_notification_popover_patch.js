/** @odoo-module **/

import { MessageNotificationPopover } from "@mail/core/common/message_notification_popover";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { useRef, onMounted } from "@odoo/owl";

/**
 * Patch the MessageNotificationPopover to:
 * 1. Store message ID as data attribute for click handler access
 * 2. Handle clicks on postal status icons
 */

patch(MessageNotificationPopover.prototype, {
    setup() {
        super.setup(...arguments);
        this.action = useService("action");
        this.orm = useService("orm");
        this.rootRef = useRef("root");
        
        onMounted(() => {
            // Store message ID on the popover root element
            if (this.rootRef.el && this.props.message) {
                this.rootRef.el.dataset.messageId = this.props.message.id;
                console.log("DR_POSTAL: Stored message ID on popover:", this.props.message.id);
            }
        });
    },
});

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
    
    // Get message ID from data attribute
    const messageId = popoverEl.dataset.messageId;
    console.log("DR_POSTAL: Click on postal icon, message ID:", messageId);
    
    if (!messageId) {
        console.log("DR_POSTAL: No message ID found on popover");
        return;
    }
    
    // Use odoo's action service via registry
    const env = owl.Component.env;
    if (!env || !env.services) {
        console.log("DR_POSTAL: Could not get env services");
        return;
    }
    
    const action = env.services.action;
    const orm = env.services.orm;
    
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
        domain: [["message_id", "=", parseInt(messageId)]],
        target: "new",
        context: { 
            create: false, 
            edit: false, 
            delete: false,
        },
    });
}, true);

console.log("DR_POSTAL: MessageNotificationPopover patch loaded");
