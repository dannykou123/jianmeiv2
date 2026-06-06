<script setup>
import { computed, ref } from 'vue'
import { useCatalogStore } from '../stores/catalog.js'

const catalog = useCatalogStore()
const filter = ref('all')
const keyword = ref('')
const operationItem = ref(null)
const operationMode = ref('in')
const operationQty = ref(1)
const operationCost = ref('')
const message = ref('')
const operationHistory = ref([])

const items = computed(() => Object.entries(catalog.products).flatMap(([type, list]) => list.map((item) => ({
  ...item,
  type,
  isCombo: Array.isArray(item.parts) && item.parts.length > 0
}))))

const stockItems = computed(() => items.value.filter((item) => !item.isCombo))
const lowItems = computed(() => stockItems.value.filter((item) => Number(item.stock) <= Number(item.low)))
const totalCost = computed(() => stockItems.value.reduce((sum, item) => sum + Number(item.stock || 0) * Number(item.cost || 0), 0))
const potentialProfit = computed(() => stockItems.value.reduce((sum, item) => {
  const stock = Number(item.stock || 0)
  return sum + stock * (Number(item.price || 0) - Number(item.cost || 0))
}, 0))

const filteredItems = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return items.value.filter((item) => {
    const typeOk =
      filter.value === 'all' ||
      (filter.value === 'low' && !item.isCombo && Number(item.stock) <= Number(item.low)) ||
      (filter.value === 'combo' && item.isCombo) ||
      item.type === filter.value
    return typeOk && item.name.toLowerCase().includes(text)
  })
})

function money(value) {
  return Number(value || 0).toLocaleString()
}

function unitMargin(item) {
  return Number(item.price || 0) - Number(item.cost || 0)
}

function marginPercent(item) {
  const price = Number(item.price || 0)
  if (!price) return 0
  return Math.round((unitMargin(item) / price) * 100)
}

function adjust(id, delta) {
  catalog.adjustStock(id, delta)
}

function openOperation(item, mode = 'in') {
  if (item.isCombo) return
  operationItem.value = item
  operationMode.value = mode
  operationQty.value = mode === 'set' ? Number(item.stock || 0) : 1
  operationCost.value = mode === 'out' ? '' : Number(item.cost || 0)
  message.value = ''
}

function closeOperation() {
  operationItem.value = null
}

function operationLabel(mode = operationMode.value) {
  return { in: '進貨', out: '耗用/報廢', set: '盤點修正' }[mode] || mode
}

function applyOperation() {
  if (!operationItem.value) return
  const result = catalog.applyStockOperation(operationItem.value.id, {
    mode: operationMode.value,
    qty: operationQty.value,
    cost: operationCost.value
  })
  if (!result) {
    message.value = '此品項無法調整庫存'
    return
  }
  const text = `${operationLabel()}「${result.name}」：${result.before} → ${result.after}`
  operationHistory.value.unshift({
    id: `${Date.now()}-${result.id}`,
    text,
    time: new Date().toLocaleString('zh-TW', { hour12: false })
  })
  operationHistory.value = operationHistory.value.slice(0, 6)
  message.value = text
  closeOperation()
}
</script>

<template>
  <section class="panel inventory-panel">
    <div class="panel-head">
      <div>
        <h2>庫存管理</h2>
        <span>{{ stockItems.length }} 個單品 · {{ lowItems.length }} 個低庫存</span>
      </div>
      <button type="button" class="ghost-btn" @click="filter = 'low'">查看低庫存</button>
    </div>

    <div class="grid-3">
      <div class="stat-card"><span>庫存總成本</span><strong>${{ money(totalCost) }}</strong></div>
      <div class="stat-card"><span>潛在毛利</span><strong>${{ money(potentialProfit) }}</strong></div>
      <div class="stat-card" :class="{ warn: lowItems.length }"><span>低庫存品項</span><strong>{{ lowItems.length }}</strong></div>
    </div>

    <div class="toolbar">
      <input v-model="keyword" class="search-input" placeholder="搜尋商品" />
      <div class="seg-row">
        <button type="button" :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</button>
        <button type="button" :class="{ on: filter === 'low' }" @click="filter = 'low'">低庫存</button>
        <button type="button" :class="{ on: filter === 'normal' }" @click="filter = 'normal'">一般</button>
        <button type="button" :class="{ on: filter === 'vacuum' }" @click="filter = 'vacuum'">真空</button>
        <button type="button" :class="{ on: filter === 'combo' }" @click="filter = 'combo'">組合</button>
      </div>
    </div>

    <div class="inventory-list">
      <article v-for="item in filteredItems" :key="item.id" class="inventory-row" :class="{ low: !item.isCombo && item.stock <= item.low, combo: item.isCombo }">
        <div>
          <strong>{{ item.name }}</strong>
          <small v-if="item.isCombo">組合：{{ item.parts.map(([name, qty]) => `${name} x ${qty}`).join('、') }}</small>
          <small v-else>{{ item.type === 'vacuum' ? '真空包裝' : '一般滷味' }} · 安全庫存 {{ item.low }}</small>
        </div>
        <div class="inventory-metrics">
          <div class="inventory-fig">
            <span>售價</span>
            <b>${{ money(item.price) }}</b>
          </div>
          <div class="inventory-fig">
            <span>{{ item.isCombo ? '庫存' : '現有' }}</span>
            <b>{{ item.isCombo ? '拆單品' : item.stock }}</b>
          </div>
          <template v-if="!item.isCombo">
            <div class="inventory-fig">
              <span>單位成本</span>
              <b>${{ money(item.cost) }}</b>
            </div>
            <div class="inventory-fig">
              <span>毛利</span>
              <b :class="{ neg: unitMargin(item) < 0 }">${{ money(unitMargin(item)) }}</b>
            </div>
            <div class="inventory-fig">
              <span>毛利率</span>
              <b :class="{ neg: unitMargin(item) < 0 }">{{ marginPercent(item) }}%</b>
            </div>
            <div class="inventory-fig">
              <span>庫存成本</span>
              <b>${{ money(Number(item.stock || 0) * Number(item.cost || 0)) }}</b>
            </div>
          </template>
        </div>
        <div v-if="!item.isCombo" class="stock-actions">
          <button type="button" @click="adjust(item.id, -10)">-10</button>
          <button type="button" @click="adjust(item.id, -1)">-1</button>
          <button type="button" @click="adjust(item.id, 1)">+1</button>
          <button type="button" @click="adjust(item.id, 10)">+10</button>
          <button type="button" @click="openOperation(item, 'in')">進貨</button>
          <button type="button" @click="openOperation(item, 'out')">耗用</button>
          <button type="button" @click="openOperation(item, 'set')">盤點</button>
        </div>
        <span v-if="!item.isCombo && item.stock <= item.low" class="pill danger">低庫存</span>
      </article>
      <p v-if="!filteredItems.length" class="set-note">沒有符合條件的庫存項目。</p>
    </div>

    <p v-if="message" class="status-line">{{ message }}</p>

    <section v-if="operationHistory.length" class="inventory-history">
      <div class="panel-subhead">
        <h3>最近庫存操作</h3>
        <span>{{ operationHistory.length }} 筆</span>
      </div>
      <article v-for="record in operationHistory" :key="record.id" class="log-row">
        <span>{{ record.time }}</span>
        <em>{{ record.text }}</em>
      </article>
    </section>

    <div v-if="operationItem" class="modal-backdrop" @click.self="closeOperation">
      <section class="edit-modal inventory-modal">
        <header>
          <h2>{{ operationLabel() }}</h2>
          <button type="button" @click="closeOperation">×</button>
        </header>
        <div class="inventory-modal-summary">
          <strong>{{ operationItem.name }}</strong>
          <span>目前庫存 {{ operationItem.stock }} 件 · 成本 ${{ money(operationItem.cost) }}</span>
        </div>
        <div class="seg-row">
          <button type="button" :class="{ on: operationMode === 'in' }" @click="operationMode = 'in'; operationQty = 1; operationCost = operationItem.cost || 0">進貨</button>
          <button type="button" :class="{ on: operationMode === 'out' }" @click="operationMode = 'out'; operationQty = 1; operationCost = ''">耗用/報廢</button>
          <button type="button" :class="{ on: operationMode === 'set' }" @click="operationMode = 'set'; operationQty = operationItem.stock || 0; operationCost = operationItem.cost || 0">盤點修正</button>
        </div>
        <div class="form-grid">
          <label>{{ operationMode === 'set' ? '修正後庫存' : '數量' }}<input v-model.number="operationQty" type="number" min="0" /></label>
          <label v-if="operationMode !== 'out'">單位成本<input v-model.number="operationCost" type="number" min="0" /></label>
        </div>
        <p class="set-note">
          進貨會增加庫存並可更新成本；耗用/報廢會扣庫存；盤點修正會直接覆蓋目前庫存數量。
        </p>
        <footer>
          <button type="button" class="ghost-btn" @click="closeOperation">取消</button>
          <button type="button" class="primary-btn" @click="applyOperation">套用</button>
        </footer>
      </section>
    </div>
  </section>
</template>
