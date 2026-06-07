import { defineStore } from 'pinia'

const defaultTeamSettings = {
  defaultDeadline: '11:30',
  maxOpenTeams: 2,
  keepOrganizerHistory: true,
  organizerHistoryLimit: 10
}

export const fontSizeDefinitions = [
  ['入口頁', [
    ['--fs-title', '主標題', 28, 90, 72],
    ['--fs-eyebrow', '副標', 10, 20, 13],
    ['--fs-lede', '說明文', 12, 22, 16],
    ['--fs-card-h', '卡片標題', 20, 40, 28],
    ['--fs-card-p', '卡片說明', 12, 20, 15],
    ['--fs-card-num', '羅馬數字', 24, 48, 34],
    ['--fs-card-path', '路徑', 12, 20, 15],
    ['--fs-copyright', '版權', 12, 20, 15]
  ]],
  ['側欄', [
    ['--fs-brand1', '品牌名', 16, 30, 21],
    ['--fs-brand2', '副標', 12, 20, 15],
    ['--fs-nav', '選單項', 13, 22, 16],
    ['--fs-role', '角色', 12, 20, 15],
    ['--fs-mail', '信箱', 11, 18, 14]
  ]],
  ['接單台', [
    ['--fs-h2', '頁面大標', 22, 42, 30],
    ['--fs-crumb', '麵包屑', 12, 20, 15],
    ['--fs-stat-v', '統計數字', 28, 56, 40],
    ['--fs-stat-s', '統計副標', 11, 18, 13],
    ['--fs-oid', '訂單編號', 12, 20, 15],
    ['--fs-price', '金額', 18, 36, 27],
    ['--fs-oname', '店名', 16, 30, 20],
    ['--fs-who', '聯絡人', 12, 20, 15],
    ['--fs-meta', '底部資訊', 11, 18, 13]
  ]],
  ['訂單明細（右側）', [
    ['--fs-detail-h', '標題', 18, 36, 25],
    ['--fs-dk', '小標', 11, 18, 13],
    ['--fs-info', '資訊', 12, 20, 14],
    ['--fs-lihd', '人名', 13, 22, 16],
    ['--fs-dept', '部門', 10, 16, 12],
    ['--fs-liamt', '小計', 13, 24, 17],
    ['--fs-total', '總額', 26, 52, 38],
    ['--fs-tk', '小標', 11, 18, 13],
    ['--fs-btn', '按鈕', 13, 22, 16]
  ]],
  ['訂單明細頁', [
    ['--fs-orow-t', '列標題', 14, 28, 18],
    ['--fs-orow-s', '副標', 12, 20, 14],
    ['--fs-orow-amt', '金額', 16, 32, 22],
    ['--fs-orow-date', '日期', 11, 18, 13],
    ['--fs-status', '狀態標籤', 10, 16, 12]
  ]],
  ['送單地圖', [
    ['--fs-route-t', '路線標題', 18, 34, 24],
    ['--fs-seg', '按鈕', 12, 20, 15]
  ]]
]

const fontSizeMeta = new Map(
  fontSizeDefinitions.flatMap(([, items]) => items.map(([varName, , min, max, defaultValue]) => [varName, { min, max, defaultValue }]))
)

const defaultFontSizes = Object.fromEntries(
  fontSizeDefinitions.flatMap(([, items]) => items.map(([varName, , , , defaultValue]) => [varName, defaultValue]))
)

const defaultDisplaySettings = {
  ordersPerPage: 20,
  fontSizes: defaultFontSizes
}

export const useUiSettingsStore = defineStore('uiSettings', {
  state: () => ({
    team: structuredClone(defaultTeamSettings),
    display: structuredClone(defaultDisplaySettings)
  }),
  actions: {
    resetUiSettings() {
      this.team = structuredClone(defaultTeamSettings)
      this.display = structuredClone(defaultDisplaySettings)
    },
    patchTeamSettings(patch) {
      this.team = { ...this.team, ...patch }
    },
    setFontSize(varName, value) {
      const meta = fontSizeMeta.get(varName)
      const next = Math.max(meta?.min ?? 8, Math.min(meta?.max ?? 96, Number(value) || meta?.defaultValue || 16))
      this.display.fontSizes = {
        ...this.display.fontSizes,
        [varName]: next
      }
    },
    setOrdersPerPage(value) {
      const allowed = [10, 20, 50, 100]
      const next = Number(value)
      this.display.ordersPerPage = allowed.includes(next) ? next : defaultDisplaySettings.ordersPerPage
    },
    resetFontSizes() {
      this.display.fontSizes = structuredClone(defaultDisplaySettings.fontSizes)
    }
  }
})
