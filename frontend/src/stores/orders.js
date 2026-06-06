import { defineStore } from 'pinia'
import { demoOrders } from '../data/demoOrders.js'

function memberTotal(member) {
  return member.items.reduce((sum, [, qty, price]) => sum + qty * price, 0)
}

function orderTotal(order) {
  return order.members.reduce((sum, member) => sum + memberTotal(member), 0)
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value))
}

export const useOrdersStore = defineStore('orders', {
  state: () => ({
    orders: structuredClone(demoOrders),
    deletedOrders: []
  }),
  getters: {
    acceptedOrders: (state) => state.orders.filter((order) => order.status === 'accepted'),
    pendingOrders: (state) => state.orders.filter((order) => order.status === 'pending'),
    shippedOrders: (state) => state.orders.filter((order) => order.status === 'shipped'),
    rejectedOrders: (state) => state.orders.filter((order) => order.status === 'rejected'),
    totalRevenue: (state) => state.orders
      .filter((order) => order.status === 'accepted' || order.status === 'shipped')
      .reduce((sum, order) => sum + orderTotal(order), 0),
    totalMembers: (state) => state.orders.reduce((sum, order) => sum + order.members.length, 0),
    memberTotal: () => memberTotal,
    orderTotal: () => orderTotal,
    statusLabel: () => (status) => ({
      pending: '待審核',
      accepted: '已接單',
      shipped: '已出貨',
      rejected: '已拒絕'
    })[status] || status,
    findOrder: (state) => (orderId) => state.orders.find((order) => order.id === orderId)
  },
  actions: {
    resetOrders() {
      this.orders = structuredClone(demoOrders)
      this.deletedOrders = []
    },
    addOrder(payload) {
      const today = new Date()
      const id = payload.id || `O${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(this.orders.length + 1).padStart(3, '0')}`
      this.orders.unshift({
        id,
        company: payload.company || '未命名公司',
        address: payload.address || '',
        date: payload.date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
        time: payload.time || `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`,
        status: payload.status || 'pending',
        teamId: payload.teamId || '',
        organizer: payload.organizer || '',
        organizerTel: payload.organizerTel || '',
        members: payload.members || []
      })
      return id
    },
    addPersonalOrder({ name, phone, items, note = '', company = '線上個人訂單', address = '店取', teamId = '' }) {
      const today = new Date()
      const id = `O${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(this.orders.length + 1).padStart(3, '0')}`
      this.orders.unshift({
        id,
        company,
        address,
        date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
        time: `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`,
        status: 'pending',
        teamId,
        members: [{ id: `${id}-M1`, name, department: '', phone, note, items }]
      })
      return id
    },
    setStatus(orderId, status) {
      const order = this.orders.find((item) => item.id === orderId)
      if (order) order.status = status
    },
    updateOrder(orderId, patch) {
      const order = this.findOrder(orderId)
      if (order) Object.assign(order, patch)
    },
    softDeleteOrder(orderId, reason = '') {
      const index = this.orders.findIndex((order) => order.id === orderId)
      if (index < 0) return null
      const [order] = this.orders.splice(index, 1)
      const deleted = {
        ...clonePlain(order),
        deletedAt: new Date().toISOString(),
        deleteReason: reason
      }
      this.deletedOrders = [
        deleted,
        ...this.deletedOrders.filter((item) => item.id !== orderId)
      ].slice(0, 50)
      return deleted
    },
    restoreOrder(orderId) {
      const index = this.deletedOrders.findIndex((order) => order.id === orderId)
      if (index < 0) return null
      const [deleted] = this.deletedOrders.splice(index, 1)
      const restored = clonePlain(deleted)
      delete restored.deletedAt
      delete restored.deleteReason
      if (!this.orders.some((order) => order.id === orderId)) {
        this.orders.unshift(restored)
      }
      return restored
    },
    deleteOrder(orderId) {
      this.orders = this.orders.filter((order) => order.id !== orderId)
    },
    addMember(orderId, member) {
      const order = this.findOrder(orderId)
      if (!order) return
      order.members.push({
        id: `${orderId}-M${order.members.length + 1}`,
        name: member.name || '未命名',
        department: member.department || '',
        phone: member.phone || '',
        note: member.note || '',
        items: member.items || []
      })
    }
  }
})
