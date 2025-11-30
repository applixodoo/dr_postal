# -*- coding: utf-8 -*-

import json
import logging
from datetime import datetime

from odoo import http, SUPERUSER_ID
from odoo.http import request

_logger = logging.getLogger(__name__)


class PostalWebhookController(http.Controller):
    """Handle incoming webhooks from Postal mail server.
    
    Postal webhook structure:
    {
        "event": "MessageSent",  // Event type
        "timestamp": 1764515384.93,
        "uuid": "...",
        "payload": {
            // Actual event data here
            "status": "Sent",
            "message": {...},
            ...
        }
    }
    """

    @http.route([
        '/postal/webhook',
        '/postal/webhook/<string:token>',
    ], type='http', auth='none', methods=['POST'], csrf=False)
    def postal_webhook(self, token=None, **kwargs):
        """Receive and process postal webhook events."""
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
        env = request.env(user=SUPERUSER_ID)
        configured_token = env['ir.config_parameter'].sudo().get_param(
            'dr_postal.webhook_token', ''
        )
        
        if not configured_token:
            _logger.warning('Postal webhook: No token configured, allowing request')
            return True
        
        if url_token and url_token == configured_token:
            return True
        
        header_token = request.httprequest.headers.get('X-Postal-Token', '')
        if header_token and header_token == configured_token:
            return True
        
        return False

    def _process_postal_event(self, data):
        """Process a postal webhook event."""
        env = request.env(user=SUPERUSER_ID)
        
        # Postal wraps events: {event, timestamp, uuid, payload}
        event_name = data.get('event', '')
        payload = data.get('payload', {})
        
        _logger.info('Postal webhook: Event=%s, Payload keys=%s', event_name, list(payload.keys()) if payload else 'None')
        
        # Map Postal event names to our states
        event_mapping = {
            'MessageSent': 'sent',
            'MessageDelayed': 'sent',
            'MessageDeliveryFailed': 'bounced',
            'MessageHeld': 'sent',
            'MessageBounced': 'bounced',
            'MessageLinkClicked': 'opened',
            'MessageLoaded': 'opened',
        }
        
        event_type = event_mapping.get(event_name)
        
        if not event_type:
            _logger.warning('Postal webhook: Unknown event name: %s', event_name)
            return {'status': 'ok', 'message': f'Unknown event: {event_name}, ignored'}
        
        _logger.info('Postal webhook: Mapped %s -> %s', event_name, event_type)
        
        # Extract message data from payload
        # For most events, message info is in payload.message
        # For bounce events, it's in payload.original_message
        if event_name == 'MessageBounced':
            message_data = payload.get('original_message', {})
        else:
            message_data = payload.get('message', {})
        
        # Extract identifiers
        external_message_id = message_data.get('message_id', '')
        recipient = message_data.get('to', '')
        
        # Get timestamp
        timestamp = data.get('timestamp') or payload.get('timestamp', 0)
        if timestamp:
            try:
                event_datetime = datetime.fromtimestamp(float(timestamp))
            except (ValueError, TypeError, OSError):
                event_datetime = datetime.now()
        else:
            event_datetime = datetime.now()
        
        # Build error message for failures
        error_message = ''
        if event_type == 'bounced':
            if event_name == 'MessageBounced':
                bounce_info = payload.get('bounce', {})
                error_message = f"Bounce from: {bounce_info.get('from', 'unknown')}\nSubject: {bounce_info.get('subject', 'N/A')}"
            else:
                error_message = payload.get('details', '')
                if payload.get('output'):
                    error_message += f"\n\nServer response: {payload.get('output', '')}"
        
        # Find notification
        notification = self._find_notification(message_data, external_message_id)
        
        if not notification:
            _logger.info(
                'Postal webhook: No matching notification found (message_id: %s, to: %s)',
                external_message_id, recipient
            )
        
        # Create postal event record
        event_vals = {
            'event_type': event_type,
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
            notification.sudo()._update_postal_state(event_type, event_record)
        
        _logger.info(
            'Postal webhook: Created event %s for %s (id: %s)',
            event_type, recipient, event_record.id
        )
        
        return {'status': 'ok', 'event_id': event_record.id}

    def _find_notification(self, message_data, external_message_id):
        """Find the mail.notification record matching the webhook data."""
        env = request.env(user=SUPERUSER_ID)
        Notification = env['mail.notification'].sudo()
        
        if external_message_id:
            Message = env['mail.message'].sudo()
            
            # Search for mail.message with this message_id
            message = Message.search([
                ('message_id', '=', external_message_id)
            ], limit=1)
            
            if message:
                notification = Notification.search([
                    ('mail_message_id', '=', message.id)
                ], limit=1)
                if notification:
                    return notification
            
            # Try with angle brackets
            message = Message.search([
                ('message_id', '=', f'<{external_message_id}>')
            ], limit=1)
            
            if message:
                notification = Notification.search([
                    ('mail_message_id', '=', message.id)
                ], limit=1)
                if notification:
                    return notification
        
        # Try by tracking UUID
        tracking_uuid = message_data.get('odoo_tracking_uuid')
        if tracking_uuid:
            notification = Notification.search([
                ('postal_tracking_uuid', '=', tracking_uuid)
            ], limit=1)
            if notification:
                return notification
        
        return None
