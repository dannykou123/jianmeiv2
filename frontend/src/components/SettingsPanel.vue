<script setup>
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCatalogStore } from '../stores/catalog.js'
import { useContactsStore } from '../stores/contacts.js'
import { useOrdersStore } from '../stores/orders.js'
import { usePrintSettingsStore } from '../stores/printSettings.js'
import { useTeamsStore } from '../stores/teams.js'
import { useThemeStore } from '../stores/theme.js'
import { useMapStore } from '../stores/map.js'
import { fontSizeDefinitions, useUiSettingsStore } from '../stores/uiSettings.js'
import { buildNasBaseUrl, testNasConnection } from '../services/nasPrint.js'
import { prepStyles, shipStyles } from '../data/printStyles.js'

const router = useRouter()
const catalog = useCatalogStore()
const contacts = useContactsStore()
const orders = useOrdersStore()
const printSettings = usePrintSettingsStore()
const teamsStore = useTeamsStore()
const themeStore = useThemeStore()
const mapStore = useMapStore()
const uiSettings = useUiSettingsStore()
const { mode, docSize, nasConfig, selectedShipStyle, selectedPrepStyle } = storeToRefs(printSettings)
const { team, display } = storeToRefs(uiSettings)

const tab = ref('account')
const status = ref('')
const dataText = ref('')
const newRoleName = ref('')

const panelStorageKey = 'jm_settingsPanel'
const defaultPanelState = {
  account: {
    shopName: '健美滷味',
    phone: '02-0000-0000',
    lineId: 'jianmei_tw',
    address: '台北市大安區忠孝東路四段 1 號',
    hours: '11:00 - 21:00（週一公休）',
    notifyNewOrders: true,
    notifyRevenueSummary: false
  },
  roles: [
    { id: 'r1', name: '店長', locked: true, perms: { orders: true, products: true, inventory: true, reports: true, settings: true } },
    { id: 'r2', name: '廚房', locked: false, perms: { orders: true, products: false, inventory: true, reports: false, settings: false } },
    { id: 'r3', name: '外場', locked: false, perms: { orders: true, products: false, inventory: false, reports: false, settings: false } }
  ],
  logs: [
    { time: '2026-06-04 10:30', who: '店長', action: '接單 明德科技' },
    { time: '2026-06-04 10:42', who: '廚房', action: '庫存進貨 滷雞翅 +20' },
    { time: '2026-06-04 11:05', who: '外場', action: '列印出貨單 2 張' }
  ]
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function readPanelState() {
  try {
    const saved = JSON.parse(localStorage.getItem(panelStorageKey) || '{}')
    return {
      account: { ...defaultPanelState.account, ...(saved.account || {}) },
      roles: Array.isArray(saved.roles) && saved.roles.length ? saved.roles : clone(defaultPanelState.roles),
      logs: Array.isArray(saved.logs) && saved.logs.length ? saved.logs : clone(defaultPanelState.logs)
    }
  } catch (_) {
    return clone(defaultPanelState)
  }
}

const savedPanelState = readPanelState()
const account = reactive(savedPanelState.account)

const tabs = [
  ['account', '帳號'],
  ['team', '團購'],
  ['print', '列印'],
  ['display', '顯示'],
  ['data', '資料']
]

const permissionFeatures = [
  ['orders', '訂單'],
  ['products', '商品'],
  ['inventory', '庫存'],
  ['reports', '報表'],
  ['settings', '設定']
]

const orderPageSizeOptions = [10, 20, 50, 100]
const fontSizeGroups = fontSizeDefinitions

const roles = ref(savedPanelState.roles)

const logs = ref(savedPanelState.logs)

function persistPanelState() {
  localStorage.setItem(panelStorageKey, JSON.stringify({
    account,
    roles: roles.value,
    logs: logs.value
  }))
}

watch(
  () => ({ account: { ...account }, roles: roles.value, logs: logs.value }),
  persistPanelState,
  { deep: true }
)

function addLog(action, who = '店長') {
  logs.value.unshift({
    time: new Date().toLocaleString('zh-TW', { hour12: false }),
    who,
    action
  })
}

function setDefaultDeadline(value) {
  uiSettings.patchTeamSettings({ defaultDeadline: value || '11:30' })
  status.value = `已設定預設收單截止：${team.value.defaultDeadline}`
  addLog(`設定預設收單截止 ${team.value.defaultDeadline}`)
}

function setMaxOpenTeams(value) {
  const next = Math.max(1, parseInt(value, 10) || 1)
  uiSettings.patchTeamSettings({ maxOpenTeams: next })
  status.value = `已設定團主每日可開團上限：${next} 團`
  addLog(`設定團主每日可開團上限 ${next} 團`)
}

function toggleTeamFlag(key, label) {
  const next = !team.value[key]
  uiSettings.patchTeamSettings({ [key]: next })
  status.value = next ? `已開啟${label}` : `已關閉${label}`
  addLog(`${next ? '開啟' : '關閉'}${label}`)
}

function setHistoryLimit(key, label, value) {
  const next = Math.max(0, parseInt(value, 10) || 0)
  uiSettings.patchTeamSettings({ [key]: next })
  status.value = `${label}：${next === 0 ? '全部' : `${next} 筆`}`
  addLog(`設定${label} ${next === 0 ? '全部' : `${next} 筆`}`)
}

function saveAccount() {
  persistPanelState()
  status.value = '店家資訊已儲存'
  addLog('修改店家資訊')
}

function toggleAccountFlag(key, label) {
  account[key] = !account[key]
  addLog(`${account[key] ? '開啟' : '關閉'}${label}`)
}

function securityAction(label) {
  status.value = `${label}需接帳號服務後啟用`
  addLog(`查看帳號安全：${label}`)
}

function planAction(label) {
  status.value = `${label}需接訂閱與帳務服務後啟用`
  addLog(`查看方案狀態：${label}`)
}

function goPrintStyle(kind) {
  router.push(`/admin/${kind}`)
}

async function pingNas() {
  status.value = '正在測試 NAS 連線...'
  try {
    const result = await testNasConnection(nasConfig.value)
    status.value = result.ok ? `NAS 連線成功：${result.url}` : `NAS 回應異常：HTTP ${result.status}`
    addLog(result.ok ? 'NAS 連線測試成功' : 'NAS 連線測試失敗')
  } catch (error) {
    status.value = `連不到 NAS：${error.message}`
    addLog('NAS 連線測試失敗')
  }
}

function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    catalog: catalog.$state,
    contacts: contacts.$state,
    orders: orders.$state,
    teams: teamsStore.$state,
    printSettings: printSettings.$state,
    theme: themeStore.$state,
    map: mapStore.$state,
    uiSettings: uiSettings.$state,
    settingsPanel: {
      account,
      team: team.value,
      roles: roles.value,
      logs: logs.value
    }
  }
  dataText.value = JSON.stringify(payload, null, 2)
  addLog('產生匯出 JSON')
}

function downloadData() {
  if (!dataText.value) exportData()
  const blob = new Blob([dataText.value], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `jianmei-data-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  addLog('下載資料備份')
}

function importData() {
  try {
    const payload = JSON.parse(dataText.value)
    if (payload.catalog) catalog.$patch(payload.catalog)
    if (payload.contacts) contacts.$patch(payload.contacts)
    if (payload.orders) orders.$patch(payload.orders)
    if (payload.teams) teamsStore.$patch(payload.teams)
    if (payload.printSettings) {
      printSettings.$patch(payload.printSettings)
      printSettings.persistSettings()
    }
    if (payload.theme) themeStore.$patch(payload.theme)
    if (payload.map) mapStore.$patch(payload.map)
    if (payload.uiSettings) uiSettings.$patch(payload.uiSettings)
    uiSettings.setOrdersPerPage(uiSettings.display.ordersPerPage)
    if (payload.settingsPanel?.account) Object.assign(account, payload.settingsPanel.account)
    if (payload.settingsPanel?.team) uiSettings.patchTeamSettings(payload.settingsPanel.team)
    if (payload.settingsPanel?.roles) roles.value = payload.settingsPanel.roles
    if (payload.settingsPanel?.logs) logs.value = payload.settingsPanel.logs
    persistPanelState()
    status.value = '資料已匯入系統狀態'
    addLog('匯入資料 JSON')
  } catch (error) {
    status.value = `匯入失敗：${error.message}`
    addLog('匯入資料 JSON 失敗')
  }
}

function clearAllData() {
  const ok = window.confirm('確定要清除目前暫存資料，並還原預設資料與列印設定嗎？')
  if (!ok) return
  catalog.resetCatalog()
  contacts.resetContacts()
  orders.resetOrders()
  teamsStore.resetTeams()
  printSettings.resetSettings()
  themeStore.resetTheme()
  mapStore.resetMap()
  uiSettings.resetUiSettings()
  Object.assign(account, clone(defaultPanelState.account))
  roles.value = clone(defaultPanelState.roles)
  logs.value = clone(defaultPanelState.logs)
  dataText.value = ''
  status.value = '資料已清除並還原預設值'
  persistPanelState()
  addLog('清除資料並還原預設值')
}

function togglePerm(role, feature) {
  if (role.locked) return
  role.perms[feature] = !role.perms[feature]
  addLog(`調整 ${role.name} 權限：${permissionFeatures.find(([key]) => key === feature)?.[1] || feature}`)
}

function addRole() {
  const name = newRoleName.value.trim()
  if (!name) return
  roles.value.push({
    id: `r${Date.now().toString().slice(-6)}`,
    name,
    locked: false,
    perms: { orders: true, products: false, inventory: false, reports: false, settings: false }
  })
  newRoleName.value = ''
  addLog(`新增角色 ${name}`)
}

function fontSizeValue(varName) {
  return Number(display.value.fontSizes?.[varName]) || 16
}

function deleteRole(roleId) {
  const role = roles.value.find((item) => item.id === roleId)
  if (!role || role.locked) return
  roles.value = roles.value.filter((item) => item.id !== roleId)
  addLog(`刪除角色 ${role.name}`)
}
</script>

<template>
  <section class="panel settings-panel">
    <div class="panel-head">
      <div>
        <h2>系統設定</h2>
        <span>帳號、團購、列印、顯示、權限與資料管理</span>
      </div>
    </div>

    <div id="setTabs" class="seg-row set-tabs">
      <button v-for="[key, label] in tabs" :key="key" type="button" class="set-tab" :class="{ on: tab === key }" :data-sg="key" @click="tab = key">
        {{ label }}
      </button>
    </div>

    <section v-if="tab === 'account'" class="settings-section account-settings">
      <article class="settings-card set-card" data-sg="account">
        <div class="panel-subhead set-card-t">
          <h3>店家資訊</h3>
          <button type="button" class="primary-btn acc-save" @click="saveAccount">儲存店家資訊</button>
        </div>
        <div class="form-grid acc-fields">
          <label class="fld-l">店家名稱<input v-model="account.shopName" /></label>
          <label class="fld-l">聯絡電話<input v-model="account.phone" /></label>
          <label class="fld-l">LINE ID<input v-model="account.lineId" /></label>
          <label class="fld-l">營業時間<input v-model="account.hours" /></label>
          <label class="fld-l span-2">店家地址<input v-model="account.address" /></label>
        </div>
        <p class="set-note">與店家資訊欄位一致，會寫入設定狀態與資料匯出檔。</p>
      </article>

      <article class="settings-card set-card" data-sg="account">
        <div class="panel-subhead set-card-t">
          <h3>通知偏好</h3>
          <span>{{ account.notifyNewOrders || account.notifyRevenueSummary ? '部分開啟' : '全部關閉' }}</span>
        </div>
        <div class="settings-switches">
          <div class="set-row">
            <div class="set-row-l">
              <div class="set-row-t">新訂單通知</div>
              <div class="set-row-d">有新訂單時推播提醒</div>
            </div>
            <button type="button" class="switch switch-line" :class="{ on: account.notifyNewOrders }" role="switch" :aria-checked="account.notifyNewOrders" @click="toggleAccountFlag('notifyNewOrders', '新訂單通知')">
              <span class="knob"></span>
            </button>
          </div>
          <div class="set-row">
            <div class="set-row-l">
              <div class="set-row-t">每日營收摘要</div>
              <div class="set-row-d">每晚 22:00 寄送當日摘要</div>
            </div>
            <button type="button" class="switch switch-line" :class="{ on: account.notifyRevenueSummary }" role="switch" :aria-checked="account.notifyRevenueSummary" @click="toggleAccountFlag('notifyRevenueSummary', '每日營收摘要')">
              <span class="knob"></span>
            </button>
          </div>
        </div>
        <p class="set-note">保留通知偏好開關；推播與摘要寄送需接通知服務後啟用。</p>
      </article>

      <article class="settings-card set-card" data-sg="account">
        <div class="panel-subhead set-card-t">
          <h3>帳號安全</h3>
          <span>目前方案</span>
        </div>
        <div class="account-action-list">
          <button type="button" class="set-link acc-line" @click="securityAction('修改密碼')"><span>修改密碼</span><span class="arr">›</span></button>
          <button type="button" class="set-link acc-line" @click="securityAction('登入裝置管理')"><span>登入裝置管理</span><span class="arr">›</span></button>
        </div>
      </article>

      <article class="settings-card set-card" data-sg="account">
        <div class="panel-subhead set-card-t">
          <h3>方案狀態</h3>
          <span>Pro 試用</span>
        </div>
        <div class="plan-grid">
          <div><small>目前方案</small><strong>團購營運版</strong></div>
          <div><small>本月訂單</small><strong>{{ orders.orders.length }}</strong></div>
          <div><small>列印模式</small><strong>{{ mode === 'nas' ? 'NAS' : '本機' }}</strong></div>
        </div>
        <div class="dashboard-actions">
          <button type="button" @click="planAction('查看帳單')">查看帳單</button>
          <button type="button" @click="planAction('升級方案')">升級方案</button>
        </div>
      </article>

      <article class="settings-card set-card" data-sg="account">
        <div class="panel-subhead set-card-t">
          <h3>權限管理</h3>
          <span>{{ roles.length }} 個角色</span>
        </div>
        <p class="set-note set-desc">設定各角色可使用的功能。</p>
        <div class="role-editor">
          <input v-model="newRoleName" class="search-input" placeholder="新增角色名稱" />
          <button type="button" class="primary-btn acc-line" @click="addRole">新增角色</button>
        </div>
        <div id="permList" class="role-list perm-list">
          <article v-for="role in roles" :key="role.id" class="role-card perm-role">
            <header class="perm-role-h">
              <strong class="perm-role-nm">{{ role.name }}</strong>
              <span v-if="role.locked" class="pill perm-tag">最高權限</span>
              <button v-else type="button" class="danger-btn perm-del" @click="deleteRole(role.id)">刪除</button>
            </header>
            <div class="perm-grid perm-feats">
              <button
                v-for="[key, label] in permissionFeatures"
                :key="key"
                type="button"
                class="perm-chip"
                :class="{ on: role.perms[key] }"
                :disabled="role.locked"
                @click="togglePerm(role, key)"
              >
                {{ label }}
              </button>
            </div>
          </article>
        </div>
      </article>

      <article class="settings-card set-card" data-sg="account">
        <div class="panel-subhead set-card-t">
          <h3>操作紀錄</h3>
          <span>最近 {{ logs.length }} 筆</span>
        </div>
        <p class="set-note set-desc">系統的重要操作紀錄（誰、做了什麼、何時）。</p>
        <div id="logList" class="log-list">
          <article v-for="log in logs" :key="`${log.time}-${log.action}`" class="log-row">
            <div class="log-dot"></div>
            <div class="log-main">
              <div class="log-act">{{ log.action }}</div>
              <div class="log-meta">{{ log.who }} · {{ log.time }}</div>
            </div>
          </article>
        </div>
      </article>
    </section>

    <section v-else-if="tab === 'team'" class="settings-section">
      <article class="settings-card set-card" data-sg="team">
        <div class="panel-subhead set-card-t">
          <h3>團購設定</h3>
          <span>每日上限 {{ team.maxOpenTeams }} 團</span>
        </div>
        <p class="set-note">控制團主發起團購的預設截止時間、每日開團上限與再訂一次功能。</p>
        <div class="form-grid acc-fields">
          <label class="fld-l">預設收單截止
            <input :value="team.defaultDeadline" type="time" @change="setDefaultDeadline($event.target.value)" />
          </label>
          <label class="fld-l">團主每日可開團數上限
            <span class="count-input">
              <input id="maxTeamsInput" :value="team.maxOpenTeams" type="number" min="1" @change="setMaxOpenTeams($event.target.value)" />
              <span>團</span>
            </span>
          </label>
        </div>
        <div id="rowReorder" class="set-row sub-row">
          <div class="set-row-l">
            <div class="set-row-t">允許「再訂一次」</div>
            <div class="set-row-d">訂購人可一鍵依歷史訂單重新下單</div>
          </div>
          <button id="swReorder" type="button" class="switch switch-line" :class="{ on: team.allowReorder }" role="switch" :aria-checked="team.allowReorder" @click="toggleTeamFlag('allowReorder', '「再訂一次」')">
            <span class="knob"></span>
          </button>
        </div>
      </article>

      <article class="settings-card set-card" data-sg="team">
        <div class="panel-subhead set-card-t">
          <h3>可見訂單紀錄</h3>
          <span>團購主 {{ team.keepOrganizerHistory ? '顯示' : '隱藏' }} · 訂購人 {{ team.keepOrdererHistory ? '顯示' : '隱藏' }}</span>
        </div>
        <p class="set-note">設定團購主與訂購人是否顯示歷史訂單，以及各自能往回查看多少筆。</p>
        <div class="settings-switches">
          <div class="set-row">
            <div class="set-row-l">
              <div class="set-row-t">團購主顯示歷史訂單</div>
              <div class="set-row-d">關閉後團購主頁面不顯示「過去的團購」</div>
            </div>
            <button id="swOrg" type="button" class="switch switch-line" :class="{ on: team.keepOrganizerHistory }" role="switch" :aria-checked="team.keepOrganizerHistory" @click="toggleTeamFlag('keepOrganizerHistory', '團購主歷史訂單')">
              <span class="knob"></span>
            </button>
          </div>
          <div class="set-row">
            <div class="set-row-l">
              <div class="set-row-t">訂購人顯示歷史訂單</div>
              <div class="set-row-d">關閉後訂購人頁面不顯示「我的點餐紀錄」</div>
            </div>
            <button id="swOrd" type="button" class="switch switch-line" :class="{ on: team.keepOrdererHistory }" role="switch" :aria-checked="team.keepOrdererHistory" @click="toggleTeamFlag('keepOrdererHistory', '訂購人歷史訂單')">
              <span class="knob"></span>
            </button>
          </div>
        </div>
        <div class="form-grid">
          <label id="rowOrgCount" class="set-row sub-row history-limit-row" :class="{ disabled: !team.keepOrganizerHistory }">
            團購主可見筆數
            <span class="count-input">
              <input
                id="histOrgInput"
                :value="team.organizerHistoryLimit"
                type="number"
                min="0"
                :disabled="!team.keepOrganizerHistory"
                placeholder="全部"
                @change="setHistoryLimit('organizerHistoryLimit', '團購主可見紀錄', $event.target.value)"
              />
              <span>筆</span>
            </span>
          </label>
          <label id="rowOrdCount" class="set-row sub-row history-limit-row" :class="{ disabled: !team.keepOrdererHistory }">
            訂購人可見筆數
            <span class="count-input">
              <input
                id="histOrdInput"
                :value="team.ordererHistoryLimit"
                type="number"
                min="0"
                :disabled="!team.keepOrdererHistory"
                placeholder="全部"
                @change="setHistoryLimit('ordererHistoryLimit', '訂購人可見紀錄', $event.target.value)"
              />
              <span>筆</span>
            </span>
          </label>
        </div>
      </article>
    </section>

    <section v-else-if="tab === 'print'" class="settings-section">
      <div class="panel-subhead set-card-t">
        <h3>列印方式</h3>
        <span>{{ mode === 'nas' ? 'NAS 感熱印表機' : '本機列印' }}</span>
      </div>

      <div class="seg-row">
        <button id="pmLocal" type="button" class="seg-btn" :class="{ on: mode === 'local' }" @click="printSettings.setMode('local')">本機列印</button>
        <button id="pmNas" type="button" class="seg-btn" :class="{ on: mode === 'nas' }" @click="printSettings.setMode('nas')">NAS 感熱印表機</button>
      </div>

      <article class="settings-card set-card" data-sg="print">
        <div class="panel-subhead set-card-t">
          <h3>單據尺寸</h3>
          <span>{{ docSize.w }} x {{ docSize.h }} mm</span>
        </div>
        <div class="form-grid acc-fields">
          <label class="fld-l">寬度 mm<input id="docW" type="number" :value="docSize.w" min="40" max="210" @input="printSettings.setDocSize({ ...docSize, w: $event.target.value })" /></label>
          <label class="fld-l">高度 mm<input id="docH" type="number" :value="docSize.h" min="40" max="297" @input="printSettings.setDocSize({ ...docSize, h: $event.target.value })" /></label>
        </div>
        <p class="set-note">本機與 NAS 列印都會跟隨這個尺寸；設定會同步寫入 legacy key：jm_docSize。</p>
      </article>

      <article class="settings-card set-card" data-sg="print">
        <div class="panel-subhead set-card-t">
          <h3>單據樣式</h3>
          <span>出貨單與備料單版型</span>
        </div>
        <p class="set-note">選擇列印出貨單、備料單的版型樣式；會同步寫入 legacy key：jm_shipStyle / jm_prepStyle。</p>
        <div class="settings-link-list">
          <button type="button" class="set-link" @click="goPrintStyle('ship')">
            <span>
              出貨單樣式
              <small>目前：{{ shipStyles[selectedShipStyle]?.name || selectedShipStyle }}</small>
            </span>
            <span class="arr">›</span>
          </button>
          <button type="button" class="set-link" @click="goPrintStyle('prep')">
            <span>
              備料單樣式
              <small>目前：{{ prepStyles[selectedPrepStyle]?.name || selectedPrepStyle }}</small>
            </span>
            <span class="arr">›</span>
          </button>
        </div>
      </article>

      <article v-show="mode === 'nas'" id="nasCard" class="settings-card set-card" data-sg="print" :class="{ dim: mode !== 'nas' }">
        <div class="panel-subhead set-card-t">
          <h3>NAS 印表機連線</h3>
          <span>{{ buildNasBaseUrl(nasConfig) }}</span>
        </div>
        <div class="form-grid acc-fields">
          <label class="fld-l">協定
            <select id="nasProto" :value="nasConfig.proto" @change="printSettings.updateNasConfig({ proto: $event.target.value })">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
            </select>
          </label>
          <label class="fld-l">NAS 主機<input id="nasHost" :value="nasConfig.host" @input="printSettings.updateNasConfig({ host: $event.target.value })" /></label>
          <label class="fld-l">Port<input id="nasPort" :value="nasConfig.port" @input="printSettings.updateNasConfig({ port: $event.target.value })" /></label>
          <label class="fld-l">Path<input id="nasPath" :value="nasConfig.path" @input="printSettings.updateNasConfig({ path: $event.target.value })" /></label>
          <label class="fld-l">Queue<input id="nasQueue" :value="nasConfig.queue" @input="printSettings.updateNasConfig({ queue: $event.target.value })" /></label>
          <label class="fld-l">寬度<input id="nasWidth" :value="`跟隨單據尺寸（${docSize.w}mm）`" readonly /></label>
        </div>

        <div class="action-row form-actions">
          <button type="button" class="ghost-btn" @click="pingNas">測試 NAS 連線</button>
          <code id="connStatus" class="conn-status">{{ buildNasBaseUrl(nasConfig) }}</code>
        </div>
        <p v-if="status" class="status-line">{{ status }}</p>
        <p class="set-note">送印時會把單據轉成 PNG 圖片再送到 NAS /print，前端不會直接存取 USB 印表機。</p>
      </article>

      <p v-if="mode !== 'nas'" class="set-note">目前使用本機列印；切換成 NAS 感熱印表機後才會顯示連線設定。</p>
    </section>

    <section v-else-if="tab === 'display'" class="settings-section">
      <div class="panel-subhead set-card-t">
        <h3>顯示設定</h3>
        <span>{{ themeStore.theme === 'dark' ? '深色' : '淺色' }}</span>
      </div>
      <div class="seg-row">
        <button id="thLight" type="button" class="seg-btn" :class="{ on: themeStore.theme === 'light' }" @click="themeStore.setTheme('light')">淺色</button>
        <button id="thDark" type="button" class="seg-btn" :class="{ on: themeStore.theme === 'dark' }" @click="themeStore.setTheme('dark')">深色</button>
      </div>
      <article class="settings-card set-card" data-sg="display">
        <div class="panel-subhead set-card-t">
          <h3>訂單列表</h3>
          <span>目前每頁 {{ display.ordersPerPage || 20 }} 筆</span>
        </div>
        <p class="set-note">控制訂單明細頁一次顯示的訂單數量；篩選與批次操作仍會套用完整篩選結果。</p>
        <div class="seg-row">
          <button
            v-for="option in orderPageSizeOptions"
            :key="option"
            type="button"
            class="seg-btn"
            :data-pp="option"
            :class="{ on: Number(display.ordersPerPage || 20) === option }"
            @click="uiSettings.setOrdersPerPage(option)"
          >
            {{ option }} 筆
          </button>
        </div>
      </article>
      <div class="panel-subhead set-card-t">
        <h3>字級設定</h3>
        <button type="button" class="ghost-btn" @click="uiSettings.resetFontSizes">還原預設字級</button>
      </div>
      <div class="font-size-grid">
        <section v-for="[group, items] in fontSizeGroups" :key="group" class="font-size-group">
          <h4>{{ group }}</h4>
          <label v-for="[varName, label, min, max] in items" :key="varName" class="font-size-control">
            <span>{{ label }}<b>{{ fontSizeValue(varName) }}px</b></span>
            <input
              type="range"
              :min="min"
              :max="max"
              :value="fontSizeValue(varName)"
              @input="uiSettings.setFontSize(varName, $event.target.value)"
            />
          </label>
        </section>
      </div>
      <p class="set-note">主題與字級狀態會套用到目前介面；列印模板維持固定紙張版型，不受介面字級影響。</p>
    </section>

    <section v-else class="settings-section">
      <div class="panel-subhead set-card-t">
        <h3>資料管理</h3>
        <span>匯出、匯入、清除</span>
      </div>
      <div class="dashboard-actions">
        <button type="button" @click="exportData">產生匯出 JSON</button>
        <button type="button" @click="downloadData">下載資料</button>
        <button type="button" @click="importData">匯入目前文字</button>
        <button type="button" class="danger-btn" @click="clearAllData">清除目前資料</button>
      </div>
      <label class="text-block">
        資料 JSON
        <textarea v-model="dataText" placeholder="按下匯出可產生 JSON；也可貼上 JSON 後匯入。"></textarea>
      </label>
      <p class="set-note">匯入會覆蓋目前狀態，包含訂單、商品、聯絡、團購、地圖與顯示設定；列印相關設定會同步寫回 legacy localStorage key。</p>
    </section>

    <p v-if="status && tab !== 'print'" class="status-line">{{ status }}</p>
  </section>
</template>
