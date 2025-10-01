// Options page script for HappyPhone Assistant
// Handles saving and testing API credentials

const form = document.getElementById('settings-form');
const domainInput = document.getElementById('domain');
const usernameInput = document.getElementById('username');
const apikeyInput = document.getElementById('apikey');
const callHistoryLimitInput = document.getElementById('call-history-limit');
const testBtn = document.getElementById('test-btn');
const statusMessage = document.getElementById('status-message');

// Load saved settings on page load
window.addEventListener('load', () => {
  chrome.storage.sync.get(['hf_domain', 'hf_username', 'hf_apikey', 'call_history_limit'], (result) => {
    if (result.hf_domain) domainInput.value = result.hf_domain;
    if (result.hf_username) usernameInput.value = result.hf_username;
    if (result.hf_apikey) apikeyInput.value = result.hf_apikey;
    if (result.call_history_limit) callHistoryLimitInput.value = result.call_history_limit;
  });
});

// Save settings
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const domain = domainInput.value.trim();
  const username = usernameInput.value.trim();
  const apikey = apikeyInput.value.trim();
  const callHistoryLimit = parseInt(callHistoryLimitInput.value, 10);

  if (!domain || !username || !apikey) {
    showStatus('Please fill in all required fields.', 'error');
    return;
  }

  // Save to chrome.storage.sync
  chrome.storage.sync.set({
    hf_domain: domain,
    hf_username: username,
    hf_apikey: apikey,
    call_history_limit: callHistoryLimit
  }, () => {
    showStatus('Settings saved successfully!', 'success');

    // Broadcast to service worker that credentials have been updated
    chrome.runtime.sendMessage({
      type: 'credentials-updated',
      payload: {
        domain,
        username,
        apikey,
        callHistoryLimit
      }
    });
  });
});

// Test API connection
testBtn.addEventListener('click', async () => {
  const domain = domainInput.value.trim();
  const username = usernameInput.value.trim();
  const apikey = apikeyInput.value.trim();

  if (!domain || !username || !apikey) {
    showStatus('Please fill in all fields before testing.', 'error');
    return;
  }

  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';

  try {
    const response = await fetch(`https://${domain}/api/v2/canned-actions/?limit=1`, {
      headers: {
        'Authorization': 'Basic ' + btoa(username + ':' + apikey)
      }
    });

    if (response.ok) {
      showStatus('✅ Connection successful! API credentials are valid.', 'success');
    } else {
      const statusText = response.status === 401 ? 'Invalid credentials' : `Error ${response.status}`;
      showStatus(`❌ Connection failed: ${statusText}`, 'error');
    }
  } catch (error) {
    showStatus(`❌ Connection failed: ${error.message}`, 'error');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = 'Test Connection';
  }
});

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';

  // Hide after 5 seconds
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
}
