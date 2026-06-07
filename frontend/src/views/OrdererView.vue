<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogStore } from '../stores/catalog.js'
import { useOrdersStore } from '../stores/orders.js'
import { teamDeadlineText, useTeamsStore } from '../stores/teams.js'

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const orders = useOrdersStore()
const teams = useTeamsStore()
const form = reactive({ name: '', phone: '', note: '' })
const cart = reactive({})
const activeType = ref('normal')
const checkoutOpen = ref(false)
const payment = ref('')
const transferLast5 = ref('')
const successOpen = ref(false)
const successSummary = ref(null)
const message = ref('')

const menuGroups = computed(() => catalog.orderMenuGroups)
const activeGroup = computed(() => menuGroups.value.find((group) => group.key === activeType.value) || menuGroups.value[0] || { items: [] })
const menu = computed(() => activeGroup.value.items)
const requestedTeamId = computed(() => {
  const team = route.query.team
  return Array.isArray(team) ? team[0] : team
})
const activeTeam = computed(() => requestedTeamId.value ? teams.findTeam(requestedTeamId.value) : null)
const paymentConfig = computed(() => activeTeam.value?.pay || teams.teams[0]?.pay || {
  lineId: 'jianmei_tw',
  cash: true,
  bank: '國泰世華 (013) 1234-5678-9012'
})
const availablePayments = computed(() => {
  const pay = paymentConfig.value
  const options = []
  if (pay.cash) options.push({ key: 'cash', label: '現金' })
  if (pay.lineId) options.push({ key: 'linepay', label: 'LINE Pay' })
  if (pay.bank) options.push({ key: 'transfer', label: '銀行轉帳' })
  options.push({ key: 'later', label: '稍後付款' })
  return options
})
const teamCanOrder = computed(() => !activeTeam.value || (activeTeam.value.open && !activeTeam.value.paused))
const teamStatusText = computed(() => {
  if (!activeTeam.value) return ''
  if (!activeTeam.value.open) return '已關團'
  if (activeTeam.value.paused) return '暫停收單'
  return '開團中'
})
const paymentLabel = computed(() => ({
  cash: '現金',
  transfer: '轉帳',
  linepay: 'LINE Pay',
  later: '稍後付款'
})[payment.value] || payment.value)
const paymentNote = computed(() => {
  if (!payment.value) return '未選付款方式'
  const last5 = transferLast5.value.trim()
  return payment.value === 'transfer' && last5 ? `${paymentLabel.value}（末五碼 ${last5}）` : paymentLabel.value
})
const cartItems = computed(() => Object.entries(cart)
  .map(([id, qty]) => {
    const product = catalog.allProducts.find((item) => item.id === id)
    return product ? { id, name: product.name, qty, price: product.price, subtotal: qty * product.price } : null
  })
  .filter(Boolean))
const cartCount = computed(() => cartItems.value.reduce((sum, item) => sum + item.qty, 0))
const total = computed(() => cartItems.value.reduce((sum, item) => sum + item.subtotal, 0))

watch(availablePayments, (options) => {
  if (payment.value && !options.some((option) => option.key === payment.value)) {
    payment.value = ''
  }
  if (payment.value !== 'transfer') transferLast5.value = ''
}, { immediate: true })

watch(menuGroups, (groups) => {
  if (groups.length && !groups.some((group) => group.key === activeType.value)) {
    activeType.value = groups[0].key
  }
}, { immediate: true })

function changeQty(id, delta) {
  cart[id] = Math.max(0, (cart[id] || 0) + delta)
  if (!cart[id]) delete cart[id]
}

function selectPayment(key) {
  payment.value = payment.value === key ? '' : key
  if (payment.value !== 'transfer') transferLast5.value = ''
}

async function copyLineId() {
  const lineId = paymentConfig.value.lineId
  if (!lineId) {
    message.value = '尚未提供 LINE ID'
    return
  }
  try {
    await navigator.clipboard?.writeText(lineId)
  } catch (_) {
    // Browser clipboard permissions vary; the visible ID still lets the user copy manually.
  }
  message.value = '已複製 LINE ID'
}

function closeSuccess() {
  successOpen.value = false
}

function openCheckout() {
  if (!cartItems.value.length) return
  if (!teamCanOrder.value) {
    message.value = activeTeam.value?.paused ? '團購主目前暫停收單' : '這個團購已關閉收單'
    return
  }
  checkoutOpen.value = true
}

function clearCart() {
  Object.keys(cart).forEach((key) => delete cart[key])
}

function submit() {
  if (!teamCanOrder.value) {
    message.value = activeTeam.value?.paused ? '團購主目前暫停收單，請稍後再送出' : '這個團購已關閉收單'
    checkoutOpen.value = false
    return
  }
  if (!form.name.trim()) {
    message.value = '請先輸入姓名'
    return
  }
  if (!cartItems.value.length) {
    message.value = '請先選擇餐點'
    return
  }
  const items = cartItems.value.map((item) => [item.name, item.qty, item.price])
  const orderTotal = total.value
  const orderCount = cartCount.value
  const payText = paymentNote.value
  const summary = {
    name: form.name.trim() || '—',
    count: orderCount,
    itemsText: items.map(([name, qty]) => `${name} ×${qty}`).join('、') || '—',
    payment: payText,
    total: orderTotal
  }
  const teamNote = activeTeam.value ? `團購：${activeTeam.value.name}` : ''
  const noteParts = [form.note, teamNote, `付款：${payText}`].filter(Boolean)
  const id = orders.addPersonalOrder({
    name: form.name,
    phone: form.phone,
    note: noteParts.join('；'),
    items,
    company: activeTeam.value ? `${activeTeam.value.name} · ${activeTeam.value.company || '團購'}` : '線上個人訂單',
    address: activeTeam.value?.company || '店取',
    teamId: activeTeam.value?.id || ''
  })
  successSummary.value = { ...summary, id }
  clearCart()
  form.name = ''
  form.phone = ''
  form.note = ''
  payment.value = ''
  transferLast5.value = ''
  checkoutOpen.value = false
  successOpen.value = true
  message.value = ''
}
</script>

<template>
  <main id="orderer" class="page orderer-page screen active">
    <div class="ord-wrap">
    <nav class="topbar ord-head">
      <button type="button" @click="router.push('/')">返回入口</button>
      <strong>{{ activeTeam ? activeTeam.name : '訂購人點餐' }}</strong>
    </nav>

    <section v-if="activeTeam" class="panel team-order-panel">
      <div class="panel-head">
        <div>
          <h2>{{ activeTeam.name }}</h2>
          <span>{{ activeTeam.company || '團購' }} · 收單截止 {{ teamDeadlineText(activeTeam) }}</span>
        </div>
        <span class="pill">{{ teamStatusText }}</span>
      </div>
      <p class="set-note">{{ activeTeam.hostNote }}</p>
      <div class="team-pay-grid">
        <div>
          <small>團購主</small>
          <strong>{{ activeTeam.organizer || '未填' }}</strong>
        </div>
        <div>
          <small>LINE ID</small>
          <strong>{{ activeTeam.pay.lineId || '未提供' }}</strong>
        </div>
        <div>
          <small>付款方式</small>
          <strong>{{ activeTeam.pay.cash ? '現金 / 轉帳 / Line Pay' : '轉帳 / Line Pay' }}</strong>
        </div>
        <div>
          <small>匯款資訊</small>
          <strong>{{ activeTeam.pay.bank || '由團購主另行通知' }}</strong>
        </div>
      </div>
      <p v-if="!teamCanOrder" class="status-line warning">
        {{ activeTeam.paused ? '團購主目前暫停收單，請稍後再送出。' : '這個團購已關閉收單。' }}
      </p>
    </section>

    <section v-else-if="requestedTeamId" class="panel team-order-panel">
      <div class="panel-head">
        <div>
          <h2>找不到這個團購</h2>
          <span>請確認團購主提供的連結是否正確</span>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>訂購人資料</h2>
          <span>送出前可在購物車確認品項與付款方式</span>
        </div>
      </div>
      <div class="form-grid">
        <label>姓名<input v-model="form.name" placeholder="請輸入姓名" /></label>
        <label>電話<input v-model="form.phone" placeholder="選填" /></label>
      </div>
    </section>

    <section id="ordCats" class="seg-row ord-cats">
      <button v-for="group in menuGroups" :key="group.key" type="button" class="ord-cat" :class="{ on: activeType === group.key }" @click="activeType = group.key">
        {{ group.label }}
      </button>
    </section>

    <section id="ordMenu" class="product-grid ord-menu">
      <article v-for="item in menu" :id="`row_${item.id}`" :key="item.id" class="product-card ord-item" :class="{ has: cart[item.id] }">
        <div class="ord-item-main">
          <strong class="ord-item-nm">{{ item.name }}</strong>
          <small v-if="item.desc" class="ord-item-desc">{{ item.desc }}</small>
          <small v-else-if="item.parts" class="ord-item-desc">組合商品</small>
          <small v-else>庫存 {{ item.stock }}</small>
          <div class="ord-item-price">${{ item.price }}</div>
        </div>
        <div :id="`step_${item.id}`" class="qty-row stepper" :class="{ 'show-minus': cart[item.id] }">
          <button type="button" class="minus" @click="changeQty(item.id, -1)">−</button>
          <span class="qty" :class="{ zero: !cart[item.id] }">{{ cart[item.id] || 0 }}</span>
          <button type="button" class="plus" @click="changeQty(item.id, 1)">+</button>
        </div>
      </article>
    </section>

    <section class="ord-extra">
      <label class="ord-note-l">
        備註（選填，店家可見）
        <textarea v-model="form.note" rows="2" placeholder="例：不要香菜、麻辣加辣…"></textarea>
      </label>

      <div class="ord-pay-sec orderer-pay">
        <div class="ord-pay-t">付款方式（選填）</div>
        <div class="pay-opts">
          <button
            v-for="option in availablePayments"
            :key="option.key"
            type="button"
            class="pay-opt"
            :class="{ on: payment === option.key }"
            @click="selectPayment(option.key)"
          >
            <span>{{ option.label }}</span>
          </button>
        </div>
        <div v-if="payment === 'linepay' && paymentConfig.lineId" class="pay-detail">
          <div class="pay-detail-t">加團主 LINE 好友付款</div>
          <div class="pay-lineid-row">
            <span>{{ paymentConfig.lineId }}</span>
            <button type="button" class="pay-copy-btn" @click="copyLineId">複製</button>
          </div>
        </div>
        <div v-if="payment === 'transfer' && paymentConfig.bank" class="pay-detail">
          <div class="pay-detail-t">轉帳帳號</div>
          <div class="pay-bank-acc">{{ paymentConfig.bank }}</div>
          <label class="pay-last5-l">
            轉帳末五碼（選填）
            <input v-model="transferLast5" inputmode="numeric" maxlength="5" placeholder="例：12345">
          </label>
        </div>
        <div v-if="payment && payment !== 'later'" class="pay-amt-tip">
          本次應付 <b>${{ total.toLocaleString() }}</b>
        </div>
      </div>

      <div class="ord-checkout" :class="{ empty: !cartItems.length }">
        <div class="oc-line">
          <span class="oc-k">合計金額</span>
          <span class="oc-v">${{ total.toLocaleString() }}</span>
        </div>
          <button id="ocSubmit" type="button" class="oc-submit" :disabled="!cartItems.length" @click="openCheckout">
          <span>確認並送出訂單</span>
          <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </div>
    </section>

    <div v-if="cartItems.length && !checkoutOpen && !successOpen" class="mobile-cart-bar" role="status" aria-live="polite">
      <div>
        <small>已選 {{ cartCount }} 份</small>
        <strong>${{ total.toLocaleString() }}</strong>
      </div>
      <button type="button" @click="openCheckout">查看購物車</button>
    </div>

    <p v-if="message" class="status-line">{{ message }}</p>
    </div>

    <div v-if="checkoutOpen" id="ordModal" class="modal-backdrop ord-modal show" @click.self="checkoutOpen = false">
      <section class="checkout-modal ord-modal-box">
        <header class="ord-modal-h">
          <span>確認你的訂單</span>
          <button type="button" @click="checkoutOpen = false">×</button>
        </header>
        <div id="cartList" class="cart-list ord-modal-body">
          <article v-for="item in cartItems" :key="item.id" class="cart-row">
            <div class="cart-row-nm">
              <strong>{{ item.name }}</strong>
              <small>${{ item.price }} x {{ item.qty }}</small>
            </div>
            <div class="qty-row mini stepper">
              <button type="button" class="minus" @click="changeQty(item.id, -1)">−</button>
              <span class="qty">{{ item.qty }}</span>
              <button type="button" class="plus" @click="changeQty(item.id, 1)">+</button>
            </div>
            <b class="cart-row-amt">${{ item.subtotal.toLocaleString() }}</b>
          </article>
          <div class="cart-total-row">合計 <b>${{ total.toLocaleString() }}</b></div>
        </div>
        <footer class="ord-modal-ft single">
          <button type="button" class="primary-btn confirm-submit ord-submit" :disabled="!teamCanOrder" @click="submit">確認送出</button>
        </footer>
      </section>
    </div>

    <div v-if="successOpen && successSummary" class="ord-success show" @click.self="closeSuccess">
      <div class="os-card">
        <div class="os-check">
          <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <div class="os-title">訂單已送出！</div>
        <div class="os-desc">你的點餐已送給團主，店家確認後即會備貨。</div>
        <div class="os-summary">
          <div class="oss-row"><span>訂購人</span><b>{{ successSummary.name }}</b></div>
          <div class="oss-row"><span>品項</span><b>{{ successSummary.count }} 項</b></div>
          <div class="oss-items">{{ successSummary.itemsText }}</div>
          <div class="oss-row"><span>付款方式</span><b>{{ successSummary.payment }}</b></div>
          <div class="oss-row total"><span>合計金額</span><b>${{ successSummary.total.toLocaleString() }}</b></div>
        </div>
        <button type="button" class="os-done" @click="closeSuccess">完成</button>
      </div>
    </div>
  </main>
</template>
