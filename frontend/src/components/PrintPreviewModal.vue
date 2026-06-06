<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { wrapPages } from '../print/legacyTemplates.js'

const props = defineProps({
  title: { type: String, required: true },
  pages: { type: Array, default: () => [] },
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'local' },
  docSize: { type: Object, default: () => ({ w: 70, h: 100 }) }
})

const emit = defineEmits(['close', 'print'])
const bodyRef = ref(null)
const html = computed(() => wrapPages(props.pages).replace(/<div class="print-page"/g, '<div class="print-page ppv-page"'))
const metaText = computed(() => {
  const pageText = `${props.pages.length || 0} 頁`
  const sizeText = `${props.docSize.w} x ${props.docSize.h} mm`
  const modeText = props.mode === 'nas' ? 'NAS 列印' : '本機列印'
  return `${pageText} · ${sizeText} · ${modeText}`
})

function fitPreviewPages() {
  const root = bodyRef.value
  if (!root) return
  root.querySelectorAll('.print-page > *').forEach((el) => {
    const page = el.parentElement
    if (!page) return

    el.style.transformOrigin = 'top left'
    el.style.transform = 'none'
    page.style.width = ''
    page.style.height = ''

    const wantW = el.offsetWidth
    const wantH = el.offsetHeight
    const realW = el.scrollWidth
    const realH = el.scrollHeight
    let ratio = 1

    if (realW > wantW + 1) ratio = Math.min(ratio, wantW / realW)
    if (realH > wantH + 1) ratio = Math.min(ratio, wantH / realH)

    if (ratio < 1) {
      el.style.transform = `scale(${ratio})`
      page.style.width = `${wantW * ratio}px`
      page.style.height = `${wantH * ratio}px`
    }
  })
}

watch(
  () => [props.open, props.pages],
  async () => {
    if (!props.open) return
    await nextTick()
    requestAnimationFrame(() => requestAnimationFrame(fitPreviewPages))
    setTimeout(fitPreviewPages, 60)
    setTimeout(fitPreviewPages, 200)
  },
  { deep: true }
)
</script>

<template>
  <div v-if="open" id="printPreview" class="modal-backdrop style-modal print-preview-modal" @click.self="emit('close')">
    <section class="preview-modal ppv-box">
      <header class="ppv-head">
        <div class="preview-title">
          <h2 id="ppvTitle">{{ title }}</h2>
          <small>{{ metaText }}</small>
        </div>
        <button type="button" @click="emit('close')">×</button>
      </header>
      <div ref="bodyRef" id="ppvBody" class="preview-body ppv-body" v-html="html"></div>
      <footer class="ppv-foot">
        <span class="preview-note">預覽會自動縮放溢出的單據；實際送印仍使用原始版型。</span>
        <button type="button" class="ghost-btn date-cancel" @click="emit('close')">取消</button>
        <button type="button" class="primary-btn date-apply" @click="emit('print')">列印</button>
      </footer>
    </section>
  </div>
</template>
