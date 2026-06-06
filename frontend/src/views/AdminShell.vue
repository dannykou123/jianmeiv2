<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AdminOrdersPage from '../components/AdminOrdersPage.vue'
import ContactsManager from '../components/ContactsManager.vue'
import InventoryPanel from '../components/InventoryPanel.vue'
import MapPanel from '../components/MapPanel.vue'
import PrepBoard from '../components/PrepBoard.vue'
import ProductManager from '../components/ProductManager.vue'
import QuickOrderModal from '../components/QuickOrderModal.vue'
import ReportsPanel from '../components/ReportsPanel.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import StatCard from '../components/StatCard.vue'
import StylePicker from '../components/StylePicker.vue'
import PrintPreviewModal from '../components/PrintPreviewModal.vue'
import { useOrdersStore } from '../stores/orders.js'
import { usePrintSettingsStore } from '../stores/printSettings.js'
import { useThemeStore } from '../stores/theme.js'
import { shipStyles, prepStyles } from '../data/printStyles.js'
import { buildA4OrderPages, buildPrepPages, buildShipPages } from '../print/legacyTemplates.js'
import { printHtmlPages } from '../services/localPrint.js'
import { sendNasPrint } from '../services/nasPrint.js'
import { useCatalogStore } from '../stores/catalog.js'

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const printSettings = usePrintSettingsStore()
const theme = useThemeStore()

const { mode, docSize, nasConfig, selectedShipStyle, selectedPrepStyle } = storeToRefs(printSettings)
const message = ref('')
const quickOrderOpen = ref(false)
const preview = ref({ open: false, title: '', kind: 'ship', pages: [] })

const tabs = [
  ['dashboard', '接單台'],
  ['map', '送單地圖'],
  ['orders', '訂單明細'],
  ['products', '商品管理'],
  ['ship', '出貨單'],
  ['prep', '備料單'],
  ['prepboard', '備貨清單'],
  ['inventory', '庫存管理'],
  ['contacts', '常用聯絡'],
  ['reports', '分析報表'],
  ['settings', '系統設定']
]

const mobileTabs = [
  ['dashboard', '接單'],
  ['prepboard', '備貨'],
  ['orders', '訂單'],
  ['products', '商品']
]

const currentView = computed(() => route.params.view || 'dashboard')
const currentTitle = computed(() => tabs.find(([key]) => key === currentView.value)?.[1] || '總覽')
const fulfilledOrders = computed(() => orders.orders.filter((order) => order.status === 'accepted' || order.status === 'shipped'))
const printableOrders = computed(() => {
  if (fulfilledOrders.value.length) return fulfilledOrders.value
  return orders.orders.filter((order) => order.status !== 'rejected')
})

function go(view) {
  router.push(`/admin/${view}`)
}

function openQuickOrder() {
  quickOrderOpen.value = true
}

function styleKeyFromOption(option) {
  return typeof option === 'string' ? option : ''
}

function ordersFromOption(option) {
  const ids = Array.isArray(option?.orderIds) ? option.orderIds : []
  if (!ids.length) return printableOrders.value
  const byId = new Map(orders.orders.map((order) => [order.id, order]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

function pagesFor(kind, option) {
  const styleKey = styleKeyFromOption(option)
  const sourceOrders = ordersFromOption(option)
  if (kind === 'prep') {
    return buildPrepPages({
      orders: sourceOrders,
      style: styleKey || selectedPrepStyle.value,
      docSize: docSize.value,
      catalogProducts: catalog.products
    })
  }
  if (kind === 'a4') {
    return buildA4OrderPages({ orders: sourceOrders })
  }
  return buildShipPages({ orders: sourceOrders, style: styleKey || selectedShipStyle.value, docSize: docSize.value })
}

function openPreview(kind, option) {
  const pages = pagesFor(kind, option)
  const styleKey = styleKeyFromOption(option)
  const sourceOrders = ordersFromOption(option)
  const scopeLabel = option?.scope === 'filtered' ? ` · 篩選 ${sourceOrders.length} 團` : ''
  const styleName = kind === 'prep'
    ? prepStyles[styleKey || selectedPrepStyle.value]?.name
    : shipStyles[styleKey || selectedShipStyle.value]?.name
  preview.value = {
    open: true,
    title: kind === 'prep'
      ? `備料單預覽${styleName ? ` · ${styleName}` : ''}${scopeLabel}`
      : kind === 'a4'
        ? `A4 訂單表預覽${scopeLabel}`
        : `出貨單預覽${styleName ? ` · ${styleName}` : ''}${scopeLabel}`,
    kind,
    pages
  }
}

function openCustomPreview(payload) {
  preview.value = {
    open: true,
    title: payload.title,
    kind: payload.kind,
    pages: payload.pages
  }
}

function openOrderPreview(orderId) {
  const order = orders.findOrder(orderId)
  if (!order) return
  preview.value = {
    open: true,
    title: `出貨單預覽 · ${order.company}`,
    kind: 'ship',
    pages: buildShipPages({ orders: [order], style: selectedShipStyle.value, docSize: docSize.value })
  }
}

function openMemberPreview({ orderId, memberId }) {
  const order = orders.findOrder(orderId)
  const member = order?.members.find((item) => item.id === memberId)
  if (!order || !member) return
  preview.value = {
    open: true,
    title: `出貨單預覽 · ${order.company} · ${member.name}`,
    kind: 'ship',
    pages: buildShipPages({
      orders: [{ ...order, members: [member] }],
      style: selectedShipStyle.value,
      docSize: docSize.value
    })
  }
}

async function doPrint(kind = preview.value.kind, pages = preview.value.pages) {
  try {
    if (mode.value === 'nas' && kind !== 'a4') {
      message.value = '正在轉換圖片並送往 NAS...'
      const result = await sendNasPrint({
        kind,
        queue: nasConfig.value.queue,
        widthMm: printSettings.widthMm,
        heightMm: printSettings.heightMm,
        htmlPages: pages,
        config: nasConfig.value
      })
      message.value = result.ok ? `NAS 送印完成，圖片 ${result.payload.images.length} 張` : `NAS 回應異常：HTTP ${result.status}`
    } else {
      printHtmlPages({
        kind,
        htmlPages: pages,
        docSize: kind === 'a4' ? { w: 210, h: 297 } : docSize.value
      })
      message.value = '已開啟本機列印流程'
    }
  } catch (error) {
    message.value = `列印失敗：${error.message}`
  }
}

function quickPrint(kind) {
  const pages = pagesFor(kind)
  preview.value = {
    open: false,
    title: '',
    kind,
    pages
  }
  doPrint(kind, pages)
}

function onQuickOrderCreated(text) {
  message.value = text
  quickOrderOpen.value = false
  go('orders')
}
</script>

<template>
  <main id="admin" class="admin-layout screen active">
    <aside class="sidebar">
      <button type="button" class="brand-btn" @click="router.push('/')">健美滷味</button>
      <button type="button" class="primary-btn" @click="openQuickOrder">快速下單</button>
      <nav id="adminNav" class="nav admin-nav" aria-label="後台導覽">
        <button
          v-for="[key, label] in tabs"
          :key="key"
          type="button"
          class="admin-nav-btn"
          :class="{ on: currentView === key }"
          :data-view="key"
          @click="go(key)"
        >
          {{ label }}
        </button>
      </nav>
      <div class="side-foot">
        <div class="role">店家管理員</div>
        <div class="mail">admin@jianmei.local</div>
        <div class="side-actions">
          <button type="button" class="icon-btn" title="登出" aria-label="登出" @click="router.push('/')">
            <svg class="ico" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          </button>
          <button type="button" class="icon-btn" title="系統設定" aria-label="系統設定" @click="go('settings')">
            <svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
          <button type="button" class="icon-btn" title="切換明暗" aria-label="切換明暗" @click="theme.toggleTheme">
            <svg class="ico" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          </button>
        </div>
      </div>
    </aside>

    <section class="admin-main main">
      <header class="topbar">
        <div>
          <small>健美滷味 · 店家後台</small>
          <h1>{{ currentTitle }}</h1>
        </div>
        <span>{{ mode === 'nas' ? 'NAS 列印' : '本機列印' }}</span>
      </header>

      <section v-if="currentView === 'dashboard'" class="view active" data-view="dashboard">
        <section class="grid-3">
          <StatCard label="訂單數" :value="orders.orders.length" :sub="`${orders.totalMembers} 位訂購人`" />
          <StatCard label="待審核" :value="orders.pendingOrders.length" />
          <StatCard label="營收" :value="`$${orders.totalRevenue.toLocaleString()}`" />
        </section>
        <section class="panel">
          <div class="panel-head">
            <h2>今日工作</h2>
            <span>接單、備料、配送、列印</span>
          </div>
          <div class="dashboard-actions">
            <button type="button" @click="go('orders')">處理訂單</button>
            <button type="button" @click="go('prepboard')">查看備貨</button>
            <button type="button" @click="go('map')">配送路線</button>
            <button type="button" @click="openPreview('ship')">出貨單預覽</button>
          </div>
        </section>
      </section>

      <section v-else-if="currentView === 'map'" class="view active" data-view="map">
        <MapPanel />
      </section>
      <section v-else-if="currentView === 'orders'" class="view active" data-view="orders">
        <AdminOrdersPage
          @preview-a4="openPreview('a4', $event)"
          @preview-ship="openPreview('ship', $event)"
          @preview-order="openOrderPreview"
          @preview-member="openMemberPreview"
        />
      </section>
      <section v-else-if="currentView === 'products'" class="view active" data-view="products">
        <ProductManager />
      </section>

      <section v-else-if="currentView === 'ship'" class="view active" data-view="ship">
        <StylePicker
          title="出貨單樣式"
          description="選擇出貨時使用的配送單樣式。點縮圖選用、點「放大」看實際大小。品項過多時會自動續印第二頁。"
          kind="ship"
          :styles="shipStyles"
          :selected="selectedShipStyle"
          :doc-size="docSize"
          print-label="列印測試"
          @select="printSettings.setShipStyle"
          @preview="openPreview('ship', $event)"
          @print="quickPrint('ship')"
        />
      </section>

      <section v-else-if="currentView === 'prep'" class="view active" data-view="prep">
        <StylePicker
          title="備料單樣式"
          description="備料單會把當日所有訂單的同品項加總，給廚房備料用。品項過多時會自動續印第二頁。"
          kind="prep"
          :styles="prepStyles"
          :selected="selectedPrepStyle"
          :doc-size="docSize"
          print-label="列印備料單"
          @select="printSettings.setPrepStyle"
          @preview="openPreview('prep', $event)"
          @print="quickPrint('prep')"
        />
      </section>

      <section v-else-if="currentView === 'prepboard'" class="view active" data-view="prepboard">
        <PrepBoard @preview="openCustomPreview" />
      </section>

      <section v-else-if="currentView === 'inventory'" class="view active" data-view="inventory">
        <InventoryPanel />
      </section>

      <section v-else-if="currentView === 'contacts'" class="view active" data-view="contacts">
        <ContactsManager />
      </section>

      <section v-else-if="currentView === 'reports'" class="view active" data-view="reports">
        <ReportsPanel />
      </section>
      <section v-else-if="currentView === 'settings'" class="view active" data-view="settings">
        <SettingsPanel />
      </section>

      <p v-if="message" class="status-line">{{ message }}</p>
    </section>

    <PrintPreviewModal
      :open="preview.open"
      :title="preview.title"
      :pages="preview.pages"
      :mode="mode"
      :doc-size="preview.kind === 'a4' ? { w: 210, h: 297 } : docSize"
      @close="preview.open = false"
      @print="doPrint(preview.kind)"
    />
    <QuickOrderModal
      :open="quickOrderOpen"
      @close="quickOrderOpen = false"
      @created="onQuickOrderCreated"
    />
    <button type="button" class="quick-fab" @click="openQuickOrder" aria-label="快速下單">
      <span>＋</span>
      <small>快速下單</small>
    </button>
    <nav id="mTabbar" class="mobile-admin-nav m-tabbar" aria-label="後台快速導覽">
      <button
        v-for="[key, label] in mobileTabs.slice(0, 2)"
        :key="key"
        type="button"
        class="m-tab"
        :class="{ on: currentView === key }"
        :data-go="key"
        @click="go(key)"
      >
        {{ label }}
      </button>
      <button type="button" class="mobile-quick m-tab-quick" @click="openQuickOrder">
        <span>＋</span>
        <small>快速下單</small>
      </button>
      <button
        v-for="[key, label] in mobileTabs.slice(2)"
        :key="key"
        type="button"
        class="m-tab"
        :class="{ on: currentView === key }"
        :data-go="key"
        @click="go(key)"
      >
        {{ label }}
      </button>
    </nav>
  </main>
</template>
