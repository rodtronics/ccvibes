// CCVibes Data Entry - Activity/Crime JSON Generator

let optionCount = 0;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  addOption(); // Start with one option
});

// === CONDITION HANDLING ===

function addCondition(type) {
  const container = document.getElementById(`${type}Conditions`);
  const template = document.getElementById('conditionTemplate');
  const clone = template.content.cloneNode(true);
  clone.querySelector('.condition-item').dataset.type = type;
  container.appendChild(clone);
}

function removeCondition(button) {
  button.closest('.condition-item').remove();
}

function updateConditionFields(select) {
  const container = select.closest('.condition-item').querySelector('.condition-fields');
  const type = select.value;

  let html = '';
  switch (type) {
    case 'resourceGte':
    case 'resourceLte':
      html = `
        <select class="condition-resource">
          <option value="cash">cash</option>
          <option value="cred">cred</option>
          <option value="heat">heat</option>
          <option value="xp">xp</option>
        </select>
        <input type="number" class="condition-value" placeholder="value">
      `;
      break;
    case 'flagSet':
      html = `<input type="text" class="condition-flag" placeholder="flag name">`;
      break;
    case 'activityCompleted':
      html = `<input type="text" class="condition-activity" placeholder="activity ID">`;
      break;
    case 'xpGte':
      html = `<input type="number" class="condition-value" placeholder="XP value">`;
      break;
  }
  container.innerHTML = html;
}

function getConditions(type) {
  const conditions = [];
  const items = document.querySelectorAll(`#${type}Conditions .condition-item`);

  items.forEach(item => {
    const condType = item.querySelector('.condition-type').value;
    const condition = { type: condType };

    switch (condType) {
      case 'resourceGte':
      case 'resourceLte':
        condition.resourceId = item.querySelector('.condition-resource')?.value;
        condition.value = parseInt(item.querySelector('.condition-value')?.value) || 0;
        break;
      case 'flagSet':
        condition.flag = item.querySelector('.condition-flag')?.value;
        break;
      case 'activityCompleted':
        condition.activityId = item.querySelector('.condition-activity')?.value;
        break;
      case 'xpGte':
        condition.value = parseInt(item.querySelector('.condition-value')?.value) || 0;
        break;
    }

    conditions.push(condition);
  });

  return conditions;
}

// === OPTION HANDLING ===

function addOption() {
  optionCount++;
  const container = document.getElementById('optionsContainer');
  const template = document.getElementById('optionTemplate');
  const clone = template.content.cloneNode(true);

  clone.querySelector('.option-number').textContent = optionCount;
  clone.querySelector('.option-card').dataset.optionNum = optionCount;

  container.appendChild(clone);

  // Initialize resolution fields for the new option
  const newOption = container.lastElementChild;
  const resolutionSelect = newOption.querySelector('.resolution-type');
  updateResolutionFields(resolutionSelect);
}

function removeOption(button) {
  const card = button.closest('.option-card');
  card.remove();
  renumberOptions();
}

function renumberOptions() {
  const options = document.querySelectorAll('.option-card');
  options.forEach((option, index) => {
    option.querySelector('.option-number').textContent = index + 1;
    option.dataset.optionNum = index + 1;
  });
  optionCount = options.length;
}

// === RESOLUTION HANDLING ===

function updateResolutionFields(select) {
  const container = select.closest('.subsection').querySelector('.resolution-fields');
  const type = select.value;

  let html = '';
  switch (type) {
    case 'deterministic':
      html = `
        <div class="form-row">
          <div class="form-group">
            <label>Cash Output</label>
            <input type="number" class="res-cash" placeholder="0" value="0">
          </div>
          <div class="form-group">
            <label>Cred Output</label>
            <input type="number" class="res-cred" placeholder="0" value="0">
          </div>
          <div class="form-group">
            <label>Heat Delta</label>
            <input type="number" class="res-heat" placeholder="0" value="0">
          </div>
        </div>
      `;
      break;

    case 'ranged_outputs':
      html = `
        <div class="form-row">
          <div class="form-group">
            <label>Cash (min - max)</label>
            <div class="range-inputs">
              <input type="number" class="res-cash-min" placeholder="min" value="0">
              <span>-</span>
              <input type="number" class="res-cash-max" placeholder="max" value="0">
            </div>
          </div>
          <div class="form-group">
            <label>Cred (min - max)</label>
            <div class="range-inputs">
              <input type="number" class="res-cred-min" placeholder="min" value="0">
              <span>-</span>
              <input type="number" class="res-cred-max" placeholder="max" value="0">
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Heat Delta</label>
            <input type="number" class="res-heat" placeholder="0" value="0">
          </div>
        </div>
      `;
      break;

    case 'weighted_outcomes':
      html = `
        <div class="outcomes-container"></div>
        <button type="button" class="btn-add btn-small" onclick="addOutcome(this)">+ Add Outcome</button>
      `;
      break;
  }

  container.innerHTML = html;

  // Add default outcomes for weighted
  if (type === 'weighted_outcomes') {
    addOutcome(container.querySelector('.btn-add')); // success
    addOutcome(container.querySelector('.btn-add')); // failure

    // Pre-fill defaults
    const outcomes = container.querySelectorAll('.outcome-card');
    if (outcomes[0]) {
      outcomes[0].querySelector('.outcome-id').value = 'success';
      outcomes[0].querySelector('.outcome-weight').value = 70;
      outcomes[0].querySelector('.outcome-cash').value = 100;
    }
    if (outcomes[1]) {
      outcomes[1].querySelector('.outcome-id').value = 'caught';
      outcomes[1].querySelector('.outcome-weight').value = 30;
      outcomes[1].querySelector('.outcome-heat').value = 5;
      outcomes[1].querySelector('.outcome-jail').value = 30000;
    }
  }
}

function addOutcome(button) {
  const container = button.previousElementSibling;
  const template = document.getElementById('outcomeTemplate');
  const clone = template.content.cloneNode(true);
  container.appendChild(clone);
}

function removeOutcome(button) {
  button.closest('.outcome-card').remove();
}

// === INPUT HANDLING ===

function addInput(button) {
  const container = button.previousElementSibling;
  const template = document.getElementById('inputTemplate');
  const clone = template.content.cloneNode(true);
  container.appendChild(clone);
}

function removeInput(button) {
  button.closest('.input-item').remove();
}

// === MODIFIER HANDLING ===

function addModifier(button) {
  const container = button.previousElementSibling;
  const template = document.getElementById('modifierTemplate');
  const clone = template.content.cloneNode(true);
  container.appendChild(clone);
}

function removeModifier(button) {
  button.closest('.modifier-item').remove();
}

function toggleCollapsible(header) {
  const content = header.nextElementSibling;
  const icon = header.querySelector('.collapse-icon');
  if (content.style.display === 'none') {
    content.style.display = 'block';
    icon.textContent = '▲';
  } else {
    content.style.display = 'none';
    icon.textContent = '▼';
  }
}

// === JSON GENERATION ===

function generateJSON() {
  const activity = {
    id: document.getElementById('id').value.trim(),
    branchId: document.getElementById('branchId').value,
    name: document.getElementById('name').value.trim(),
    description: document.getElementById('description').value.trim(),
    meta: {
      tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t),
      icon: document.getElementById('icon').value.trim() || '📋'
    }
  };

  // Visibility & Unlock conditions
  const visibleIf = getConditions('visibleIf');
  const unlockIf = getConditions('unlockIf');

  if (visibleIf.length > 0) activity.visibleIf = visibleIf;
  if (unlockIf.length > 0) activity.unlockIf = unlockIf;

  // Options
  activity.options = [];
  const optionCards = document.querySelectorAll('.option-card');

  optionCards.forEach(card => {
    const option = {
      id: card.querySelector('.option-id').value.trim(),
      name: card.querySelector('.option-name').value.trim(),
      description: card.querySelector('.option-description').value.trim(),
      repeatable: card.querySelector('.option-repeatable').checked,
      maxConcurrentRuns: parseInt(card.querySelector('.option-maxConcurrent').value) || 1,
      durationMs: parseInt(card.querySelector('.option-duration').value) || 30000,
      cooldownMs: parseInt(card.querySelector('.option-cooldown').value) || 0,
      xpRewards: {
        onComplete: parseInt(card.querySelector('.option-xp').value) || 0
      }
    };

    // Requirements
    const staffRole = card.querySelector('.req-staff-role').value;
    if (staffRole) {
      option.requirements = {
        staff: [{
          roleId: staffRole,
          count: parseInt(card.querySelector('.req-staff-count').value) || 1,
          starsMin: parseInt(card.querySelector('.req-staff-stars').value) || 0
        }],
        items: [],
        buildings: []
      };
    }

    // Inputs
    const inputItems = card.querySelectorAll('.inputs-list .input-item');
    if (inputItems.length > 0) {
      option.inputs = { resources: {}, items: {} };
      inputItems.forEach(item => {
        const resource = item.querySelector('.input-resource').value;
        const amount = parseInt(item.querySelector('.input-amount').value) || 0;
        if (amount > 0) {
          option.inputs.resources[resource] = amount;
        }
      });
    }

    // Resolution
    const resolutionType = card.querySelector('.resolution-type').value;
    option.resolution = { type: resolutionType };

    switch (resolutionType) {
      case 'deterministic':
        option.resolution.outputs = {
          resources: {},
          items: {}
        };
        const cash = parseInt(card.querySelector('.res-cash')?.value) || 0;
        const cred = parseInt(card.querySelector('.res-cred')?.value) || 0;
        if (cash) option.resolution.outputs.resources.cash = cash;
        if (cred) option.resolution.outputs.resources.cred = cred;
        option.resolution.heatDelta = parseInt(card.querySelector('.res-heat')?.value) || 0;
        option.resolution.effects = [];
        break;

      case 'ranged_outputs':
        option.resolution.outputs = {
          resources: {},
          items: {}
        };
        const cashMin = parseInt(card.querySelector('.res-cash-min')?.value) || 0;
        const cashMax = parseInt(card.querySelector('.res-cash-max')?.value) || 0;
        const credMin = parseInt(card.querySelector('.res-cred-min')?.value) || 0;
        const credMax = parseInt(card.querySelector('.res-cred-max')?.value) || 0;

        if (cashMax > 0) {
          option.resolution.outputs.resources.cash = { min: cashMin, max: cashMax };
        }
        if (credMax > 0) {
          option.resolution.outputs.resources.cred = { min: credMin, max: credMax };
        }
        option.resolution.heatDelta = parseInt(card.querySelector('.res-heat')?.value) || 0;
        option.resolution.effects = [];
        break;

      case 'weighted_outcomes':
        option.resolution.outcomes = [];
        const outcomeCards = card.querySelectorAll('.outcome-card');
        outcomeCards.forEach(oc => {
          const outcome = {
            id: oc.querySelector('.outcome-id').value.trim(),
            weight: parseInt(oc.querySelector('.outcome-weight').value) || 50,
            outputs: { resources: {}, items: {} },
            heatDelta: parseInt(oc.querySelector('.outcome-heat').value) || 0,
            effects: []
          };

          const outCash = parseInt(oc.querySelector('.outcome-cash').value) || 0;
          const outCred = parseInt(oc.querySelector('.outcome-cred').value) || 0;
          if (outCash) outcome.outputs.resources.cash = outCash;
          if (outCred) outcome.outputs.resources.cred = outCred;

          const jailDuration = parseInt(oc.querySelector('.outcome-jail').value) || 0;
          if (jailDuration > 0) {
            outcome.jail = { durationMs: jailDuration };
          }

          option.resolution.outcomes.push(outcome);
        });
        break;
    }

    // Modifiers
    const modifierItems = card.querySelectorAll('.modifiers-list .modifier-item');
    if (modifierItems.length > 0) {
      option.modifiers = [];
      modifierItems.forEach(mod => {
        option.modifiers.push({
          staffAttribute: mod.querySelector('.modifier-attribute').value,
          targetOutcome: mod.querySelector('.modifier-outcome').value.trim(),
          weightDeltaPerPoint: parseInt(mod.querySelector('.modifier-delta').value) || 0
        });
      });
    } else {
      option.modifiers = [];
    }

    activity.options.push(option);
  });

  // Display JSON
  const output = document.getElementById('jsonOutput');
  output.textContent = JSON.stringify(activity, null, 2);
  output.classList.add('has-content');
}

// === UTILITY FUNCTIONS ===

function copyJSON() {
  const output = document.getElementById('jsonOutput');
  const text = output.textContent;

  if (text.startsWith('//')) {
    alert('Generate JSON first!');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    const copyBtn = document.getElementById('copyText');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    const copyBtn = document.getElementById('copyText');
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 2000);
  });
}

function clearForm() {
  if (confirm('Clear all form data?')) {
    document.getElementById('activityForm').reset();
    document.getElementById('visibleIfConditions').innerHTML = '';
    document.getElementById('unlockIfConditions').innerHTML = '';
    document.getElementById('optionsContainer').innerHTML = '';
    document.getElementById('jsonOutput').textContent = '// Generated JSON will appear here';
    document.getElementById('jsonOutput').classList.remove('has-content');
    optionCount = 0;
    addOption();
  }
}

function downloadJSON() {
  const output = document.getElementById('jsonOutput');
  const text = output.textContent;

  if (text.startsWith('//')) {
    alert('Generate JSON first!');
    return;
  }

  const activityId = document.getElementById('id').value.trim() || 'activity';
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${activityId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadFromJSON() {
  const input = prompt('Paste JSON to load:');
  if (!input) return;

  try {
    const activity = JSON.parse(input);
    populateForm(activity);
  } catch (e) {
    alert('Invalid JSON: ' + e.message);
  }
}

function populateForm(activity) {
  // Clear existing
  document.getElementById('visibleIfConditions').innerHTML = '';
  document.getElementById('unlockIfConditions').innerHTML = '';
  document.getElementById('optionsContainer').innerHTML = '';
  optionCount = 0;

  // Basic info
  document.getElementById('id').value = activity.id || '';
  document.getElementById('branchId').value = activity.branchId || 'street';
  document.getElementById('name').value = activity.name || '';
  document.getElementById('description').value = activity.description || '';
  document.getElementById('icon').value = activity.meta?.icon || '';
  document.getElementById('tags').value = (activity.meta?.tags || []).join(', ');

  // Conditions
  if (activity.visibleIf) {
    activity.visibleIf.forEach(cond => {
      addCondition('visibleIf');
      const item = document.querySelector('#visibleIfConditions .condition-item:last-child');
      populateCondition(item, cond);
    });
  }

  if (activity.unlockIf) {
    activity.unlockIf.forEach(cond => {
      addCondition('unlockIf');
      const item = document.querySelector('#unlockIfConditions .condition-item:last-child');
      populateCondition(item, cond);
    });
  }

  // Options
  if (activity.options) {
    activity.options.forEach(opt => {
      addOption();
      const card = document.querySelector('.option-card:last-child');
      populateOption(card, opt);
    });
  }

  // Generate JSON output
  generateJSON();
}

function populateCondition(item, cond) {
  const typeSelect = item.querySelector('.condition-type');
  typeSelect.value = cond.type;
  updateConditionFields(typeSelect);

  switch (cond.type) {
    case 'resourceGte':
    case 'resourceLte':
      item.querySelector('.condition-resource').value = cond.resourceId;
      item.querySelector('.condition-value').value = cond.value;
      break;
    case 'flagSet':
      item.querySelector('.condition-flag').value = cond.flag;
      break;
    case 'activityCompleted':
      item.querySelector('.condition-activity').value = cond.activityId;
      break;
    case 'xpGte':
      item.querySelector('.condition-value').value = cond.value;
      break;
  }
}

function populateOption(card, opt) {
  card.querySelector('.option-id').value = opt.id || '';
  card.querySelector('.option-name').value = opt.name || '';
  card.querySelector('.option-description').value = opt.description || '';
  card.querySelector('.option-repeatable').checked = opt.repeatable !== false;
  card.querySelector('.option-maxConcurrent').value = opt.maxConcurrentRuns || 1;
  card.querySelector('.option-duration').value = opt.durationMs || 30000;
  card.querySelector('.option-cooldown').value = opt.cooldownMs || 0;
  card.querySelector('.option-xp').value = opt.xpRewards?.onComplete || 0;

  // Requirements
  if (opt.requirements?.staff?.[0]) {
    const staff = opt.requirements.staff[0];
    card.querySelector('.req-staff-role').value = staff.roleId || '';
    card.querySelector('.req-staff-count').value = staff.count || 1;
    card.querySelector('.req-staff-stars').value = staff.starsMin || 0;
  }

  // Inputs
  if (opt.inputs?.resources) {
    Object.entries(opt.inputs.resources).forEach(([resource, amount]) => {
      addInput(card.querySelector('.inputs-list + .btn-add'));
      const inputItem = card.querySelector('.inputs-list .input-item:last-child');
      inputItem.querySelector('.input-resource').value = resource;
      inputItem.querySelector('.input-amount').value = amount;
    });
  }

  // Resolution
  const resolutionType = opt.resolution?.type || 'weighted_outcomes';
  const resSelect = card.querySelector('.resolution-type');
  resSelect.value = resolutionType;
  updateResolutionFields(resSelect);

  switch (resolutionType) {
    case 'deterministic':
      card.querySelector('.res-cash').value = opt.resolution.outputs?.resources?.cash || 0;
      card.querySelector('.res-cred').value = opt.resolution.outputs?.resources?.cred || 0;
      card.querySelector('.res-heat').value = opt.resolution.heatDelta || 0;
      break;

    case 'ranged_outputs':
      const cashRange = opt.resolution.outputs?.resources?.cash;
      const credRange = opt.resolution.outputs?.resources?.cred;
      if (cashRange) {
        card.querySelector('.res-cash-min').value = cashRange.min || 0;
        card.querySelector('.res-cash-max').value = cashRange.max || 0;
      }
      if (credRange) {
        card.querySelector('.res-cred-min').value = credRange.min || 0;
        card.querySelector('.res-cred-max').value = credRange.max || 0;
      }
      card.querySelector('.res-heat').value = opt.resolution.heatDelta || 0;
      break;

    case 'weighted_outcomes':
      // Clear default outcomes
      card.querySelector('.outcomes-container').innerHTML = '';

      opt.resolution.outcomes?.forEach(outcome => {
        addOutcome(card.querySelector('.outcomes-container + .btn-add'));
        const oc = card.querySelector('.outcome-card:last-child');
        oc.querySelector('.outcome-id').value = outcome.id || '';
        oc.querySelector('.outcome-weight').value = outcome.weight || 50;
        oc.querySelector('.outcome-cash').value = outcome.outputs?.resources?.cash || 0;
        oc.querySelector('.outcome-cred').value = outcome.outputs?.resources?.cred || 0;
        oc.querySelector('.outcome-heat').value = outcome.heatDelta || 0;
        oc.querySelector('.outcome-jail').value = outcome.jail?.durationMs || 0;
      });
      break;
  }

  // Modifiers
  if (opt.modifiers?.length > 0) {
    const header = card.querySelector('.collapsible h4');
    toggleCollapsible(header); // Expand modifiers section

    opt.modifiers.forEach(mod => {
      addModifier(card.querySelector('.modifiers-list + .btn-add'));
      const modItem = card.querySelector('.modifier-item:last-child');
      modItem.querySelector('.modifier-attribute').value = mod.staffAttribute || 'stealth';
      modItem.querySelector('.modifier-outcome').value = mod.targetOutcome || '';
      modItem.querySelector('.modifier-delta').value = mod.weightDeltaPerPoint || 0;
    });
  }
}
