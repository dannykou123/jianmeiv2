import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const ordersPage = readFileSync(resolve(here, '../src/components/AdminOrdersPage.vue'), 'utf8')
const adminShell = readFileSync(resolve(here, '../src/views/AdminShell.vue'), 'utf8')
const prepBoard = readFileSync(resolve(here, '../src/components/PrepBoard.vue'), 'utf8')
const styles = readFileSync(resolve(here, '../src/styles/legacy.css'), 'utf8')

function expectIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Expected ${label}`)
  }
}

expectIncludes(ordersPage, "import { buildOrderPrepSummary, buildPrepTally, topPrepRows } from '../utils/prepTally.js'", 'orders page to import shared prep tally helpers')
expectIncludes(ordersPage, "defineEmits(['preview-a4', 'preview-ship', 'preview-order', 'preview-member', 'preview-prep'])", 'orders page to emit filtered prep previews')
expectIncludes(ordersPage, 'const filteredPrepTally = computed', 'orders page to derive prep tally from filtered orders')
expectIncludes(ordersPage, 'class="order-prep-summary"', 'a compact prep summary band in orders page')
expectIncludes(ordersPage, 'class="order-prep-detail"', 'an expandable prep detail area in orders page')
expectIncludes(ordersPage, '@click="previewFilteredPrep"', 'filtered prep print action in orders page')
expectIncludes(ordersPage, '依目前篩選', 'prep summary to clarify it follows current filters')

expectIncludes(adminShell, '@preview-prep="openPreview(\'prep\', $event)"', 'admin shell to route prep preview events')
expectIncludes(adminShell, "['prepboard', '備貨清單']", 'the dedicated prep board route to stay available')
expectIncludes(prepBoard, "import { buildPrepTally } from '../utils/prepTally.js'", 'prep board to reuse shared tally logic')

expectIncludes(styles, '.order-prep-summary', 'styles for compact prep summary')
expectIncludes(styles, '.order-prep-detail', 'styles for expanded prep detail')
expectIncludes(styles, '.ops-chips', 'styles for prep summary chips')

console.log('admin orders prep integration ok')
