console.clear();
console.log('DOM SCANNER - HappyPhone Debug Tool');
console.log('========================================');

console.log('');
console.log('CONTACT INFO SECTION:');
const contactCard = document.querySelector('div.hf-card_contact-info');
if (contactCard) {
  console.log('Contact card found');
  const inputs = contactCard.querySelectorAll('input');
  console.log('Found ' + inputs.length + ' inputs in contact card:');
  inputs.forEach((input, i) => {
    console.log('  ' + (i+1) + '. Type: ' + input.type + ', ID: ' + input.id + ', data-test-id: ' + input.getAttribute('data-test-id'));
  });
  const editButtons = contactCard.querySelectorAll('a[data-test-id*="edit"]');
  console.log('Found ' + editButtons.length + ' edit buttons');
} else {
  console.log('Contact card NOT found');
}

console.log('');
console.log('TICKET CUSTOM FIELDS:');
const customFields = document.querySelectorAll('div[data-test-id="custom-field"]');
console.log('Found ' + customFields.length + ' custom fields');

customFields.forEach((field, i) => {
  console.log('');
  console.log('Field ' + (i+1) + ':');
  const label = field.querySelector('label.hf-custom-field_label');
  if (label) {
    console.log('  Label: ' + label.textContent.trim());
  }
  const value = field.querySelector('p.hf-custom-field_value');
  if (value) {
    console.log('  Value: ' + value.textContent.trim());
  }
  const editIcon = field.querySelector('.hf-custom-field_inline-edit-icon');
  console.log('  Edit icon: ' + (editIcon ? 'Found' : 'NOT found'));
  const trigger = field.querySelector('.ember-power-select-trigger');
  if (trigger) {
    const selected = trigger.querySelector('.ember-power-select-selected-item');
    console.log('  Power Select: Found, selected: ' + (selected ? selected.textContent.trim() : 'none'));
  } else {
    console.log('  Power Select: NOT found');
  }
  const inputs = field.querySelectorAll('input');
  if (inputs.length > 0) {
    console.log('  Inputs: Found ' + inputs.length);
    inputs.forEach((input, j) => {
      console.log('    ' + (j+1) + '. type: ' + input.type + ', test-id: ' + input.getAttribute('data-test-id'));
    });
  }
});

console.log('');
console.log('NOTE EDITOR SECTION:');
const privateNoteBtn = document.querySelector('a[data-test-id="private-note-link"]');
const replyBtn = document.querySelector('a[data-test-id="reply-link"]');
const proseMirror = document.querySelector('div.ProseMirror.ProseMirror-example-setup-style');
console.log('Private Note button: ' + (privateNoteBtn ? 'Found' : 'NOT found'));
console.log('Reply button: ' + (replyBtn ? 'Found' : 'NOT found'));
console.log('ProseMirror editor: ' + (proseMirror ? 'Found' : 'NOT found'));

console.log('');
console.log('SAVE BUTTONS:');
const contactSave = document.querySelector('a[data-test-id="contact-custom-field-save-all"]');
const ticketSave = document.querySelector('a[data-test-id="ticket-custom-field-save-all"]');
console.log('Contact Save All: ' + (contactSave ? 'Found' : 'NOT found'));
console.log('Ticket Save All: ' + (ticketSave ? 'Found' : 'NOT found'));

console.log('');
console.log('ALL INPUTS ON PAGE BY TYPE:');
const allInputs = document.querySelectorAll('input');
const inputsByType = {};
allInputs.forEach(input => {
  const type = input.type || 'unknown';
  if (!inputsByType[type]) inputsByType[type] = [];
  inputsByType[type].push(input);
});
for (const type in inputsByType) {
  console.log('  Type: ' + type + ' - Count: ' + inputsByType[type].length);
  if (type === 'text' || type === 'email' || type === 'tel') {
    inputsByType[type].forEach((input, i) => {
      console.log('    ' + (i+1) + '. id: ' + input.id + ', test-id: ' + input.getAttribute('data-test-id') + ', class: ' + input.className);
    });
  }
}

console.log('');
console.log('ALL POWER SELECT TRIGGERS:');
const allTriggers = document.querySelectorAll('.ember-power-select-trigger');
console.log('Found ' + allTriggers.length + ' triggers');
allTriggers.forEach((trigger, i) => {
  const selected = trigger.querySelector('.ember-power-select-selected-item');
  const parent = trigger.closest('div[data-test-id="custom-field"]');
  const parentLabel = parent ? parent.querySelector('label').textContent.trim() : 'unknown';
  console.log('  ' + (i+1) + '. Parent: ' + parentLabel + ', selected: ' + (selected ? selected.textContent.trim() : 'none'));
});

console.log('');
console.log('END OF SCAN');
