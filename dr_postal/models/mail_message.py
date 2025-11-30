# -*- coding: utf-8 -*-

from odoo import api, models


class MailMessage(models.Model):
    """Extend mail.message to include postal tracking data in frontend."""
    
    _inherit = 'mail.message'

    # Remove _to_store override for now - it's causing recursion issues
    # The postal_state field exists on mail.notification and can be read directly
    # UI will need to fetch this data separately or we'll find another approach
