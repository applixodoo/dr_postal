# -*- coding: utf-8 -*-

import json
import logging
from datetime import datetime

from odoo import http, SUPERUSER_ID
from odoo.http import request

_logger = logging.getLogger(__name__)


class PostalWebhookController(http.Controller):
    """Handle incoming webhooks from Postal mail server.
    
    Postal webhook documentation: https://docs.postalserver.io/developer/webhooks
    
    Event types and their payload structures:
    - MessageSent/MessageDelayed/MessageDeliveryFailed/MessageHeld: has "status" field
    - MessageBounced: has "original_message" and "bounce" objects
    - MessageLoaded (opened): has "ip_address" but no "status" or "url"
    - MessageLinkClicked: has "url" and "ip_address"
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

    def _detect_event_type(self, data):
        """
        Detect the event type based on payload structure.
        
        Based on https://docs.postalserver.io/developer/webhooks:
        - MessageBounced: has "original_message" and "bounce" keys
        - MessageLinkClicked: has "url" key
        - MessageLoaded (opened): has "ip_address" but no "url" or "status"
        - Message Status Events: has "status" key (Sent, Delayed, DeliveryFailed, Held)
        """
        _logger.info('Postal webhook: _detect_event_type called with keys: %s', list(data.keys()))
        
        # Check for bounce event (has special structure)
        if 'original_message' in data and 'bounce' in data:
            _logger.info('Postal webhook: Detected BOUNCE event')
            return 'bounced', data.get('original_message', {})
        
        # Check for click event
        if 'url' in data:
            _logger.info('Postal webhook: Detected CLICK event')
            return 'opened', data.get('message', {})
        
        # Check for open/loaded event (has ip_address but no status)
        if 'ip_address' in data and 'status' not in data:
            _logger.info('Postal webhook: Detected OPEN event')
            return 'opened', data.get('message', {})
        
        # Message status events (Sent, Delayed, DeliveryFailed, Held)
        status_raw = data.get('status')
        _logger.info('Postal webhook: Raw status value: %r (type: %s)', status_raw, type(status_raw).__name__)
        
        if status_raw:
            status = str(status_raw).lower().strip()
            _logger.info('Postal webhook: Normalized status: %r', status)
            
            status_mapping = {
                'sent': 'sent',
                'delayed': 'sent',
                'held': 'sent',
                'deliveryfailed': 'bounced',
                'hardfail': 'bounced',
                'softfail': 'bounced',
            }
            mapped = status_mapping.get(status)
            _logger.info('Postal webhook: Mapped status %r -> %r', status, mapped)
            
            if mapped:
                return mapped, data.get('message', {})
            else:
                _logger.warning('Postal webhook: Unknown status value: %s', status)
                return None, data.get('message', {})
        
        # Unknown event type
        _logger.warning('Postal webhook: No status field found, cannot determine event type')
        return None, data.get('message', {})

    def _process_postal_event(self, data):
        """Process a postal webhook event."""
        env = request.env(user=SUPERUSER_ID)
        
        # Log incoming payload for debugging
        _logger.info('Postal webhook: Received payload keys: %s', list(data.keys()))
        
        # Detect event type based on payload structure
        event_type, message_data = self._detect_event_type(data)
        
        if not event_type:
            _logger.warning('Postal webhook: Could not determine event type from payload')
            return {'status': 'ok', 'message': 'Unknown event type, ignored'}
        
        _logger.info('Postal webhook: Detected event type: %s', event_type)
        
        # Extract identifiers
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
        if event_type == 'bounced':
            if 'bounce' in data:
                # Bounce event has special structure
                bounce_info = data.get('bounce', {})
                error_message = f"Bounce from: {bounce_info.get('from', 'unknown')}\nSubject: {bounce_info.get('subject', 'N/A')}"
            else:
                error_message = data.get('details', '')
                if data.get('output'):
                    error_message += f"\n\nServer response: {data.get('output', '')}"
        
        # Find notification by message_id
        notification = self._find_notification(message_data, external_message_id)
        
        if not notification:
            _logger.info(
                'Postal webhook: No matching notification found for event %s (message_id: %s, to: %s)',
                event_type, external_message_id, recipient
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
            'Postal webhook: Processed %s event for %s (event_id: %s)',
            event_type, recipient, event_record.id
        )
        
        return {'status': 'ok', 'event_id': event_record.id}

    def _find_notification(self, message_data, external_message_id):
        """Find the mail.notification record matching the webhook data."""
        env = request.env(user=SUPERUSER_ID)
        Notification = env['mail.notification'].sudo()
        
        # Try to find by message_id in mail.message
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
