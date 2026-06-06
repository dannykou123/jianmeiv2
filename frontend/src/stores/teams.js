import { defineStore } from 'pinia'
import { demoTeams } from '../data/demoOrders.js'

const legacyDefaultPay = {
  lineId: 'jianmei_tw',
  cash: true,
  bank: '國泰世華 (013) 1234-5678-9012'
}

function todayYmd() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function teamDeadlineText(team) {
  if (!team) return ''
  const date = team.dueDate || todayYmd()
  return team.deadline ? `${date} ${team.deadline}` : date
}

function normalizeTeam(team) {
  return {
    id: team.id,
    name: team.name || '未命名團購',
    company: team.company || '',
    open: team.open !== false,
    paused: Boolean(team.paused),
    dueDate: team.dueDate || todayYmd(),
    deadline: team.deadline || '',
    organizer: team.organizer || '',
    submitStatus: team.submitStatus || null,
    deliverAt: team.deliverAt || '',
    submittedAt: team.submittedAt || '',
    submittedPeople: Number(team.submittedPeople || 0),
    submittedTotal: Number(team.submittedTotal || 0),
    hostNote: team.hostNote || '滿 $1500 免運，費用可現金或轉帳給團購主。',
    pay: {
      lineId: team.pay ? team.pay.lineId || '' : legacyDefaultPay.lineId,
      cash: team.pay?.cash !== false,
      bank: team.pay ? team.pay.bank || '' : legacyDefaultPay.bank
    },
    createdAt: team.createdAt || new Date().toISOString()
  }
}

export const useTeamsStore = defineStore('teams', {
  state: () => ({
    teams: structuredClone(demoTeams).map(normalizeTeam)
  }),
  getters: {
    activeTeams: (state) => state.teams.filter((team) => team.open && !team.paused),
    findTeam: (state) => (teamId) => state.teams.find((team) => team.id === teamId),
    submitStatusLabel: () => (status) => ({
      pending: '待審核',
      accepted: '已接單',
      rejected: '已拒單'
    })[status] || '尚未送單'
  },
  actions: {
    resetTeams() {
      this.teams = structuredClone(demoTeams).map(normalizeTeam)
    },
    addTeam(payload) {
      const id = payload.id || `T${Date.now().toString().slice(-8)}`
      this.teams.unshift(normalizeTeam({ ...payload, id, open: true, paused: false }))
      return id
    },
    updateTeam(teamId, patch) {
      const team = this.findTeam(teamId)
      if (team) Object.assign(team, patch)
    },
    toggleOpen(teamId) {
      const team = this.findTeam(teamId)
      if (!team) return
      team.open = !team.open
      if (!team.open) team.paused = false
    },
    togglePaused(teamId) {
      const team = this.findTeam(teamId)
      if (team?.open) team.paused = !team.paused
    },
    submitToShop(teamId, { deliverAt, people, total }) {
      const team = this.findTeam(teamId)
      if (!team) return
      team.submitStatus = 'pending'
      team.deliverAt = deliverAt
      team.submittedAt = new Date().toISOString()
      team.submittedPeople = Number(people || 0)
      team.submittedTotal = Number(total || 0)
    },
    recallSubmission(teamId) {
      const team = this.findTeam(teamId)
      if (!team || team.submitStatus !== 'pending') return
      team.submitStatus = null
      team.deliverAt = ''
    },
    reviewSubmission(teamId, decision) {
      const team = this.findTeam(teamId)
      if (!team || team.submitStatus !== 'pending') return
      team.submitStatus = decision === 'accept' ? 'accepted' : 'rejected'
    },
    reeditSubmission(teamId) {
      const team = this.findTeam(teamId)
      if (!team || team.submitStatus !== 'rejected') return
      team.submitStatus = null
    }
  }
})
