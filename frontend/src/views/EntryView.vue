<script setup>
import { useRouter } from 'vue-router'
import { useThemeStore } from '../stores/theme.js'

const router = useRouter()
const themeStore = useThemeStore()

const entries = [
  {
    num: 'I',
    icon: 'store',
    title: '店家後台',
    desc: '審核訂單、出貨排程、聯絡人與商品管理',
    path: '/admin',
    to: '/admin/dashboard'
  },
  {
    num: 'II',
    icon: 'group',
    title: '團購人',
    desc: '開團、收單、與店家對接，擁有專屬永久網址',
    path: '/organizer',
    to: '/organizer'
  },
  {
    num: 'III',
    icon: 'bowl',
    title: '訂購人',
    desc: '進入團購人分享的網址即可直接下單',
    path: '/order/...001',
    to: '/orderer'
  }
]
</script>

<template>
  <main class="entry-page">
    <button class="theme-mini" type="button" @click="themeStore.toggleTheme">切換明暗</button>
    <section class="entry-hero">
      <div class="entry-logo" aria-label="健美滷味">
        <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
          <defs>
            <linearGradient id="entry-braise" x1="0" y1="0" x2="0.3" y2="1">
              <stop offset="0" stop-color="#c4a594" />
              <stop offset="0.5" stop-color="#a8897c" />
              <stop offset="1" stop-color="#7e6256" />
            </linearGradient>
            <linearGradient id="entry-bill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#c2a896" />
              <stop offset="1" stop-color="#9c8270" />
            </linearGradient>
            <radialGradient id="entry-gloss" cx="0.38" cy="0.3" r="0.5">
              <stop offset="0" stop-color="#fff" stop-opacity="0.5" />
              <stop offset="1" stop-color="#fff" stop-opacity="0" />
            </radialGradient>
          </defs>
          <path d="M68 30 q14 -4 18 6 q-8 -1 -14 4 Z" fill="#7e6256" />
          <path d="M58 24 q22 2 24 24 q1 16 -14 22 q-16 6 -28 -4 q-10 -9 -7 -23 q3 -16 25 -19 Z" fill="url(#entry-braise)" />
          <path d="M58 24 q22 2 24 24 q1 16 -14 22 q-16 6 -28 -4 q-10 -9 -7 -23 q3 -16 25 -19 Z" fill="url(#entry-gloss)" />
          <path d="M50 12 q-3 -7 2 -10 q1 5 -2 10" fill="none" stroke="#7e6256" stroke-width="3" stroke-linecap="round" />
          <path d="M28 50 q-16 0 -19 6 q-1 4 4 6 q12 4 18 -3 q3 -5 -3 -9 Z" fill="url(#entry-bill)" />
          <path d="M9 56 q9 4 17 1" fill="none" stroke="#8a7060" stroke-width="1.6" stroke-linecap="round" />
          <circle cx="48" cy="44" r="6" fill="#fff" />
          <circle cx="47" cy="45" r="3.4" fill="#3a2e28" />
          <circle cx="48.4" cy="43.4" r="1.1" fill="#fff" />
          <ellipse cx="64" cy="58" rx="9" ry="6" fill="#7e6256" opacity="0.25" />
        </svg>
      </div>
      <p class="eyebrow">JIANMEI · BRAISED CUISINE</p>
      <h1>健美滷味 · 團購系統</h1>
      <p class="entry-lede">慢火細燉、用心入味。<br />請依下方對應角色，選擇進入入口。</p>
      <div class="entry-divider"><span></span><i></i><span></span></div>
    </section>

    <section class="entry-grid">
      <button v-for="entry in entries" :key="entry.to" class="entry-card" type="button" @click="router.push(entry.to)">
        <span class="entry-num">{{ entry.num }}</span>
        <span class="entry-ico" aria-hidden="true">
          <svg v-if="entry.icon === 'store'" viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18M9 13h6" /></svg>
          <svg v-else-if="entry.icon === 'group'" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-5-5.9" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M4 13h16a8 8 0 0 1-16 0zM6 13a6 6 0 0 1 12 0M12 4v3" /></svg>
        </span>
        <span class="entry-title">{{ entry.title }}</span>
        <small>{{ entry.desc }}</small>
        <span class="entry-foot"><span>{{ entry.path }}</span><b>→</b></span>
      </button>
    </section>
    <p class="entry-copy">&copy; Jianmei Lu Wei · 健美滷味</p>
  </main>
</template>
