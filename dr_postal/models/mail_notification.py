# -*- coding: utf-8 -*-

import uuid
from odoo import api, fields, models, _


class MailNotification(models.Model):
    """Extend mail.notification with postal tracking fields."""
    
    _inherit = 'mail.notification'

    postal_state = fields.Selection([
        ('none', 'No Tracking'),
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('opened', 'Opened'),
        ('bounced', 'Bounced'),
    ], string='Postal Status', default='none', index=True)
    postal_tracking_uuid = fields.Char(
        string='Postal Tracking UUID',
        index=True,
        copy=False,
    )
    postal_last_event_id = fields.Many2one(
        'mail.postal.event',
        string='Last Postal Event',
        ondelete='set null',
    )

    def _to_store_defaults(self, target):
        """Add postal_state to the data sent to frontend."""
        defaults = super()._to_store_defaults(target)
        defaults.append("postal_state")
        return defaults

    def _generate_tracking_uuid(self):
        """Generate a new tracking UUID for this notification."""
        return str(uuid.uuid4())

    def _update_postal_state(self, event_type, event_record):
        """
        Update the postal state based on incoming event.
        
        State progression: none → sent → delivered → opened
        Bounced is terminal and can happen from any state.
        
        For bounced emails, also updates Odoo's notification_status to 'bounce'
        to trigger the built-in bounce handling UI (envelope icon with retry options).
        """
        self.ensure_one()
        
        state_order = {'none': 0, 'sent': 1, 'delivered': 2, 'opened': 3, 'bounced': 99}
        
        current_order = state_order.get(self.postal_state, 0)
        new_order = state_order.get(event_type, 0)
        
        if new_order > current_order or event_type == 'bounced':
            vals = {
                'postal_state': event_type,
                'postal_last_event_id': event_record.id,
            }
            
            # For bounced emails, trigger Odoo's built-in bounce handling
            if event_type == 'bounced':
                vals['notification_status'] = 'bounce'
                vals['failure_type'] = 'mail_bounce'
                vals['failure_reason'] = event_record.error_message or _('Email bounced (reported by Postal)')
            
            self.write(vals)
