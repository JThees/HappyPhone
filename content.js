// Content Script for HappyPhone Assistant
// Runs on HappyFox pages to read ticket data and inject notes

console.log('HappyPhone Assistant content script loaded');

// Listen for messages from service worker and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case 'get-ticket-data':
      handleGetTicketData(sendResponse);
      return true; // Async response

    case 'set-internal-note':
      handleSetInternalNote(payload, sendResponse);
      return true;

    case 'insert-note':
      handleInsertNote(payload, sendResponse);
      return true;

    case 'fill-contact-fields':
      handleFillContactFields(payload, sendResponse);
      return true;

    case 'fill-ticket-fields':
      handleFillTicketFields(payload, sendResponse);
      return true;

    default:
      console.warn('Unknown message type:', type);
  }
});

// Extract ticket data from HappyFox page
function handleGetTicketData(sendResponse) {
  try {
    const ticketData = {
      contact: extractContactInfo(),
      ticket: extractTicketInfo(),
      ticketMeta: extractTicketMeta()
    };

    sendResponse({ success: true, data: ticketData });
  } catch (error) {
    console.error('Error extracting ticket data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Extract contact information from HappyFox
function extractContactInfo() {
  console.log('🔍 Extracting contact info from HappyFox...');

  const contact = {
    name: '',
    email: '',
    phone: '',
    preferredContactMethod: { email: false, sms: false }
  };

  // Find contact card
  const contactCard = document.querySelector('div.hf-card_contact-info');
  if (!contactCard) {
    console.warn('⚠️ Contact card not found (div.hf-card_contact-info)');
    return contact;
  }

  console.log('✅ Found contact card');

  // Extract name (first contact info item)
  const nameElement = contactCard.querySelector('div.hf-card_content_contact-info-item');
  if (nameElement) {
    contact.name = nameElement.textContent.trim();
    console.log('📝 Name:', contact.name);
  }

  // Extract phone/email from links
  const contactLinks = contactCard.querySelectorAll('a.hf-card_content_readonly-info_link');
  console.log(`📞 Found ${contactLinks.length} contact links`);

  contactLinks.forEach((link, index) => {
    const text = link.textContent.trim();
    const href = link.getAttribute('href') || '';
    console.log(`🔗 Link ${index + 1}: text="${text}", href="${href}"`);

    if (href.startsWith('tel:') || text.match(/^\+?\d{7,}/)) {
      contact.phone = text;
      console.log('📞 Phone:', contact.phone);
    } else if (href.startsWith('mailto:')) {
      // Extract email from mailto: link
      contact.email = href.replace('mailto:', '');
      console.log('📧 Email (from mailto):', contact.email);
    } else if (text.includes('@')) {
      // Text contains @ symbol, likely an email
      contact.email = text;
      console.log('📧 Email (from text):', contact.email);
    }
    // Skip internal links like /staff/contact/64
  });

  // Also check for email in non-link contact info items
  if (!contact.email) {
    const contactInfoItems = contactCard.querySelectorAll('div.hf-card_content_contact-info-item');
    console.log(`📋 Found ${contactInfoItems.length} contact info items`);

    contactInfoItems.forEach((item, index) => {
      const spans = item.querySelectorAll('span');
      spans.forEach(span => {
        const text = span.textContent.trim();
        if (text.includes('@') && !contact.email) {
          contact.email = text;
          console.log(`📧 Email (from contact-info-item span): ${contact.email}`);
        }
      });
    });
  }

  // Extract preferred contact method
  const customFields = document.querySelectorAll('div.hf-custom-field_label-container');
  customFields.forEach(labelContainer => {
    const label = labelContainer.textContent.trim().toLowerCase();
    if (label.includes('prefered') || label.includes('preferred')) {
      const valueElement = labelContainer.nextElementSibling;
      if (valueElement && valueElement.classList.contains('hf-custom-field_value')) {
        const value = valueElement.textContent.trim().toLowerCase();
        contact.preferredContactMethod.email = value.includes('email');
        contact.preferredContactMethod.sms = value.includes('sms') || value.includes('text');
        console.log('✉️ Preferred contact method:', value);
      }
    }
  });

  console.log('✅ Contact extraction complete:', contact);
  return contact;
}

// Extract ticket information from HappyFox
function extractTicketInfo() {
  console.log('🎫 Extracting ticket info from HappyFox...');

  const ticket = {
    county: '',
    legalIssue: '',
    checkboxes: {}
  };

  // Find all custom field labels and their values
  const customFields = document.querySelectorAll('label.hf-custom-field_label');
  console.log(`📋 Found ${customFields.length} custom fields`);

  customFields.forEach(label => {
    const labelText = label.textContent.trim().toLowerCase();
    const testId = label.getAttribute('data-test-id');
    console.log(`🏷️ Field: "${labelText}" (test-id: ${testId})`);

    // Find the value element - try multiple approaches
    let valueElement = label.parentElement?.querySelector('p.hf-custom-field_value');

    // If not found, try looking in the next sibling container
    if (!valueElement) {
      const container = label.closest('div.hf-custom-field_label-container');
      if (container && container.nextElementSibling) {
        valueElement = container.nextElementSibling.querySelector('p.hf-custom-field_value');
      }
    }

    // If still not found, try direct next sibling
    if (!valueElement && label.parentElement) {
      const nextDiv = label.parentElement.nextElementSibling;
      if (nextDiv && nextDiv.classList.contains('hf-custom-field_value')) {
        valueElement = nextDiv;
      } else if (nextDiv) {
        valueElement = nextDiv.querySelector('p.hf-custom-field_value');
      }
    }

    if (valueElement) {
      let value = valueElement.textContent.trim();

      // Treat "-" as empty
      if (value === '-') {
        value = '';
      }

      console.log(`   Value: "${value}"`);

      if (labelText.includes('county')) {
        ticket.county = value;
        console.log('🏛️ County:', ticket.county || '(empty)');
      } else if (labelText === 'legal issue') {
        // Exact match for "Legal Issue" to avoid confusion with sub-issue fields
        ticket.legalIssue = value;
        console.log('⚖️ Legal Issue:', ticket.legalIssue || '(empty)');
      } else if (labelText.includes('issue') && value) {
        // This might be a sub-issue field (checkboxes)
        // Handle multi-select values (comma-separated)
        const values = value.split(',').map(v => v.trim()).filter(v => v);
        values.forEach(v => {
          ticket.checkboxes[v] = true;
        });
        console.log('☑️ Checkbox values:', values);
      }
    } else {
      console.log('   ⚠️ No value element found');
      // Debug: log the parent structure
      console.log('   🔍 Parent element:', label.parentElement);
      console.log('   🔍 Label container:', label.closest('div.hf-custom-field_label-container'));
    }
  });

  console.log('✅ Ticket extraction complete:', ticket);
  return ticket;
}

// Extract ticket metadata (number, title, etc.)
function extractTicketMeta() {
  console.log('🏷️ Extracting ticket metadata...');

  const meta = {
    number: '',
    title: '',
    status: ''
  };

  // Extract from page title if possible
  const pageTitle = document.title;
  console.log('📄 Page title:', pageTitle);

  // Pattern: "Matter: Title - #NUMBER - Domain"
  const titleMatch = pageTitle.match(/Matter:\s*(.+?)\s*-\s*#(\w+)/);
  if (titleMatch) {
    meta.title = titleMatch[1].trim();
    meta.number = '#' + titleMatch[2];
    console.log('🎟️ Ticket Number from title:', meta.number);
    console.log('📰 Ticket Title from title:', meta.title);
  }

  // Fallback: Try selectors if not found in title
  if (!meta.number) {
    const numberSelectors = [
      '.hf-ticket-number',
      '[class*="ticket-id"]',
      '[class*="ticket-number"]',
      'span[class*="ticket"]'
    ];

    for (const selector of numberSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim() && element.textContent.trim() !== '+') {
        meta.number = element.textContent.trim();
        console.log('🎟️ Ticket Number from selector:', meta.number);
        break;
      }
    }
  }

  if (!meta.title) {
    const titleSelectors = [
      'h1.hf-ticket-title',
      '.hf-ticket-subject',
      'h1[class*="ticket"]',
      '.hf-ticket-header h1'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        meta.title = element.textContent.trim();
        console.log('📰 Ticket Title from selector:', meta.title);
        break;
      }
    }
  }

  // Try to find status
  const statusElement = document.querySelector('[class*="status"]');
  if (statusElement) {
    meta.status = statusElement.textContent.trim();
    console.log('📊 Status:', meta.status);
  }

  console.log('✅ Ticket metadata extraction complete:', meta);
  return meta;
}

// Toggle internal note mode in HappyFox
function handleSetInternalNote(payload, sendResponse) {
  try {
    const { internal } = payload;

    // Find the call note toggle
    // Reference: MessageEntry.md:6103,6143 - span.hf-mod-call-note → label.hf-toggle_button
    const callNoteContainer = document.querySelector('span.hf-mod-call-note');
    if (!callNoteContainer) {
      sendResponse({ success: false, error: 'Call note toggle not found' });
      return;
    }

    const toggleButton = callNoteContainer.querySelector('label.hf-toggle_button');
    if (!toggleButton) {
      sendResponse({ success: false, error: 'Toggle button not found' });
      return;
    }

    const checkbox = toggleButton.querySelector('input[type="checkbox"]');
    if (!checkbox) {
      sendResponse({ success: false, error: 'Toggle checkbox not found' });
      return;
    }

    // Set checkbox state to match internal flag
    if (checkbox.checked !== internal) {
      checkbox.click();
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('Error setting internal note:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Insert note into HappyFox editor
function handleInsertNote(payload, sendResponse) {
  try {
    const { note, internal } = payload;

    // First ensure we're in the right mode (internal vs public)
    handleSetInternalNote({ internal }, () => {});

    // Find the ProseMirror editor
    // Reference: MessageEntry.md:5655 - div.ProseMirror.ProseMirror-example-setup-style
    const editor = document.querySelector('div.ProseMirror.ProseMirror-example-setup-style');
    if (!editor) {
      sendResponse({ success: false, error: 'ProseMirror editor not found' });
      return;
    }

    // Focus the editor
    editor.focus();

    // Insert text using multiple approaches for compatibility
    // Try modern approach first
    if (editor.isContentEditable) {
      // Clear existing content and insert new text
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);

      // Insert text
      document.execCommand('insertText', false, note);
    } else {
      // Fallback: directly set content
      editor.textContent = note;

      // Trigger input event to notify ProseMirror
      const inputEvent = new Event('input', { bubbles: true });
      editor.dispatchEvent(inputEvent);
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error('Error inserting note:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Fill contact fields in HappyFox (only empty fields)
function handleFillContactFields(payload, sendResponse) {
  try {
    const { contact } = payload;
    let filledFields = [];

    // This will be implemented once we understand the edit mode structure in HappyFox
    // For now, return success but note it's not fully implemented
    console.log('Fill contact fields requested:', contact);

    sendResponse({ success: true, filledFields, note: 'Contact field filling not yet fully implemented' });
  } catch (error) {
    console.error('Error filling contact fields:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Fill ticket fields in HappyFox
function handleFillTicketFields(payload, sendResponse) {
  try {
    const { ticket } = payload;
    let filledFields = [];

    // This will be implemented once we understand the edit mode structure in HappyFox
    // For now, return success but note it's not fully implemented
    console.log('Fill ticket fields requested:', ticket);

    sendResponse({ success: true, filledFields, note: 'Ticket field filling not yet fully implemented' });
  } catch (error) {
    console.error('Error filling ticket fields:', error);
    sendResponse({ success: false, error: error.message });
  }
}
