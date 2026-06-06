<script setup>
import { computed, reactive, ref } from 'vue'
import { useCatalogStore } from '../stores/catalog.js'

const catalog = useCatalogStore()
const activeType = ref('normal')
const search = ref('')
const message = ref('')
const modalOpen = ref(false)
const editingId = ref('')
const form = reactive({
  type: 'normal',
  name: '',
  desc: '',
  price: 0,
  stock: 0,
  cost: 0,
  low: 10,
  combo: false,
  parts: {}
})

const activeTypeTotal = computed(() => (catalog.products[activeType.value] || []).length)
const activeTypeLabel = computed(() => catalog.productTypes.find((type) => type.key === activeType.value)?.label || '')

function productSearchText(item) {
  const parts = (item.parts || []).map(([name, qty]) => `${name} ${qty}`).join(' ')
  const type = item.parts?.length ? '組合 組合商品' : '單品'
  return [item.name, item.desc, type, parts].filter(Boolean).join(' ').toLowerCase()
}

const products = computed(() => (catalog.products[activeType.value] || []).filter((item) => {
  const query = search.value.trim().toLowerCase()
  return productSearchText(item).includes(query)
}))

const partOptions = computed(() => (catalog.products[form.type] || []).filter((item) => {
  return item.id !== editingId.value && !item.parts
}))

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

function comboPartCount(item) {
  return (item.parts || []).reduce((sum, [, qty]) => sum + Number(qty || 0), 0)
}

function resetForm(type = activeType.value) {
  Object.assign(form, {
    type,
    name: '',
    desc: '',
    price: 0,
    stock: 0,
    cost: 0,
    low: 10,
    combo: false,
    parts: {}
  })
}

function openCreate() {
  editingId.value = ''
  resetForm(activeType.value)
  modalOpen.value = true
}

function openEdit(item) {
  editingId.value = item.id
  const foundType = Object.entries(catalog.products).find(([, list]) => list.some((product) => product.id === item.id))?.[0] || activeType.value
  resetForm(foundType)
  form.name = item.name
  form.desc = item.desc || ''
  form.price = item.price
  form.stock = item.stock || 0
  form.cost = item.cost || 0
  form.low = item.low || 10
  form.combo = Array.isArray(item.parts) && item.parts.length > 0
  if (form.combo) {
    item.parts.forEach(([name, qty]) => {
      form.parts[name] = qty
    })
  }
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

function togglePart(name) {
  if (form.parts[name]) {
    delete form.parts[name]
  } else {
    form.parts[name] = 1
  }
}

function selectedParts() {
  const allowedNames = new Set(partOptions.value.map((item) => item.name))
  return Object.entries(form.parts)
    .filter(([name]) => allowedNames.has(name))
    .filter(([, qty]) => Number(qty) > 0)
    .map(([name, qty]) => [name, Number(qty) || 1])
}

function setProductType(type) {
  if (form.type === type) return
  form.type = type
  onProductTypeChange()
}

function setComboMode(combo) {
  if (form.combo === combo) return
  form.combo = combo
  onComboModeChange()
}

function onProductTypeChange() {
  if (form.combo) form.parts = {}
}

function onComboModeChange() {
  if (!form.combo) form.parts = {}
}

function saveProduct() {
  if (!form.name.trim()) {
    message.value = '請輸入商品名稱'
    return
  }
  if (Number(form.price) < 0) {
    message.value = '請輸入有效價格'
    return
  }
  const parts = form.combo ? selectedParts() : []
  if (form.combo && !parts.length) {
    message.value = '組合商品請至少選一項組成'
    return
  }
  const payload = {
    id: editingId.value || undefined,
    name: form.name,
    desc: form.desc,
    price: form.price,
    stock: form.stock,
    cost: form.cost,
    low: form.low,
    parts
  }
  if (editingId.value) {
    const currentType = Object.entries(catalog.products).find(([, list]) => list.some((item) => item.id === editingId.value))?.[0]
    if (currentType === form.type) {
      catalog.updateProduct(editingId.value, payload)
    } else {
      catalog.deleteProduct(editingId.value)
      catalog.addProduct(form.type, payload)
    }
  } else {
    catalog.addProduct(form.type, payload)
  }
  activeType.value = form.type
  message.value = editingId.value ? `已更新「${form.name}」` : `已新增「${form.name}」`
  closeModal()
}

function deleteProduct(item) {
  const ok = window.confirm(`確定刪除「${item.name}」？`)
  if (!ok) return
  catalog.deleteProduct(item.id)
  message.value = `已刪除「${item.name}」`
}
</script>

<template>
  <section id="productsPanel" class="panel products-panel">
    <div class="panel-head">
      <div>
        <h2>商品管理 <span id="prodCount" class="count-pill">{{ activeTypeTotal }} 項</span></h2>
        <span>{{ activeTypeLabel }}商品 · 篩選 {{ products.length }} 項 · {{ catalog.lowStockItems.length }} 項低庫存</span>
      </div>
      <div class="action-row">
        <input v-model="search" class="search-input" placeholder="搜尋商品" />
      </div>
    </div>

    <div class="prod-bar">
      <div id="prodTabs" class="prod-tabs" role="tablist" aria-label="商品類別">
        <button
          v-for="type in catalog.productTypes"
          :key="type.key"
          type="button"
          class="prod-tab"
          :class="{ on: activeType === type.key }"
          :data-ptype="type.key"
          role="tab"
          :aria-selected="activeType === type.key"
          @click="activeType = type.key"
        >
          {{ type.label }}
        </button>
      </div>
      <button type="button" class="prod-add" aria-label="新增商品" @click="openCreate">
        <span aria-hidden="true">＋</span>
      </button>
    </div>

    <div id="prodList" class="prod-list">
      <article v-for="item in products" :key="item.id" class="prod-item" :class="{ low: !item.parts && item.stock <= item.low }" :data-id="item.id">
        <div class="prod-info">
          <div class="prod-nm">
            {{ item.name }}
            <span v-if="item.parts" class="prod-combo-badge">組合</span>
            <span v-else-if="item.stock <= item.low" class="prod-combo-badge low">低庫存</span>
          </div>
          <div v-if="item.desc" class="prod-desc">{{ item.desc }}</div>
          <div v-if="item.parts" class="prod-parts">{{ item.parts.map(([name, qty]) => `${name}×${qty}`).join('・') }}</div>
          <div v-else class="prod-meta">
            庫存 {{ item.stock || 0 }} 件 · 成本 ${{ item.cost || 0 }} · 安全量 {{ item.low || 0 }}
          </div>
          <div class="prod-metrics">
            <span v-if="item.parts">組成 {{ item.parts.length }} 種 · 共 {{ comboPartCount(item) }} 份單品</span>
            <template v-else>
              <span>毛利 ${{ money(unitMargin(item)) }}</span>
              <span>毛利率 {{ marginPercent(item) }}%</span>
              <span>庫存成本 ${{ money(Number(item.stock || 0) * Number(item.cost || 0)) }}</span>
            </template>
          </div>
        </div>
        <div class="prod-price">${{ item.price }}</div>
        <div class="prod-ops">
          <button type="button" class="prod-op" aria-label="編輯" @click="openEdit(item)">✎</button>
          <button type="button" class="prod-op del" aria-label="刪除" @click="deleteProduct(item)">×</button>
        </div>
      </article>
      <p v-if="!products.length" class="set-note">此類別沒有符合條件的商品。</p>
    </div>

    <p v-if="message" class="status-line">{{ message }}</p>

    <div v-if="modalOpen" id="prodModal" class="modal-backdrop date-modal show" @click.self="closeModal">
      <section class="edit-modal product-modal date-box">
        <header class="date-box-h">
          <h2 id="prodModalTitle">{{ editingId ? '編輯商品' : '新增商品' }}</h2>
          <button type="button" @click="closeModal">×</button>
        </header>

        <div class="form-grid">
          <label>商品名稱<input id="pmName" v-model="form.name" /></label>
          <label>售價<input id="pmPrice" v-model.number="form.price" type="number" min="0" /></label>
          <label class="span-2">商品說明<input v-model="form.desc" placeholder="顯示在訂購人點餐卡片，可留空" /></label>
          <div class="field-block">
            <span class="field-label">類別</span>
            <div id="pmTypeSeg" class="pm-type-seg" role="group" aria-label="商品類別">
              <button
                v-for="type in catalog.productTypes"
                :key="type.key"
                type="button"
                class="pm-type-btn"
                :class="{ on: form.type === type.key }"
                :data-type="type.key"
                @click="setProductType(type.key)"
              >
                {{ type.label }}
              </button>
            </div>
          </div>
          <div class="field-block">
            <span class="field-label">商品型態</span>
            <label class="pm-combo-toggle">
              <input id="pmIsCombo" type="checkbox" :checked="form.combo" @change="setComboMode($event.target.checked)" />
              <span>這是組合商品（由多項商品組成）</span>
            </label>
            <div class="pm-type-seg" role="group" aria-label="商品型態">
              <button type="button" class="pm-type-btn" :class="{ on: !form.combo }" @click="setComboMode(false)">單品</button>
              <button type="button" class="pm-type-btn" :class="{ on: form.combo }" @click="setComboMode(true)">組合商品</button>
            </div>
          </div>
          <label v-if="!form.combo">庫存<input v-model.number="form.stock" type="number" min="0" /></label>
          <label v-if="!form.combo">成本<input v-model.number="form.cost" type="number" min="0" /></label>
          <label v-if="!form.combo">安全庫存<input v-model.number="form.low" type="number" min="0" /></label>
        </div>

        <section v-if="form.combo" id="pmComboFields" class="parts-picker">
          <div class="panel-subhead">
            <h3>組合內容</h3>
            <span>{{ selectedParts().length }} 項</span>
          </div>
          <div id="pmPartsList" class="pm-parts-list">
            <article v-for="part in partOptions" :key="part.id" class="pm-part" :class="{ on: form.parts[part.name] }" :data-nm="part.name">
              <button type="button" class="pm-part-chk" :aria-label="`${form.parts[part.name] ? '取消' : '加入'}${part.name}`" @click="togglePart(part.name)">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              </button>
              <span class="pm-part-nm">
                {{ part.name }}
                <small>${{ part.price }} · 庫存 {{ part.stock }}</small>
              </span>
              <input
                class="pm-part-qty"
                type="number"
                min="1"
                :disabled="!form.parts[part.name]"
                :value="form.parts[part.name] || 1"
                @input="form.parts[part.name] = Number($event.target.value) || 1"
              />
            </article>
          </div>
          <p v-if="!partOptions.length" class="set-note">此類別還沒有可加入組合的單品。</p>
        </section>

        <footer class="date-box-ft">
          <button type="button" class="ghost-btn date-cancel" @click="closeModal">取消</button>
          <button type="button" class="primary-btn date-apply" @click="saveProduct">儲存</button>
        </footer>
      </section>
    </div>
  </section>
</template>
