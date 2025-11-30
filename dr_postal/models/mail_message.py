# -*- coding: utf-8 -*-

from odoo import models


class MailMessage(models.Model):
    """Extend mail.message for postal tracking compatibility."""
    
    _inherit = 'mail.message'
    
    # No overrides needed - postal_state is handled via mail.notification._to_store_defaults
