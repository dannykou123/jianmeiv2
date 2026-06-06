import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, '../src/views/OrganizerView.vue'), 'utf8')

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
