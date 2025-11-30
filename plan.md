# Odoo v19 -- Postal Webhook Mail Tracking Module

> Working name: **`dr_postal`**

## 0. Goal & Scope

**Goal:**\
Build an Odoo module that:

1.  Receives **webhooks from a postal mail server** (bounce, delivered,
    opened/read).
2.  Links events to **Odoo mail.messages / notifications**
    (e.g. messages sent via Odoo mail / mass mailing).
3.  Adds **WhatsApp-style visual status ticks** on mail notifications:
    -   `✓` (1 grey tick) = **Sent**
    -   `✓✓` (2 grey ticks) = **Delivered**
    -   `✓✓` (2 blue ticks) = **Read/Open**
    -   `✕` (red cross) = **Bounced**
4.  When **bounced**, the related followers / author get a notification
    in **chatter**, identical to Odoo's default bounce notification.

------------------------------------------------------------------------

## 1. Assumptions

-   Odoo v19 mail system still has:
    -   `mail.message`
    -   `mail.notification`
    -   Outgoing email records (`mail.mail` or equivalent).
-   Postal server webhook payload includes:
    -   Event type
    -   Timestamp
    -   External message-id
    -   Custom metadata (optional, but recommended)
-   Outgoing email can include custom headers required for tracking.

------------------------------------------------------------------------

## 2. High-Level Architecture

-   **Module technical name**: `dr_postal`
-   **Backend components**:
    -   Python models
    -   Webhook controller
-   **Frontend components**:
    -   JS extension for message notification UI
    -   CSS styling
-   **Security & Settings**:
    -   Webhook secret stored in system settings

### Data Flow

1.  Odoo sends outgoing email → attaches tracking headers.
2.  Postal server processes email & emits webhook.
3.  Postal server sends webhook JSON → Odoo `/postal/webhook`.
4.  Odoo parses payload, identifies message/notification.
5.  State updated & event stored.
6.  UI shows new WhatsApp-style status.
7.  If bounced → chatter message created.

------------------------------------------------------------------------

## 3. Data Model Design

### 3.1 Model: `mail.postal.event`

Fields:

-   `name` -- summary or event label\
-   `event_type` -- selection: `sent`, `delivered`, `opened`, `bounced`\
-   `event_datetime` -- datetime\
-   `payload_json` -- raw JSON (text)\
-   `external_message_id` -- message-id or tracking uuid\
-   `message_id` -- Many2one `mail.message`\
-   `notification_id` -- Many2one `mail.notification`\
-   `state` -- computed or stored, final state

Purpose: Keep an event history for audit/debugging.

------------------------------------------------------------------------

### 3.2 Extend `mail.notification`

New fields:

-   `postal_state` (selection: `none`, `sent`, `delivered`, `opened`,
    `bounced`)\
-   `postal_tracking_uuid` (char)\
-   `postal_last_event_id` (Many2one → `mail.postal.event`)

Methods:

-   `_update_postal_state(event_type, values)`
    -   Updates state and stores event reference\
    -   Handles bounce logic (chatter)

------------------------------------------------------------------------

## 4. Webhook Endpoint Design

File: `controllers/webhook.py`

Route:

    POST /postal/webhook
    Content-Type: application/json

### Payload (example)

``` json
{
  "event": "bounced",
  "message_id": "abc123@example.com",
  "timestamp": "2025-01-01T12:00:00Z",
  "recipient": "john@example.com",
  "metadata": {
    "odoo_notification_id": 991,
    "odoo_message_id": 745
  },
  "error": "Mailbox full"
}
```

### Controller Steps

1.  Validate webhook secret header: `X-Postal-Token`.
2.  Parse JSON body.
3.  Extract external message-id or metadata.
4.  Resolve Odoo notification or message:
    -   Prefer by `metadata.odoo_notification_id`
    -   fallback: `postal_tracking_uuid`
5.  Create `mail.postal.event`.
6.  Update notification state (`sent`, `delivered`, `opened`,
    `bounced`).
7.  If bounced → create chatter message.

Response:

``` json
{ "status": "ok" }
```

------------------------------------------------------------------------

## 5. Linking Outgoing Emails to Postal Messages

Modify Odoo email sending pipeline:

Steps:

1.  Generate new `tracking_uuid = uuid4()`.
2.  Store `tracking_uuid` on `mail.notification`.
3.  Add headers to outgoing email:
    -   `X-Odoo-Tracking-UUID`
    -   `X-Odoo-Notification-Id`
    -   `X-Odoo-Message-Id`

These headers must survive through the postal server into the webhook
metadata.

------------------------------------------------------------------------

## 6. State Logic & Behavior

### States

  Event       UI          DB state
  ----------- ----------- -------------
  sent        ✓ (grey)    `sent`
  delivered   ✓✓ (grey)   `delivered`
  opened      ✓✓ (blue)   `opened`
  bounced     ✕ (red)     `bounced`

### State progression

    none → sent → delivered → opened
    any → bounced (terminal)

### Bounce effect

-   Create chatter message on related document:
    -   Model: `mail.message`
    -   Subtype: bounce or note
    -   Content: "Email to xxx bounced. Reason: ..."

Prevent duplicate bounce messages.

------------------------------------------------------------------------

## 7. UI -- WhatsApp-Style Notification Ticks

### JS Component

File: `static/src/js/mail_notification_tracking.js`

Extend Odoo mail notification rendering:

-   Add small status icons next to notification hover element.

-   Icons rendered as:

        ✓    (sent)
        ✓✓   (delivered)
        ✓✓   (opened, blue)
        ✕    (bounced, red)

### Tooltip mapping

-   "Sent"
-   "Delivered"
-   "Opened"
-   "Bounced (reason)"

### CSS

Add styles in:

`static/src/css/dr_postal.css`

Styles for:

-   `.dr_postal_sent`
-   `.dr_postal_delivered`
-   `.dr_postal_opened`
-   `.dr_postal_bounced`

------------------------------------------------------------------------

## 8. Security & Access Rights

### Webhook verification

Configuration setting:

-   `dr_postal_webhook_token`

Postal server sends header:

    X-Postal-Token: <token>

Reject mismatches with HTTP 403.

### Access rights

-   Admin/tech users: full access to `mail.postal.event`.
-   Regular users: no direct menu entry.
-   Events only visible indirectly through mail notifications.

------------------------------------------------------------------------

## 9. Settings Panel

Extend `res.config.settings`:

Fields:

-   `dr_postal_webhook_token`
-   Computed field showing webhook URL:
    -   `<your_odoo_base_url>/postal/webhook`

Add a button: *"Copy URL"*.

------------------------------------------------------------------------

## 10. Testing Strategy

### Automated Tests

-   Test state updates (sent → delivered → opened).
-   Test bounce → chatter message.
-   Test webhook authentication + parsing.
-   Test invalid event types.

### Manual Tests

1.  Send real email to test inbox.
2.  Trigger postal webhook manually.
3.  Validate:
    -   UI icons update.
    -   State stored.
    -   Bounce chatter message created.

------------------------------------------------------------------------

## 11. Implementation Order (Vibe Coding Checklist)

1.  **Module skeleton (`dr_postal`)**
2.  **Models**
    -   Create `mail.postal.event`
    -   Extend `mail.notification`
3.  **Outgoing mail patch**
4.  **Webhook controller**
5.  **State logic + bounce chatter**
6.  **UI (JS + CSS)**
7.  **Config settings**
8.  **Tests**
9.  **Cleanup + translations**

------------------------------------------------------------------------

## 12. Future Improvements

-   Per-recipient delivery state\
-   Delivery statistics dashboard\
-   Retry queue for failed webhooks\
-   Timeline view of message events\
-   Monitoring & analytics
