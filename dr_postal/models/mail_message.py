# -*- coding: utf-8 -*-

from odoo import api, models


class MailMessage(models.Model):
    """Extend mail.message to include postal tracking data in frontend."""
    
    _inherit = 'mail.message'

    def _to_store(self, store, **kwargs):
        """Include postal tracking fields in store data for frontend."""
        super()._to_store(store, **kwargs)
        
        # Get notifications for these messages and add postal state
        for message in self:
            notifications = self.env['mail.notification'].search([
                ('mail_message_id', '=', message.id)
            ])
            for notif in notifications:
                # Store postal state with the notification
                store.add(notif, {
                    'postal_state': notif.postal_state or 'none',
                })
