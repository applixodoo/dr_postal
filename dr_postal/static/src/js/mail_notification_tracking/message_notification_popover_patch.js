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
let postalPopupViewIdPromise;
async function getPostalPopupViewId(orm) {
    if (!postalPopupViewIdPromise) {
        postalPopupViewIdPromise = orm.call(
            "ir.model.data",
            "_xmlid_to_res_id",
            ["dr_postal.mail_postal_event_view_tree_popup", false]
        );
    }
    return postalPopupViewIdPromise;
}

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
            
            let popupViewId = false;
            try {
                popupViewId = await getPostalPopupViewId(orm);
            } catch (error) {
                console.error("DR_POSTAL: Could not resolve popup view ID", error);
            }

            const actionParams = {
                name: "Email Tracking",
                type: "ir.actions.act_window",
                res_model: "mail.postal.event",
                view_mode: "list",
                views: [[popupViewId || false, "list"]],
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
                const modalBodies = document.querySelectorAll(".modal-body.o_act_window");
                const currentModal = modalBodies[modalBodies.length - 1];
                if (
                    currentModal &&
                    currentModal.querySelector('.o_list_view[data-res-model="mail.postal.event"]')
                ) {
                    currentModal.classList.add("o_dr_postal_popup_modal");
                }
            }, 50);

            await popupPromise;
        }, true);
        
        return {};
    },
};

registry.category("services").add("postal_popover_click", postalPopoverClickService);

console.log("DR_POSTAL: Postal popover service registered");
