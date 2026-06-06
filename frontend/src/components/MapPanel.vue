<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import { useOrdersStore } from '../stores/orders.js'
import { useContactsStore } from '../stores/contacts.js'
import { useMapStore } from '../stores/map.js'
import { applyRouteOrder } from '../services/routePlanning.js'

const orders = useOrdersStore()
const contacts = useContactsStore()
const mapStore = useMapStore()
const deliveryStatuses = new Set(['accepted', 'pending', 'shipped'])
const filter = ref('accepted')
const customOrigin = ref('')
const originChoice = ref('store')
const mapEl = ref(null)
const routeOrder = ref([])
const draggingId = ref('')
const dragOverId = ref('')
const status = ref('')
let map
let markers = []
let line
let stopMarkers = []

const knownOrigins = computed(() => {
  const addresses = [
    ...Object.keys(mapStore.addressLatLng),
    ...contacts.contacts.map((contact) => contact.address).filter(Boolean)
  ]
  return [...new Set(addresses)]
})

const stops = computed(() => orders.orders
  .filter((order) => deliveryStatuses.has(order.status))
  .filter((order) => filter.value === 'all' || order.status === filter.value)
  .map((order, index) => {
    const coord = mapStore.addressLatLng[order.address] || [25.04 + index * 0.006, 121.55 + index * 0.006]
    return {
      id: order.id,
      label: order.company,
      address: order.address,
      amount: orders.orderTotal(order),
      status: order.status,
      lat: coord[0],
      lng: coord[1]
    }
  }))

const orderedStops = computed(() => applyRouteOrder({
  origin: mapStore.origin,
  stops: stops.value,
  routeOrder: routeOrder.value
}))
const routeTotal = computed(() => orderedStops.value.reduce((sum, stop) => sum + stop.amount, 0))
const routeSubtitle = computed(() => {
  const mode = routeOrder.value.length ? '自訂順序' : '最近排序'
  return `起點：${mapStore.origin.label} · ${orderedStops.value.length} 個站點 · 共 $${routeTotal.value.toLocaleString()} · ${mode}`
})

function coordForAddress(address, fallback = [25.033, 121.544]) {
  return mapStore.addressLatLng[address] || fallback
}

function storeIcon() {
  return L.divIcon({
    className: 'jm-leaflet-icon',
    html: '<div class="lf-pin store"><span>店</span></div>',
    iconSize: [36, 36],
    iconAnchor: [18, 34],
    popupAnchor: [0, -30]
  })
}

function numberIcon(number, statusValue) {
  const statusClass = statusValue === 'pending' ? 'pending' : statusValue === 'shipped' ? 'shipped' : ''
  return L.divIcon({
    className: 'jm-leaflet-icon',
    html: `<div class="lf-pin ${statusClass}"><span>${number}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    popupAnchor: [0, -28]
  })
}

function resetLayers() {
  markers.forEach((marker) => marker.remove())
  markers = []
  stopMarkers = []
  if (line) line.remove()
  line = null
}

function renderMap() {
  if (!map || !mapEl.value) return
  resetLayers()
  const origin = mapStore.origin
  const points = [[origin.lat, origin.lng], ...orderedStops.value.map((stop) => [stop.lat, stop.lng])]
  markers.push(L.marker([origin.lat, origin.lng], { icon: storeIcon() }).addTo(map).bindPopup(`<b>${origin.label}</b><br>出發點`))
  orderedStops.value.forEach((stop, index) => {
    const marker = L.marker([stop.lat, stop.lng], { icon: numberIcon(index + 1, stop.status) }).addTo(map)
      .bindPopup(`<b>${index + 1}. ${stop.label}</b><br>${stop.address}<br>$${stop.amount.toLocaleString()} · ${orders.statusLabel(stop.status)}`)
    stopMarkers[index] = marker
    markers.push(marker)
  })
  if (points.length > 1) line = L.polyline(points, { color: '#c0a691', weight: 2.5, opacity: .78, dashArray: '6,8' }).addTo(map)
  if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 14 })
  setTimeout(() => map?.invalidateSize(), 100)
}

function setKnownOrigin() {
  if (originChoice.value === 'store') {
    mapStore.resetOrigin()
    customOrigin.value = ''
    routeOrder.value = []
    status.value = '起點已重設為店家'
    return
  }
  if (originChoice.value === 'custom') {
    status.value = '請輸入自訂起點地址後按「設為起點」'
    return
  }
  const coord = coordForAddress(originChoice.value)
  mapStore.setOrigin({ label: originChoice.value, address: originChoice.value, lat: coord[0], lng: coord[1] })
  customOrigin.value = ''
  routeOrder.value = []
  status.value = `已設定起點：${originChoice.value}`
}

function applyOrigin() {
  const text = customOrigin.value.trim()
  if (!text) return
  const known = Boolean(mapStore.addressLatLng[text])
  const coord = coordForAddress(text)
  mapStore.setOrigin({ label: text, address: text, lat: coord[0], lng: coord[1] })
  originChoice.value = knownOrigins.value.includes(text) ? text : 'custom'
  routeOrder.value = []
  status.value = known ? `已設定起點：${text}` : `已設定起點（概略座標）：${text}`
}

function resetOrigin() {
  originChoice.value = 'store'
  customOrigin.value = ''
  routeOrder.value = []
  mapStore.resetOrigin()
  status.value = '起點已重設為店家'
}

function openGoogleMaps() {
  if (!orderedStops.value.length) {
    status.value = '此狀態目前沒有可導航的站點'
    return
  }
  const parts = [mapStore.origin.address || `${mapStore.origin.lat},${mapStore.origin.lng}`, ...orderedStops.value.map((stop) => stop.address)]
  window.open(`https://www.google.com/maps/dir/${parts.map(encodeURIComponent).join('/')}`, '_blank')
}

function onDragStart(stopId) {
  draggingId.value = stopId
  if (!routeOrder.value.length) routeOrder.value = orderedStops.value.map((stop) => stop.id)
}

function onDragOver(targetId) {
  if (draggingId.value && draggingId.value !== targetId) dragOverId.value = targetId
}

function onDrop(targetId) {
  const sourceId = draggingId.value
  draggingId.value = ''
  dragOverId.value = ''
  if (!sourceId || sourceId === targetId) return
  const ids = orderedStops.value.map((stop) => stop.id)
  const from = ids.indexOf(sourceId)
  const to = ids.indexOf(targetId)
  if (from < 0 || to < 0) return
  ids.splice(to, 0, ids.splice(from, 1)[0])
  routeOrder.value = ids
  status.value = '已套用自訂配送順序'
}

function onDragEnd() {
  draggingId.value = ''
  dragOverId.value = ''
}

function resetRouteOrder() {
  routeOrder.value = []
  status.value = '已重設為最近站順序'
}

function focusStop(index) {
  const stop = orderedStops.value[index]
  const marker = stopMarkers[index]
  if (!stop || !map) return
  map.setView([stop.lat, stop.lng], 15, { animate: true })
  marker?.openPopup()
}

onMounted(async () => {
  await nextTick()
  map = L.map(mapEl.value, { zoomControl: true }).setView([mapStore.origin.lat, mapStore.origin.lng], 13)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map)
  renderMap()
})

onUnmounted(() => {
  resetLayers()
  if (map) {
    map.remove()
    map = null
  }
})

watch([orderedStops, () => mapStore.origin], renderMap, { deep: true })
</script>

<template>
  <section class="panel map-panel">
    <div class="panel-head">
      <div>
        <h2>送單路線</h2>
        <span>{{ routeSubtitle }}</span>
      </div>
      <button type="button" class="primary-btn nav-btn" @click="openGoogleMaps">在 Google Maps 開導航</button>
    </div>

    <div class="toolbar map-toolbar">
      <div id="mapSeg" class="seg-row seg">
        <button type="button" class="seg-btn" data-mf="accepted" :class="{ on: filter === 'accepted' }" @click="filter = 'accepted'">已接單</button>
        <button type="button" class="seg-btn" data-mf="pending" :class="{ on: filter === 'pending' }" @click="filter = 'pending'">待審核</button>
        <button type="button" class="seg-btn" data-mf="shipped" :class="{ on: filter === 'shipped' }" @click="filter = 'shipped'">已出貨</button>
        <button type="button" class="seg-btn" data-mf="all" :class="{ on: filter === 'all' }" @click="filter = 'all'">全部</button>
      </div>
    </div>

    <div class="map-layout">
      <div class="route-panel route-list">
        <div class="dk panel-subhead route-panel-head">
          <h3>送單路線</h3>
          <button type="button" class="ghost-btn route-reset route-reset-btn" @click="resetRouteOrder">重設順序</button>
        </div>
        <div class="route-hint">
          <span class="route-hint-icon">⋮⋮</span>
          可拖曳站點調整送餐順序
        </div>
        <div class="route-origin">
          <div class="ro-row">
            <span class="ro-k">起點</span>
            <select id="mapOriginSel" v-model="originChoice" @change="setKnownOrigin">
              <option value="store">健美滷味（店家）</option>
              <option v-for="address in knownOrigins" :key="address" :value="address">{{ address }}</option>
              <option value="custom">自訂起點</option>
            </select>
            <button type="button" class="ro-reset" title="重設為店家" @click="resetOrigin">店家</button>
          </div>
          <div class="ro-row">
            <input id="mapOriginAddr" v-model="customOrigin" placeholder="或輸入自訂起點地址…" />
            <button type="button" class="ro-apply" @click="applyOrigin">設為起點</button>
          </div>
        </div>
        <div id="routeSub" class="route-sub route-panel-sub">{{ routeSubtitle }}</div>
        <div id="routeList">
          <article class="route-stop route-origin-stop origin-stop">
            <span class="route-no origin">起</span>
            <div class="route-stop-main">
              <div class="route-stop-nm">{{ mapStore.origin.label }}</div>
              <div class="route-stop-addr">{{ mapStore.origin.address || '出發點' }}</div>
            </div>
          </article>
          <article
            v-for="(stop, index) in orderedStops"
            :key="stop.id"
            class="route-stop"
            :class="{ drag: draggingId === stop.id, 'drag-over': dragOverId === stop.id }"
            :data-id="stop.id"
            draggable="true"
            @dragstart="onDragStart(stop.id)"
            @dragend="onDragEnd"
            @dragover.prevent="onDragOver(stop.id)"
            @drop="onDrop(stop.id)"
            @click="focusStop(index)"
          >
            <span class="route-grip" title="拖曳調整順序">⋮⋮</span>
            <span class="route-no">{{ index + 1 }}</span>
            <div class="route-stop-main">
              <div class="route-stop-nm">{{ stop.label }}</div>
              <div class="route-stop-addr">{{ stop.address }} · {{ orders.statusLabel(stop.status) }}</div>
            </div>
            <span class="route-stop-amt">${{ stop.amount.toLocaleString() }}</span>
          </article>
          <div v-if="!orderedStops.length" class="route-empty">
            <p>此狀態目前沒有訂單</p>
            <span>可切換篩選或回訂單頁調整狀態。</span>
          </div>
        </div>
      </div>
      <div id="mapCanvas" ref="mapEl" class="map-canvas"></div>
    </div>

    <p v-if="status" class="status-line">{{ status }}</p>
  </section>
</template>
