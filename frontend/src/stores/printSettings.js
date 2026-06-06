import { defineStore } from 'pinia'

const defaultDocSize = { w: 70, h: 100 }
const defaultNasConfig = {
  proto: 'http',
  host: '192.168.1.100',
  port: '8000',
  path: '/print',
  queue: 'thermal-70x100'
}
const legacyShipStyleAliases = {
  boutique: 'lux1',
  dense: 'd1'
}
const validShipStyles = new Set([
  'clean',
  'd1',
  'd2',
  'd3',
  'd4',
  'd5',
  'd6',
  'hl1',
  'hl2',
  'hl3',
  'hl4',
  'hl5',
  'hl6',
  'lux1',
  'lux2',
  'lux3',
  'lux4',
  'lux5',
  'lux6',
  'lux7',
  'lux8',
  's1',
  's2',
  's3',
  's4',
  's5',
  's6',
  's7'
])

function normalizeShipStyle(key) {
  const nextKey = legacyShipStyleAliases[key] || key || 'clean'
  return validShipStyles.has(nextKey) ? nextKey : 'clean'
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch (_) {
    return fallback
  }
}

function readString(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback
  } catch (_) {
    return fallback
  }
}

export const usePrintSettingsStore = defineStore('printSettings', {
  state: () => ({
    mode: readString('jm_printMode', 'local') === 'nas' ? 'nas' : 'local',
    docSize: readJson('jm_docSize', defaultDocSize),
    selectedShipStyle: normalizeShipStyle(readString('jm_shipStyle', 'clean')),
    selectedPrepStyle: readString('jm_prepStyle', 'p1'),
    nasConfig: { ...defaultNasConfig, ...readJson('jm_nasConfig', defaultNasConfig) }
  }),
  getters: {
    widthMm: (state) => Number(state.docSize.w) || 70,
    heightMm: (state) => Number(state.docSize.h) || 100
  },
  actions: {
    persistLegacyKeys() {
      this.selectedShipStyle = normalizeShipStyle(this.selectedShipStyle)
      localStorage.setItem('jm_docSize', JSON.stringify(this.docSize))
      localStorage.setItem('jm_shipStyle', this.selectedShipStyle)
      localStorage.setItem('jm_prepStyle', this.selectedPrepStyle)
    },
    persistSettings() {
      this.persistLegacyKeys()
      localStorage.setItem('jm_printMode', this.mode)
      localStorage.setItem('jm_nasConfig', JSON.stringify(this.nasConfig))
    },
    resetSettings() {
      this.mode = 'local'
      this.docSize = { ...defaultDocSize }
      this.selectedShipStyle = 'clean'
      this.selectedPrepStyle = 'p1'
      this.nasConfig = { ...defaultNasConfig }
      this.persistSettings()
    },
    setMode(mode) {
      this.mode = mode === 'nas' ? 'nas' : 'local'
      localStorage.setItem('jm_printMode', this.mode)
    },
    setDocSize(size) {
      const w = Math.max(40, Math.min(210, Number(size.w) || 70))
      const h = Math.max(40, Math.min(297, Number(size.h) || 100))
      const nextSize = { w, h }
      this.docSize = nextSize
      localStorage.setItem('jm_docSize', JSON.stringify(nextSize))
    },
    setShipStyle(key) {
      const nextKey = normalizeShipStyle(key)
      this.selectedShipStyle = nextKey
      localStorage.setItem('jm_shipStyle', nextKey)
    },
    setPrepStyle(key) {
      this.selectedPrepStyle = key
      localStorage.setItem('jm_prepStyle', key)
    },
    updateNasConfig(patch) {
      this.nasConfig = { ...this.nasConfig, ...patch }
      localStorage.setItem('jm_nasConfig', JSON.stringify(this.nasConfig))
    }
  }
})
