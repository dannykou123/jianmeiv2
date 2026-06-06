<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue'
import { useCatalogStore } from '../stores/catalog.js'
import { useContactsStore } from '../stores/contacts.js'
import { useOrdersStore } from '../stores/orders.js'
import { useUiSettingsStore } from '../stores/uiSettings.js'

const emit = defineEmits(['preview-a4', 'preview-ship', 'preview-order', 'preview-member'])
const catalog = useCatalogStore()
const contacts = useContactsStore()
const orders = useOrdersStore()
const uiSettings = useUiSettingsStore()

const statusTabs = [
  ['pending', '待審核'],
  ['accepted', '已接單'],
  ['shipped', '已出貨'],
  ['rejected', '已拒絕'],
  ['all', '全部']
]

const filter = ref('pending')
const keyword = ref('')
const dateMode = ref('all')
const customStart = ref('')
const customEnd = ref('')
const datePickerOpen = ref(false)
const pickerStart = ref('')
const pickerEnd = ref('')
const pickerField = ref('start')
const calendarCursor = ref(new Date())
const expandedId = ref('')
const detailTabs = reactive({})
const editing = ref(null)
const editMembersText = ref('')
const creating = ref(false)
const createContactId = ref('')
const createMembersText = ref('訂購人|部門|電話|備註|招牌綜合滷味,1,180')
const message = ref('')
const orderEditor = ref(null)
const memberEditor = ref(null)
const memberEditorProductInput = ref('')
const undoDelete = ref(null)
const editorProductInputs = reactive({})
let undoDeleteTimer

const createDraft = reactive({
  company: '',
  address: '',
  date: toYmd(new Date()),
  time: '12:00',
  status: 'pending'
})

const statusCounts = computed(() => ({
  pending: orders.pendingOrders.length,
  accepted: orders.acceptedOrders.length,
  shipped: orders.shippedOrders.length,
  rejected: orders.rejectedOrders.length,
  all: orders.orders.length
}))

const filteredOrders = computed(() => orders.orders.filter((order) => {
  const filterOk = filter.value === 'all' || order.status === filter.value
  const { start, end } = activeDateRange.value
  const dateOk = (!start || order.date >= start) && (!end || order.date <= end)
  const haystack = [
    order.id,
    order.company,
    order.address,
    order.status,
    ...order.members.flatMap((member) => [member.name, member.department, member.phone])
  ].join(' ').toLowerCase()
  return filterOk && dateOk && haystack.includes(keyword.value.trim().toLowerCase())
}))

const filteredTotal = computed(() => filteredOrders.value.reduce((sum, order) => sum + orders.orderTotal(order), 0))
const filteredMembers = computed(() => filteredOrders.value.reduce((sum, order) => sum + order.members.length, 0))
const filteredItems = computed(() => filteredOrders.value.reduce((sum, order) => sum + orderItemCount(order), 0))
const filteredOrderIds = computed(() => filteredOrders.value.map((order) => order.id))
const filteredShipOrderIds = computed(() => filteredOrders.value
  .filter((order) => order.status === 'accepted' || order.status === 'shipped')
  .map((order) => order.id))
const ordersPerPage = computed(() => Number(uiSettings.display.ordersPerPage) || 20)
const displayedOrders = computed(() => filteredOrders.value.slice(0, ordersPerPage.value))
const hiddenOrderCount = computed(() => Math.max(0, filteredOrders.value.length - displayedOrders.value.length))
const contactOptions = computed(() => contacts.contacts.map((contact) => ({
  id: contact.id,
  label: contact.type === 'person'
    ? `${contact.name}（個人）`
    : `${contact.company}${contact.name ? ` · ${contact.name}` : ''}`,
  contact
})))
const productMetaByName = computed(() => new Map(
  Object.entries(catalog.products).flatMap(([type, list]) => list.map((item) => [item.name, { item, type }]))
))
const prepSummaries = computed(() => Object.fromEntries(
  orders.orders.map((order) => [order.id, buildOrderPrepSummary(order)])
))
const productOptions = computed(() => catalog.allProducts.map((item) => ({
  name: item.name,
  price: Number(item.price) || 0,
  isCombo: Array.isArray(item.parts) && item.parts.length > 0
})))
const orderEditorTitle = computed(() => {
  if (!orderEditor.value) return ''
  return orderEditor.value.mode === 'edit' ? `編輯團購單 · ${orderEditor.value.company || '未命名'}` : '新增訂單'
})
const orderEditorTotal = computed(() => orderEditor.value?.members.reduce((sum, member) => {
  return sum + editorMemberTotal(member)
}, 0) || 0)
const memberEditorTitle = computed(() => {
  if (!memberEditor.value) return ''
  const name = memberEditor.value.name || '編輯訂單'
  return `${name}　${memberEditor.value.orderCompany || ''}`.trim()
})
const memberEditorTotal = computed(() => {
  if (!memberEditor.value) return 0
  return memberEditor.value.items.reduce((sum, [, qty, price]) => {
    return sum + Number(qty || 0) * Number(price || 0)
  }, 0)
})

function toYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateForOffset(offset) {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return toYmd(date)
}

const activeDateRange = computed(() => {
  const quick = {
    today: ['今天', 0],
    tomorrow: ['明天', 1],
    after: ['後天', 2]
  }
  if (quick[dateMode.value]) {
    const [label, offset] = quick[dateMode.value]
    const date = dateForOffset(offset)
    return { start: date, end: date, label: `${label} ${date}` }
  }
  if (dateMode.value === 'custom') {
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

const hasDateFilter = computed(() => dateMode.value !== 'all' || customStart.value || customEnd.value)
const dateButtonLabel = computed(() => {
  if (!hasDateFilter.value) return '日期'
  return activeDateRange.value.label
})
const calendarTitle = computed(() => {
  const cursor = calendarCursor.value
  return `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`
})
const calendarDays = computed(() => {
  const cursor = calendarCursor.value
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: firstWeekday }, (_, index) => ({ key: `empty-${index}`, empty: true }))
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    const ymd = toYmd(date)
    days.push({
      key: ymd,
      empty: false,
      day,
      ymd,
      className: calendarDayClass(ymd)
    })
  }
  return days
})
const dateHint = computed(() => {
  if (!pickerStart.value) return '請選擇開始日期'
  if (!pickerEnd.value) return '再選一次可設定結束日期'
  return `已選 ${rangeDayCount(pickerStart.value, pickerEnd.value)} 天`
})

function setDateMode(nextMode) {
  if (nextMode === 'custom') {
    openDatePicker()
    return
  }
  dateMode.value = nextMode
  expandedId.value = ''
}

function clearDateFilter() {
  dateMode.value = 'all'
  customStart.value = ''
  customEnd.value = ''
  expandedId.value = ''
}

function dateFromYmd(ymd) {
  const [year, month, day] = String(ymd || '').split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function rangeDayCount(start, end) {
  const startDate = dateFromYmd(start)
  const endDate = dateFromYmd(end)
  if (!startDate || !endDate) return 1
  return Math.abs(Math.round((endDate - startDate) / 86400000)) + 1
}

function calendarDayClass(ymd) {
  const today = toYmd(new Date())
  const start = pickerStart.value
  const end = pickerEnd.value
  const classes = ['cal-day']
  if (ymd === today) classes.push('today')
  if (ymd === start) classes.push('range-start')
  if (ymd === end) classes.push('range-end')
  if (start && !end && ymd === start) classes.push('range-end')
  if (start && end && ymd > start && ymd < end) classes.push('in-range')
  return classes.join(' ')
}

function setCalendarCursorFromYmd(ymd) {
  const date = dateFromYmd(ymd) || new Date()
  calendarCursor.value = new Date(date.getFullYear(), date.getMonth(), 1)
}

function openDatePicker() {
  pickerStart.value = customStart.value
  pickerEnd.value = customEnd.value
  pickerField.value = pickerStart.value && !pickerEnd.value ? 'end' : 'start'
  setCalendarCursorFromYmd(pickerStart.value || dateForOffset(0))
  datePickerOpen.value = true
}

function closeDatePicker() {
  datePickerOpen.value = false
}

function calMove(delta) {
  const cursor = calendarCursor.value
  calendarCursor.value = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1)
}

function setPickField(field) {
  pickerField.value = field === 'end' ? 'end' : 'start'
}

function pickDate(ymd) {
  if (!pickerStart.value || pickerEnd.value || pickerField.value === 'start') {
    pickerStart.value = ymd
    pickerEnd.value = ''
    pickerField.value = 'end'
    return
  }
  if (ymd < pickerStart.value) {
    pickerEnd.value = pickerStart.value
    pickerStart.value = ymd
  } else {
    pickerEnd.value = ymd
  }
  pickerField.value = 'start'
}

function dateQuick(type) {
  const today = dateForOffset(0)
  if (type === 'today') {
    pickerStart.value = today
    pickerEnd.value = today
  } else if (type === '7d') {
    pickerStart.value = dateForOffset(-6)
    pickerEnd.value = today
  } else if (type === '30d') {
    pickerStart.value = dateForOffset(-29)
    pickerEnd.value = today
  } else if (type === 'clear') {
    pickerStart.value = ''
    pickerEnd.value = ''
  }
  if (pickerStart.value) setCalendarCursorFromYmd(pickerStart.value)
}

function applyDateRange() {
  customStart.value = pickerStart.value
  customEnd.value = pickerEnd.value || pickerStart.value
  dateMode.value = pickerStart.value ? 'custom' : 'all'
  expandedId.value = ''
  closeDatePicker()
}

function setFilter(nextFilter) {
  filter.value = nextFilter
  expandedId.value = ''
}

function previewFilteredShip() {
  if (!filteredShipOrderIds.value.length) {
    message.value = '目前篩選結果沒有已接單或已出貨的可列印訂單'
    return
  }
  emit('preview-ship', { orderIds: filteredShipOrderIds.value, scope: 'filtered' })
}

function previewFilteredA4() {
  if (!filteredOrderIds.value.length) {
    message.value = '目前沒有符合條件的訂單可列印'
    return
  }
  emit('preview-a4', { orderIds: filteredOrderIds.value, scope: 'filtered' })
}

function toggleExpanded(orderId) {
  const nextId = expandedId.value === orderId ? '' : orderId
  expandedId.value = nextId
  if (nextId && !detailTabs[nextId]) detailTabs[nextId] = 'info'
}

function detailTab(orderId) {
  return detailTabs[orderId] || 'info'
}

function setDetailTab(orderId, tab) {
  detailTabs[orderId] = tab
}

function buildOrderPrepSummary(order) {
  const normalRows = new Map()
  const vacuumRows = new Map()
  const comboRows = new Map()
  let comboCount = 0

  const addSingle = (name, qty) => {
    const meta = productMetaByName.value.get(name)
    const rows = meta?.type === 'vacuum' ? vacuumRows : normalRows
    rows.set(name, (rows.get(name) || 0) + qty)
  }

  const addItem = (name, qty) => {
    const amount = Math.max(0, Number(qty) || 0)
    if (!amount) return
    const meta = productMetaByName.value.get(name)
    if (meta?.item?.parts?.length) {
      comboCount += amount
      comboRows.set(name, (comboRows.get(name) || 0) + amount)
      meta.item.parts.forEach(([partName, partQty]) => addItem(partName, amount * (Number(partQty) || 1)))
      return
    }
    addSingle(name, amount)
  }

  order.members.forEach((member) => {
    member.items.forEach(([name, qty]) => addItem(name, qty))
  })

  const sortRows = (rows) => [...rows.entries()].sort((a, b) => b[1] - a[1])

  return {
    rows: [...sortRows(normalRows), ...sortRows(vacuumRows)],
    comboRows: [...comboRows.entries()].sort((a, b) => b[1] - a[1]),
    comboCount
  }
}

function prepSummary(order) {
  return prepSummaries.value[order.id] || { rows: [], comboRows: [], comboCount: 0 }
}

function productPrice(name) {
  return Number(productMetaByName.value.get(name)?.item?.price) || 0
}

function clearEditorProductInputs() {
  Object.keys(editorProductInputs).forEach((key) => {
    delete editorProductInputs[key]
  })
}

function newEditorMember(index = 0) {
  return {
    id: `DRAFT-M${Date.now()}-${index}`,
    name: index ? `訂購人${index + 1}` : '新訂購人',
    department: '',
    phone: '',
    note: '',
    items: []
  }
}

function cloneEditorMember(member, index) {
  return {
    id: member.id || `DRAFT-M${index + 1}`,
    name: member.name || `訂購人${index + 1}`,
    department: member.department || member.dept || '',
    phone: member.phone || member.tel || '',
    note: member.note || '',
    items: (member.items || []).map(([name, qty, price]) => [
      name,
      Math.max(1, Number(qty) || 1),
      Number(price) || productPrice(name)
    ])
  }
}

function openCreate() {
  clearEditorProductInputs()
  createContactId.value = ''
  orderEditor.value = {
    mode: 'create',
    id: '',
    company: '',
    address: '',
    date: toYmd(new Date()),
    time: '12:00',
    status: 'pending',
    organizer: '',
    organizerTel: '',
    members: [newEditorMember()]
  }
}

function closeOrderEditor() {
  orderEditor.value = null
  createContactId.value = ''
  clearEditorProductInputs()
}

function orderItemCount(order) {
  return order.members.reduce((sum, member) => {
    return sum + member.items.reduce((itemSum, [, qty]) => itemSum + Number(qty || 0), 0)
  }, 0)
}

function memberTotal(member) {
  return member.items.reduce((sum, [, qty, price]) => sum + Number(qty || 0) * Number(price || 0), 0)
}

function orderStockItems(order) {
  return order.members.flatMap((member) => member.items.map(([name, qty]) => [name, qty]))
}

function stockChangeSummary(changes) {
  if (!changes?.length) return '未扣到庫存'
  const shortage = changes.filter((item) => item.shortage > 0 || item.missing)
  const changed = changes.filter((item) => !item.missing).length
  return shortage.length ? `已扣 ${changed} 項庫存，${shortage.length} 項不足或找不到商品` : `已扣 ${changed} 項庫存`
}

function deductStockForOrder(order) {
  if (order.stockDeducted) return { changes: [], skipped: true }
  const changes = catalog.deductItems(orderStockItems(order))
  orders.updateOrder(order.id, {
    stockDeducted: true,
    stockDeductedAt: new Date().toISOString()
  })
  return { changes, skipped: false }
}

function orderToMembersText(order) {
  return order.members.map((member) => {
    const items = member.items.map(([name, qty, price]) => `${name},${qty},${price}`).join(';')
    return [member.name, member.department, member.phone, member.note, items].join('|')
  }).join('\n')
}

function openEdit(order) {
  clearEditorProductInputs()
  orderEditor.value = {
    mode: 'edit',
    id: order.id,
    company: order.company,
    address: order.address,
    date: order.date,
    time: order.time,
    status: order.status,
    organizer: order.organizer || '',
    organizerTel: order.organizerTel || '',
    members: order.members.map((member, index) => cloneEditorMember(member, index))
  }
  message.value = ''
}

function openEditMember(order, member) {
  const memberIndex = order.members.findIndex((item) => item.id === member.id || item === member)
  memberEditor.value = {
    orderId: order.id,
    orderCompany: order.company,
    memberId: member.id,
    memberIndex,
    name: member.name || '',
    department: member.department || member.dept || '',
    phone: member.phone || member.tel || '',
    note: member.note || '',
    items: (member.items || []).map(([name, qty, price]) => [
      name,
      Math.max(1, Number(qty) || 1),
      Number(price) || productPrice(name)
    ])
  }
  memberEditorProductInput.value = ''
  message.value = ''
}

function closeMemberEditor() {
  memberEditor.value = null
  memberEditorProductInput.value = ''
}

function editorMemberTotal(member) {
  return member.items.reduce((sum, [, qty, price]) => sum + Number(qty || 0) * Number(price || 0), 0)
}

function addEditorMember() {
  if (!orderEditor.value) return
  orderEditor.value.members.push(newEditorMember(orderEditor.value.members.length))
}

function removeEditorMember(member) {
  if (!orderEditor.value) return
  const index = orderEditor.value.members.indexOf(member)
  if (index < 0) return
  const needsConfirm = member.items.length > 0
  if (needsConfirm && !window.confirm(`確定刪除訂購人「${member.name || '此人'}」？`)) return
  orderEditor.value.members.splice(index, 1)
  delete editorProductInputs[member.id]
}

function changeEditorItemQty(member, itemIndex, delta) {
  const item = member.items[itemIndex]
  if (!item) return
  item[1] = Math.max(1, Number(item[1] || 0) + delta)
}

function removeEditorItem(member, itemIndex) {
  member.items.splice(itemIndex, 1)
}

function addEditorItem(member) {
  const name = (editorProductInputs[member.id] || '').trim()
  if (!name) return
  const meta = productMetaByName.value.get(name)
  if (!meta) {
    message.value = `找不到此商品：${name}`
    return
  }
  const exists = member.items.find((item) => item[0] === name)
  if (exists) {
    exists[1] += 1
  } else {
    member.items.push([name, 1, Number(meta.item.price) || 0])
  }
  editorProductInputs[member.id] = ''
}

function changeMemberEditorItemQty(itemIndex, delta) {
  const item = memberEditor.value?.items[itemIndex]
  if (!item) return
  item[1] = Math.max(1, Number(item[1] || 0) + delta)
}

function removeMemberEditorItem(itemIndex) {
  if (!memberEditor.value) return
  memberEditor.value.items.splice(itemIndex, 1)
}

function addMemberEditorItem() {
  if (!memberEditor.value) return
  const name = memberEditorProductInput.value.trim()
  if (!name) return
  const meta = productMetaByName.value.get(name)
  if (!meta) {
    message.value = `找不到此商品：${name}`
    return
  }
  const exists = memberEditor.value.items.find((item) => item[0] === name)
  if (exists) {
    exists[1] += 1
  } else {
    memberEditor.value.items.push([name, 1, Number(meta.item.price) || 0])
  }
  memberEditorProductInput.value = ''
}

function parseMembers(text, baseId = 'M') {
  return text.split('\n')
    .map((line, index) => {
      const [name = '', department = '', phone = '', note = '', itemsText = ''] = line.split('|')
      const items = itemsText.split(';')
        .map((raw) => raw.trim())
        .filter(Boolean)
        .map((raw) => {
          const [itemName, qty = '1', price = '0'] = raw.split(',').map((part) => part.trim())
          return [itemName, Number(qty) || 1, Number(price) || 0]
        })
        .filter(([itemName]) => itemName)

      return {
        id: `${baseId}-${index + 1}`,
        name: name.trim() || '未命名',
        department: department.trim(),
        phone: phone.trim(),
        note: note.trim(),
        items
      }
    })
    .filter((member) => member.name && member.items.length)
}

function validateOrderDraft(draft, members) {
  if (!draft.company.trim()) return '請輸入公司名稱'
  if (!draft.address.trim()) return '請輸入配送地址'
  if (!members.length) return '請至少輸入一位訂購人與品項'
  return ''
}

function saveEdit() {
  if (!editing.value) return
  const members = parseMembers(editMembersText.value, editing.value.id)
  const error = validateOrderDraft(editing.value, members)
  if (error) {
    message.value = error
    return
  }
  orders.updateOrder(editing.value.id, {
    company: editing.value.company,
    address: editing.value.address,
    date: editing.value.date,
    time: editing.value.time,
    status: editing.value.status,
    members
  })
  message.value = `已更新「${editing.value.company}」`
  editing.value = null
}

function resetCreateDraft() {
  Object.assign(createDraft, {
    company: '',
    address: '',
    date: toYmd(new Date()),
    time: '12:00',
    status: 'pending'
  })
  createContactId.value = ''
  createMembersText.value = '訂購人|部門|電話|備註|招牌綜合滷味,1,180'
}

function fillCreateFromContact() {
  if (!orderEditor.value || orderEditor.value.mode !== 'create') return
  const contact = contacts.contacts.find((item) => item.id === createContactId.value)
  if (!contact) return
  const isPerson = contact.type === 'person'
  orderEditor.value.company = isPerson ? `個人訂單 · ${contact.name}` : contact.company
  orderEditor.value.address = contact.address || ''
  orderEditor.value.organizer = contact.name || ''
  orderEditor.value.organizerTel = contact.phone || ''
  const memberName = isPerson ? contact.name : contact.name || '窗口'
  const note = contact.fav ? `常訂：${contact.fav}` : ''
  orderEditor.value.members = [{
    id: `DRAFT-C${contact.id}`,
    name: memberName,
    department: '',
    phone: contact.phone || '',
    note,
    items: [['招牌綜合滷味', 1, productPrice('招牌綜合滷味')]]
  }]
}

function createOrder() {
  const members = parseMembers(createMembersText.value, 'NEW')
  const error = validateOrderDraft(createDraft, members)
  if (error) {
    message.value = error
    return
  }
  const id = orders.addOrder({ ...createDraft, members })
  creating.value = false
  expandedId.value = id
  message.value = `已建立訂單：${id}`
  resetCreateDraft()
}

function saveOrderEditor() {
  if (!orderEditor.value) return
  const draft = orderEditor.value
  const members = draft.members
    .filter((member) => member.items.length > 0)
    .map((member, index) => ({
      id: member.id && !member.id.startsWith('DRAFT-') ? member.id : `${draft.id || 'NEW'}-M${index + 1}`,
      name: member.name.trim() || `訂購人${index + 1}`,
      department: member.department.trim(),
      phone: member.phone.trim(),
      note: member.note.trim(),
      items: member.items.map(([name, qty, price]) => [
        name,
        Math.max(1, Number(qty) || 1),
        Number(price) || productPrice(name)
      ])
    }))
  const payload = {
    company: draft.company.trim(),
    address: draft.address.trim(),
    date: draft.date,
    time: draft.time,
    status: draft.status,
    organizer: draft.organizer.trim(),
    organizerTel: draft.organizerTel.trim(),
    members
  }
  const error = validateOrderDraft(payload, members)
  if (error) {
    message.value = error
    return
  }

  if (draft.mode === 'edit') {
    orders.updateOrder(draft.id, payload)
    expandedId.value = draft.id
    detailTabs[draft.id] = 'info'
    filter.value = payload.status
    clearDateFilter()
    message.value = `已更新「${payload.company}」`
  } else {
    const id = orders.addOrder(payload)
    expandedId.value = id
    detailTabs[id] = 'info'
    filter.value = payload.status
    clearDateFilter()
    message.value = `已建立訂單：${id}`
  }

  closeOrderEditor()
}

function saveMemberEditor() {
  if (!memberEditor.value) return
  const draft = memberEditor.value
  const order = orders.findOrder(draft.orderId)
  if (!order) {
    message.value = '找不到訂單'
    closeMemberEditor()
    return
  }

  const memberIndex = order.members.findIndex((member, index) => {
    return member.id === draft.memberId || index === draft.memberIndex
  })
  if (memberIndex < 0) {
    message.value = '找不到訂購人'
    closeMemberEditor()
    return
  }

  const members = order.members.map((member, index) => {
    if (index !== memberIndex) return member
    return {
      ...member,
      id: member.id || draft.memberId || `${order.id}-M${index + 1}`,
      name: draft.name.trim() || `訂購人${index + 1}`,
      department: draft.department.trim(),
      phone: draft.phone.trim(),
      note: draft.note.trim(),
      items: draft.items.map(([name, qty, price]) => [
        name,
        Math.max(1, Number(qty) || 1),
        Number(price) || productPrice(name)
      ])
    }
  })

  orders.updateOrder(order.id, { members })
  expandedId.value = order.id
  detailTabs[order.id] = 'info'
  message.value = `已更新「${members[memberIndex].name}」`
  closeMemberEditor()
}

function setOrderStatus(order, status) {
  let stockNote = ''
  if (status === 'shipped' && order.status !== 'shipped') {
    const result = deductStockForOrder(order)
    stockNote = result.skipped ? '，庫存先前已扣除' : `，${stockChangeSummary(result.changes)}`
  }
  orders.setStatus(order.id, status)
  message.value = `「${order.company}」已改為${orders.statusLabel(status)}${stockNote}`
}

function setFilteredStatus(status) {
  const targets = filteredOrders.value.filter((order) => order.status !== status)
  let deducted = 0
  let shortage = 0
  targets.forEach((order) => {
    if (status === 'shipped') {
      const result = deductStockForOrder(order)
      if (!result.skipped) {
        deducted += result.changes.filter((item) => !item.missing).length
        shortage += result.changes.filter((item) => item.shortage > 0 || item.missing).length
      }
    }
    orders.setStatus(order.id, status)
  })
  const stockNote = status === 'shipped' ? `，已扣 ${deducted} 項庫存${shortage ? `，${shortage} 項不足或找不到商品` : ''}` : ''
  message.value = targets.length ? `已批次更新 ${targets.length} 筆為${orders.statusLabel(status)}${stockNote}` : '目前篩選結果不需要更新'
}

function deleteOrder(order) {
  const ok = window.confirm(`確定刪除「${order.company}」？刪除後可在 30 天內復原。`)
  if (!ok) return
  const deleted = orders.softDeleteOrder(order.id)
  if (!deleted) return
  if (expandedId.value === order.id) expandedId.value = ''
  undoDelete.value = {
    id: deleted.id,
    company: deleted.company,
    status: deleted.status
  }
  message.value = '已刪除（可復原）'
  clearTimeout(undoDeleteTimer)
  undoDeleteTimer = setTimeout(() => {
    undoDelete.value = null
  }, 5000)
}

function restoreDeletedOrder() {
  if (!undoDelete.value) return
  const restored = orders.restoreOrder(undoDelete.value.id)
  clearTimeout(undoDeleteTimer)
  if (!restored) {
    undoDelete.value = null
    message.value = '找不到可復原的訂單'
    return
  }
  filter.value = restored.status
  expandedId.value = restored.id
  detailTabs[restored.id] = 'info'
  clearDateFilter()
  message.value = `已復原「${restored.company}」`
  undoDelete.value = null
}

function dismissUndoDelete() {
  clearTimeout(undoDeleteTimer)
  undoDelete.value = null
}

onUnmounted(() => clearTimeout(undoDeleteTimer))
</script>

<template>
  <section id="ordersPanel" class="panel orders-panel">
    <div class="panel-head orders-head">
      <div>
        <h2>訂單列表</h2>
        <span>
          {{ filteredOrders.length }} 筆符合條件 · 顯示 {{ displayedOrders.length }} 筆 · {{ filteredMembers }} 位 · {{ filteredItems }} 份
        </span>
      </div>
      <div class="action-row">
        <button type="button" class="ghost-btn" @click="openCreate">新增訂單</button>
        <button type="button" class="ghost-btn" :disabled="!filteredShipOrderIds.length" @click="previewFilteredShip">出貨單預覽</button>
        <button type="button" class="primary-btn" :disabled="!filteredOrderIds.length" @click="previewFilteredA4">A4 總表</button>
      </div>
    </div>

    <div class="order-kpis">
      <div><b>{{ statusCounts.pending }}</b><span>待審核</span></div>
      <div><b>{{ statusCounts.accepted }}</b><span>已接單</span></div>
      <div><b>{{ statusCounts.shipped }}</b><span>已出貨</span></div>
      <div><b>{{ statusCounts.rejected }}</b><span>已拒絕</span></div>
      <div><b>${{ filteredTotal.toLocaleString() }}</b><span>篩選總額</span></div>
    </div>

    <div class="toolbar filter-bar">
      <div id="statusTabs" class="seg-row status-tabs">
        <button
          v-for="[key, label] in statusTabs"
          :key="key"
          type="button"
          class="st-tab"
          :class="{ on: filter === key }"
          :data-status="key"
          @click="setFilter(key)"
        >
          {{ label }}
        </button>
      </div>
      <div class="seg-row">
        <button type="button" class="od-quick" :class="{ on: dateMode === 'today' }" @click="setDateMode('today')">今天</button>
        <button type="button" class="od-quick" :class="{ on: dateMode === 'tomorrow' }" @click="setDateMode('tomorrow')">明天</button>
        <button type="button" class="od-quick" :class="{ on: dateMode === 'after' }" @click="setDateMode('after')">後天</button>
        <button id="dateBtn" type="button" class="date-btn" :class="{ on: hasDateFilter }" @click="openDatePicker">
          <span id="dateBtnLabel">{{ dateButtonLabel }}</span>
        </button>
        <button v-if="hasDateFilter" id="odClearBtn" type="button" class="od-clear" @click="clearDateFilter">清除日期</button>
      </div>
      <div v-if="false" class="date-range-inputs" aria-hidden="true">
        <input v-model="customStart" class="search-input small" type="date" aria-label="開始日期" @input="expandedId = ''" />
        <span>到</span>
        <input v-model="customEnd" class="search-input small" type="date" aria-label="結束日期" @input="expandedId = ''" />
      </div>
      <span class="pill">{{ activeDateRange.label }}</span>
      <label class="search-wrap">
        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input id="orderSearch" v-model="keyword" class="search-input" placeholder="搜尋訂單、公司、地址、訂購人" @input="expandedId = ''" />
      </label>
    </div>

    <div class="batch-bar">
      <span>
        篩選結果：{{ filteredOrders.length }} 筆
        <template v-if="hiddenOrderCount"> · 目前每頁 {{ ordersPerPage }} 筆，尚有 {{ hiddenOrderCount }} 筆未顯示</template>
      </span>
      <button type="button" @click="setFilteredStatus('accepted')">批次接單</button>
      <button type="button" @click="setFilteredStatus('rejected')">批次拒單</button>
      <button type="button" @click="setFilteredStatus('shipped')">批次出貨</button>
      <button type="button" @click="expandedId = ''">全部收合</button>
    </div>

    <p v-if="message" class="status-line">{{ message }}</p>
    <div v-if="undoDelete" class="undo-banner">
      <span>已刪除「{{ undoDelete.company }}」，可在短時間內復原。</span>
      <button type="button" class="ghost-btn" @click="restoreDeletedOrder">復原</button>
      <button type="button" class="ghost-btn" aria-label="關閉復原提示" @click="dismissUndoDelete">關閉</button>
    </div>

    <div id="orderRows" class="list order-list order-rows">
      <article
        v-for="order in displayedOrders"
        :key="order.id"
        class="order-card orow"
        :class="{ open: expandedId === order.id }"
        :data-order-id="order.id"
        :data-status="order.status"
      >
        <button type="button" class="order-head orow-head" @click="toggleExpanded(order.id)">
          <div>
            <strong class="orow-title">{{ order.company }}</strong>
            <small class="orow-sub">{{ order.id }} · {{ order.date }} {{ order.time }} · {{ order.address }}</small>
            <span class="order-summary orow-date">
              {{ order.members.length }} 位訂購人 · {{ orderItemCount(order) }} 份 · {{ orders.statusLabel(order.status) }}
            </span>
          </div>
          <div class="order-meta orow-meta">
            <span class="pill status-pill" :class="order.status">{{ orders.statusLabel(order.status) }}</span>
            <span v-if="order.stockDeducted" class="pill">庫存已扣</span>
            <b class="orow-amt">${{ orders.orderTotal(order).toLocaleString() }}</b>
            <span class="order-chevron">{{ expandedId === order.id ? '收合' : '展開' }}</span>
          </div>
        </button>

        <div v-if="expandedId === order.id" class="order-detail orow-acc">
          <div class="dash-tabs order-detail-tabs">
            <button
              type="button"
              :class="{ on: detailTab(order.id) === 'info' }"
              @click="setDetailTab(order.id, 'info')"
            >
              訂單資訊
            </button>
            <button
              type="button"
              :class="{ on: detailTab(order.id) === 'prep' }"
              @click="setDetailTab(order.id, 'prep')"
            >
              備料清單
            </button>
          </div>

          <div v-if="detailTab(order.id) === 'info'" class="dash-pane">
            <div class="member-list">
              <article v-for="member in order.members" :key="member.id" class="member-row">
                <div>
                  <strong>{{ member.name }}</strong>
                  <small>{{ member.department || '無部門' }} · {{ member.phone || '無電話' }}</small>
                  <small v-if="member.note">備註：{{ member.note }}</small>
                  <b class="member-total">${{ memberTotal(member).toLocaleString() }}</b>
                  <div class="member-actions">
                    <button type="button" @click="emit('preview-member', { orderId: order.id, memberId: member.id })">列印此人</button>
                    <button type="button" class="person-edit" @click="openEditMember(order, member)">編輯</button>
                  </div>
                </div>
                <ul>
                  <li v-for="([name, qty, price], idx) in member.items" :key="idx">
                    <span>{{ name }}</span>
                    <b>x{{ qty }}</b>
                    <em>${{ (qty * price).toLocaleString() }}</em>
                  </li>
                </ul>
              </article>
            </div>
          </div>

          <div v-else class="dash-pane dash-prep">
            <div v-if="prepSummary(order).rows.length" class="dash-prep-list">
              <div v-if="prepSummary(order).comboCount" class="dash-prep-note">
                已自動拆解 {{ prepSummary(order).comboCount }} 份組合商品為下列單品
              </div>
              <div v-for="([name, qty]) in prepSummary(order).rows" :key="name" class="dash-prep-row">
                <span class="dpp-q">{{ qty }}</span>
                <span class="dpp-n">{{ name }}</span>
              </div>
              <div v-if="prepSummary(order).comboRows.length" class="dash-prep-combo">
                組合：{{ prepSummary(order).comboRows.map(([name, qty]) => `${name}×${qty}`).join('、') }}（已併入上方加總）
              </div>
            </div>
            <div v-else class="dash-prep-empty">此團沒有品項</div>
          </div>

          <div class="team-review-actions">
            <template v-if="order.status === 'pending'">
              <button type="button" class="team-action reject" @click="setOrderStatus(order, 'rejected')">整團拒單</button>
              <button type="button" class="team-action accept" @click="setOrderStatus(order, 'accepted')">整團接單（{{ order.members.length }} 位）</button>
            </template>
            <button v-else-if="order.status === 'rejected'" type="button" class="team-action accept" @click="setOrderStatus(order, 'accepted')">重新接單</button>
            <button v-else-if="order.status === 'accepted'" type="button" class="team-action shipped" @click="setOrderStatus(order, 'shipped')">標記整團出貨</button>
            <span v-else-if="order.status === 'shipped'" class="team-done">此團已出貨完成</span>
          </div>

          <div class="action-row">
            <button type="button" @click="emit('preview-order', order.id)">列印此單</button>
            <button type="button" @click="openEdit(order)">編輯</button>
            <button type="button" @click="setOrderStatus(order, 'pending')">待審核</button>
            <button type="button" @click="setOrderStatus(order, 'accepted')">接單</button>
            <button type="button" @click="setOrderStatus(order, 'rejected')">拒單</button>
            <button type="button" @click="setOrderStatus(order, 'shipped')">已出貨</button>
            <button type="button" class="danger-btn" @click="deleteOrder(order)">刪除</button>
          </div>
        </div>
      </article>
      <p v-if="hiddenOrderCount" class="set-note">
        依顯示設定目前只列出前 {{ displayedOrders.length }} 筆；可到「系統設定 → 顯示」調整每頁訂單筆數。
      </p>
      <p v-if="!filteredOrders.length" class="set-note">目前沒有符合條件的訂單。</p>
    </div>

    <div v-if="datePickerOpen" id="dateModal" class="modal-backdrop date-modal show" @click.self="closeDatePicker">
      <section class="edit-modal date-box order-date-box">
        <header class="date-box-h">
          <h2>選擇日期區間</h2>
          <button type="button" aria-label="關閉" @click="closeDatePicker">&times;</button>
        </header>
        <div class="date-range-disp">
          <button id="drdStartBox" type="button" class="drd-item" :class="{ active: pickerField === 'start' }" @click="setPickField('start')">
            <span class="drd-k">開始</span>
            <span id="drdStart" class="drd-v">{{ pickerStart || '—' }}</span>
          </button>
          <svg class="ico drd-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          <button id="drdEndBox" type="button" class="drd-item" :class="{ active: pickerField === 'end' }" @click="setPickField('end')">
            <span class="drd-k">結束</span>
            <span id="drdEnd" class="drd-v">{{ pickerEnd || pickerStart || '—' }}</span>
          </button>
        </div>
        <div id="dateHint" class="date-hint">{{ dateHint }}</div>
        <div class="cal-head">
          <button type="button" class="cal-nav" @click="calMove(-1)">‹</button>
          <span id="calTitle" class="cal-title">{{ calendarTitle }}</span>
          <button type="button" class="cal-nav" @click="calMove(1)">›</button>
        </div>
        <div class="cal-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
        <div id="calGrid" class="cal-grid">
          <button
            v-for="day in calendarDays"
            :key="day.key"
            type="button"
            :class="day.empty ? 'cal-day empty' : day.className"
            :disabled="day.empty"
            @click="!day.empty && pickDate(day.ymd)"
          >
            {{ day.empty ? '' : day.day }}
          </button>
        </div>
        <div class="date-quick">
          <button type="button" @click="dateQuick('today')">今天</button>
          <button type="button" @click="dateQuick('7d')">近 7 天</button>
          <button type="button" @click="dateQuick('30d')">近 30 天</button>
          <button type="button" @click="dateQuick('clear')">清除</button>
        </div>
        <footer class="date-box-ft">
          <button type="button" class="date-cancel" @click="closeDatePicker">取消</button>
          <button type="button" class="date-apply" @click="applyDateRange">套用</button>
        </footer>
      </section>
    </div>

    <div v-if="memberEditor" id="editOrderModal" class="modal-backdrop style-modal show" @click.self="closeMemberEditor">
      <section class="edit-modal ppv-box edit-order-modal">
        <header class="ppv-head">
          <span id="editOrderTitle">{{ memberEditorTitle }}</span>
          <button type="button" @click="closeMemberEditor">×</button>
        </header>

        <div class="ppv-body edit-order-body">
          <div class="form-grid edit-order-meta">
            <label>訂購人姓名<input v-model.trim="memberEditor.name" /></label>
            <label>單位 / 部門<input v-model.trim="memberEditor.department" /></label>
            <label>電話<input v-model.trim="memberEditor.phone" /></label>
          </div>

          <div id="editOrderRows">
            <div v-if="!memberEditor.items.length" class="eo-empty">此訂單沒有品項</div>
            <div v-for="(item, itemIndex) in memberEditor.items" :key="`${item[0]}-${itemIndex}`" class="eo-row" :data-i="itemIndex">
              <div class="eo-name">{{ item[0] }}</div>
              <div class="eo-ctrl">
                <button type="button" class="eo-step" @click="changeMemberEditorItemQty(itemIndex, -1)">−</button>
                <span class="eo-q" :id="`eoq${itemIndex}`">{{ item[1] }}</span>
                <button type="button" class="eo-step" @click="changeMemberEditorItemQty(itemIndex, 1)">＋</button>
                <span class="eo-p">${{ Number(item[2] || 0).toLocaleString() }}</span>
                <button type="button" class="eo-del" aria-label="刪除" @click="removeMemberEditorItem(itemIndex)">刪除</button>
              </div>
            </div>
          </div>

          <div class="et-additem eo-additem">
            <input
              v-model="memberEditorProductInput"
              list="memberEditorProducts"
              placeholder="輸入品名加入品項..."
              @keyup.enter="addMemberEditorItem"
            />
            <button type="button" @click="addMemberEditorItem">加入</button>
          </div>

          <label class="eo-note-l">
            訂單備註
            <textarea id="editOrderNote" v-model.trim="memberEditor.note" rows="2" placeholder="例：請於下午茶時段送達、不要香菜…"></textarea>
          </label>

          <div class="et-foot-sum">訂購人合計 <b>${{ memberEditorTotal.toLocaleString() }}</b></div>
          <datalist id="memberEditorProducts">
            <option v-for="item in productOptions" :key="item.name" :value="item.name">
              {{ item.isCombo ? '組合' : '單品' }} · ${{ item.price }}
            </option>
          </datalist>
        </div>

        <footer class="ppv-foot">
          <button type="button" class="date-cancel" @click="closeMemberEditor">取消</button>
          <button type="button" class="date-apply" @click="saveMemberEditor">儲存變更</button>
        </footer>
      </section>
    </div>

    <div v-if="orderEditor" id="editTeamModal" class="modal-backdrop style-modal show" @click.self="closeOrderEditor">
      <section class="edit-modal order-editor-modal ppv-box et-box">
        <header class="ppv-head">
          <h2 id="editTeamTitle">{{ orderEditorTitle }}</h2>
          <button type="button" @click="closeOrderEditor">×</button>
        </header>

        <div id="editTeamForm" class="order-editor-body ppv-body et-body">
          <label v-if="orderEditor.mode === 'create'" class="text-block">
            從常用聯絡帶入
            <select v-model="createContactId" class="search-input" @change="fillCreateFromContact">
              <option value="">不帶入，手動填寫</option>
              <option v-for="option in contactOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
            </select>
          </label>

          <section class="et-sec">
            <div class="et-sec-t">團購人 / 公司資訊</div>
            <div class="form-grid">
              <label>公司 / 團購名稱<input v-model.trim="orderEditor.company" /></label>
              <label>送單地址<input v-model.trim="orderEditor.address" /></label>
              <label>團購人姓名<input v-model.trim="orderEditor.organizer" /></label>
              <label>團購人電話<input v-model.trim="orderEditor.organizerTel" /></label>
              <label>日期<input v-model="orderEditor.date" type="date" /></label>
              <label>時間<input v-model="orderEditor.time" type="time" /></label>
              <label>團購單狀態
                <select v-model="orderEditor.status">
                  <option value="pending">待審核</option>
                  <option value="accepted">已接單</option>
                  <option value="shipped">已出貨</option>
                  <option value="rejected">已拒絕</option>
                </select>
              </label>
            </div>
          </section>

          <section class="et-sec">
            <div class="et-sec-t">
              訂購人（{{ orderEditor.members.length }} 位）
              <button type="button" class="et-add" @click="addEditorMember">＋ 新增訂購人</button>
            </div>

            <div v-if="orderEditor.members.length" id="etMembers" class="et-members">
              <article v-for="(member, memberIndex) in orderEditor.members" :key="member.id" class="et-member" :data-mi="memberIndex">
                <div class="et-member-h">
                  <input v-model.trim="member.name" class="et-mname" placeholder="訂購人姓名" />
                  <span class="et-msub">${{ editorMemberTotal(member).toLocaleString() }}</span>
                  <button type="button" class="et-del-mem" aria-label="刪除訂購人" @click="removeEditorMember(member)">刪除</button>
                </div>

                <div class="et-member-row">
                  <input v-model.trim="member.department" placeholder="單位 / 部門" />
                  <input v-model.trim="member.phone" placeholder="電話（選填）" />
                </div>
                <input v-model.trim="member.note" class="et-note" placeholder="備註（選填）" />

                <div class="et-items">
                  <div v-if="!member.items.length" class="et-item-empty">尚無品項</div>
                  <div v-for="(item, itemIndex) in member.items" :key="`${item[0]}-${itemIndex}`" class="et-item">
                    <span class="et-item-n">{{ item[0] }}</span>
                    <div class="et-item-ctrl">
                      <button type="button" class="eo-step" @click="changeEditorItemQty(member, itemIndex, -1)">−</button>
                      <span class="eo-q">{{ item[1] }}</span>
                      <button type="button" class="eo-step" @click="changeEditorItemQty(member, itemIndex, 1)">＋</button>
                      <span class="eo-p">${{ Number(item[2] || 0).toLocaleString() }}</span>
                      <button type="button" class="eo-del" aria-label="刪除品項" @click="removeEditorItem(member, itemIndex)">刪除</button>
                    </div>
                  </div>
                </div>

                <div class="et-additem">
                  <input
                    :id="`etAdd${memberIndex}`"
                    v-model="editorProductInputs[member.id]"
                    list="orderEditorProducts"
                    placeholder="輸入品名加入品項..."
                    @keyup.enter="addEditorItem(member)"
                  />
                  <button type="button" @click="addEditorItem(member)">加入</button>
                </div>
              </article>
            </div>
            <div v-else class="et-item-empty">尚無訂購人，請新增</div>
          </section>

          <div class="et-foot-sum">團購單合計 <b>${{ orderEditorTotal.toLocaleString() }}</b></div>
          <datalist id="orderEditorProducts">
            <option v-for="item in productOptions" :key="item.name" :value="item.name">
              {{ item.isCombo ? '組合' : '單品' }} · ${{ item.price }}
            </option>
          </datalist>
        </div>

        <footer class="ppv-foot">
          <button type="button" class="ghost-btn date-cancel" @click="closeOrderEditor">取消</button>
          <button type="button" class="primary-btn date-apply" @click="saveOrderEditor">
            {{ orderEditor.mode === 'edit' ? '儲存變更' : '建立訂單' }}
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>
