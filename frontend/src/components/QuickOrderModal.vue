<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useCatalogStore } from '../stores/catalog.js'
import { useContactsStore } from '../stores/contacts.js'
import { useOrdersStore } from '../stores/orders.js'

const props = defineProps({
  open: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'created'])

const catalog = useCatalogStore()
const contacts = useContactsStore()
const orders = useOrdersStore()

const type = ref('person')
const menuType = ref('normal')
const contactId = ref('')
const companyContactId = ref('')
const message = ref('')
const cart = reactive({})
const orderers = ref([])

const person = reactive({
  name: '',
  phone: '',
  address: ''
})

const company = reactive({
  name: '',
  address: '',
  organizer: '',
  phone: ''
})

const currentOrderer = reactive({
  name: '',
  department: ''
})

const menuGroups = computed(() => catalog.orderMenuGroups)
const activeMenuGroup = computed(() => menuGroups.value.find((group) => group.key === menuType.value) || menuGroups.value[0] || { items: [] })
const menu = computed(() => activeMenuGroup.value.items)
const contactOptions = computed(() => contacts.contacts.map((contact) => ({
  id: contact.id,
  label: contact.type === 'person'
    ? `${contact.name}（個人）`
    : `${contact.company}${contact.name ? ` · ${contact.name}` : ''}`,
  contact
})))
const cartItems = computed(() => Object.entries(cart)
  .map(([id, qty]) => {
    const product = catalog.findProduct(id)
    return product ? { id, name: product.name, qty, price: product.price, subtotal: qty * product.price } : null
  })
  .filter(Boolean))
const currentTotal = computed(() => cartItems.value.reduce((sum, item) => sum + item.subtotal, 0))
const teamTotal = computed(() => orderers.value.reduce((sum, orderer) => {
  return sum + orderer.items.reduce((itemSum, [, qty, price]) => itemSum + qty * price, 0)
}, 0) + currentTotal.value)

watch(() => props.open, (open) => {
  if (open) resetQuickOrder()
})

function resetQuickOrder() {
  type.value = 'person'
  menuType.value = menuGroups.value[0]?.key || 'normal'
  contactId.value = ''
  companyContactId.value = ''
  message.value = ''
  clearCart()
  orderers.value = []
  Object.assign(person, { name: '', phone: '', address: '' })
  Object.assign(company, { name: '', address: '', organizer: '', phone: '' })
  Object.assign(currentOrderer, { name: '', department: '' })
}

function setType(nextType) {
  type.value = nextType
  message.value = ''
}

watch(menuGroups, (groups) => {
  if (groups.length && !groups.some((group) => group.key === menuType.value)) {
    menuType.value = groups[0].key
  }
}, { immediate: true })

function changeQty(id, delta) {
  cart[id] = Math.max(0, (cart[id] || 0) + delta)
  if (!cart[id]) delete cart[id]
}

function clearCart() {
  Object.keys(cart).forEach((key) => delete cart[key])
}

function fillPersonFromContact() {
  const contact = contacts.contacts.find((item) => item.id === contactId.value)
  if (!contact) return
  person.name = contact.name || contact.company || ''
  person.phone = contact.phone || ''
  person.address = contact.address || ''
}

function fillCompanyFromContact() {
  const contact = contacts.contacts.find((item) => item.id === companyContactId.value)
  if (!contact) return
  company.name = contact.company || contact.name || ''
  company.address = contact.address || ''
  company.organizer = contact.name || ''
  company.phone = contact.phone || ''
}

function stockChangeSummary(changes) {
  const deducted = changes.filter((item) => !item.missing).length
  const shortage = changes.filter((item) => item.missing || item.shortage > 0).length
  if (!changes.length) return '無庫存品項'
  return `庫存已扣 ${deducted} 項${shortage ? `，${shortage} 項不足或找不到商品` : ''}`
}

function deductQuickOrderStock(orderId, itemRows) {
  const changes = catalog.deductItems(itemRows.map(([name, qty]) => [name, qty]))
  orders.updateOrder(orderId, {
    stockDeducted: true,
    stockDeductedAt: new Date().toISOString(),
    stockDeductedSource: 'quick-order'
  })
  return stockChangeSummary(changes)
}

function addCurrentOrderer() {
  if (!currentOrderer.name.trim()) {
    message.value = '請輸入訂購人姓名'
    return
  }
  if (!cartItems.value.length) {
    message.value = '請先為此訂購人選擇餐點'
    return
  }
  orderers.value.push({
    id: `QK-${Date.now().toString().slice(-6)}-${orderers.value.length + 1}`,
    name: currentOrderer.name.trim(),
    department: currentOrderer.department.trim(),
    phone: '',
    note: '',
    items: cartItems.value.map((item) => [item.name, item.qty, item.price])
  })
  Object.assign(currentOrderer, { name: '', department: '' })
  clearCart()
  message.value = '已加入訂購人'
}

function removeOrderer(index) {
  orderers.value.splice(index, 1)
}

function createPersonalOrder() {
  if (!person.name.trim()) {
    message.value = '請輸入姓名'
    return
  }
  if (!cartItems.value.length) {
    message.value = '請至少選一項餐點'
    return
  }
  const id = orders.addPersonalOrder({
    name: person.name.trim(),
    phone: person.phone.trim(),
    address: person.address.trim() || '店取',
      company: `個人快速下單 · ${person.name.trim()}`,
    note: '店家快速下單',
    items: cartItems.value.map((item) => [item.name, item.qty, item.price])
  })
  const stockNote = deductQuickOrderStock(id, cartItems.value.map((item) => [item.name, item.qty]))
  emit('created', `已建立個人快速訂單：${id}，${stockNote}`)
  emit('close')
}

function createCompanyOrder() {
  if (!company.name.trim()) {
    message.value = '請輸入公司名稱'
    return
  }
  if (cartItems.value.length && currentOrderer.name.trim()) addCurrentOrderer()
  if (!orderers.value.length) {
    message.value = '請至少加入一位訂購人'
    return
  }
  const id = orders.addOrder({
    company: company.name.trim(),
    address: company.address.trim() || '—',
    status: 'pending',
    members: orderers.value.map((orderer, index) => ({
      id: `QK-${index + 1}`,
      name: orderer.name,
      department: orderer.department,
      phone: company.phone.trim(),
      note: company.organizer.trim() ? `團購窗口：${company.organizer.trim()}` : '',
      items: orderer.items.map((item) => item.slice())
    }))
  })
  const stockRows = orderers.value.flatMap((orderer) => orderer.items.map(([name, qty]) => [name, qty]))
  const stockNote = deductQuickOrderStock(id, stockRows)
  emit('created', `已建立團購快速訂單：${id}，${stockNote}`)
  emit('close')
}

function submit() {
  if (type.value === 'person') createPersonalOrder()
  else createCompanyOrder()
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
    <section class="edit-modal quick-order-modal">
      <header>
        <h2>快速下單</h2>
        <button type="button" @click="emit('close')">×</button>
      </header>

      <div class="seg-row">
        <button type="button" :class="{ on: type === 'person' }" @click="setType('person')">個人</button>
        <button type="button" :class="{ on: type === 'company' }" @click="setType('company')">公司</button>
      </div>

      <section v-if="type === 'person'" class="quick-section">
        <label class="text-block">
          從常用聯絡帶入
          <select v-model="contactId" class="search-input" @change="fillPersonFromContact">
            <option value="">不帶入，手動填寫</option>
            <option v-for="option in contactOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
          </select>
        </label>
        <div class="form-grid">
          <label>姓名<input v-model.trim="person.name" placeholder="例：王大明" /></label>
          <label>電話<input v-model.trim="person.phone" placeholder="選填" /></label>
          <label class="span-2">地址<input v-model.trim="person.address" placeholder="選填，留空視為店取" /></label>
        </div>
      </section>

      <section v-else class="quick-section">
        <label class="text-block">
          從常用聯絡帶入
          <select v-model="companyContactId" class="search-input" @change="fillCompanyFromContact">
            <option value="">不帶入，手動填寫</option>
            <option v-for="option in contactOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
          </select>
        </label>
        <div class="form-grid">
          <label>公司 / 團購名稱<input v-model.trim="company.name" /></label>
          <label>地址<input v-model.trim="company.address" /></label>
          <label>窗口<input v-model.trim="company.organizer" /></label>
          <label>窗口電話<input v-model.trim="company.phone" /></label>
        </div>
        <div class="quick-orderers">
          <div class="panel-subhead">
            <h3>訂購人</h3>
            <span>已加入 {{ orderers.length }} 位</span>
          </div>
          <article v-for="(orderer, index) in orderers" :key="orderer.id" class="quick-orderer">
            <div>
              <strong>{{ orderer.name }}</strong>
              <small>{{ orderer.department || '未填部門' }} · {{ orderer.items.map(([name, qty]) => `${name} x${qty}`).join('、') }}</small>
            </div>
            <button type="button" class="danger-btn" @click="removeOrderer(index)">移除</button>
          </article>
          <div class="form-grid">
            <label>訂購人姓名<input v-model.trim="currentOrderer.name" /></label>
            <label>部門<input v-model.trim="currentOrderer.department" /></label>
          </div>
        </div>
      </section>

      <section class="quick-section">
        <div class="panel-subhead">
          <h3>{{ type === 'company' ? '此訂購人的餐點' : '選擇餐點' }}</h3>
          <span>小計 ${{ currentTotal.toLocaleString() }}</span>
        </div>
        <div class="seg-row">
          <button v-for="group in menuGroups" :key="group.key" type="button" :class="{ on: menuType === group.key }" @click="menuType = group.key">
            {{ group.label }}
          </button>
        </div>
        <div class="quick-menu">
          <article v-for="item in menu" :key="item.id" class="quick-menu-item">
            <div>
              <strong>{{ item.name }}</strong>
              <small v-if="item.desc">{{ item.desc }}</small>
              <small v-else>{{ item.parts ? '組合商品' : `庫存 ${item.stock}` }}</small>
            </div>
            <b>${{ item.price }}</b>
            <div class="qty-row mini">
              <button type="button" @click="changeQty(item.id, -1)">−</button>
              <span>{{ cart[item.id] || 0 }}</span>
              <button type="button" @click="changeQty(item.id, 1)">+</button>
            </div>
          </article>
        </div>
        <button v-if="type === 'company'" type="button" class="ghost-btn" @click="addCurrentOrderer">加入此訂購人到團購單</button>
      </section>

      <p v-if="message" class="status-line">{{ message }}</p>

      <footer>
        <div>
          <strong>{{ type === 'company' ? '團購單合計' : '合計' }} ${{ (type === 'company' ? teamTotal : currentTotal).toLocaleString() }}</strong>
          <small v-if="type === 'company'">含目前選餐與已加入訂購人</small>
        </div>
        <div class="action-row">
          <button type="button" class="ghost-btn" @click="emit('close')">取消</button>
          <button type="button" class="primary-btn" @click="submit">建立訂單</button>
        </div>
      </footer>
    </section>
  </div>
</template>
