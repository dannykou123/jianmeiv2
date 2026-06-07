import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ordererSource = readFileSync(resolve(here, '../src/views/OrdererView.vue'), 'utf8')
const settingsSource = readFileSync(resolve(here, '../src/components/SettingsPanel.vue'), 'utf8')
const uiSettingsSource = readFileSync(resolve(here, '../src/stores/uiSettings.js'), 'utf8')
const styles = readFileSync(resolve(here, '../src/styles/legacy.css'), 'utf8')

function expectIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Expected ${label}`)
  }
}

function expectExcludes(source, needle, label) {
  if (source.includes(needle)) {
    throw new Error(`Expected to exclude ${label}`)
  }
}

expectIncludes(ordererSource, '<main id="orderer"', 'OrdererView.vue to keep the orderer page')
expectIncludes(ordererSource, '<h2>訂購人資料</h2>', 'OrdererView.vue to keep the orderer profile form')
expectIncludes(ordererSource, 'function submit()', 'OrdererView.vue to keep order submission')

expectExcludes(ordererSource, 'const history = ref', 'local orderer history state')
expectExcludes(ordererSource, 'const visibleHistory = computed', 'visible orderer history computed state')
expectExcludes(ordererSource, 'const canReorder = computed', 'orderer reorder computed state')
expectExcludes(ordererSource, 'function reorder(', 'orderer reorder handler')
expectExcludes(ordererSource, 'history.value.unshift', 'saving submitted orders into orderer history')
expectExcludes(ordererSource, 'keepOrdererHistory', 'orderer history setting usage on the orderer page')
expectExcludes(ordererSource, 'visibleHistory', 'orderer history rendering')
expectExcludes(ordererSource, 'hist-reorder', 'reorder button rendering')

expectIncludes(settingsSource, 'id="swOrg"', 'settings to keep organizer history control')
expectIncludes(settingsSource, 'id="histOrgInput"', 'settings to keep organizer history limit')
expectExcludes(settingsSource, 'id="rowReorder"', 'the orderer reorder setting row')
expectExcludes(settingsSource, 'id="swReorder"', 'the orderer reorder setting switch')
expectExcludes(settingsSource, 'allowReorder', 'orderer reorder setting usage')
expectExcludes(settingsSource, 'id="swOrd"', 'the orderer history setting switch')
expectExcludes(settingsSource, 'id="rowOrdCount"', 'the orderer history limit row')
expectExcludes(settingsSource, 'keepOrdererHistory', 'orderer history setting usage')
expectExcludes(settingsSource, 'ordererHistoryLimit', 'orderer history limit setting usage')

expectExcludes(uiSettingsSource, 'allowReorder', 'default orderer reorder setting')
expectExcludes(uiSettingsSource, 'keepOrdererHistory', 'default orderer history setting')
expectExcludes(uiSettingsSource, 'ordererHistoryLimit', 'default orderer history limit')

expectExcludes(styles, '.hist-reorder', 'stale reorder button styles')
