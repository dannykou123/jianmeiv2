<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalogStore } from '../stores/catalog.js'
import { teamDeadlineText, useTeamsStore } from '../stores/teams.js'
import { useOrdersStore } from '../stores/orders.js'
import { useUiSettingsStore } from '../stores/uiSettings.js'
import { buildA4OrderPages } from '../print/legacyTemplates.js'
import { printHtmlPages } from '../services/localPrint.js'

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const teams = useTeamsStore()
const orders = useOrdersStore()
const uiSettings = useUiSettingsStore()

const organizerHistory = [
  { date: '2026/05/16', people: 6, total: 1480, status: '已送單' },
  { date: '2026/05/09', people: 8, total: 2050, status: '已送單' },
  { date: '2026/05/02', people: 5, total: 1230, status: '已送單' },
  { date: '2026/04/25', people: 7, total: 1690, status: '已送單' },
  { date: '2026/04/18', people: 4, total: 880, status: '已送單' },
  { date: '2026/04/11', people: 9, total: 2360, status: '已送單' },
  { date: '2026/04/04', people: 6, total: 1540, status: '已送單' },
  { date: '2026/03/28', people: 5, total: 1180, status: '已送單' },
  { date: '2026/03/21', people: 8, total: 1920, status: '已送單' },
  { date: '2026/03/14', people: 7, total: 1750, status: '已送單' },
  { date: '2026/03/07', people: 6, total: 1390, status: '已送單' }
]

const activeTeamId = ref(route.params.teamId || teams.teams[0]?.id || '')
const activeOrderId = ref(orders.orders[0]?.id || '')
const message = ref('')
const submitOpen = ref(false)
const newTeamOpen = ref(false)
const shareText = ref('開團囉！！請點網址進去點餐')
const deliverAt = ref(defaultDeliverAt())
const quickMenuType = ref('normal')
const quickCart = reactive({})
const nowMs = ref(Date.now())
let countdownTimer = null

const quickMember = reactive({
  name: '',
  department: '',
  phone: '',
  note: '',
  itemsText: '招牌綜合滷味,1,180'
})

const newTeam = reactive({
  name: '',
  company: '',
  dueDate: todayYmd(),
  deadline: uiSettings.team.defaultDeadline,
  organizer: ''
})

const activeTeam = computed(() => teams.findTeam(activeTeamId.value) || teams.teams[0] || null)
const activeTeamOrders = computed(() => {
  const team = activeTeam.value
  if (!team) return orders.orders
  return orders.orders.filter((order) => {
    if (order.teamId) return order.teamId === team.id
    return order.company === team.company
  })
})
const activeOrder = computed(() => activeTeamOrders.value.find((order) => order.id === activeOrderId.value) || activeTeamOrders.value[0] || null)
const openTeamCount = computed(() => teams.teams.filter((team) => team.open).length)
const maxOpenTeams = computed(() => Math.max(1, Number(uiSettings.team.maxOpenTeams) || 1))
const teamTotal = computed(() => activeTeamOrders.value.reduce((sum, order) => sum + orders.orderTotal(order), 0))
const memberCount = computed(() => activeTeamOrders.value.reduce((sum, order) => sum + order.members.length, 0))
const itemCount = computed(() => activeTeamOrders.value.reduce((sum, order) => sum + order.members.reduce((memberSum, member) => {
  return memberSum + member.items.reduce((itemSum, [, qty]) => itemSum + Number(qty || 0), 0)
}, 0), 0))

const shareLink = computed(() => {
  if (!activeTeam.value) return ''
  const href = router.resolve({ path: '/orderer', query: { team: activeTeam.value.id } }).href
  return `${window.location.origin}${window.location.pathname}${href}`
})

const submitDescription = computed(() => {
  const team = activeTeam.value
  if (!team?.submitStatus) return '整批送單前仍可自由調整訂購人與品項。'
  if (team.submitStatus === 'pending') return '已送單給店家，等待店家接單；尚未接單前可以收回。'
  if (team.submitStatus === 'accepted') return '店家已接單，無法收回；出貨前仍可追加訂購人。'
  return '店家已拒單，可以重新編輯後再次送出。'
})

const itemSummary = computed(() => {
  const map = new Map()
  activeTeamOrders.value.forEach((order) => {
    order.members.forEach((member) => {
      member.items.forEach(([name, qty, price]) => {
        const prev = map.get(name) || { qty: 0, amount: 0 }
        prev.qty += Number(qty || 0)
        prev.amount += Number(qty || 0) * Number(price || 0)
        map.set(name, prev)
      })
    })
  })
  return [...map.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.qty - a.qty)
})
const menuGroups = computed(() => catalog.orderMenuGroups)
const activeQuickMenuGroup = computed(() => menuGroups.value.find((group) => group.key === quickMenuType.value) || menuGroups.value[0] || { items: [] })
const quickMenu = computed(() => activeQuickMenuGroup.value.items)
const quickCartItems = computed(() => Object.entries(quickCart)
  .map(([id, qty]) => {
    const product = catalog.findProduct(id)
    return product ? { id, name: product.name, qty, price: product.price, subtotal: qty * product.price } : null
  })
  .filter(Boolean))
const quickCartTotal = computed(() => quickCartItems.value.reduce((sum, item) => sum + item.subtotal, 0))
const visibleOrganizerHistory = computed(() => {
  if (!uiSettings.team.keepOrganizerHistory) return []
  const limit = Math.max(0, Number(uiSettings.team.organizerHistoryLimit) || 0)
  return limit > 0 ? organizerHistory.slice(0, limit) : organizerHistory
})
const deadlineCountdown = computed(() => {
  const team = activeTeam.value
  if (!team?.deadline) return '未設定'
  const deadline = new Date(`${team.dueDate}T${team.deadline}`)
  if (Number.isNaN(deadline.getTime())) return '未設定'
  const diff = Math.floor((deadline.getTime() - nowMs.value) / 1000)
  if (diff <= 0) return '已截止'
  const days = Math.floor(diff / 86400)
  const hours = String(Math.floor((diff % 86400) / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((diff % 3600) / 60)).padStart(2, '0')
  const seconds = String(diff % 60).padStart(2, '0')
  if (days > 0) return `${days}天 ${hours}:${minutes}`
  return Number(hours) > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
})
const deadlineCountdownLabel = computed(() => deadlineCountdown.value === '已截止' ? '收單狀態' : '收單倒數')
const deadlineCountdownClass = computed(() => ({
  'deadline-closed': deadlineCountdown.value === '已截止',
  'deadline-muted': deadlineCountdown.value === '未設定'
}))

onMounted(() => {
  countdownTimer = window.setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (countdownTimer) window.clearInterval(countdownTimer)
})

watch(() => route.params.teamId, (teamId) => {
  if (teamId && teams.findTeam(teamId)) activeTeamId.value = teamId
})

watch(activeTeamId, (teamId) => {
  if (teamId && route.params.teamId !== teamId) router.replace(`/organizer/${teamId}`)
})

watch(activeTeamOrders, (list) => {
  if (!list.some((order) => order.id === activeOrderId.value)) {
    activeOrderId.value = list[0]?.id || ''
  }
}, { immediate: true })

watch(menuGroups, (groups) => {
  if (groups.length && !groups.some((group) => group.key === quickMenuType.value)) {
    quickMenuType.value = groups[0].key
  }
}, { immediate: true })

function todayYmd() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function defaultDeliverAt() {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function selectTeam(teamId) {
  activeTeamId.value = teamId
  message.value = ''
}

function teamState(team) {
  if (!team.open) return '已關團'
  if (team.paused) return '暫停收單'
  return '開團中'
}

function teamOrders(team) {
  if (!team) return []
  return orders.orders.filter((order) => {
    if (order.teamId) return order.teamId === team.id
    return order.company === team.company
  })
}

function teamMemberCount(team) {
  return teamOrders(team).reduce((sum, order) => sum + order.members.length, 0)
}

function teamTotalFor(team) {
  return teamOrders(team).reduce((sum, order) => sum + orders.orderTotal(order), 0)
}

function teamLinkFor(team) {
  if (!team) return ''
  const href = router.resolve({ path: '/orderer', query: { team: team.id } }).href
  return `${window.location.origin}${window.location.pathname}${href}`
}

async function copyTeamLink(team) {
  const link = teamLinkFor(team)
  if (!link) return
  try {
    await navigator.clipboard.writeText(link)
    message.value = `已複製「${team.name}」團購連結`
  } catch (_) {
    message.value = `團購連結：${link}`
  }
}

function openTeamLineShare(team) {
  const link = teamLinkFor(team)
  if (!link) return
  const text = encodeURIComponent(`${shareText.value}\n${link}`)
  window.open(`https://line.me/R/msg/text/?${text}`, '_blank')
}

function recallTeamFromList(team) {
  teams.recallSubmission(team.id)
  message.value = '已收回訂單，可進入團購修改後再送出'
}

function parseItems(text) {
  return text.split(';')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, qty = '1', price = '0'] = line.split(',').map((part) => part.trim())
      return [name, Number(qty) || 1, Number(price) || 0]
    })
    .filter(([name]) => name)
}

function changeQuickQty(id, delta) {
  quickCart[id] = Math.max(0, (quickCart[id] || 0) + delta)
  if (!quickCart[id]) delete quickCart[id]
}

function clearQuickCart() {
  Object.keys(quickCart).forEach((key) => delete quickCart[key])
}

function addQuickMember() {
  const items = quickCartItems.value.length
    ? quickCartItems.value.map((item) => [item.name, item.qty, item.price])
    : parseItems(quickMember.itemsText)
  if (!quickMember.name.trim() || !items.length) {
    message.value = '請輸入訂購人姓名與品項'
    return
  }
  let order = activeOrder.value
  if (!order && activeTeam.value) {
    const id = orders.addOrder({
      company: activeTeam.value.company || activeTeam.value.name,
      address: activeTeam.value.company || '',
      teamId: activeTeam.value.id,
      members: []
    })
    activeOrderId.value = id
    order = orders.findOrder(id)
  }
  if (!order) {
    message.value = '尚無可加入的團購訂單'
    return
  }
  orders.addMember(order.id, {
    name: quickMember.name,
    department: quickMember.department,
    phone: quickMember.phone,
    note: quickMember.note,
    items
  })
  Object.assign(quickMember, {
    name: '',
    department: '',
    phone: '',
    note: '',
    itemsText: '招牌綜合滷味,1,180'
  })
  clearQuickCart()
  message.value = '已加入訂購人'
}

function openNewTeam() {
  if (openTeamCount.value >= maxOpenTeams.value) {
    message.value = `已達開團上限（${maxOpenTeams.value} 團），請先關閉其他團`
    return
  }
  Object.assign(newTeam, {
    name: '',
    company: '',
    dueDate: todayYmd(),
    deadline: uiSettings.team.defaultDeadline,
    organizer: ''
  })
  newTeamOpen.value = true
}

function createTeam() {
  if (!newTeam.name.trim()) {
    message.value = '請輸入團購名稱'
    return
  }
  const id = teams.addTeam({
    name: newTeam.name,
    company: newTeam.company,
    dueDate: newTeam.dueDate,
    deadline: newTeam.deadline,
    organizer: newTeam.organizer
  })
  newTeamOpen.value = false
  activeTeamId.value = id
  message.value = `已開團「${newTeam.name}」`
}

async function copyShareLink() {
  if (!shareLink.value) return
  try {
    await navigator.clipboard.writeText(shareLink.value)
    message.value = '已複製團購連結'
  } catch (_) {
    message.value = `團購連結：${shareLink.value}`
  }
}

function openLineShare() {
  if (!shareLink.value) return
  const text = encodeURIComponent(`${shareText.value}\n${shareLink.value}`)
  window.open(`https://line.me/R/msg/text/?${text}`, '_blank')
}

function openSubmitModal() {
  if (!activeTeam.value) return
  if (!memberCount.value) {
    message.value = '還沒有任何訂單'
    return
  }
  if (activeTeam.value.submitStatus === 'accepted') {
    message.value = '店家已接單，無法重新送單或取消'
    return
  }
  if (activeTeam.value.submitStatus === 'pending') {
    message.value = '訂單已送出、待店家審核；如要修改請先收回'
    return
  }
  deliverAt.value = activeTeam.value.deliverAt || defaultDeliverAt()
  submitOpen.value = true
}

function confirmSubmit() {
  const time = new Date(deliverAt.value)
  if (!deliverAt.value || Number.isNaN(time.getTime())) {
    message.value = '請選擇送單時間'
    return
  }
  if (time.getTime() < Date.now() - 60000) {
    message.value = '送單日期不可早於現在時間'
    return
  }
  teams.submitToShop(activeTeam.value.id, {
    deliverAt: deliverAt.value,
    people: memberCount.value,
    total: teamTotal.value
  })
  submitOpen.value = false
  message.value = `已送單給店家：${memberCount.value} 人 · $${teamTotal.value.toLocaleString()}`
}

function recallOrder() {
  teams.recallSubmission(activeTeam.value.id)
  message.value = '已收回訂單，可重新編輯後再送出'
}

function reeditResubmit() {
  teams.reeditSubmission(activeTeam.value.id)
  message.value = '已可重新編輯，調整訂單後再送出'
}

function demoReview(decision) {
  teams.reviewSubmission(activeTeam.value.id, decision)
  message.value = decision === 'accept' ? '（模擬）店家已接單' : '（模擬）店家已拒單'
}

function addToOrder() {
  message.value = '可在下方「快速追加訂購人」繼續加單'
}

function updatePayment(patch) {
  if (!activeTeam.value) return
  teams.updateTeam(activeTeam.value.id, {
    pay: { ...activeTeam.value.pay, ...patch }
  })
}

function printA4() {
  const team = activeTeam.value
  const pages = buildA4OrderPages({
    orders: activeTeamOrders.value,
    title: team?.name || '團購訂單總表',
    code: team?.id || '',
    meta: [team?.company, team ? teamDeadlineText(team) : ''].filter(Boolean).join(' · ')
  })
  printHtmlPages({ kind: 'a4', htmlPages: pages, docSize: { w: 210, h: 297 } })
}
</script>

<template>
  <main id="organizer" class="page organizer-page screen active org-wrap">
    <nav class="topbar org-head">
      <button type="button" @click="router.push('/')">返回入口</button>
      <strong id="orgTitle" class="ord-shop">團購主</strong>
    </nav>

    <section id="orgStatsRow" class="grid-3 org-stats">
      <div class="stat-card org-stat"><span class="os-k">訂購人數</span><strong class="os-v">{{ memberCount }}</strong></div>
      <div class="stat-card org-stat"><span class="os-k">品項總數</span><strong class="os-v">{{ itemCount }}</strong></div>
      <div class="stat-card org-stat"><span class="os-k">總額</span><strong class="os-v">${{ teamTotal.toLocaleString() }}</strong></div>
      <div class="stat-card org-stat"><span class="os-k">{{ deadlineCountdownLabel }}</span><strong class="os-v" :class="deadlineCountdownClass">{{ deadlineCountdown }}</strong></div>
    </section>

    <section id="orgListView" class="panel org-panel">
      <div class="panel-head">
        <div>
          <h2>目前團購</h2>
          <span id="teamQuotaHint" class="team-quota-hint">{{ openTeamCount }} 個開團中 · 上限 {{ maxOpenTeams }} 團 · {{ activeTeam?.name || '尚無團購' }}</span>
        </div>
        <div class="action-row org-actions">
          <button type="button" class="ghost-btn org-act team-new-btn" @click="openNewTeam">開新團</button>
          <button type="button" class="primary-btn org-act" @click="printA4">列印 A4 訂單表</button>
        </div>
      </div>

      <div id="teamList" class="team-list">
        <article
          v-for="team in teams.teams"
          :key="team.id"
          class="tcard"
          :class="[{ active: team.id === activeTeam?.id }, team.open && !team.paused ? 'on' : 'off']"
          @click="selectTeam(team.id)"
        >
          <div class="tcard-top">
            <div class="tcard-nm">{{ team.name }}</div>
            <span class="tcard-badge" :class="team.open && !team.paused ? 'on' : 'off'">
              <span v-if="team.open && !team.paused" class="team-dot"></span>
              {{ teamState(team) }}
            </span>
          </div>
          <div class="tcard-meta">
            <span>#{{ team.id }}</span>
            <span>{{ team.company || '未填公司' }}</span>
            <span>截止 {{ teamDeadlineText(team) }}</span>
            <span>{{ team.organizer || '未填團購主' }}</span>
          </div>
          <div class="tcard-foot">
            <span class="tcard-stat">{{ teamMemberCount(team) }} 單 · ${{ teamTotalFor(team).toLocaleString() }}</span>
            <div class="tcard-ops team-actbar">
              <button type="button" class="tcard-op team-copy" @click.stop="copyTeamLink(team)">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                複製團購連結
              </button>
              <button type="button" class="tcard-op line team-line" @click.stop="openTeamLineShare(team)">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.5 2 2 5.7 2 10.2c0 4 3.6 7.4 8.5 8 .3.1.8.2.9.5.1.3.1.6 0 .9l-.1.9c0 .3-.2 1 .9.6 1.1-.5 6-3.5 8.2-6h0c1.5-1.6 2.2-3.3 2.2-5.4C22.6 5.7 18 2 12 2z" /></svg>
                LINE 分享
              </button>
              <button type="button" class="tcard-op team-toggle-mini" @click.stop="teams.togglePaused(team.id)">{{ team.paused ? '恢復收單' : '暫停收單' }}</button>
              <button type="button" class="tcard-op tg team-toggle-mini" @click.stop="teams.toggleOpen(team.id)">{{ team.open ? '關閉團購' : '開啟團購' }}</button>
            </div>
            <div v-if="team.submitStatus" class="tcard-submit" :class="team.submitStatus" @click.stop>
              <span>{{ teams.submitStatusLabel(team.submitStatus) }}</span>
              <button v-if="team.submitStatus === 'pending'" type="button" class="ts-act recall" @click="recallTeamFromList(team)">收回訂單</button>
              <button v-if="team.submitStatus === 'accepted'" type="button" class="ts-act add" @click="selectTeam(team.id)">追加訂單</button>
              <button v-if="team.submitStatus === 'rejected'" type="button" class="ts-act add" @click="selectTeam(team.id)">重新編輯</button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section v-if="uiSettings.team.keepOrganizerHistory" class="hist-sec organizer-history">
      <div class="hist-h">
        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        過去的團購
      </div>
      <div v-if="!visibleOrganizerHistory.length" class="hist-empty">還沒有團購紀錄</div>
      <template v-else>
        <article v-for="record in visibleOrganizerHistory" :key="record.date" class="hist-item">
          <div class="hist-top">
            <span class="hist-date">
              {{ record.date }}
              <span class="hist-badge done">{{ record.status }}</span>
            </span>
            <span class="hist-amt">${{ record.total.toLocaleString() }}</span>
          </div>
          <div class="hist-sub">共 {{ record.people }} 人訂購</div>
        </article>
      </template>
    </section>

    <section v-if="activeTeam" id="orgDetailView" class="panel org-panel">
      <div class="panel-head">
        <div>
          <h2>{{ activeTeam.name }}</h2>
          <span>#{{ activeTeam.id }} · {{ teamState(activeTeam) }} · 截止 {{ teamDeadlineText(activeTeam) }}</span>
        </div>
        <span class="pill">{{ teams.submitStatusLabel(activeTeam.submitStatus) }}</span>
      </div>

      <div id="teamOpen" class="share-box team-open">
        <input id="teamLink" class="team-id" :value="shareLink" readonly />
        <button type="button" class="team-copy" @click="copyShareLink">複製連結</button>
        <button type="button" class="team-line" @click="openLineShare">LINE 分享</button>
      </div>
      <textarea v-model="shareText" class="parts-textarea team-note-l" aria-label="LINE 分享文字"></textarea>

      <div id="orgSubmitBar" class="submit-state org-submit-bar" :class="activeTeam.submitStatus || 'draft'">
        <div class="osb-main">
          <div class="osb-h">
            <strong class="osb-badge" :class="activeTeam.submitStatus || 'draft'">{{ teams.submitStatusLabel(activeTeam.submitStatus) }}</strong>
            <small v-if="activeTeam.deliverAt" class="osb-when">送單時間 {{ activeTeam.deliverAt.replace('T', ' ') }}</small>
          </div>
          <small class="osb-desc">{{ submitDescription }}</small>
        </div>
        <div class="action-row osb-actions">
          <button v-if="!activeTeam.submitStatus" type="button" class="primary-btn osb-btn" @click="openSubmitModal">整批送單給店家</button>
          <button v-if="activeTeam.submitStatus === 'pending'" type="button" class="osb-btn recall" @click="recallOrder">收回訂單</button>
          <button v-if="activeTeam.submitStatus === 'pending'" type="button" class="osb-btn demo" @click="demoReview('accept')">店家接單</button>
          <button v-if="activeTeam.submitStatus === 'pending'" type="button" class="osb-btn demo" @click="demoReview('reject')">店家拒單</button>
          <button v-if="activeTeam.submitStatus === 'accepted'" type="button" class="osb-btn add" @click="addToOrder">追加訂單</button>
          <button v-if="activeTeam.submitStatus === 'rejected'" type="button" class="osb-btn reedit" @click="reeditResubmit">重新編輯並送出</button>
        </div>
      </div>
    </section>

    <section v-if="activeTeam" class="panel org-panel pay-setup">
      <div class="panel-head">
        <h2>團購公告與付款</h2>
        <span>會顯示給訂購人參考</span>
      </div>
      <label class="text-block pay-fld">
        公告內容
        <textarea :value="activeTeam.hostNote" @input="teams.updateTeam(activeTeam.id, { hostNote: $event.target.value })"></textarea>
      </label>
      <div class="form-grid team-pay-grid">
        <label class="pay-fld"><span class="pay-fld-k">LINE ID</span><input :value="activeTeam.pay.lineId" @input="updatePayment({ lineId: $event.target.value })" /></label>
        <label class="pay-fld"><span class="pay-fld-k">匯款資訊</span><input :value="activeTeam.pay.bank" @input="updatePayment({ bank: $event.target.value })" /></label>
      </div>
      <button type="button" class="switch-line pay-switch" :class="{ on: activeTeam.pay.cash }" @click="updatePayment({ cash: !activeTeam.pay.cash })">
        {{ activeTeam.pay.cash ? '接受現金付款' : '不收現金' }}
      </button>
    </section>

    <section class="panel org-panel proxy-panel">
      <div class="panel-head">
        <div>
          <h2>快速追加訂購人</h2>
          <span>{{ activeOrder?.company || '尚無訂單' }}</span>
        </div>
        <select v-model="activeOrderId" class="search-input">
          <option v-if="!activeTeamOrders.length" value="">尚無訂單，追加後會自動建立</option>
          <option v-for="order in activeTeamOrders" :key="order.id" :value="order.id">{{ order.company }} · {{ order.date }}</option>
        </select>
      </div>
      <div class="form-grid">
        <label>姓名<input v-model="quickMember.name" /></label>
        <label>部門<input v-model="quickMember.department" /></label>
        <label>電話<input v-model="quickMember.phone" /></label>
        <label>備註<input v-model="quickMember.note" /></label>
        <label class="span-2">
          備用文字品項
          <textarea v-model="quickMember.itemsText" class="parts-textarea" placeholder="品名,數量,單價;品名,數量,單價"></textarea>
        </label>
      </div>
      <div class="proxy-order-menu">
        <div class="panel-subhead">
          <h3>代選品項</h3>
          <span>目前 ${{ quickCartTotal.toLocaleString() }}</span>
        </div>
        <div class="seg-row">
          <button
            v-for="group in menuGroups"
            :key="group.key"
            type="button"
            :class="{ on: quickMenuType === group.key }"
            @click="quickMenuType = group.key"
          >
            {{ group.label }}
          </button>
        </div>
        <div class="quick-menu">
          <article v-for="item in quickMenu" :key="item.id" class="quick-menu-item">
            <div>
              <strong>{{ item.name }}</strong>
              <small v-if="item.desc">{{ item.desc }}</small>
              <small v-else-if="item.parts">組合優惠</small>
              <small v-else>庫存 {{ item.stock }}</small>
            </div>
            <b>${{ item.price }}</b>
            <div class="qty-row mini">
              <button type="button" @click="changeQuickQty(item.id, -1)">−</button>
              <span>{{ quickCart[item.id] || 0 }}</span>
              <button type="button" @click="changeQuickQty(item.id, 1)">+</button>
            </div>
          </article>
        </div>
        <div class="proxy-cart-summary" :class="{ empty: !quickCartItems.length }">
          <div>
            <strong>{{ quickCartItems.length ? `${quickCartItems.length} 種品項` : '尚未選品項' }}</strong>
            <small>
              {{ quickCartItems.length
                ? quickCartItems.map((item) => `${item.name} x${item.qty}`).join('、')
                : '可用上方按鈕選品，或保留文字格式貼單。' }}
            </small>
          </div>
          <button type="button" class="ghost-btn" :disabled="!quickCartItems.length" @click="clearQuickCart">清空選品</button>
        </div>
      </div>
      <div class="action-row org-actions">
        <button type="button" class="primary-btn org-act" @click="addQuickMember">加入此訂購人</button>
        <small class="set-note">若已用上方按鈕選品，會優先使用選品內容；文字格式可作為臨時貼單備用。</small>
      </div>
    </section>

    <section id="orgPeople" class="panel org-panel">
      <div class="panel-head">
        <h2>訂購人明細</h2>
        <span>{{ memberCount }} 位</span>
      </div>
      <div class="member-list">
        <article v-for="order in activeTeamOrders" :key="order.id" class="order-card">
          <div class="order-head">
            <div>
              <strong>{{ order.company }}</strong>
              <small>{{ order.date }} {{ order.time }} · {{ order.address }}</small>
            </div>
            <b>${{ orders.orderTotal(order).toLocaleString() }}</b>
          </div>
          <div class="order-detail">
            <article v-for="member in order.members" :key="member.id" class="member-row">
              <div>
                <strong>{{ member.name }}</strong>
                <small>{{ member.department || '無部門' }} · {{ member.phone || '無電話' }}</small>
                <small v-if="member.note">備註：{{ member.note }}</small>
              </div>
              <ul>
                <li v-for="([name, qty, price], index) in member.items" :key="index">
                  <span>{{ name }}</span>
                  <b>x{{ qty }}</b>
                  <em>${{ (qty * price).toLocaleString() }}</em>
                </li>
              </ul>
            </article>
          </div>
        </article>
        <p v-if="!activeTeamOrders.length" class="set-note">這個團購還沒有訂單。</p>
      </div>
    </section>

    <section id="orgItems" class="panel org-panel">
      <div class="panel-head">
        <h2>品項彙總</h2>
        <span>備料參考</span>
      </div>
      <div class="report-list">
        <article v-for="item in itemSummary" :key="item.name" class="report-row">
          <div>
            <strong>{{ item.name }}</strong>
            <small>{{ item.qty }} 份 · ${{ item.amount.toLocaleString() }}</small>
          </div>
          <div class="bar"><span :style="{ width: `${Math.min(100, item.qty * 18)}%` }"></span></div>
        </article>
      </div>
    </section>

    <p v-if="message" class="status-line">{{ message }}</p>

    <div v-if="submitOpen" id="submitModal" class="modal-backdrop date-modal show" @click.self="submitOpen = false">
      <section class="edit-modal date-box">
        <header class="date-box-h">
          <h2>整批送單給店家</h2>
          <button type="button" @click="submitOpen = false">×</button>
        </header>
        <div class="form-grid">
          <label class="span-2">預計送達 / 取貨時間<input v-model="deliverAt" type="datetime-local" /></label>
        </div>
        <p class="set-note">送單後會進入待審核狀態，店家接單前可收回。</p>
        <footer class="date-box-ft">
          <button type="button" class="ghost-btn date-cancel" @click="submitOpen = false">取消</button>
          <button type="button" class="primary-btn date-apply" @click="confirmSubmit">確認送單</button>
        </footer>
      </section>
    </div>

    <div v-if="newTeamOpen" id="newTeamModal" class="modal-backdrop date-modal show" @click.self="newTeamOpen = false">
      <section class="edit-modal date-box">
        <header class="date-box-h">
          <h2>開新團</h2>
          <button type="button" @click="newTeamOpen = false">×</button>
        </header>
        <div class="form-grid">
          <label>團購名稱<input v-model.trim="newTeam.name" /></label>
          <label>公司 / 群組<input v-model.trim="newTeam.company" /></label>
          <label>收單日期<input v-model="newTeam.dueDate" type="date" /></label>
          <label>收單時間<input v-model="newTeam.deadline" type="time" /></label>
          <label>團購主<input v-model.trim="newTeam.organizer" /></label>
        </div>
        <footer class="date-box-ft">
          <button type="button" class="ghost-btn date-cancel" @click="newTeamOpen = false">取消</button>
          <button type="button" class="primary-btn date-apply" @click="createTeam">建立團購</button>
        </footer>
      </section>
    </div>
  </main>
</template>
