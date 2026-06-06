<script setup>
import { computed } from 'vue'
import { buildPrepPages, buildShipPages } from '../print/legacyTemplates.js'

const SAMPLE_ORDERS = [
  {
    id: 'JM-0001',
    company: '健美滷味',
    address: '台北市大安區示範路 1 號',
    date: '2026-06-05',
    time: '11:30',
    status: 'accepted',
    members: [
      {
        id: 'm1',
        name: '王小美',
        department: '設計部',
        phone: '0912-345-678',
        note: '冷凍先分裝',
        items: [
          ['招牌滷牛腱', 1, 180],
          ['麻辣鴨血', 2, 90],
          ['甜不辣', 1, 65],
          ['真空豆干(6入)', 1, 120],
          ['百頁豆腐', 2, 45],
          ['滷蛋', 3, 25]
        ]
      }
    ]
  }
]

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  kind: { type: String, required: true },
  styles: { type: Object, required: true },
  selected: { type: String, required: true },
  docSize: { type: Object, default: () => ({ w: 70, h: 100 }) },
  previewLabel: { type: String, default: '預覽實際大小' },
  printLabel: { type: String, default: '列印測試' }
})

const emit = defineEmits(['select', 'preview', 'print'])

const styleItems = computed(() => Object.values(props.styles))
const sampleStats = computed(() => {
  const itemCount = SAMPLE_ORDERS[0].members[0].items.length
  return Object.fromEntries(
    styleItems.value.map((item) => {
      const pages = previewPages(item.key)
      return [item.key, {
        itemCount,
        pageCount: pages.length || 1
      }]
    })
  )
})

function previewPages(styleKey) {
  return props.kind === 'prep'
    ? buildPrepPages({ orders: SAMPLE_ORDERS, style: styleKey, docSize: props.docSize })
    : buildShipPages({ orders: SAMPLE_ORDERS, style: styleKey, docSize: props.docSize })
}

const thumbnails = computed(() => Object.fromEntries(
  styleItems.value.map((item) => {
    const pages = previewPages(item.key)
    return [item.key, pages[0] || '']
  })
))

function selectStyle(key) {
  emit('select', key)
}

function previewStyle(key) {
  emit('preview', key)
}
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <h2>{{ title }}</h2>
      <span>{{ styles[selected]?.name }}</span>
    </div>
    <p v-if="description" class="print-desc">{{ description }}</p>
    <div
      :id="kind === 'ship' ? 'shipGrid' : kind === 'prep' ? 'prepGrid' : undefined"
      class="style-grid print-grid"
    >
      <article
        v-for="item in styleItems"
        :key="item.key"
        class="style-option print-opt"
        :class="{ selected: item.key === selected, sel: item.key === selected }"
        :data-key="item.key"
      >
        <span v-if="item.key === selected" class="style-check pcheck" aria-hidden="true">✓</span>
        <button
          type="button"
          class="style-select-area print-opt-main"
          :data-style-key="item.key"
          :aria-label="`選用${item.name}`"
          @click="selectStyle(item.key)"
        >
          <span class="style-thumb pthumb" :class="{ 'pthumb-a5': kind === 'prep' }" aria-hidden="true">
            <span class="style-thumb-inner pscaler" v-html="thumbnails[item.key]"></span>
          </span>
          <span class="style-name pname">{{ item.name }}</span>
          <small class="ptag">{{ item.tag }}</small>
          <span class="style-meta">
            示範 {{ sampleStats[item.key]?.pageCount || 1 }} 頁 · {{ sampleStats[item.key]?.itemCount || 0 }} 項
          </span>
        </button>
        <span class="style-actions">
          <button type="button" class="style-zoom sp-zoom" :data-style-key="item.key" @click="previewStyle(item.key)">放大預覽</button>
        </span>
      </article>
    </div>
    <div class="print-bar">
      <span class="print-cur">目前使用：<b :id="kind === 'ship' ? 'curShipName' : kind === 'prep' ? 'curPrepName' : undefined">{{ styles[selected]?.name }}</b></span>
      <button type="button" class="ghost-btn" @click="emit('preview', selected)">{{ previewLabel }}</button>
      <button type="button" class="primary-btn nav-btn" @click="emit('print')">{{ printLabel }}</button>
    </div>
  </section>
</template>
