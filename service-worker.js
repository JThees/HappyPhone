// Service Worker for HappyPhone Assistant
// Handles storage, messaging, and coordination between popup and content script

let MAX_CALL_HISTORY = 3; // Default, will be loaded from settings

// Initialize storage with empty data if not present
chrome.runtime.onInstalled.addListener(() => {
  // Load call history limit from settings
  chrome.storage.sync.get(['call_history_limit'], (settings) => {
    if (settings.call_history_limit) {
      MAX_CALL_HISTORY = settings.call_history_limit;
    }
  });

  chrome.storage.local.get(['contact', 'ticket', 'callHistory'], (result) => {
    const defaults = {};

    if (!result.contact) {
      defaults.contact = {
        name: '',
        email: '',
        phone: '',
        preferredContactMethod: { email: false, sms: false }
      };
    }

    if (!result.ticket) {
      defaults.ticket = {
        county: '',
        legalIssue: '',
        checkboxes: {}
      };
    }

    if (!result.callHistory) {
      defaults.callHistory = [];
    }

    if (Object.keys(defaults).length > 0) {
      chrome.storage.local.set(defaults);
    }
  });
});

// Load settings on startup
chrome.storage.sync.get(['call_history_limit'], (settings) => {
  if (settings.call_history_limit) {
    MAX_CALL_HISTORY = settings.call_history_limit;
  }
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case 'get-bootstrap-data':
      handleGetBootstrapData(sendResponse);
      return true; // Async response

    case 'update-contact':
      handleUpdateContact(payload, sendResponse);
      return true;

    case 'update-ticket':
      handleUpdateTicket(payload, sendResponse);
      return true;

    case 'log-call':
      handleLogCall(payload, sendResponse);
      return true;

    case 'sync-internal-note-toggle':
      handleSyncInternalNoteToggle(payload, sender);
      break;

    case 'insert-note':
      handleInsertNote(payload, sendResponse);
      return true;

    case 'request-ticket-data':
      handleRequestTicketData(sendResponse);
      return true;

    case 'credentials-updated':
      handleCredentialsUpdated(payload);
      break;

    default:
      console.warn('Unknown message type:', type);
  }
});

// Get all bootstrap data for popup initialization
async function handleGetBootstrapData(sendResponse) {
  chrome.storage.local.get(['contact', 'ticket', 'callHistory'], (result) => {
    sendResponse({
      contact: result.contact || {},
      ticket: result.ticket || {},
      callHistory: result.callHistory || []
    });
  });
}

// Update contact information in storage
async function handleUpdateContact(payload, sendResponse) {
  chrome.storage.local.set({ contact: payload }, () => {
    // Broadcast update to all open popups
    broadcastMessage({ type: 'contact-updated', payload });
    sendResponse({ success: true });
  });
}

// Update ticket information in storage
async function handleUpdateTicket(payload, sendResponse) {
  chrome.storage.local.set({ ticket: payload }, () => {
    // Broadcast update to all open popups
    broadcastMessage({ type: 'ticket-updated', payload });
    sendResponse({ success: true });
  });
}

// Log call to history
async function handleLogCall(payload, sendResponse) {
  chrome.storage.local.get(['contact', 'ticket', 'callHistory'], (result) => {
    const callHistory = result.callHistory || [];

    const callEntry = {
      timestamp: Date.now(),
      contact: result.contact,
      ticket: result.ticket,
      note: payload.note,
      internal: payload.internal,
      user: 'Current User', // Placeholder until authentication
      debugInfo: null
    };

    // Add to beginning, keep only last MAX_CALL_HISTORY entries
    callHistory.unshift(callEntry);
    const trimmedHistory = callHistory.slice(0, MAX_CALL_HISTORY);

    chrome.storage.local.set({ callHistory: trimmedHistory }, () => {
      // Broadcast history update
      broadcastMessage({ type: 'history-updated', payload: trimmedHistory });
      sendResponse({ success: true, callHistory: trimmedHistory });
    });
  });
}

// Sync internal note toggle state to content script
async function handleSyncInternalNoteToggle(payload, sender) {
  notifyContentScript({ type: 'set-internal-note', payload });
}

// Insert note into HappyFox
async function handleInsertNote(payload, sendResponse) {
  const response = await notifyContentScript({
    type: 'insert-note',
    payload
  });

  // If insertion failed, update the last call entry with debug info
  if (!response.success) {
    chrome.storage.local.get(['callHistory'], (result) => {
      const callHistory = result.callHistory || [];
      if (callHistory.length > 0) {
        callHistory[0].debugInfo = response.error || 'Failed to insert note';
        chrome.storage.local.set({ callHistory });
      }
    });
  }

  sendResponse(response);
}

// Request ticket data from content script
async function handleRequestTicketData(sendResponse) {
  console.log('🔄 Service worker: Requesting ticket data from content script...');
  const response = await notifyContentScript({ type: 'get-ticket-data' });
  console.log('✅ Service worker: Received response from content script:', response);
  sendResponse(response);
}

// Send message to content script in active HappyFox tab
async function notifyContentScript(message) {
  console.log('📤 Service worker: Sending message to content script:', message);
  return new Promise((resolve) => {
    // First try active tab in current window
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
      console.log('🔍 Service worker: Active tabs:', activeTabs);

      // Then get all HappyFox tabs
      chrome.tabs.query({ url: 'https://*.happyfox.com/*' }, (happyFoxTabs) => {
        console.log('🦊 Service worker: All HappyFox tabs:', happyFoxTabs.length);

        // Prefer active tab if it's a HappyFox tab, otherwise use first HappyFox tab
        let targetTab = null;
        if (activeTabs.length > 0 && activeTabs[0].url?.includes('happyfox.com')) {
          targetTab = activeTabs[0];
          console.log('✅ Using active HappyFox tab');
        } else if (happyFoxTabs.length > 0) {
          targetTab = happyFoxTabs[0];
          console.log('✅ Using first HappyFox tab (not active)');
        }

        if (!targetTab) {
          console.warn('⚠️ Service worker: No HappyFox tab found');
          resolve({ success: false, error: 'No HappyFox tab found. Please open a HappyFox ticket page.' });
          return;
        }

        console.log('📨 Service worker: Sending to tab ID:', targetTab.id, 'URL:', targetTab.url);
        chrome.tabs.sendMessage(targetTab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Service worker: Error sending message:', chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('✅ Service worker: Got response from content script:', response);
            resolve(response || { success: true });
          }
        });
      });
    });
  });
}

// Broadcast message to all extension contexts (popups, etc.)
function broadcastMessage(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Ignore errors if no receivers are listening
  });
}

// Handle credentials update from options page
function handleCredentialsUpdated(payload) {
  const { callHistoryLimit } = payload;

  if (callHistoryLimit) {
    MAX_CALL_HISTORY = callHistoryLimit;
    console.log(`Call history limit updated to: ${MAX_CALL_HISTORY}`);
  }
}
