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
    postal_bounce_notified = fields.Boolean(
        string='Bounce Notified',
        default=False,
        help='Whether a bounce notification has been posted to chatter',
    )

    def _generate_tracking_uuid(self):
        """Generate a new tracking UUID for this notification."""
        return str(uuid.uuid4())

    def _update_postal_state(self, event_type, event_record):
        """
        Update the postal state based on incoming event.
        
        State progression: none → sent → delivered → opened
        Bounced is terminal and can happen from any state.
        
        :param event_type: The event type ('sent', 'delivered', 'opened', 'bounced')
        :param event_record: The mail.postal.event record
        """
        self.ensure_one()
        
        # State hierarchy for progression (bounced is terminal, always applies)
        state_order = {'none': 0, 'sent': 1, 'delivered': 2, 'opened': 3, 'bounced': 99}
        
        current_order = state_order.get(self.postal_state, 0)
        new_order = state_order.get(event_type, 0)
        
        # Update if new state is higher in hierarchy or if bounced
        if new_order > current_order or event_type == 'bounced':
            self.write({
                'postal_state': event_type,
                'postal_last_event_id': event_record.id,
            })
            
            # Handle bounce notification
            if event_type == 'bounced' and not self.postal_bounce_notified:
                self._post_bounce_notification(event_record)

    def _post_bounce_notification(self, event_record):
        """Post a bounce notification to the related document's chatter."""
        self.ensure_one()
        
        if not self.mail_message_id or not self.mail_message_id.model:
            return
        
        # Get the related document
        model = self.mail_message_id.model
        res_id = self.mail_message_id.res_id
        
        if not res_id:
            return
        
        try:
            record = self.env[model].browse(res_id)
            if not record.exists():
                return
        except Exception:
            return
        
        # Build bounce message
        recipient = self.res_partner_id.email or event_record.recipient or _('Unknown recipient')
        error_msg = event_record.error_message or _('No error details provided')
        
        body = _(
            '<p><strong>⚠️ Email Bounce</strong></p>'
            '<p>The email to <strong>%(recipient)s</strong> has bounced.</p>'
            '<p><strong>Reason:</strong> %(error)s</p>',
            recipient=recipient,
            error=error_msg,
        )
        
        # Post message to chatter
        if hasattr(record, 'message_post'):
            record.message_post(
                body=body,
                message_type='notification',
                subtype_xmlid='mail.mt_note',
            )
            
            # Mark as notified to prevent duplicates
            self.postal_bounce_notified = True

