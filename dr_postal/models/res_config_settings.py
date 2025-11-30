# -*- coding: utf-8 -*-

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    """Add postal webhook configuration to settings."""
    
    _inherit = 'res.config.settings'

    dr_postal_webhook_token = fields.Char(
        string='Postal Webhook Token',
        config_parameter='dr_postal.webhook_token',
        help='Secret token used to authenticate incoming postal webhooks. '
             'This token will be part of your webhook URL.',
    )
    dr_postal_webhook_url = fields.Char(
        string='Webhook URL',
        compute='_compute_webhook_url',
        help='Configure this URL in your Postal server webhook settings.',
    )

    @api.depends('dr_postal_webhook_token')
    def _compute_webhook_url(self):
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url', '')
        token = self.env['ir.config_parameter'].sudo().get_param('dr_postal.webhook_token', '')
        for record in self:
            if token:
                record.dr_postal_webhook_url = f"{base_url}/postal/webhook/{token}"
            else:
                record.dr_postal_webhook_url = f"{base_url}/postal/webhook/YOUR-TOKEN-HERE"
