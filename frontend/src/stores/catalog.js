import { defineStore } from 'pinia'
import { products, productTypes } from '../data/catalog.js'

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    products: structuredClone(products),
    productTypes
  }),
  getters: {
    allProducts: (state) => Object.values(state.products).flat(),
    orderMenuGroups: (state) => {
      const normal = (state.products.normal || []).filter((item) => !item.parts?.length)
      const vacuum = (state.products.vacuum || []).filter((item) => !item.parts?.length)
      const combo = Object.values(state.products).flat().filter((item) => item.parts?.length)
      return [
        { key: 'normal', label: '一般滷味', shortLabel: '一般', items: normal },
        { key: 'vacuum', label: '真空包裝', shortLabel: '真空', items: vacuum },
        { key: 'combo', label: '組合優惠', shortLabel: '組合', items: combo }
      ].filter((group) => group.items.length)
    },
    lowStockItems: (state) => Object.values(state.products)
      .flat()
      .filter((item) => Number.isFinite(item.stock) && item.stock <= item.low),
    findProduct: (state) => (id) => Object.values(state.products)
      .flat()
      .find((item) => item.id === id)
  },
  actions: {
    resetCatalog() {
      this.products = structuredClone(products)
      this.productTypes = productTypes
    },
    addProduct(type, payload) {
      const list = this.products[type] || this.products.normal
      const id = payload.id || `${type[0]}${Date.now().toString().slice(-6)}`
      const item = {
        id,
        name: payload.name || '未命名商品',
        desc: payload.desc || '',
        price: Number(payload.price) || 0,
        stock: Number(payload.stock) || 0,
        cost: Number(payload.cost) || 0,
        low: Number(payload.low) || 0
      }
      if (Array.isArray(payload.parts) && payload.parts.length) {
        item.parts = payload.parts
        delete item.stock
        delete item.cost
        delete item.low
      }
      list.push(item)
      return id
    },
    updateProduct(id, patch) {
      const item = this.findProduct(id)
      if (!item) return
      item.name = patch.name === undefined ? item.name : patch.name || '未命名商品'
      item.desc = patch.desc === undefined ? item.desc || '' : patch.desc || ''
      item.price = patch.price === undefined ? item.price : Number(patch.price) || 0
      if (Array.isArray(patch.parts) && patch.parts.length) {
        item.parts = patch.parts
        delete item.stock
        delete item.cost
        delete item.low
      } else {
        delete item.parts
        item.stock = patch.stock === undefined ? Number(item.stock) || 0 : Number(patch.stock) || 0
        item.cost = patch.cost === undefined ? Number(item.cost) || 0 : Number(patch.cost) || 0
        item.low = patch.low === undefined ? Number(item.low) || 0 : Number(patch.low) || 0
      }
    },
    deleteProduct(id) {
      Object.keys(this.products).forEach((type) => {
        this.products[type] = this.products[type].filter((item) => item.id !== id)
      })
    },
    adjustStock(id, delta) {
      const item = this.findProduct(id)
      if (!item || !Number.isFinite(item.stock)) return
      item.stock = Math.max(0, item.stock + delta)
    },
    applyStockOperation(id, { mode, qty, cost }) {
      const item = this.findProduct(id)
      if (!item || item.parts || !Number.isFinite(item.stock)) return null
      const amount = Math.max(0, Number(qty) || 0)
      const before = Number(item.stock) || 0
      if (mode === 'in') {
        item.stock = before + amount
        if (cost !== '' && cost !== null && cost !== undefined) item.cost = Math.max(0, Number(cost) || 0)
      } else if (mode === 'out') {
        item.stock = Math.max(0, before - amount)
      } else if (mode === 'set') {
        item.stock = amount
        if (cost !== '' && cost !== null && cost !== undefined) item.cost = Math.max(0, Number(cost) || 0)
      }
      return { id, name: item.name, before, after: item.stock, mode, qty: amount, cost: item.cost }
    },
    deductItems(items) {
      const byName = new Map(this.allProducts.map((item) => [item.name, item]))
      const needs = new Map()

      const addNeed = (name, qty) => {
        const product = byName.get(name)
        const amount = Math.max(0, Number(qty) || 0)
        if (!amount) return
        if (product?.parts?.length) {
          product.parts.forEach(([partName, partQty]) => addNeed(partName, amount * (Number(partQty) || 1)))
          return
        }
        needs.set(name, (needs.get(name) || 0) + amount)
      }

      items.forEach(([name, qty]) => addNeed(name, qty))

      const changes = []
      needs.forEach((qty, name) => {
        const product = byName.get(name)
        if (!product || product.parts || !Number.isFinite(product.stock)) {
          changes.push({ name, qty, missing: true, before: 0, after: 0, shortage: qty })
          return
        }
        const before = Number(product.stock) || 0
        product.stock = Math.max(0, before - qty)
        changes.push({
          id: product.id,
          name,
          qty,
          before,
          after: product.stock,
          shortage: Math.max(0, qty - before)
        })
      })
      return changes
    }
  }
})
