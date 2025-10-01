# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HappyPhone Assistant is a Chrome extension (Manifest V3) that helps support agents manage HappyFox tickets during phone calls. It pulls contact/ticket data, provides a note editor, tracks the last five call summaries, and auto-fills HappyFox forms.

**Current Status**: UI scaffolded with demo data. Need to implement service worker, content script, storage, and messaging between components.

## Architecture

### Component Structure

```
popup.html/css/js → User interface (editor, contact/ticket cards, call history)
service-worker.js → Background orchestrator (storage, API, messaging hub)
content.js → HappyFox page controller (DOM manipulation, note injection)
manifest.json → Extension configuration (Manifest V3)
```

### Data Flow

1. **Popup opens** → requests bootstrap data from service worker
2. **Service worker** → returns cached contact/ticket/history from chrome.storage.local
3. **User edits note** → clicks "Add to Ticket"
4. **Popup** → sends `log-call` message to service worker, then `insert-note` to content script
5. **Content script** → injects note into HappyFox ProseMirror editor using documented selectors
6. **Service worker** → updates storage, broadcasts `history-updated` to all popups

### Files

**Core Extension Files**:
- `manifest.json` - Manifest V3 configuration
- `service-worker.js` - Background service worker (storage, API, message hub)
- `content.js` - Content script for HappyFox page manipulation
- `popup.html` - Main UI structure
- `popup.css` - UI styling
- `popup.js` - Popup logic and messaging

**Documentation**:
- `DOM Selectors for HappyFox Ticket.md` - **Primary selector reference** for content script
- `DOM.md`, `MessageEntry.md` - Full DOM dumps (370KB, 500KB) used to derive selectors
- `DOMSelectorsHappyFox.md` - Duplicate, can be removed

**Reference**:
- `HF Better Inserter V1.5.1 Final.zip` - Old Manifest V3 extension for reference (options page, storage patterns)

## Implementation Guide

### 1. Manifest Configuration (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "HappyPhone Assistant",
  "version": "0.1.0",
  "permissions": ["storage", "activeTab", "scripting"],
  "host_permissions": ["https://*.happyfox.com/*"],
  "background": {
    "service_worker": "service-worker.js"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [{
    "matches": ["https://*.happyfox.com/*"],
    "js": ["content.js"]
  }]
}
```

### 2. Service Worker (service-worker.js)

**Responsibilities**:
- Handle `chrome.runtime.onMessage` for:
  - `get-bootstrap-data`: Return {contact, ticket, history} from storage
  - `log-call`: Add timestamped entry to callHistory array (max 5), save to storage, broadcast `history-updated`
  - `sync-internal-note-toggle`: Forward to active tab via `chrome.tabs.sendMessage`
  - `insert-note` (future): Send note payload to content script
- Provide `notifyContentScript` helper for tab messaging
- Future: `fetchHappyFoxData` for API integration

### 3. Popup Logic (popup.js)

**Changes needed**:
- Add `init()` on `DOMContentLoaded`:
  - Request bootstrap: `await chrome.runtime.sendMessage({ type: 'get-bootstrap-data' })`
  - Render contact/ticket/history with existing functions
- Listen for `chrome.runtime.onMessage` to handle `history-updated`, `ticket-updated`, `contact-updated`
- "Previous Calls" button: load from storage or request from service worker
- "Add to Ticket" button: send `log-call` with `{ note, internal, summary }`, then `insert-note` message
- Remove demo data arrays (lines 13-28) once bootstrap works

### 4. Content Script (content.js)

**Message handlers**:
- `set-internal-note`: Toggle HappyFox Private Note mode using selectors from `MessageEntry.md:6103,6143` (`label.hf-toggle_button` inside `span.hf-mod-call-note`)
- `insert-note`:
  - Select ProseMirror editor: `div.ProseMirror.ProseMirror-example-setup-style` (MessageEntry.md:5655)
  - Focus and insert text (use `document.execCommand` or modern contenteditable API)
  - Verify internal note state before insertion

### 5. Storage Contract

**chrome.storage.local schema**:
```javascript
{
  contact: {
    name: string,
    email: string,
    phone: string,
    preferredContactMethod: string
  },
  ticket: {
    county: string,
    legalIssue: string
    // + future dynamic fields
  },
  callHistory: [
    {
      timestamp: number,
      summary: string,
      user: string,
      note: string,
      internal: boolean
    }
  ] // max 5 entries
}
```

After storage updates, service worker broadcasts changes to open popups via `chrome.runtime.sendMessage`.

## Critical DOM Selectors (from DOM Selectors for HappyFox Ticket.md)

### Contact Information
- Container: `div.hf-card_contact-info`
- Phone/email links: `a.hf-card_content_readonly-info_link`
- Preferred contact method: `div.hf-custom-field_label-container` + `p.hf-custom-field_value`

### Ticket Custom Fields
- Pattern: `label.hf-custom-field_label` + `p.hf-custom-field_value`
- County, Legal Issue use this pattern

### Private Note Editor
- Container: `div.hf-floating-editor_expanded.hf-pm-editor-wrapper`
- ProseMirror editor: `div.ProseMirror.ProseMirror-example-setup-style` (MessageEntry.md:5655)
- Internal note toggle: `span.hf-mod-call-note` → `label.hf-toggle_button` (MessageEntry.md:6103,6143)
- Add button: `button#ember416.hf-primary-action` (may have dynamic ID)

### Minimized Composer
- Container: `div.hf-floating-editor_minimized-view_links-container`
- Reply link: `a.hf-floating-editor_links`
- Private Note link: `a.hf-floating-editor_links:nth-of-type(2)`

## Testing Workflow

1. Load unpacked extension in Chrome (`chrome://extensions/`)
2. Open popup → verify cached data loads (or empty states)
3. Toggle "Ticket Information" header → verify collapse
4. Click "Previous Calls" → modal shows; add note → verify entry persists after reopen
5. Toggle "Internal Note" → verify content script receives message (check console)
6. On HappyFox page: verify note injection works with correct selectors
7. After API integration: verify data refresh

## Future Enhancements

- **API Integration**: Fetch contact/ticket data from HappyFox API
- **Options Page**: Store API key/domain (reference old extension for patterns)
- **Dynamic Legal Issues**: Service worker resolves dependencies (checkboxes, dropdowns)
- **Ticket Properties**: Auto-populate status, priority, assignee, tags from HappyFox

## Development Notes

- No build system - plain HTML/CSS/JS with ES6 modules
- Version in popup.html:15 currently shows "v1.5.1" (update to match manifest)
- Demo data in popup.js:13-28 should be removed after bootstrap implementation
- Internal note toggle defaults to checked (popup.html:65)
- Call history display limited to 5 most recent (popup.js:75)
- Use `chrome.tabs.sendMessage` for popup → content communication via service worker
- HappyFox uses ProseMirror editor - test insertion methods carefully
- Some element IDs are Ember-generated (e.g., `ember416`) - use more stable selectors when possible
