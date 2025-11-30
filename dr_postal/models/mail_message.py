# -*- coding: utf-8 -*-

from odoo import api, models


class MailMessage(models.Model):
    """Extend mail.message to include postal tracking data in frontend."""
    
    _inherit = 'mail.message'

    def _message_notification_format(self):
        """Include postal tracking fields in notification format for frontend."""
        result = super()._message_notification_format()
        
        # Add postal fields to each notification
        for message_id, notifications in result.items():
            for notif in notifications:
                notification = self.env['mail.notification'].browse(notif.get('id'))
                if notification.exists():
                    notif['postal_state'] = notification.postal_state or 'none'
                    notif['postal_tracking_uuid'] = notification.postal_tracking_uuid or ''
        
        return result

