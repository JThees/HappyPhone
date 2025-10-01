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

    console.log(`📝 Inserting note (internal: ${internal})`);

    // Click the appropriate button to open the editor
    const noteButton = internal
      ? document.querySelector('a[data-test-id="private-note-link"]')
      : document.querySelector('a[data-test-id="reply-link"]');

    if (noteButton) {
      console.log(`🖱️ Clicking ${internal ? 'Private Note' : 'Reply'} button`);
      noteButton.click();
    } else {
      console.warn(`⚠️ ${internal ? 'Private Note' : 'Reply'} button not found`);
    }

    // Wait for editor to open
    setTimeout(() => {
      // Find the ProseMirror editor
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

      console.log('✅ Note inserted successfully');
      sendResponse({ success: true });
    }, 300);
  } catch (error) {
    console.error('Error inserting note:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Fill contact fields in HappyFox (only empty fields)
async function handleFillContactFields(payload, sendResponse) {
  try {
    const { contact } = payload;
    let filledFields = [];

    console.log('📝 Filling contact fields:', contact);

    // Contact fields use individual inline edit, not Edit All
    // We need to click the edit icon for each field (name, email, phone)
    console.log('🔍 Activating inline edit for contact fields...');

    // Find all contact info items with edit icons
    const contactCard = document.querySelector('div.hf-card_contact-info');
    if (contactCard) {
      const contactItems = contactCard.querySelectorAll('div.hf-card_content_contact-info-item');
      console.log(`Found ${contactItems.length} contact info items`);

      // Click edit icon for each field that needs editing
      for (const item of contactItems) {
        const editSpan = item.querySelector('span.hf-u-cursor-pointer[data-ember-action]');
        if (editSpan) {
          console.log('🖱️ Clicking inline edit for contact field');
          editSpan.click();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    // Also click "Edit All" for custom fields (like PreferredContactMethod)
    const editAllButton = document.querySelector('a[data-test-id="contact-custom-field-edit-all"]');
    if (editAllButton) {
      console.log('🖱️ Clicking Edit All for contact custom fields');
      editAllButton.click();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Re-query to get the input (in case we just entered edit mode)
    let nameInput = document.querySelector('input[data-test-id="name"]');
    console.log('🔍 Name input found:', !!nameInput, 'Current value:', nameInput?.value);

    if (nameInput) {
      // Fill the field if it's empty and we have a value
      if (!nameInput.value && contact.name) {
        nameInput.value = contact.name;
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        filledFields.push('name');
        console.log('✅ Filled name:', contact.name);
      } else if (nameInput.value) {
        console.log('ℹ️ Name already has value, skipping fill');
      }

      // Always save if inline edit is open (to close it)
      const nameField = nameInput.closest('div.hf-custom-field');
      console.log('   🔍 Name field container found:', !!nameField);
      if (nameField) {
        // Look for the inline action Save link (only exists if in edit mode)
        const saveBtn = nameField.querySelector('a.hf-custom-field_inline-action_item.hf-primary-action');
        console.log('   🔍 Name inline save button found:', !!saveBtn);
        if (saveBtn) {
          console.log('   💾 Clicking save button to close name inline edit');
          saveBtn.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Fill email field if empty
    const emailInput = document.querySelector('input[data-test-id="email"]');
    console.log('🔍 Email input found:', !!emailInput, 'Current value:', emailInput?.value);

    if (emailInput) {
      // Fill the field if it's empty and we have a value
      if (!emailInput.value && contact.email) {
        emailInput.value = contact.email;
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        emailInput.dispatchEvent(new Event('change', { bubbles: true }));
        filledFields.push('email');
        console.log('✅ Filled email:', contact.email);
      } else if (emailInput.value) {
        console.log('ℹ️ Email already has value, skipping fill');
      }

      // Always save if inline edit is open (to close it)
      const emailField = emailInput.closest('div.hf-custom-field');
      console.log('   🔍 Email field container found:', !!emailField);
      if (emailField) {
        // Look for the inline action Save link (only exists if in edit mode)
        const saveBtn = emailField.querySelector('a.hf-custom-field_inline-action_item.hf-primary-action');
        console.log('   🔍 Email inline save button found:', !!saveBtn);
        if (saveBtn) {
          console.log('   💾 Clicking save button to close email inline edit');
          saveBtn.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Fill phone field if empty
    const phoneInput = document.querySelector('input[data-test-id="phone"]');
    console.log('🔍 Phone input found:', !!phoneInput, 'Current value:', phoneInput?.value);

    if (phoneInput) {
      // Fill the field if it's empty and we have a value
      if (!phoneInput.value && contact.phone) {
        phoneInput.value = contact.phone;
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
        filledFields.push('phone');
        console.log('✅ Filled phone:', contact.phone);
      } else if (phoneInput.value) {
        console.log('ℹ️ Phone already has value, skipping fill');
      }

      // Always save if inline edit is open (to close it)
      const phoneField = phoneInput.closest('div.hf-custom-field');
      console.log('   🔍 Phone field container found:', !!phoneField);
      if (phoneField) {
        // Look for the inline action Save link (only exists if in edit mode)
        const saveBtn = phoneField.querySelector('a.hf-custom-field_inline-action_item.hf-primary-action');
        console.log('   🔍 Phone inline save button found:', !!saveBtn);
        if (saveBtn) {
          console.log('   💾 Clicking save button to close phone inline edit');
          saveBtn.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Fill preferred contact method checkboxes
    if (contact.preferredContactMethod) {
      const emailCheckbox = document.querySelector('input[data-test-id="field-Email-checkbox"]');
      if (emailCheckbox && contact.preferredContactMethod.email && !emailCheckbox.checked) {
        emailCheckbox.click();
        filledFields.push('preferredContactMethod.email');
        console.log('✅ Checked Email preference');
      }

      const smsCheckbox = document.querySelector('input[data-test-id="field-Text Message (SMS)-checkbox"]');
      if (smsCheckbox && contact.preferredContactMethod.sms && !smsCheckbox.checked) {
        smsCheckbox.click();
        filledFields.push('preferredContactMethod.sms');
        console.log('✅ Checked SMS preference');
      }
    }

    // Click "Save All" button to save all contact changes
    if (filledFields.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('🔍 Looking for Save All button for contact fields...');
      const saveButton = document.querySelector('a[data-test-id="contact-custom-field-save-all"]');
      console.log('   🔍 Save All button found:', !!saveButton);

      if (saveButton) {
        console.log('   💾 Clicking Save All button for contact fields');
        saveButton.click();
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('   ✅ Save All button clicked');
      } else {
        console.warn('   ⚠️ Save All button not found for contact fields');
        // Try alternate selector
        const altSaveButton = document.querySelector('button:contains("Save All"), a:contains("Save All")');
        if (altSaveButton) {
          console.log('   💾 Found alternate Save All button, clicking...');
          altSaveButton.click();
        }
      }
    }

    sendResponse({ success: true, filledFields });
  } catch (error) {
    console.error('Error filling contact fields:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Fill ticket fields in HappyFox
async function handleFillTicketFields(payload, sendResponse) {
  try {
    const { ticket } = payload;
    let filledFields = [];

    console.log('🎫 Filling ticket fields:', ticket);

    // NOTE: We do NOT click "Edit All" for ticket fields because County and Legal Issue
    // use individual inline editing. The fillEmberPowerSelect function will activate
    // inline edit mode for each field individually.

    // Fill County dropdown using Ember Power Select
    if (ticket.county) {
      const countyFilled = await fillEmberPowerSelect('County', ticket.county);
      if (countyFilled) {
        filledFields.push('county');
      }

      // Wait for dropdown to fully close and wormhole to be cleared
      console.log('⏳ Waiting for County dropdown to fully close...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify wormhole is truly empty before proceeding
      let attempts = 0;
      while (attempts < 10) {
        const wormhole = document.querySelector('#ember-basic-dropdown-wormhole');
        const stillHasContent = wormhole && wormhole.innerHTML.trim().length > 0;
        if (!stillHasContent) {
          console.log('✅ Wormhole cleared, proceeding to Legal Issue');
          break;
        }
        console.log(`   ⏳ Wormhole still has content, waiting... (attempt ${attempts + 1}/10)`);
        await new Promise(resolve => setTimeout(resolve, 300));
        attempts++;
      }

      // Extra wait to ensure DOM is stable
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Fill Legal Issue dropdown using Ember Power Select
    if (ticket.legalIssue) {
      const legalIssueFilled = await fillEmberPowerSelect('Legal Issue', ticket.legalIssue);
      if (legalIssueFilled) {
        filledFields.push('legalIssue');
      }
      // Wait for dropdown to close and checkboxes to render
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Fill checkboxes based on legal issue
    if (ticket.checkboxes && Object.keys(ticket.checkboxes).length > 0) {
      Object.entries(ticket.checkboxes).forEach(([checkboxLabel, isChecked]) => {
        if (isChecked) {
          const checkbox = findCheckboxByLabel(checkboxLabel);
          if (checkbox && !checkbox.checked) {
            checkbox.click();
            filledFields.push(`checkbox.${checkboxLabel}`);
            console.log('✅ Checked:', checkboxLabel);
          }
        }
      });
    }

    // Click "Save All" button to save the changes
    if (filledFields.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const saveButton = document.querySelector('a[data-test-id="ticket-custom-field-save-all"]');
      if (saveButton) {
        console.log('💾 Clicking Save All button for ticket fields');
        saveButton.click();
      } else {
        console.warn('⚠️ Save All button not found');
      }
    }

    sendResponse({ success: true, filledFields });
  } catch (error) {
    console.error('Error filling ticket fields:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Helper function to fill Ember Power Select dropdowns
async function fillEmberPowerSelect(fieldLabel, value) {
  try {
    // Find all custom field labels
    const labels = document.querySelectorAll('label.hf-custom-field_label');
    console.log(`🔍 Searching for "${fieldLabel}" among ${labels.length} labels`);

    let targetTrigger = null;

    // Find the trigger for this field
    for (const label of labels) {
      const labelText = label.textContent.trim();
      console.log(`   Checking label: "${labelText}"`);

      if (labelText === fieldLabel) {
        console.log(`   ✅ Found matching label!`);

        // First, try to find existing trigger (if already in edit mode)
        // Look for the trigger within the custom-field container (NOT the global search)
        const customFieldDiv = label.closest('div[data-test-id="custom-field"]');
        if (customFieldDiv) {
          targetTrigger = customFieldDiv.querySelector('.ember-power-select-trigger');
          if (targetTrigger) {
            console.log(`   ✅ Trigger already exists (already in edit mode)`);
          }
        }

        // If not found, we need to enter inline edit mode by clicking the edit icon
        if (!targetTrigger) {
          console.log(`   🔍 Trigger not found, looking for inline edit icon`);

          // Get the custom-field div BEFORE clicking (we need this reference after DOM updates)
          const customFieldDiv = label.closest('div[data-test-id="custom-field"]');
          console.log(`   🔍 Custom field div found:`, !!customFieldDiv);

          if (customFieldDiv) {
            // Find the inline edit icon (SVG with class hf-custom-field_inline-edit-icon)
            const labelContainer = label.parentElement;
            const editIcon = labelContainer?.querySelector('.hf-custom-field_inline-edit-icon');
            console.log(`   🔍 Edit icon found:`, !!editIcon);

            if (editIcon) {
              // Check if labelContainer itself is the clickable element
              if (labelContainer.getAttribute('data-test-id') === 'custom-field-inline-editable') {
                console.log(`   🖱️ Clicking label container (it is the clickable element)`);
                labelContainer.click();
              } else {
                // Fallback: find clickable parent or dispatch click event on SVG
                const clickableParent = labelContainer.querySelector('[data-test-id="custom-field-inline-editable"]');
                if (clickableParent) {
                  console.log(`   🖱️ Clicking clickable parent for inline edit`);
                  clickableParent.click();
                } else {
                  console.log(`   🖱️ Clicking edit icon SVG directly`);
                  editIcon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
              }

              // Wait for edit mode to activate
              await new Promise(resolve => setTimeout(resolve, 800));

              // Now try to find the trigger within the custom-field container
              // (use the reference we got before clicking)
              console.log(`   🔍 Searching for trigger in custom field div...`);
              console.log(`   🔍 Custom field data-scroll-id:`, customFieldDiv.getAttribute('data-scroll-id'));
              console.log(`   🔍 Custom field HTML (first 400 chars):`, customFieldDiv.innerHTML.substring(0, 400));

              targetTrigger = customFieldDiv.querySelector('.ember-power-select-trigger');
              if (targetTrigger) {
                console.log(`   ✅ Found trigger in custom-field div after clicking inline edit`);
                console.log(`   🔍 Trigger data-ebd-id:`, targetTrigger.getAttribute('data-ebd-id'));
              } else {
                console.log(`   ⚠️ Trigger not found. Looking for any dropdown-related elements...`);
                const anyDropdown = customFieldDiv.querySelector('.ember-basic-dropdown');
                console.log(`   🔍 Found .ember-basic-dropdown:`, !!anyDropdown);
                const anySelect = customFieldDiv.querySelector('[class*="select"]');
                console.log(`   🔍 Found any select element:`, !!anySelect);
              }

              if (!targetTrigger) {
                console.log(`   ⚠️ Could not find trigger after clicking inline edit`);
              }
            } else {
              console.log(`   ⚠️ Inline edit icon not found`);
            }
          } else {
            console.log(`   ⚠️ Could not find custom-field div container before clicking`);
          }
        }

        if (targetTrigger) {
          console.log(`   ✅ Found trigger element`);
          break;
        } else {
          console.log(`   ⚠️ No trigger found after exhaustive search`);
        }
      }
    }

    if (!targetTrigger) {
      console.warn(`⚠️ Could not find dropdown trigger for: ${fieldLabel}`);
      return false;
    }

    // Check if already has the desired value
    const selectedItem = targetTrigger.querySelector('.ember-power-select-selected-item');
    if (selectedItem && selectedItem.textContent.trim() === value) {
      console.log(`ℹ️ ${fieldLabel} already set to: ${value}`);
      return false;
    }

    // Open the dropdown
    console.log(`🖱️ Opening ${fieldLabel} dropdown`);
    console.log(`   Trigger element:`, targetTrigger);
    console.log(`   Trigger aria-label:`, targetTrigger.getAttribute('aria-label'));
    console.log(`   Trigger data-ebd-id:`, targetTrigger.getAttribute('data-ebd-id'));
    console.log(`   Trigger tabindex:`, targetTrigger.getAttribute('tabindex'));

    // Verify we're clicking the right field's trigger
    const parentCustomField = targetTrigger.closest('div[data-test-id="custom-field"]');
    const parentLabel = parentCustomField?.querySelector('label.hf-custom-field_label');
    console.log(`   Trigger belongs to field:`, parentLabel?.textContent.trim());

    // Focus the trigger first (required for keyboard events)
    targetTrigger.focus();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try opening with keyboard events (more reliable for Ember Power Select)
    // Space or Enter should open the dropdown
    const spaceEvent = new KeyboardEvent('keydown', {
      key: ' ',
      code: 'Space',
      keyCode: 32,
      which: 32,
      bubbles: true,
      cancelable: true
    });
    targetTrigger.dispatchEvent(spaceEvent);

    // Also try click as fallback
    targetTrigger.click();

    // Wait for dropdown to render (they render in a wormhole at body level)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Get the specific content ID from the trigger's aria-owns attribute
    const contentId = targetTrigger.getAttribute('aria-owns');
    console.log(`   🔍 Looking for dropdown content ID:`, contentId);

    // Look for the SPECIFIC dropdown content that belongs to this trigger
    let dropdownContent = contentId ? document.getElementById(contentId) : null;

    // If not found immediately, wait for async loading
    if (!dropdownContent) {
      console.log(`   ⏳ Dropdown content not found, waiting for async load...`);
      await new Promise(resolve => setTimeout(resolve, 800));
      dropdownContent = contentId ? document.getElementById(contentId) : null;
    }

    console.log(`   🔍 Dropdown content found:`, !!dropdownContent);
    if (dropdownContent) {
      console.log(`   🔍 Dropdown content ID:`, dropdownContent.id);
    }

    // Find options list within the specific dropdown content
    const finalOptionsList = dropdownContent ? dropdownContent.querySelector('ul.ember-power-select-options') : null;

    console.log(`   🔍 Options list found:`, !!finalOptionsList);

    if (finalOptionsList) {
      const options = finalOptionsList.querySelectorAll('li.ember-power-select-option');
      console.log(`🔍 Found ${options.length} options in ${fieldLabel} dropdown`);

      // Debug: log first few option values to verify correct dropdown
      const firstFewOptions = Array.from(options).slice(0, 5).map(opt => opt.textContent.trim());
      console.log(`   First 5 options:`, firstFewOptions);

      let optionFound = false;
      for (const option of options) {
        const optionText = option.textContent.trim();
        const valueToMatch = value.trim();

        // Case-insensitive comparison
        if (optionText.toLowerCase() === valueToMatch.toLowerCase()) {
          console.log(`🖱️ Clicking option: "${optionText}"`);

          // Try multiple click approaches for Ember Power Select
          // Approach 1: mousedown event (Ember often uses this)
          option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          await new Promise(resolve => setTimeout(resolve, 100));

          // Approach 2: regular click
          option.click();
          await new Promise(resolve => setTimeout(resolve, 100));

          // Approach 3: mouseup event
          option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));

          console.log(`✅ Selected ${fieldLabel}: ${optionText}`);

          // Wait for dropdown to close
          await new Promise(resolve => setTimeout(resolve, 500));

          // Verify dropdown closed by checking if the content still exists
          const contentIdAfter = targetTrigger.getAttribute('aria-owns');
          const contentAfter = contentIdAfter ? document.getElementById(contentIdAfter) : null;
          const stillVisible = contentAfter && contentAfter.offsetParent !== null;
          console.log(`   🔍 Dropdown still visible after click:`, stillVisible);

          optionFound = true;
          break;
        }
      }

      if (!optionFound) {
        console.warn(`⚠️ Could not find option "${value}" in ${fieldLabel} dropdown`);
        console.warn(`   Searched for (lowercase):`, value.trim().toLowerCase());
        console.warn(`   Available options:`, Array.from(options).map(opt => `"${opt.textContent.trim()}"`).slice(0, 10));

        // Close the dropdown by pressing Escape or clicking trigger again
        console.log(`   🔒 Closing dropdown without selection`);
        const escapeEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(escapeEvent);
        await new Promise(resolve => setTimeout(resolve, 300));

        return false;
      }

      return true;
    } else {
      console.warn(`⚠️ Dropdown options list not found for ${fieldLabel} (checked wormhole and document)`);
    }

    return false;
  } catch (error) {
    console.error(`Error filling Ember Power Select for ${fieldLabel}:`, error);
    return false;
  }
}

// Helper function to find checkbox by label text
function findCheckboxByLabel(labelText) {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  for (const checkbox of checkboxes) {
    const testId = checkbox.getAttribute('data-test-id');
    if (testId && testId.includes(labelText)) {
      return checkbox;
    }

    // Also check nearby label text
    const parent = checkbox.closest('label, div');
    if (parent && parent.textContent.includes(labelText)) {
      return checkbox;
    }
  }
  return null;
}
