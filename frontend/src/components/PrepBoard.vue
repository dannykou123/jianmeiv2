<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCatalogStore } from '../stores/catalog.js'
import { useOrdersStore } from '../stores/orders.js'
import { usePrintSettingsStore } from '../stores/printSettings.js'
import { buildPrepPages } from '../print/legacyTemplates.js'

const emit = defineEmits(['preview'])
const router = useRouter()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const printSettings = usePrintSettingsStore()
const { selectedPrepStyle, docSize } = storeToRefs(printSettings)
const range = ref('today')
const customStart = ref('')
const customEnd = ref('')

function toYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateForOffset(offset) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return toYmd(date)
}

function setRange(nextRange) {
  range.value = nextRange
}

function clearDateRange() {
  range.value = 'today'
  customStart.value = ''
  customEnd.value = ''
}

const dateRange = computed(() => {
  const quickLabels = {
    today: ['今天', 0],
    tomorrow: ['明天', 1],
    after: ['後天', 2]
  }
  if (quickLabels[range.value]) {
    const [label, offset] = quickLabels[range.value]
    const date = dateForOffset(offset)
    return { start: date, end: date, label: `${label} ${date}` }
  }
  if (range.value === 'custom') {
    const start = customStart.value
    const end = customEnd.value
    if (start || end) {
      return {
        start,
        end,
        label: start === end ? start : `${start || '不限'} ~ ${end || '不限'}`
      }
    }
    return { start: '', end: '', label: '指定區間' }
  }
  return { start: '', end: '', label: '全部日期' }
})

const filteredOrders = computed(() => {
  const { start, end } = dateRange.value
  return orders.orders.filter((order) => {
    return (!start || order.date >= start) && (!end || order.date <= end)
  })
})

const productMeta = computed(() => {
  const byName = new Map()
  Object.entries(catalog.products).forEach(([type, list]) => {
    list.forEach((item) => byName.set(item.name, { ...item, type }))
  })
  return byName
})

function addQty(map, name, qty) {
  map.set(name, (map.get(name) || 0) + qty)
}

const tally = computed(() => {
  const normal = new Map()
  const vacuum = new Map()
  const combo = new Map()

  filteredOrders.value.forEach((order) => {
    order.members.forEach((member) => {
      member.items.forEach(([name, qty]) => {
        const product = productMeta.value.get(name)
        if (product?.parts?.length) {
          addQty(combo, name, qty)
          product.parts.forEach(([partName, partQty]) => {
            const part = productMeta.value.get(partName)
            addQty(part?.type === 'vacuum' ? vacuum : normal, partName, partQty * qty)
          })
          return
        }
        addQty(product?.type === 'vacuum' ? vacuum : normal, name, qty)
      })
    })
  })

  const rows = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])
  return {
    normal: rows(normal),
    vacuum: rows(vacuum),
    combo: rows(combo)
  }
})

const totalRows = computed(() => tally.value.normal.length + tally.value.vacuum.length)
const totalQty = computed(() => [...tally.value.normal, ...tally.value.vacuum].reduce((sum, [, qty]) => sum + qty, 0))
const comboQty = computed(() => tally.value.combo.reduce((sum, [, qty]) => sum + qty, 0))
const rangeLabel = computed(() => dateRange.value.label)
const hasDateFilter = computed(() => range.value !== 'today' || customStart.value || customEnd.value)

function openPreview() {
  if (!totalRows.value) return
  const pages = buildPrepPages({
    orders: filteredOrders.value,
    style: selectedPrepStyle.value,
    docSize: docSize.value,
    catalogProducts: catalog.products
  })
  emit('preview', {
    title: `備貨單預覽 · ${rangeLabel.value}`,
    kind: 'prep',
    pages
  })
}
</script>

<template>
  <section class="panel prepboard-panel">
    <div class="panel-head">
      <div>
        <h2>備貨清單 <span id="prepboardCount" class="count-pill">{{ totalRows }} 項</span></h2>
        <span>{{ filteredOrders.length }} 筆訂單 · {{ totalRows }} 項 · {{ totalQty }} 份</span>
      </div>
      <div class="action-row">
        <button type="button" class="ghost-btn pb-print pb-style" @click="router.push('/admin/prep')">樣式</button>
        <button type="button" class="primary-btn pb-print" :disabled="!totalRows" @click="openPreview">列印備貨單</button>
      </div>
    </div>

    <div class="toolbar pb-bar">
      <div class="seg-row">
        <button type="button" class="pb-quick" :class="{ on: range === 'today' }" @click="setRange('today')">今天</button>
        <button type="button" class="pb-quick" :class="{ on: range === 'tomorrow' }" @click="setRange('tomorrow')">明天</button>
        <button type="button" class="pb-quick" :class="{ on: range === 'after' }" @click="setRange('after')">後天</button>
        <button id="pbDateBtn" type="button" class="date-btn pb-quick" :class="{ on: range === 'custom' }" @click="setRange('custom')">
          <span id="pbDateLabel">{{ rangeLabel }}</span>
        </button>
        <button type="button" class="pb-quick" :class="{ on: range === 'all' }" @click="setRange('all')">全部</button>
      </div>
      <div v-if="range === 'custom'" class="date-range-inputs">
        <input v-model="customStart" type="date" class="search-input" aria-label="開始日期" />
        <span>到</span>
        <input v-model="customEnd" type="date" class="search-input" aria-label="結束日期" />
      </div>
      <button v-if="hasDateFilter" id="pbClearBtn" type="button" class="ghost-btn pb-clear" @click="clearDateRange">清除</button>
      <span id="pbRangeLabel" class="pill pb-info">{{ rangeLabel }}</span>
      <span class="pill">{{ filteredOrders.length }} 筆訂單</span>
    </div>

    <div class="grid-3">
      <div class="stat-card"><span>一般滷味</span><strong>{{ tally.normal.length }}</strong><small>{{ tally.normal.reduce((s, [, q]) => s + q, 0) }} 份</small></div>
      <div class="stat-card"><span>真空包裝</span><strong>{{ tally.vacuum.length }}</strong><small>{{ tally.vacuum.reduce((s, [, q]) => s + q, 0) }} 份</small></div>
      <div class="stat-card"><span>組合商品</span><strong>{{ comboQty }}</strong><small>已拆解併入上方加總</small></div>
    </div>

    <div v-if="totalRows" id="prepboardStat" class="prepboard-grid">
      <article v-if="tally.normal.length" class="prep-card pb-card normal">
        <header><strong>一般滷味</strong><span>{{ tally.normal.length }} 項</span></header>
        <div class="prep-items pb-grid">
          <div v-for="[name, qty] in tally.normal" :key="name" class="prep-item pb-item"><b class="pb-q">{{ qty }}</b><span class="pb-n">{{ name }}</span></div>
        </div>
      </article>

      <article v-if="tally.vacuum.length" class="prep-card pb-card vacuum">
        <header><strong>真空包裝</strong><span>{{ tally.vacuum.length }} 項</span></header>
        <div class="prep-items pb-grid">
          <div v-for="[name, qty] in tally.vacuum" :key="name" class="prep-item pb-item"><b class="pb-q">{{ qty }}</b><span class="pb-n">{{ name }}</span></div>
        </div>
      </article>

      <article v-if="tally.combo.length" class="prep-card pb-card combo">
        <header><strong>組合商品</strong><span>{{ comboQty }} 份 · 已拆解</span></header>
        <div class="prep-items pb-grid">
          <div v-for="[name, qty] in tally.combo" :key="name" class="prep-item pb-item combo"><b class="pb-q">{{ qty }}</b><span class="pb-n">{{ name }}</span></div>
        </div>
      </article>
    </div>
    <p v-else class="set-note">此日期範圍沒有可備貨的訂單。</p>
  </section>
</template>
