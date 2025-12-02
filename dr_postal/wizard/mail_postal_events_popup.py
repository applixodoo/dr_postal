# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class MailPostalEventsPopup(models.TransientModel):
    """Transient model for displaying postal events in a clean popup."""
    _name = 'mail.postal.events.popup'
    _description = 'Email Tracking Events Popup'

    mail_message_id = fields.Many2one('mail.message', 'Message', readonly=True)
    event_ids = fields.Many2many(
        'mail.postal.event', 
        string='Tracking Events',
        compute='_compute_event_ids',
    )

    @api.depends('mail_message_id')
    def _compute_event_ids(self):
        for wizard in self:
            if wizard.mail_message_id:
                wizard.event_ids = self.env['mail.postal.event'].search([
                    ('message_id', '=', wizard.mail_message_id.id)
                ], order='event_datetime desc')
            else:
                wizard.event_ids = False

    @api.model
    def default_get(self, fields_list):
        rec = super().default_get(fields_list)
        message_id = self._context.get('default_mail_message_id')
        if message_id:
            rec['mail_message_id'] = message_id
        return rec

