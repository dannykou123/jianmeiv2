import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '../src/views/OrganizerView.vue'), 'utf8')
const styles = readFileSync(resolve(here, '../src/styles/legacy.css'), 'utf8')

function expectIncludes(needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Expected OrganizerView.vue to include ${label}`)
  }
}

function expectExcludes(needle, label) {
  if (source.includes(needle)) {
    throw new Error(`Expected OrganizerView.vue to exclude ${label}`)
  }
}

expectIncludes('id="orgPeople"', 'the orderer detail panel')
expectIncludes('class="primary-btn quick-add-trigger"', 'the add-orderer action in the detail header')
expectIncludes('id="quickAddModal"', 'the quick add modal')
expectIncludes('class="org-settings-grid"', 'the merged group settings layout')
expectExcludes('class="panel org-panel proxy-panel"', 'the standalone orderer management panel')

if (!/\.org-settings-grid\s*\{[^}]*grid-template-columns:\s*1fr;/s.test(styles)) {
  throw new Error('Expected merged organizer settings to use a single-column layout')
}

if (/\.team-pay-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/s.test(styles)) {
  throw new Error('Expected organizer payment fields not to use the old four-column grid')
}
