import { defineStore } from 'pinia'
import { contacts } from '../data/demoOrders.js'

export const useContactsStore = defineStore('contacts', {
  state: () => ({
    contacts: structuredClone(contacts),
    filter: 'all',
    keyword: ''
  }),
  getters: {
    filteredContacts: (state) => state.contacts.filter((contact) => {
      const typeOk = state.filter === 'all' || contact.type === state.filter
      const haystack = `${contact.company} ${contact.name} ${contact.phone} ${contact.address} ${contact.fav || ''}`.toLowerCase()
      return typeOk && haystack.includes(state.keyword.trim().toLowerCase())
    })
  },
  actions: {
    resetContacts() {
      this.contacts = structuredClone(contacts)
      this.filter = 'all'
      this.keyword = ''
    },
    setFilter(filter) {
      this.filter = filter
    },
    setKeyword(keyword) {
      this.keyword = keyword
    },
    addContact(payload) {
      this.contacts.unshift({
        id: `C${Date.now().toString().slice(-6)}`,
        type: payload.type || 'company',
        company: payload.company || '',
        name: payload.name || '',
        phone: payload.phone || '',
        address: payload.address || '',
        fav: payload.fav || ''
      })
    },
    updateContact(id, patch) {
      const contact = this.contacts.find((item) => item.id === id)
      if (contact) Object.assign(contact, patch)
    },
    deleteContact(id) {
      this.contacts = this.contacts.filter((contact) => contact.id !== id)
    }
  }
})
