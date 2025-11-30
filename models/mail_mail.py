# -*- coding: utf-8 -*-

import uuid
from odoo import api, models


class MailMail(models.Model):
    """Extend mail.mail to add postal tracking headers to outgoing emails."""
    
    _inherit = 'mail.mail'

    def _send_prepare_values(self, partner=None):
        """Add postal tracking headers to outgoing email."""
        res = super()._send_prepare_values(partner=partner)
        
        # Find notification for this partner if exists
        notification = self._get_postal_notification(partner)
        
        if notification:
            # Generate tracking UUID if not exists
            if not notification.postal_tracking_uuid:
                tracking_uuid = str(uuid.uuid4())
                notification.postal_tracking_uuid = tracking_uuid
            else:
                tracking_uuid = notification.postal_tracking_uuid
            
            # Add custom headers for postal tracking
            extra_headers = res.get('headers', {}) or {}
            extra_headers.update({
                'X-Odoo-Tracking-UUID': tracking_uuid,
                'X-Odoo-Notification-Id': str(notification.id),
                'X-Odoo-Message-Id': str(self.mail_message_id.id) if self.mail_message_id else '',
            })
            res['headers'] = extra_headers
            
            # Update notification state to 'sent'
            if notification.postal_state == 'none':
                notification.postal_state = 'sent'
        
        return res

    def _get_postal_notification(self, partner=None):
        """Find the mail.notification record for this mail and partner."""
        if not self.mail_message_id:
            return None
        
        domain = [('mail_message_id', '=', self.mail_message_id.id)]
        
        if partner:
            domain.append(('res_partner_id', '=', partner.id))
        
        notification = self.env['mail.notification'].search(domain, limit=1)
        return notification

