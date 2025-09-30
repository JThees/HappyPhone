# DOM Selectors for HappyFox Ticket

## Contact Information
- `.git/DOM.md:499` → `div.hf-card_contact-info` wraps the contact card; its first `div.hf-card_content_contact-info-item` holds the contact name.
- `.git/DOM.md:518` → `a.hf-card_content_readonly-info_link` contains the phone/email link text; pair with the preceding icon span to distinguish phone vs. email.
- `.git/DOM.md:521` → `div.hf-custom-field_label-container` + sibling `p.hf-custom-field_value` expose the “PreferedContactMethod” custom field (HappyFox typo).

## Ticket Information
- `.git/DOM.md:536`, `.git/DOM.md:543` → Same label/value pattern for “County” and “Legal Issue”; grab `label.hf-custom-field_label` and its following `p.hf-custom-field_value`.

## Tasks / Tags / Time
- `.git/DOM.md:552` → `header.hf-js-tasks-header`; empty-state text lives at `.git/DOM.md:562` inside `div.hf-card_content_readonly-info.hf-mod-empty-message`.
- `.git/DOM.md:567` → `h3.hf-card_header_title` for “Tags”; chips sit under `.git/DOM.md:571` (`div.hf-tags-container` with `span.hf-card_items-list_item`). The add button is `.git/DOM.md:573` (`span.hf-card_items-list_add-item`).
- `.git/DOM.md:575`, `.git/DOM.md:577` → `h3.hf-card_header_title` for “Time Spent”; the “Add” action is `.git/DOM.md:578` (`div.hf-pop-over-container`). The current total follows in the card body.

## Reusable Patterns
- `.git/DOM.md:476–481` → `div.hf-details-side-pane_search` + `span.ember-power-select-placeholder` for the custom-field search box.
- Any card: `section.hf-card` with `header`/`div.hf-card_content`; match the `h3` text to find the right card.
- For required custom fields, rely on `hf-custom-field_label-container` + `hf-custom-field_value`.

## Minimized Composer (Image 1)
- `.git/DOM.md:463` → `div.hf-floating-editor_minimized-view_links-container` houses the collapsed links.
- `.git/DOM.md:464–467` → `a.hf-floating-editor_links` (Reply) + `span.hf-u-vertical-middle`.
- `.git/DOM.md:468–473` → `a.hf-floating-editor_links:nth-of-type(2)` (Private Note) + `span.hf-u-vertical-middle`.

## Private Note Editor (Image 2)

### Container & Header
- `.git/MessageEntry.md:3675` → `div.hf-floating-editor_expanded.hf-pm-editor-wrapper`.
- `.git/MessageEntry.md:3691`, `3731` → `div.hf-floating-editor_toggle_header` with `span.hf-alert-to-value`.
- `.git/MessageEntry.md:3763` → `div.hf-floating-editor_top-menu` (Quote Reply menu).
- `.git/MessageEntry.md:3779` → `div.hf-timer-wrap.hf-is-inactive.hf-started` (timer widget).
- `.git/MessageEntry.md:3811` → `button.hf-pm-editor-expand`.

### Toolbar
- `.git/MessageEntry.md:3995` → `span.hf-floating-editor_toolbar-menu.hf-canned-action-label`.
- `.git/MessageEntry.md:4061` → `span.hf-floating-editor_toolbar-menu.hf-insert-kb-label`.
- `.git/MessageEntry.md:4402–4482` and onward → `span.ProseMirror-menuitem` with icons such as `div.ProseMirror-icon.bold-menu`, `italic-menu`, etc., under `div.ProseMirror-menubar`.

### Editor Body
- `.git/MessageEntry.md:4111` → `div.hf-floating-editor_editor-pane.hf-private-note-editor`.
- `.git/MessageEntry.md:5655` → `div.ProseMirror.ProseMirror-example-setup-style` (editable surface).
- `.git/MessageEntry.md:5674` → `div.ProseMirror-trailingBreak`.

### Ticket-Property Strip (above the primary button)
- `.git/MessageEntry.md:5695` → `div.hf-floating-editor_ticket-actions.hf-ticket-box_actions-row`.
- `.git/MessageEntry.md:5783` → `span.hf-floating-editor_status.hf-ticket-box_actions-row_element:nth-of-type(2)` (“status Open”).
- `.git/MessageEntry.md:5831` → `span.hf-floating-editor_priority…(nth-of-type(3))`.
- `.git/MessageEntry.md:5879` → `span.hf-floating-editor_assignee…(nth-of-type(4))`.
- `.git/MessageEntry.md:6007–6016` → `span.hf-mod-due-date-box:nth-of-type(5)` with children inside `div.hf-due-date-container`.
- `.git/MessageEntry.md:6047–6056` → `div.hf-floating-editor_time-spent.hf-floating-editor_ticket-properties`.
- `.git/MessageEntry.md:6063` → `span.hf-floating-editor_tags-container`.
- `.git/MessageEntry.md:6103`, `6143` → `span.hf-mod-call-note` + `label.hf-toggle_button` (Call Note toggle).

### Action Footer
- `.git/MessageEntry.md:763` → `div.hf-floating-editor_footer`.
- `.git/MessageEntry.md:6167` → `button#ember416.hf-primary-action` (“Add Private Note”).
- `.git/MessageEntry.md:767–772` → Draft indicator, trash icon, and reset link (`span.hf-floating-editor_draft-indicator`, etc.).

Once you’re ready to commit, replace the file contents with this version (workspace is read-only for me, so I can’t patch directly).
