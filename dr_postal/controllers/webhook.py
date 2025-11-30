# -*- coding: utf-8 -*-

import json
import logging
from datetime import datetime

from odoo import http, SUPERUSER_ID
from odoo.http import request

_logger = logging.getLogger(__name__)


class PostalWebhookController(http.Controller):
    """Handle incoming webhooks from Postal mail server."""

    @http.route('/postal/webhook', type='jsonrpc', auth='none', methods=['POST'], csrf=False)
    def postal_webhook(self, **kwargs):
        """
        Receive and process postal webhook events.
        
        Expected payload format:
        {
            "event": "bounced|delivered|opened|sent",
            "message_id": "abc123@example.com",
            "timestamp": "2025-01-01T12:00:00Z",
            "recipient": "john@example.com",
            "metadata": {
                "odoo_notification_id": 991,
                "odoo_message_id": 745,
                "odoo_tracking_uuid": "uuid-string"
            },
            "error": "Mailbox full"  // only for bounced
        }
        """
        # Get JSON data
        try:
            data = request.get_json_data()
        except Exception as e:
            _logger.error('Postal webhook: Failed to parse JSON: %s', e)
            return {'status': 'error', 'message': 'Invalid JSON'}
        
        if not data:
            _logger.warning('Postal webhook: Empty payload received')
            return {'status': 'error', 'message': 'Empty payload'}
        
        # Validate webhook token
        if not self._validate_webhook_token():
            _logger.warning('Postal webhook: Invalid or missing token')
            return {'status': 'error', 'message': 'Unauthorized'}
        
        # Process the event
        try:
            result = self._process_postal_event(data)
            return result
        except Exception as e:
            _logger.exception('Postal webhook: Error processing event: %s', e)
            return {'status': 'error', 'message': str(e)}

    def _validate_webhook_token(self):
        """Validate the X-Postal-Token header against configured token."""
        # Get configured token
        env = request.env(user=SUPERUSER_ID)
        configured_token = env['ir.config_parameter'].sudo().get_param(
            'dr_postal.webhook_token', ''
        )
        
        # If no token configured, allow all (for development)
        if not configured_token:
            _logger.warning('Postal webhook: No token configured, allowing request')
            return True
        
        # Check header
        received_token = request.httprequest.headers.get('X-Postal-Token', '')
        
        return received_token == configured_token

    def _process_postal_event(self, data):
        """Process a postal webhook event."""
        env = request.env(user=SUPERUSER_ID)
        
        # Extract event data
        event_type = data.get('event', '').lower()
        
        # Map postal event types to our states
        event_mapping = {
            'sent': 'sent',
            'delivered': 'delivered',
            'opened': 'opened',
            'bounced': 'bounced',
            'bounce': 'bounced',  # Alternative naming
            'open': 'opened',      # Alternative naming
            'delivery': 'delivered',  # Alternative naming
        }
        
        mapped_event = event_mapping.get(event_type)
        if not mapped_event:
            _logger.warning('Postal webhook: Unknown event type: %s', event_type)
            return {'status': 'ok', 'message': 'Unknown event type, ignored'}
        
        # Extract identifiers
        external_message_id = data.get('message_id', '')
        recipient = data.get('recipient', '')
        timestamp = data.get('timestamp', '')
        error_message = data.get('error', '')
        metadata = data.get('metadata', {}) or {}
        
        # Parse timestamp
        event_datetime = self._parse_timestamp(timestamp)
        
        # Find notification
        notification = self._find_notification(metadata, external_message_id)
        
        if not notification:
            _logger.info(
                'Postal webhook: No matching notification found for event %s (message_id: %s)',
                mapped_event, external_message_id
            )
            # Still create event for audit even without notification match
        
        # Create postal event record
        event_vals = {
            'event_type': mapped_event,
            'event_datetime': event_datetime,
            'payload_json': json.dumps(data, indent=2),
            'external_message_id': external_message_id,
            'recipient': recipient,
            'error_message': error_message,
            'postal_tracking_uuid': metadata.get('odoo_tracking_uuid', ''),
        }
        
        if notification:
            event_vals['notification_id'] = notification.id
            event_vals['message_id'] = notification.mail_message_id.id if notification.mail_message_id else False
        
        event_record = env['mail.postal.event'].sudo().create(event_vals)
        
        # Update notification state
        if notification:
            notification.sudo()._update_postal_state(mapped_event, event_record)
        
        _logger.info(
            'Postal webhook: Processed %s event for %s (event_id: %s)',
            mapped_event, recipient, event_record.id
        )
        
        return {'status': 'ok', 'event_id': event_record.id}

    def _find_notification(self, metadata, external_message_id):
        """Find the mail.notification record matching the webhook data."""
        env = request.env(user=SUPERUSER_ID)
        Notification = env['mail.notification'].sudo()
        
        # Try by notification ID from metadata (most reliable)
        notification_id = metadata.get('odoo_notification_id')
        if notification_id:
            notification = Notification.browse(int(notification_id))
            if notification.exists():
                return notification
        
        # Try by tracking UUID from metadata
        tracking_uuid = metadata.get('odoo_tracking_uuid')
        if tracking_uuid:
            notification = Notification.search([
                ('postal_tracking_uuid', '=', tracking_uuid)
            ], limit=1)
            if notification:
                return notification
        
        # Try by message ID from metadata
        message_id = metadata.get('odoo_message_id')
        if message_id:
            notification = Notification.search([
                ('mail_message_id', '=', int(message_id))
            ], limit=1)
            if notification:
                return notification
        
        return None

    def _parse_timestamp(self, timestamp_str):
        """Parse ISO timestamp string to datetime."""
        if not timestamp_str:
            return datetime.now()
        
        try:
            # Handle ISO format with Z suffix
            if timestamp_str.endswith('Z'):
                timestamp_str = timestamp_str[:-1] + '+00:00'
            return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            _logger.warning('Postal webhook: Failed to parse timestamp: %s', timestamp_str)
            return datetime.now()

