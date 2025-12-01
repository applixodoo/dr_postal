/** @odoo-module **/

import { Component, onMounted, useRef } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

/**
 * Service to handle postal status icon clicks.
 * Opens a popup with tracking events when clicking on WhatsApp-style ticks.
 */
export const postalClickService = {
    dependencies: ["action", "orm"],
    
    start(env, { action, orm }) {
        // Add click listener for postal status icons
        document.addEventListener("click", async (ev) => {
            const target = ev.target.closest(".o_dr_postal_status");
            if (!target) {
                return;
            }
            
            ev.preventDefault();
            ev.stopPropagation();
            
            // Try to find the message element to get the message ID
            const messageEl = target.closest(".o-mail-Message");
            if (messageEl) {
                const messageId = messageEl.dataset.messageId;
                if (messageId) {
                    // Check if there are any events for this message
                    const eventCount = await orm.searchCount("mail.postal.event", [
                        ["message_id", "=", parseInt(messageId)]
                    ]);
                    
                    if (eventCount > 0) {
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
                    }
                    return;
                }
            }
            
            // Fallback: Try to find notification ID from data attribute
            const notificationRow = target.closest("[data-notification-id]");
            if (notificationRow) {
                const notificationId = parseInt(notificationRow.dataset.notificationId);
                if (notificationId) {
                    await action.doAction({
                        name: "Email Tracking",
                        type: "ir.actions.act_window",
                        res_model: "mail.postal.event",
                        view_mode: "list",
                        views: [[false, "list"]],
                        domain: [["notification_id", "=", notificationId]],
                        target: "new",
                        context: { create: false, edit: false, delete: false },
                    });
                }
            }
        }, true); // Use capture phase to intercept before other handlers
        
        return {};
    },
};

registry.category("services").add("postal_click", postalClickService);
