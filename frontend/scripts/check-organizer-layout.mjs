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
expectIncludes('const inTeamDetail = computed', 'a route-driven organizer detail mode')
expectIncludes('id="orgLandingView"', 'the first-level organizer landing view')
expectIncludes('id="orgCurrentTeams"', 'the current groups section on the landing view')
expectIncludes('id="orgPastTeams"', 'the past groups section on the landing view')
expectIncludes('v-if="inTeamDetail && activeTeam"', 'detail-only organizer management content')
expectIncludes('v-if="!inTeamDetail"', 'landing-only organizer list content')
expectIncludes('@click="enterTeam(team.id)"', 'team cards entering the detail route')
expectIncludes('@click="backToTeamList"', 'the detail route back action')
expectIncludes('@click="openEditTeam"', 'the group info edit action')
expectIncludes('function saveTeam()', 'a shared create/edit group save handler')
expectIncludes('class="primary-btn quick-add-trigger"', 'the add-orderer action in the detail header')
expectIncludes('id="quickAddModal"', 'the quick add modal')
expectIncludes('class="org-settings-grid org-settings-clean"', 'the simplified group settings layout')
expectIncludes('class="action-row org-settings-actions"', 'the prominent group settings action area')
expectIncludes('class="pill org-submit-status"', 'the status pill in the organizer settings header')
expectIncludes('class="primary-btn org-submit-primary org-submit-top"', 'the prominent top-right submit-to-shop action')
expectIncludes('列印訂單表', 'the renamed order print action')
expectIncludes('@click="openEditMember(order, member)"', 'the member edit action in orderer details')
expectIncludes('id="orgMemberEditModal"', 'the organizer member edit modal')
expectIncludes('function saveMemberEditor()', 'the organizer member edit save handler')
expectExcludes('class="panel org-panel proxy-panel"', 'the standalone orderer management panel')
expectExcludes('class="tcard-next"', 'the next-step prompt on group cards')
expectExcludes('function teamNextAction', 'the next-step prompt helper')
expectExcludes('class="parts-textarea team-note-l"', 'the visible LINE share text editor')
expectExcludes('id="orgSubmitBar"', 'the verbose submit status block')
expectExcludes('class="primary-btn osb-btn"', 'the primary submit action inside the status bar')
expectExcludes('demoReview(\'accept\')', 'the shop accept demo action in organizer settings')
expectExcludes('demoReview(\'reject\')', 'the shop reject demo action in organizer settings')
expectExcludes('列印 A4 訂單表', 'the old A4-specific print action label')
expectExcludes('v-model.trim="memberEditor.phone"', 'phone editing in organizer member editor')
expectExcludes('v-model="quickMember.phone"', 'phone entry in organizer quick add')

const actionsStart = source.indexOf('class="action-row org-settings-actions"')
const actionsEnd = source.indexOf('</div>', actionsStart)
const actionsSource = source.slice(actionsStart, actionsEnd)
const actionOrder = [
  ['class="pill org-submit-status"', 'status pill'],
  ['class="primary-btn org-submit-primary org-submit-top"', 'submit action'],
  ['列印訂單表', 'print action'],
  ['編輯開團資訊', 'edit group action']
].map(([needle, label]) => {
  const index = actionsSource.indexOf(needle)
  if (index < 0) throw new Error(`Expected OrganizerView.vue to include ${label}`)
  return { index, label }
})

for (let i = 1; i < actionOrder.length; i += 1) {
  if (actionOrder[i].index <= actionOrder[i - 1].index) {
    throw new Error('Expected organizer settings actions to be ordered: status, submit, print, edit group')
  }
}

if (!/\.org-settings-grid\s*\{[^}]*grid-template-columns:\s*1fr;/s.test(styles)) {
  throw new Error('Expected merged organizer settings to use a single-column layout')
}

if (!/\.org-settings-clean\s*\{[^}]*display:\s*grid;/s.test(styles)) {
  throw new Error('Expected simplified organizer settings to be a clean grid')
}

if (/\.team-pay-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/s.test(styles)) {
  throw new Error('Expected organizer payment fields not to use the old four-column grid')
}
