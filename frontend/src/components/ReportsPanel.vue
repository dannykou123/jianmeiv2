<script setup>
import { computed, ref } from 'vue'
import { useOrdersStore } from '../stores/orders.js'
import { calculateReportData } from '../services/reporting.js'

const orders = useOrdersStore()
const range = ref('today')

const report = computed(() => calculateReportData({ orders: orders.orders, range: range.value }))
const maxBarRevenue = computed(() => Math.max(1, ...report.value.bars.map((bar) => bar.revenue)))
const maxTopQty = computed(() => Math.max(1, ...report.value.topItems.map((item) => item.qty)))
const summaryItems = computed(() => [
  ['區間', report.value.rangeLabel],
  ['成交率', `${report.value.conversionRate}%`],
  ['成交 / 全部', `${report.value.dealtOrderCount} / ${report.value.sourceOrderCount}`],
  ['趨勢合計', `$${report.value.trendTotal.toLocaleString()}`],
  ['最高營收段', `${report.value.bestBar.label} · $${report.value.bestBar.revenue.toLocaleString()}`]
])
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <h2>營收報表</h2>
        <span>只計已接單與已出貨 · {{ range === 'all' ? '全部資料' : range === 'today' ? '今日' : range === 'week' ? '本週' : '本月' }}</span>
      </div>
      <div class="seg-row">
        <button type="button" :class="{ on: range === 'today' }" @click="range = 'today'">今日</button>
        <button type="button" :class="{ on: range === 'week' }" @click="range = 'week'">本週</button>
        <button type="button" :class="{ on: range === 'month' }" @click="range = 'month'">本月</button>
        <button type="button" :class="{ on: range === 'all' }" @click="range = 'all'">全部</button>
      </div>
    </div>

    <div class="order-kpis">
      <div><b>${{ report.revenue.toLocaleString() }}</b><span>營收</span></div>
      <div><b>{{ report.orderCount }}</b><span>訂單數</span></div>
      <div><b>{{ report.soldItems }}</b><span>售出品項</span></div>
      <div><b>${{ report.averageOrder.toLocaleString() }}</b><span>客單價</span></div>
    </div>

    <section class="report-summary">
      <div v-for="[label, value] in summaryItems" :key="label">
        <span>{{ label }}</span>
        <strong>{{ value }}</strong>
      </div>
    </section>

    <section class="report-card">
      <div class="panel-subhead">
        <h3>營收趨勢</h3>
        <span>{{ report.bars.length }} 段</span>
      </div>
      <div class="report-bars">
        <div v-for="bar in report.bars" :key="bar.label" class="report-bar-col">
          <div class="report-bar-wrap"><span :style="{ height: `${Math.round(bar.revenue / maxBarRevenue * 100)}%` }"></span></div>
          <small>{{ bar.label }}</small>
          <b>${{ bar.revenue.toLocaleString() }}</b>
        </div>
      </div>
    </section>

    <section class="report-card">
      <div class="panel-subhead">
        <h3>熱賣商品 TOP 5</h3>
        <span>{{ report.topItems.length }} 項</span>
      </div>
      <div class="report-list">
        <article v-for="(item, index) in report.topItems" :key="item.name" class="report-row">
          <div>
            <strong>{{ index + 1 }}. {{ item.name }}</strong>
            <small>{{ item.qty }} 份 · ${{ item.revenue.toLocaleString() }}</small>
          </div>
          <div class="bar"><span :style="{ width: `${Math.round(item.qty / maxTopQty * 100)}%` }"></span></div>
        </article>
        <p v-if="!report.topItems.length" class="set-note">這個期間沒有成交訂單資料。</p>
      </div>
    </section>
  </section>
</template>
