const fs = require('fs');
const path = require('path');

const targetPath = process.argv[2] || '健美滷味_團購系統_優化版_修正版.html';
const htmlPath = path.resolve(process.cwd(), targetPath);
const html = fs.readFileSync(htmlPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...html.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
  return matches.length ? matches[matches.length - 1][1] : '';
}

function assertVar(variable) {
  assert(html.includes(`${variable}:`), `Missing root variable ${variable}`);
  assert(html.includes(`['${variable}',`), `Missing font-size slider ${variable}`);
}

const ordererVars = [
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
];

const organizerVars = [
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

const smallUiVars = [
  '--fs-ui-10',
  '--fs-ui-11',
  '--fs-ui-11-5',
  '--fs-ui-12',
  '--fs-ui-12-5',
  '--fs-ui-13',
  '--fs-ui-13-5',
  '--fs-ui-14',
  '--fs-ui-14-5',
  '--fs-ui-15',
  '--fs-ui-16',
  '--fs-ui-17',
  '--fs-ui-18',
  '--fs-ui-19',
  '--fs-ui-20',
  '--fs-ui-21',
  '--fs-ui-22',
  '--fs-ui-23',
  '--fs-ui-24',
  '--fs-ui-25',
  '--fs-ui-26',
  '--fs-ui-28',
  '--fs-ui-30',
  '--fs-ui-34',
];

[...ordererVars, ...organizerVars, ...smallUiVars].forEach(assertVar);

[
  ['.ord-shop', '--fs-ord-shop'],
  ['.ord-sub', '--fs-ord-sub'],
  ['.ord-cat', '--fs-ord-cat'],
  ['.ord-cat-title', '--fs-ord-cat-title'],
  ['.ord-item-nm', '--fs-ord-item'],
  ['.ord-item-desc', '--fs-ord-desc'],
  ['.ord-item-price', '--fs-ord-price'],
  ['.ord-note-ta', '--fs-ord-note'],
  ['.ord-checkout .oc-k', '--fs-ord-summary'],
  ['.ord-checkout .oc-v', '--fs-ord-total'],
  ['.org-proxy-btn', '--fs-org-action'],
  ['.team-new-btn', '--fs-org-action'],
  ['.team-badge', '--fs-org-team-status'],
  ['.team-id', '--fs-org-team-code'],
  ['.person-nm', '--fs-org-member-name'],
  ['.person-summary', '--fs-org-member-meta'],
  ['.person-amt', '--fs-org-member-amount'],
  ['.person-tag', '--fs-org-member-tag'],
  ['.person-pay,.person-edit,.person-del-btn', '--fs-org-member-action'],
  ['.org-foot-c', '--fs-org-foot-small'],
  ['.org-foot-go', '--fs-org-foot'],
].forEach(([selector, variable]) => {
  const rule = cssRule(selector);
  assert(rule.includes(variable), `${selector} must use ${variable}`);
});

[
  '.set-modal',
  '.set-panel',
  '.set-content',
  '.set-modal-x',
  '.stepper button',
  '.stepper .qty',
  '.px-step button',
  '.qk-ord-del',
  '.route-no',
  '.m-badge',
].forEach(selector => {
  assert(cssRule(selector), `Missing CSS rule ${selector}`);
});

const setModalRule = cssRule('.set-modal');
assert(setModalRule.includes('position:fixed'), '.set-modal must be fixed to viewport');
assert(setModalRule.includes('overflow-y:auto') || setModalRule.includes('overflow:auto'), '.set-modal must allow scrolling when content is taller than viewport');
assert(!setModalRule.includes('overflow:hidden'), '.set-modal must not hide overflowing settings content');

const setPanelRule = cssRule('.set-panel');
assert(setPanelRule.includes('max-height:'), '.set-panel must constrain height inside viewport');
assert(setPanelRule.includes('overflow:hidden'), '.set-panel should keep header/tabs fixed while content scrolls');

const setContentRule = cssRule('.set-content');
assert(setContentRule.includes('overflow-y:auto'), '.set-content must scroll independently');

const setCloseRule = cssRule('.set-modal-x');
assert(setCloseRule.includes('position:relative'), '.set-modal close button must remain above modal content');
assert(setCloseRule.includes('z-index:'), '.set-modal close button needs a z-index');

[
  '.stepper button',
  '.stepper .qty',
  '.px-step button',
  '.qk-ord-del',
  '.route-no',
  '.m-badge',
].forEach(selector => {
  const rule = cssRule(selector);
  assert(rule.includes('max('), `${selector} must scale its box with larger font sizes`);
  assert(rule.includes('white-space:nowrap'), `${selector} must not wrap compact text`);
});

assert(!html.includes('containing block 敶梢嚗?/'), 'Malformed settings-modal CSS comment must be fixed');

console.log(`Old HTML settings checks OK: ${path.basename(htmlPath)}`);
