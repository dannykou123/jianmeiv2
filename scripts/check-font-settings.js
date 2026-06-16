const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getCssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...html.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  assert(matches.length, `Missing CSS rule for ${selector}`);
  const withFontSize = matches.find(match => match[1].includes('font-size'));
  return (withFontSize || matches[0])[1].replace(/\s+/g, ' ');
}

function assertRuleUsesVar(selector, variable) {
  const rule = getCssRule(selector);
  assert(
    rule.includes(`font-size:var(${variable})`),
    `${selector} should use ${variable} for font-size`
  );
  assert(
    !/font-size:\s*\d+(?:\.\d+)?px/.test(rule),
    `${selector} should not keep a fixed px font-size`
  );
}

function assertVarDefault(variable) {
  assert(html.includes(`${variable}:`), `Missing default CSS variable ${variable}`);
}

function assertSlider(variable) {
  assert(html.includes(`['${variable}',`), `Missing font-size slider for ${variable}`);
}

const requiredVars = [
  '--fs-ord-shop',
  '--fs-ord-sub',
  '--fs-ord-cat',
  '--fs-ord-cat-title',
  '--fs-ord-item',
  '--fs-ord-desc',
  '--fs-ord-price',
  '--fs-ord-note',
  '--fs-ord-pay',
  '--fs-ord-summary',
  '--fs-ord-total',
  '--fs-ord-cart',
  '--fs-ord-cart-small',
  '--fs-ord-modal',
  '--fs-ord-history-title',
  '--fs-ord-history-small',
  '--fs-ord-history-amount',
  '--fs-org-action',
  '--fs-org-list-title',
  '--fs-org-list-meta',
  '--fs-org-list-badge',
  '--fs-org-list-amount',
  '--fs-org-stat-value',
  '--fs-org-stat-label',
  '--fs-org-team-status',
  '--fs-org-team-code',
  '--fs-org-member-name',
  '--fs-org-member-meta',
  '--fs-org-member-amount',
  '--fs-org-member-tag',
  '--fs-org-member-action',
  '--fs-org-summary-label',
  '--fs-org-summary-value',
  '--fs-org-submit',
  '--fs-org-submit-small',
  '--fs-org-foot',
  '--fs-org-foot-small',
];

requiredVars.forEach(variable => {
  assertVarDefault(variable);
  assertSlider(variable);
});

[
  ['.ord-shop', '--fs-ord-shop'],
  ['.ord-sub', '--fs-ord-sub'],
  ['.ord-cat', '--fs-ord-cat'],
  ['.ord-cat-title', '--fs-ord-cat-title'],
  ['.ord-item-nm', '--fs-ord-item'],
  ['.ord-item-desc', '--fs-ord-desc'],
  ['.ord-item-price', '--fs-ord-price'],
  ['.ord-extra .ord-note-l', '--fs-ord-note'],
  ['.ord-pay-t', '--fs-ord-pay'],
  ['.ord-pay-sec .pay-opt', '--fs-ord-pay'],
  ['.ord-checkout .oc-k', '--fs-ord-summary'],
  ['.ord-checkout .oc-v', '--fs-ord-total'],
  ['.oc-submit', '--fs-ord-cart'],
  ['.ord-cart-bar', '--fs-ord-cart'],
  ['.ord-cart-c', '--fs-ord-cart-small'],
  ['.ord-cart-t', '--fs-ord-cart'],
  ['.ord-modal-h', '--fs-ord-modal'],
  ['.cart-row-nm', '--fs-ord-modal'],
  ['.cart-row-nm small', '--fs-ord-history-small'],
  ['.cart-total-row', '--fs-ord-summary'],
  ['.cart-total-row b', '--fs-ord-total'],
  ['.ord-modal-tot', '--fs-ord-summary'],
  ['.ord-modal-tot b', '--fs-ord-total'],
  ['.os-title', '--fs-ord-modal'],
  ['.os-desc', '--fs-ord-summary'],
  ['.os-done', '--fs-ord-cart'],
  ['.hist-h', '--fs-ord-history-title'],
  ['.hist-date', '--fs-ord-history-small'],
  ['.hist-sub', '--fs-ord-history-small'],
  ['.hist-amt', '--fs-ord-history-amount'],
  ['.org-share', '--fs-org-action'],
  ['.team-new-btn', '--fs-org-action'],
  ['.tcard-nm', '--fs-org-list-title'],
  ['.tcard-badge', '--fs-org-list-badge'],
  ['.tcard-meta span', '--fs-org-list-meta'],
  ['.tcard-stat', '--fs-org-list-amount'],
  ['.tcard-op', '--fs-org-action'],
  ['.ts-badge', '--fs-org-submit-small'],
  ['.ts-act', '--fs-org-submit-small'],
  ['.os-v', '--fs-org-stat-value'],
  ['.os-k', '--fs-org-stat-label'],
  ['.team-badge', '--fs-org-team-status'],
  ['.team-id', '--fs-org-team-code'],
  ['.team-note-l', '--fs-org-member-meta'],
  ['.team-actbar>button', '--fs-org-action'],
  ['.team-copy', '--fs-org-action'],
  ['.team-line', '--fs-org-action'],
  ['.team-toggle-mini', '--fs-org-action'],
  ['.org-act', '--fs-org-action'],
  ['.person-nm', '--fs-org-member-name'],
  ['.person-dept', '--fs-org-member-meta'],
  ['.person-amt', '--fs-org-member-amount'],
  ['.person-tag', '--fs-org-member-tag'],
  ['.person-pay,.person-edit,.person-del-btn', '--fs-org-member-action'],
  ['.paid-badge,.unpaid-badge', '--fs-org-submit-small'],
  ['.pay-sum-k', '--fs-org-summary-label'],
  ['.pay-sum-l b', '--fs-org-summary-value'],
  ['.pay-sum-amt span', '--fs-org-summary-label'],
  ['.pay-sum-amt b', '--fs-org-summary-value'],
  ['.osb-badge', '--fs-org-submit-small'],
  ['.osb-when', '--fs-org-submit-small'],
  ['.osb-desc', '--fs-org-submit'],
  ['.osb-btn', '--fs-org-submit-small'],
  ['.osb-demo', '--fs-org-submit-small'],
  ['.org-foot-bar', '--fs-org-foot'],
  ['.org-foot-c', '--fs-org-foot-small'],
].forEach(([selector, variable]) => assertRuleUsesVar(selector, variable));

const noWrapRules = [
  '.ord-cat',
  '.oc-submit',
  '.ord-cart-go',
  '.cart-total-row',
  '.ord-modal-tot',
  '.ord-modal-h',
  '.os-title',
  '.os-done',
  '.ord-pay-sec .pay-opt',
  '.tcard-op',
  '.team-copy',
  '.team-line',
  '.team-actbar>button',
  '.team-toggle-mini',
  '.org-act',
  '.person-pay,.person-edit,.person-del-btn',
  '.osb-btn',
  '.org-foot-bar',
  '.org-foot-go',
];

noWrapRules.forEach(selector => {
  const rule = getCssRule(selector);
  assert(rule.includes('white-space:nowrap'), `${selector} must prevent button text wrapping`);
});

console.log(`Font-size settings coverage OK (${requiredVars.length} variables checked).`);
