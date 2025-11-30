# -*- coding: utf-8 -*-

import json
import logging
from datetime import datetime

from odoo import http, SUPERUSER_ID
from odoo.http import request

_logger = logging.getLogger(__name__)


class PostalWebhookController(http.Controller):
    """Handle incoming webhooks from Postal mail server."""

    @http.route([
        '/postal/webhook',
        '/postal/webhook/<string:token>',
    ], type='http', auth='none', methods=['POST'], csrf=False)
    def postal_webhook(self, token=None, **kwargs):
        """
        Receive and process postal webhook events.
        
        Postal payload format:
        {
            "message": {
                "id": 7465,
                "token": "AP3dANR0LKoe8Gq5",
                "direction": "outgoing",
                "message_id": "961778370469068...@eupq08",
                "to": "recipient@example.com",
                "from": "sender@example.com",
                "subject": "Email Subject",
                "timestamp": 1764514825.368213
            },
            "status": "Sent",  // Sent, SoftFail, HardFail, Held, Bounced, etc.
            "details": "Message accepted by ...",
            "output": "250 2.0.0 OK ...",
            "timestamp": 1764514826.4674146
        }
        """
        # Get JSON data from request body
        try:
            data = json.loads(request.httprequest.data.decode('utf-8'))
        except Exception as e:
            _logger.error('Postal webhook: Failed to parse JSON: %s', e)
            return self._json_response({'status': 'error', 'message': 'Invalid JSON'}, 400)
        
        if not data:
            _logger.warning('Postal webhook: Empty payload received')
            return self._json_response({'status': 'error', 'message': 'Empty payload'}, 400)
        
        # Validate webhook token
        if not self._validate_webhook_token(token):
            _logger.warning('Postal webhook: Invalid or missing token')
            return self._json_response({'status': 'error', 'message': 'Unauthorized'}, 403)
        
        # Process the event
        try:
            result = self._process_postal_event(data)
            return self._json_response(result)
        except Exception as e:
            _logger.exception('Postal webhook: Error processing event: %s', e)
            return self._json_response({'status': 'error', 'message': str(e)}, 500)

    def _json_response(self, data, status=200):
        """Return a JSON response."""
        return request.make_response(
            json.dumps(data),
            headers=[('Content-Type', 'application/json')],
            status=status
        )

    def _validate_webhook_token(self, url_token=None):
        """Validate the token from URL or X-Postal-Token header."""
        # Get configured token
        env = request.env(user=SUPERUSER_ID)
        configured_token = env['ir.config_parameter'].sudo().get_param(
            'dr_postal.webhook_token', ''
        )
        
        # If no token configured, allow all (for development)
        if not configured_token:
            _logger.warning('Postal webhook: No token configured, allowing request')
            return True
        
        # Check URL token first (preferred method)
        if url_token and url_token == configured_token:
            return True
        
        # Fallback: check header
        header_token = request.httprequest.headers.get('X-Postal-Token', '')
        if header_token and header_token == configured_token:
            return True
        
        return False

    def _process_postal_event(self, data):
        """Process a postal webhook event."""
        env = request.env(user=SUPERUSER_ID)
        
        # Extract event status from Postal's format
        # Postal sends both "status" and "event" fields
        # "event" contains: MessageSent, MessageDelivered, MessageBounced, etc.
        # "status" contains: Sent, SoftFail, HardFail, Held, Bounced, etc.
        
        # Try "event" field first (more specific)
        event_status = data.get('event', '').lower().replace('_', '')
        
        # Fallback to "status" field
        if not event_status:
            event_status = data.get('status', '').lower()
        
        _logger.info('Postal webhook: Received event=%s, status=%s', 
                     data.get('event'), data.get('status'))
        
        # Map postal status to our states
        status_mapping = {
            # Postal status values
            'sent': 'sent',
            'softfail': 'bounced',
            'hardfail': 'bounced',
            'bounced': 'bounced',
            'held': 'sent',  # Treat held as sent for now
            'delivered': 'delivered',
            # Open tracking events
            'opened': 'opened',
            'open': 'opened',
            # Click events (treat as opened)
            'clicked': 'opened',
            'click': 'opened',
            # Legacy/alternative names
            'delivery': 'delivered',
            'bounce': 'bounced',
            # Postal event types (concatenated lowercase versions)
            'messagesent': 'sent',
            'messagedelivered': 'delivered',
            'messageopened': 'opened',
            'messagebounced': 'bounced',
            'messagedelayed': 'sent',
            'messageheldforsend': 'sent',
            'messagelinkclicked': 'opened',
            'messageloaded': 'opened',  # Image load = opened
        }
        
        mapped_event = status_mapping.get(event_status)
        if not mapped_event:
            _logger.warning('Postal webhook: Unknown status type: %s', event_status)
            return {'status': 'ok', 'message': f'Unknown event type: {event_status}, ignored'}
        
        # Extract message info from Postal's nested structure
        message_data = data.get('message', {})
        
        # Get identifiers
        external_message_id = message_data.get('message_id', '')
        recipient = message_data.get('to', '')
        
        # Get timestamp - Postal uses Unix timestamp
        timestamp = data.get('timestamp', 0)
        if timestamp:
            try:
                event_datetime = datetime.fromtimestamp(float(timestamp))
            except (ValueError, TypeError, OSError):
                event_datetime = datetime.now()
        else:
            event_datetime = datetime.now()
        
        # Build error message for failures
        error_message = ''
        if mapped_event == 'bounced':
            error_message = data.get('details', '')
            if data.get('output'):
                error_message += f"\n\nServer response: {data.get('output', '')}"
        
        # Find notification by message_id
        notification = self._find_notification(message_data, external_message_id)
        
        if not notification:
            _logger.info(
                'Postal webhook: No matching notification found for event %s (message_id: %s, to: %s)',
                mapped_event, external_message_id, recipient
            )
        
        # Create postal event record
        event_vals = {
            'event_type': mapped_event,
            'event_datetime': event_datetime,
            'payload_json': json.dumps(data, indent=2),
            'external_message_id': external_message_id,
            'recipient': recipient,
            'error_message': error_message,
            'postal_tracking_uuid': '',
        }
        
        if notification:
            event_vals['notification_id'] = notification.id
            event_vals['message_id'] = notification.mail_message_id.id if notification.mail_message_id else False
            if notification.postal_tracking_uuid:
                event_vals['postal_tracking_uuid'] = notification.postal_tracking_uuid
        
        event_record = env['mail.postal.event'].sudo().create(event_vals)
        
        # Update notification state
        if notification:
            notification.sudo()._update_postal_state(mapped_event, event_record)
        
        _logger.info(
            'Postal webhook: Processed %s event for %s (event_id: %s)',
            mapped_event, recipient, event_record.id
        )
        
        return {'status': 'ok', 'event_id': event_record.id}

    def _find_notification(self, message_data, external_message_id):
        """Find the mail.notification record matching the webhook data."""
        env = request.env(user=SUPERUSER_ID)
        Notification = env['mail.notification'].sudo()
        
        # Try to find by message_id in mail.message
        if external_message_id:
            # Search for mail.message with this message_id
            Message = env['mail.message'].sudo()
            message = Message.search([
                ('message_id', '=', external_message_id)
            ], limit=1)
            
            if message:
                # Find notification for this message
                notification = Notification.search([
                    ('mail_message_id', '=', message.id)
                ], limit=1)
                if notification:
                    return notification
            
            # Also try with angle brackets
            message = Message.search([
                ('message_id', '=', f'<{external_message_id}>')
            ], limit=1)
            
            if message:
                notification = Notification.search([
                    ('mail_message_id', '=', message.id)
                ], limit=1)
                if notification:
                    return notification
        
        # Try by tracking UUID if present
        tracking_uuid = message_data.get('odoo_tracking_uuid')
        if tracking_uuid:
            notification = Notification.search([
                ('postal_tracking_uuid', '=', tracking_uuid)
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
