/* eslint-disable no-unused-vars */
const contactFieldsEl = document.getElementById('contact-fields');
const ticketFieldsEl = document.getElementById('ticket-fields');
const ticketBody = document.getElementById('ticket-card-body');
const ticketHeader = document.querySelector('#ticket-card .collapsible');
const previousCallsBtn = document.getElementById('previous-calls-btn');
const previousCallsModal = document.getElementById('previous-calls-modal');
const callHistoryList = document.getElementById('call-history-list');
const addToTicketBtn = document.getElementById('add-to-ticket-btn');
const editor = document.getElementById('note-editor');
const internalNoteToggle = document.getElementById('internal-note-toggle');

const demoContact = {
  name: 'None',
  email: '(No Email)',
  phone: '+17085270394',
  preferredContactMethod: '-'
};

const demoTicket = {
  county: '-',
  legalIssue: '-'
};

const demoHistory = [
  { timestamp: Date.now() - 3600_000, summary: 'Consultation with client re billing', user: 'Kaelie R.' },
  { timestamp: Date.now() - 7200_000, summary: 'Follow-up call, voicemail left', user: 'Kaelie R.' }
];

const formatTimestamp = (ms) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(ms);

function renderContact(data) {
  contactFieldsEl.innerHTML = `
    <li>
      <span class="label">Name</span>
      <span>${data.name}</span>
    </li>
    <li>
      <span class="label">Email</span>
      <span>${data.email}</span>
    </li>
    <li>
      <span class="label">Phone</span>
      <span>${data.phone}</span>
    </li>
    <li>
      <span class="label">Preferred Contact Method</span>
      <span>${data.preferredContactMethod}</span>
    </li>
  `;
}

function renderTicket(data) {
  ticketFieldsEl.innerHTML = `
    <div>
      <dt>County*</dt>
      <dd>${data.county}</dd>
    </div>
    <div>
      <dt>Legal Issue*</dt>
      <dd>${data.legalIssue}</dd>
      <!-- Placeholder: populate dependent inputs dynamically -->
    </div>
  `;
}

function renderHistory(items) {
  if (!Array.isArray(items) || !items.length) {
    callHistoryList.innerHTML = '<li class="call-history__item">No previous calls recorded.</li>';
    return;
  }

  callHistoryList.innerHTML = items
    .slice(0, 5)
    .map(
      (item) => `
      <li class="call-history__item">
        <div class="call-history__meta">
          <span>${formatTimestamp(item.timestamp)}</span>
          <span>${item.user ?? 'Unknown agent'}</span>
        </div>
        <p>${item.summary}</p>
      </li>`
    )
    .join('');
}

ticketHeader.setAttribute('aria-expanded', 'true');

ticketHeader.addEventListener('click', () => {
  const isExpanded = ticketHeader.getAttribute('aria-expanded') === 'true';
  ticketHeader.setAttribute('aria-expanded', String(!isExpanded));
  ticketBody.dataset.state = isExpanded ? 'collapsed' : 'expanded';
});

previousCallsBtn.addEventListener('click', async () => {
  try {
    const { callHistory = [] } = await chrome.storage.local.get('callHistory');
    renderHistory(callHistory);
  } catch {
    renderHistory(demoHistory);
  }
  previousCallsModal.showModal();
});

previousCallsModal.addEventListener('close', () => {
  callHistoryList.innerHTML = '';
});

addToTicketBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({
    type: 'add-to-ticket',
    payload: {
      note: editor.value,
      internal: internalNoteToggle.checked
    }
  });
});

internalNoteToggle.addEventListener('change', () => {
  chrome.runtime.sendMessage({
    type: 'sync-internal-note-toggle',
    payload: { internal: internalNoteToggle.checked }
  });
});

renderContact(demoContact);
renderTicket(demoTicket);
renderHistory([]);
