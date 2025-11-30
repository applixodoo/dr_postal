# -*- coding: utf-8 -*-

from odoo import api, fields, models, _


class MailPostalEvent(models.Model):
    """Stores postal webhook events for audit and debugging."""
    
    _name = 'mail.postal.event'
    _description = 'Postal Mail Event'
    _order = 'event_datetime desc, id desc'
    _rec_name = 'name'

    name = fields.Char(
        string='Summary',
        compute='_compute_name',
        store=True,
    )
    event_type = fields.Selection([
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('opened', 'Opened'),
        ('bounced', 'Bounced'),
    ], string='Event Type', required=True, index=True)
    event_datetime = fields.Datetime(
        string='Event Time',
        required=True,
        default=fields.Datetime.now,
        index=True,
    )
    payload_json = fields.Text(
        string='Raw Payload',
        help='Original JSON payload from postal webhook',
    )
    external_message_id = fields.Char(
        string='External Message ID',
        index=True,
        help='Message-ID from the postal server',
    )
    recipient = fields.Char(
        string='Recipient',
        help='Email recipient address',
    )
    error_message = fields.Text(
        string='Error Message',
        help='Error details for bounced emails',
    )
    message_id = fields.Many2one(
        'mail.message',
        string='Mail Message',
        ondelete='set null',
        index=True,
    )
    notification_id = fields.Many2one(
        'mail.notification',
        string='Notification',
        ondelete='set null',
        index=True,
    )
    postal_tracking_uuid = fields.Char(
        string='Tracking UUID',
        index=True,
        help='Odoo-generated tracking UUID',
    )

    @api.depends('event_type', 'recipient', 'event_datetime')
    def _compute_name(self):
        for event in self:
            event_label = dict(self._fields['event_type'].selection).get(event.event_type, event.event_type)
            recipient = event.recipient or _('Unknown')
            event.name = f"{event_label}: {recipient}"

