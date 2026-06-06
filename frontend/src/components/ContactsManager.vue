<script setup>
import { reactive, ref } from 'vue'
import { useContactsStore } from '../stores/contacts.js'

const contacts = useContactsStore()
const editingId = ref('')
const draft = reactive({
  type: 'company',
  company: '',
  name: '',
  phone: '',
  address: '',
  fav: ''
})

function resetDraft() {
  editingId.value = ''
  Object.assign(draft, { type: 'company', company: '', name: '', phone: '', address: '', fav: '' })
}

function saveContact() {
  if (!draft.name.trim() && !draft.company.trim()) return
  if (editingId.value) {
    contacts.updateContact(editingId.value, { ...draft })
  } else {
    contacts.addContact(draft)
  }
  resetDraft()
}

function editContact(contact) {
  editingId.value = contact.id
  Object.assign(draft, {
    type: contact.type || 'company',
    company: contact.company || '',
    name: contact.name || '',
    phone: contact.phone || '',
    address: contact.address || '',
    fav: contact.fav || ''
  })
}

function contactTitle(contact) {
  return contact.type === 'person' ? contact.name : contact.company
}

function telHref(phone) {
  return `tel:${String(phone || '').replaceAll('-', '')}`
}

function deleteContact(contact) {
  const ok = window.confirm(`確定刪除「${contactTitle(contact)}」？`)
  if (!ok) return
  contacts.deleteContact(contact.id)
  if (editingId.value === contact.id) resetDraft()
}
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>聯絡人</h2>
        <span>{{ contacts.filteredContacts.length }} 位</span>
      </div>
      <input class="search-input" :value="contacts.keyword" placeholder="搜尋公司、姓名、電話、地址" @input="contacts.setKeyword($event.target.value)" />
    </div>

    <div class="seg-row">
      <button type="button" :class="{ on: contacts.filter === 'all' }" @click="contacts.setFilter('all')">全部</button>
      <button type="button" :class="{ on: contacts.filter === 'company' }" @click="contacts.setFilter('company')">公司</button>
      <button type="button" :class="{ on: contacts.filter === 'person' }" @click="contacts.setFilter('person')">個人</button>
    </div>

    <div class="product-editor">
      <select v-model="draft.type">
        <option value="company">公司</option>
        <option value="person">個人</option>
      </select>
      <input v-model="draft.company" placeholder="公司名稱" />
      <input v-model="draft.name" placeholder="聯絡人 / 姓名" />
      <input v-model="draft.phone" placeholder="電話" />
      <input v-model="draft.address" placeholder="地址" />
      <input v-model="draft.fav" placeholder="常訂品項" />
      <button type="button" class="primary-btn" @click="saveContact">{{ editingId ? '儲存聯絡人' : '新增聯絡人' }}</button>
      <button v-if="editingId" type="button" class="ghost-btn" @click="resetDraft">取消編輯</button>
    </div>

    <div class="contact-grid">
      <article v-for="contact in contacts.filteredContacts" :key="contact.id" class="contact-card">
        <div class="contact-avatar">{{ (contactTitle(contact) || '?').slice(0, 1) }}</div>
        <div class="contact-main">
          <strong>{{ contactTitle(contact) }}</strong>
          <span class="pill">{{ contact.type === 'person' ? '個人' : '公司' }}</span>
          <small>{{ contact.type === 'person' ? contact.phone || '無電話' : `${contact.name || '未填聯絡人'} · ${contact.phone || '無電話'}` }}</small>
          <small>{{ contact.address || '未填地址' }}</small>
          <em v-if="contact.fav">常訂：{{ contact.fav }}</em>
        </div>
        <div class="contact-actions">
          <a v-if="contact.phone" class="ghost-btn" :href="telHref(contact.phone)" aria-label="撥號">撥號</a>
          <button type="button" class="ghost-btn" @click="editContact(contact)">編輯</button>
          <button type="button" class="danger-btn" @click="deleteContact(contact)">刪除</button>
        </div>
      </article>
      <p v-if="!contacts.filteredContacts.length" class="set-note">找不到符合的聯絡人。</p>
    </div>
  </section>
</template>
