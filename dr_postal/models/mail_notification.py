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

    def _to_store(self, store, fields=None, **kwargs):
        """Include postal_state in store data for frontend."""
        super()._to_store(store, fields=fields, **kwargs)
        for notif in self:
            store.add(notif, {'postal_state': notif.postal_state or 'none'})

    def _generate_tracking_uuid(self):
        """Generate a new tracking UUID for this notification."""
        return str(uuid.uuid4())

    def _update_postal_state(self, event_type, event_record):
        """
        Update the postal state based on incoming event.
        
        State progression: none → sent → delivered → opened
        Bounced is terminal and can happen from any state.
        """
        self.ensure_one()
        
        state_order = {'none': 0, 'sent': 1, 'delivered': 2, 'opened': 3, 'bounced': 99}
        
        current_order = state_order.get(self.postal_state, 0)
        new_order = state_order.get(event_type, 0)
        
        if new_order > current_order or event_type == 'bounced':
            self.write({
                'postal_state': event_type,
                'postal_last_event_id': event_record.id,
            })
            
            if event_type == 'bounced' and not self.postal_bounce_notified:
                self._post_bounce_notification(event_record)

    def _post_bounce_notification(self, event_record):
        """Post a bounce notification to the related document's chatter."""
        self.ensure_one()
        
        if not self.mail_message_id or not self.mail_message_id.model:
            return
        
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
        
        recipient = self.res_partner_id.email or event_record.recipient or _('Unknown recipient')
        error_msg = event_record.error_message or _('No error details provided')
        
        body = _(
            '<p><strong>⚠️ Email Bounce</strong></p>'
            '<p>The email to <strong>%(recipient)s</strong> has bounced.</p>'
            '<p><strong>Reason:</strong> %(error)s</p>',
            recipient=recipient,
            error=error_msg,
        )
        
        if hasattr(record, 'message_post'):
            record.message_post(
                body=body,
                message_type='notification',
                subtype_xmlid='mail.mt_note',
            )
            self.postal_bounce_notified = True
