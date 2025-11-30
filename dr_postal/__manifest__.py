# -*- coding: utf-8 -*-
{
    'name': 'Postal Mail Tracking',
    'version': '19.0.1.0.0',
    'category': 'Discuss',
    'summary': 'Track email delivery status via Postal webhooks with WhatsApp-style ticks',
    'description': """
Postal Webhook Mail Tracking Module
===================================

This module integrates Odoo with Postal mail server webhooks to provide:

* **Real-time tracking**: Sent, Delivered, Opened, and Bounced status
* **WhatsApp-style visual indicators**: 
    - ✓ (grey) = Sent
    - ✓✓ (grey) = Delivered  
    - ✓✓ (blue) = Read/Opened
    - ✕ (red) = Bounced
* **Resend failed emails**: Dialog to retry or ignore bounced emails
* **Event audit log**: Full history of postal events for debugging

Configuration
-------------
1. Go to Settings → Discuss → Postal Tracking
2. Set your webhook token
3. Configure Postal to send webhooks to: {your_odoo_url}/postal/webhook
    """,
    'author': 'Applixodoo',
    'website': 'https://github.com/applixodoo/dr_postal',
    'license': 'LGPL-3',
    'depends': [
        'mail',
    ],
    'data': [
        'security/ir.model.access.csv',
        'wizard/mail_resend_message_views.xml',
        'views/res_config_settings_views.xml',
        'views/mail_postal_event_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'dr_postal/static/src/css/dr_postal.css',
            'dr_postal/static/src/js/**/*',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
}
