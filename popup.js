// Popup script for HappyPhone Assistant
// Handles UI interactions, real-time storage sync, and messaging

// DOM elements
const contactNameInput = document.getElementById('contact-name');
const contactEmailInput = document.getElementById('contact-email');
const contactPhoneInput = document.getElementById('contact-phone');
const contactMethodEmailCheckbox = document.getElementById('contact-method-email');
const contactMethodSmsCheckbox = document.getElementById('contact-method-sms');

const ticketCountySelect = document.getElementById('ticket-county');
const ticketLegalIssueSelect = document.getElementById('ticket-legal-issue');
const legalIssueCheckboxesContainer = document.getElementById('legal-issue-checkboxes');

const ticketBody = document.getElementById('ticket-card-body');
const ticketHeader = document.querySelector('#ticket-card .collapsible');
const ticketNumberEl = document.getElementById('ticket-number');
const ticketTitleEl = document.getElementById('ticket-title');

const previousCallsBtn = document.getElementById('previous-calls-btn');
const previousCallsModal = document.getElementById('previous-calls-modal');
const callHistoryList = document.getElementById('call-history-list');

const addToTicketBtn = document.getElementById('add-to-ticket-btn');
const editor = document.getElementById('note-editor');
const internalNoteToggle = document.getElementById('internal-note-toggle');

// Utilities
const formatTimestamp = (ms) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);

// Debounce helper for real-time saving
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Config data
let configData = null;

// Initialize popup
async function init() {
  try {
    // Load config JSON
    const configResponse = await fetch(chrome.runtime.getURL('config.json'));
    configData = await configResponse.json();

    // Populate dropdown options
    populateCountyDropdown(configData.counties);
    populateLegalIssueDropdown(Object.keys(configData.legalIssues));

    // Request bootstrap data from service worker
    const response = await chrome.runtime.sendMessage({ type: 'get-bootstrap-data' });

    if (response) {
      loadContactData(response.contact || {});
      loadTicketData(response.ticket || {});
    }

    // Set up real-time storage sync
    setupContactListeners();
    setupTicketListeners();
    setupMessageListeners();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
}

// Populate county dropdown from config
function populateCountyDropdown(counties) {
  ticketCountySelect.innerHTML = '<option value="">Select county...</option>';
  counties.forEach(county => {
    const option = document.createElement('option');
    option.value = county;
    option.textContent = county;
    ticketCountySelect.appendChild(option);
  });
}

// Populate legal issue dropdown from config
function populateLegalIssueDropdown(legalIssues) {
  ticketLegalIssueSelect.innerHTML = '<option value="">Select legal issue...</option>';
  legalIssues.forEach(issue => {
    const option = document.createElement('option');
    option.value = issue;
    option.textContent = issue;
    ticketLegalIssueSelect.appendChild(option);
  });
}

// Load contact data into form
function loadContactData(contact) {
  contactNameInput.value = contact.name || '';
  contactEmailInput.value = contact.email || '';
  contactPhoneInput.value = contact.phone || '';

  if (contact.preferredContactMethod) {
    contactMethodEmailCheckbox.checked = contact.preferredContactMethod.email || false;
    contactMethodSmsCheckbox.checked = contact.preferredContactMethod.sms || false;
  }
}

// Load ticket data into form
function loadTicketData(ticket) {
  ticketCountySelect.value = ticket.county || '';
  ticketLegalIssueSelect.value = ticket.legalIssue || '';

  // Load checkboxes if legal issue is selected
  if (ticket.legalIssue && configData) {
    const checkboxOptions = configData.legalIssues[ticket.legalIssue] || [];
    renderLegalIssueCheckboxes(checkboxOptions, ticket.checkboxes || {});
  }
}

// Render legal issue checkboxes (dynamically populated based on selection)
function renderLegalIssueCheckboxes(checkboxOptions, savedCheckboxes = {}) {
  if (!checkboxOptions || checkboxOptions.length === 0) {
    legalIssueCheckboxesContainer.innerHTML = '';
    return;
  }

  const checkboxHTML = checkboxOptions.map(option => {
    const isChecked = savedCheckboxes[option] || false;
    return `
      <label class="checkbox">
        <input type="checkbox" data-checkbox-key="${option}" ${isChecked ? 'checked' : ''}>
        <span>${option}</span>
      </label>
    `;
  }).join('');

  legalIssueCheckboxesContainer.innerHTML = `
    <div class="checkbox-group">
      ${checkboxHTML}
    </div>
  `;

  // Add listeners to new checkboxes
  const checkboxInputs = legalIssueCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
  checkboxInputs.forEach(checkbox => {
    checkbox.addEventListener('change', saveTicketData);
  });
}

// Set up contact field listeners for real-time save
function setupContactListeners() {
  const saveContact = debounce(() => {
    const contactData = {
      name: contactNameInput.value,
      email: contactEmailInput.value,
      phone: contactPhoneInput.value,
      preferredContactMethod: {
        email: contactMethodEmailCheckbox.checked,
        sms: contactMethodSmsCheckbox.checked
      }
    };

    chrome.runtime.sendMessage({
      type: 'update-contact',
      payload: contactData
    });
  }, 500);

  contactNameInput.addEventListener('input', saveContact);
  contactEmailInput.addEventListener('input', saveContact);
  contactPhoneInput.addEventListener('input', saveContact);
  contactMethodEmailCheckbox.addEventListener('change', saveContact);
  contactMethodSmsCheckbox.addEventListener('change', saveContact);
}

// Set up ticket field listeners for real-time save
function setupTicketListeners() {
  const saveTicket = debounce(saveTicketData, 500);

  ticketCountySelect.addEventListener('change', saveTicket);
  ticketLegalIssueSelect.addEventListener('change', () => {
    // Update checkboxes based on selected legal issue
    const selectedIssue = ticketLegalIssueSelect.value;
    if (selectedIssue && configData) {
      const checkboxOptions = configData.legalIssues[selectedIssue] || [];
      renderLegalIssueCheckboxes(checkboxOptions);
    } else {
      legalIssueCheckboxesContainer.innerHTML = '';
    }
    saveTicket();
  });
}

// Save ticket data to storage
function saveTicketData() {
  const checkboxes = {};
  const checkboxInputs = legalIssueCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
  checkboxInputs.forEach(checkbox => {
    const key = checkbox.dataset.checkboxKey;
    if (key) {
      checkboxes[key] = checkbox.checked;
    }
  });

  const ticketData = {
    county: ticketCountySelect.value,
    legalIssue: ticketLegalIssueSelect.value,
    checkboxes
  };

  chrome.runtime.sendMessage({
    type: 'update-ticket',
    payload: ticketData
  });
}

// Listen for broadcast messages from service worker
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message) => {
    const { type, payload } = message;

    switch (type) {
      case 'contact-updated':
        loadContactData(payload);
        break;

      case 'ticket-updated':
        loadTicketData(payload);
        break;

      case 'history-updated':
        // Update history display if modal is open
        if (previousCallsModal.open) {
          renderHistory(payload);
        }
        break;

      default:
        // Ignore unknown messages
    }
  });
}

// Render call history in modal
function renderHistory(items) {
  if (!Array.isArray(items) || !items.length) {
    callHistoryList.innerHTML = '<li class="call-history__item">No previous calls recorded.</li>';
    return;
  }

  callHistoryList.innerHTML = items
    .map((item) => {
      const debugNote = item.debugInfo ? `<p style="color: red; font-size: 12px;">Debug: ${item.debugInfo}</p>` : '';
      return `
        <li class="call-history__item">
          <div class="call-history__meta">
            <span>${formatTimestamp(item.timestamp)}</span>
            <span>${item.user ?? 'Unknown agent'}</span>
          </div>
          <p><strong>Contact:</strong> ${item.contact?.name || 'N/A'} - ${item.contact?.phone || 'N/A'}</p>
          <p><strong>Note:</strong> ${item.note?.substring(0, 100) || 'No note'}${item.note?.length > 100 ? '...' : ''}</p>
          ${debugNote}
        </li>
      `;
    })
    .join('');
}

// Ticket card collapse/expand
ticketHeader.setAttribute('aria-expanded', 'true');
ticketHeader.addEventListener('click', () => {
  const isExpanded = ticketHeader.getAttribute('aria-expanded') === 'true';
  ticketHeader.setAttribute('aria-expanded', String(!isExpanded));
  ticketBody.dataset.state = isExpanded ? 'collapsed' : 'expanded';
});

// Get Ticket Data button - requests data from HappyFox page
const getTicketDataBtn = document.getElementById('get-ticket-data-btn');
getTicketDataBtn.addEventListener('click', async () => {
  console.log('🖱️ Popup: Get Ticket Data button clicked');
  try {
    getTicketDataBtn.disabled = true;
    getTicketDataBtn.textContent = 'Loading...';

    console.log('📤 Popup: Sending request-ticket-data message...');
    const response = await chrome.runtime.sendMessage({
      type: 'request-ticket-data'
    });
    console.log('📥 Popup: Received response:', response);

    if (response.success && response.data) {
      // Update contact fields
      if (response.data.contact) {
        loadContactData(response.data.contact);
      }

      // Update ticket fields
      if (response.data.ticket) {
        loadTicketData(response.data.ticket);
      }

      // Update ticket meta in footer
      if (response.data.ticketMeta) {
        ticketNumberEl.textContent = response.data.ticketMeta.number || 'Ticket#';
        ticketTitleEl.textContent = response.data.ticketMeta.title || 'TicketTitle';
      }

      alert('Ticket data loaded successfully!');
    } else {
      alert(`Failed to load ticket data: ${response.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error getting ticket data:', error);
    alert('Error getting ticket data. Make sure you are on a HappyFox ticket page.');
  } finally {
    getTicketDataBtn.disabled = false;
    getTicketDataBtn.textContent = 'Get Ticket Data';
  }
});

// Previous calls modal
previousCallsBtn.addEventListener('click', async () => {
  try {
    const { callHistory = [] } = await chrome.storage.local.get('callHistory');
    renderHistory(callHistory);
  } catch (error) {
    console.error('Error loading call history:', error);
    callHistoryList.innerHTML = '<li class="call-history__item">Error loading call history.</li>';
  }
  previousCallsModal.showModal();
});

previousCallsModal.addEventListener('close', () => {
  callHistoryList.innerHTML = '';
});

// Add to ticket button
addToTicketBtn.addEventListener('click', async () => {
  const note = editor.value.trim();

  if (!note) {
    alert('Please enter a note before adding to ticket.');
    return;
  }

  try {
    // Log the call
    await chrome.runtime.sendMessage({
      type: 'log-call',
      payload: {
        note,
        internal: internalNoteToggle.checked
      }
    });

    // Insert note into HappyFox
    const insertResponse = await chrome.runtime.sendMessage({
      type: 'insert-note',
      payload: {
        note,
        internal: internalNoteToggle.checked
      }
    });

    if (insertResponse.success) {
      alert('Note added to ticket successfully!');
      editor.value = ''; // Clear editor after successful insertion
    } else {
      alert(`Failed to add note: ${insertResponse.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error adding to ticket:', error);
    alert('Error adding to ticket. Please try again.');
  }
});

// Internal note toggle sync
internalNoteToggle.addEventListener('change', () => {
  chrome.runtime.sendMessage({
    type: 'sync-internal-note-toggle',
    payload: { internal: internalNoteToggle.checked }
  });
});

// Settings button - opens options page
const settingsButton = document.querySelector('.settings-button');
if (settingsButton) {
  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

// Clear Fields button - resets all form fields
const clearFieldsBtn = document.getElementById('clear-fields-btn');
if (clearFieldsBtn) {
  clearFieldsBtn.addEventListener('click', () => {
    // Confirm before clearing
    if (confirm('Are you sure you want to clear all fields? This will reset contact info, ticket info, and notes.')) {
      // Clear contact fields
      contactNameInput.value = '';
      contactEmailInput.value = '';
      contactPhoneInput.value = '';
      contactMethodEmailCheckbox.checked = false;
      contactMethodSmsCheckbox.checked = false;

      // Clear ticket fields
      ticketCountySelect.value = '';
      ticketLegalIssueSelect.value = '';
      legalIssueCheckboxesContainer.innerHTML = '';

      // Clear note editor
      editor.value = '';

      // Clear storage
      const emptyContact = {
        name: '',
        email: '',
        phone: '',
        preferredContactMethod: { email: false, sms: false }
      };

      const emptyTicket = {
        county: '',
        legalIssue: '',
        checkboxes: {}
      };

      // Save empty data to storage
      chrome.runtime.sendMessage({
        type: 'update-contact',
        payload: emptyContact
      });

      chrome.runtime.sendMessage({
        type: 'update-ticket',
        payload: emptyTicket
      });
    }
  });
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
