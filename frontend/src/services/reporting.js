function toYmd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function orderTotal(order) {
  return order.members.reduce((sum, member) => {
    return sum + member.items.reduce((itemSum, [, qty, price]) => {
      return itemSum + Number(qty || 0) * Number(price || 0)
    }, 0)
  }, 0)
}

function soldItemCount(order) {
  return order.members.reduce((sum, member) => {
    return sum + member.items.reduce((itemSum, [, qty]) => itemSum + Number(qty || 0), 0)
  }, 0)
}

function rangeLabel(range) {
  return ({
    today: '今日',
    week: '本週',
    month: '本月',
    all: '全部資料'
  })[range] || '本月'
}

function rangeDates(range, today = new Date()) {
  if (range === 'all') return null
  if (range === 'today') return [toYmd(today)]
  const days = range === 'week' ? 7 : 30
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - index)
    return toYmd(date)
  })
}

function barDates(range, today = new Date()) {
  if (range === 'today') return [['今日', toYmd(today)]]
  if (range === 'week') {
    const labels = ['日', '一', '二', '三', '四', '五', '六']
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - (6 - index))
      return [labels[date.getDay()], toYmd(date)]
    })
  }
  return Array.from({ length: 4 }, (_, weekIndex) => {
    const dates = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(today)
      date.setDate(today.getDate() - ((3 - weekIndex) * 7 + dayIndex))
      return toYmd(date)
    })
    return [`第${weekIndex + 1}週`, dates]
  })
}

export function calculateReportData({ orders, range = 'today', today = new Date() }) {
  const dealt = orders.filter((order) => order.status === 'accepted' || order.status === 'shipped')
  const dateSet = rangeDates(range, today)
  const source = dateSet ? orders.filter((order) => dateSet.includes(order.date)) : orders
  const selected = dateSet ? dealt.filter((order) => dateSet.includes(order.date)) : dealt
  const itemMap = new Map()
  const revenue = selected.reduce((sum, order) => sum + orderTotal(order), 0)
  const soldItems = selected.reduce((sum, order) => sum + soldItemCount(order), 0)

  selected.forEach((order) => {
    order.members.forEach((member) => {
      member.items.forEach(([name, qty, price]) => {
        const key = String(name)
        const count = Number(qty || 0)
        const prev = itemMap.get(key) || { qty: 0, revenue: 0 }
        prev.qty += count
        prev.revenue += count * Number(price || 0)
        itemMap.set(key, prev)
      })
    })
  })

  const topItems = [...itemMap.entries()]
    .map(([name, value]) => ({ name, ...value }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  const revenueByDate = new Map()
  dealt.forEach((order) => {
    revenueByDate.set(order.date, (revenueByDate.get(order.date) || 0) + orderTotal(order))
  })

  const bars = barDates(range === 'all' ? 'month' : range, today).map(([label, dates]) => {
    const value = Array.isArray(dates)
      ? dates.reduce((sum, date) => sum + (revenueByDate.get(date) || 0), 0)
      : revenueByDate.get(dates) || 0
    return { label, revenue: value }
  })
  const trendTotal = bars.reduce((sum, bar) => sum + bar.revenue, 0)
  const bestBar = bars.reduce((best, bar) => (bar.revenue > best.revenue ? bar : best), { label: '無', revenue: 0 })

  return {
    rangeLabel: rangeLabel(range),
    sourceOrderCount: source.length,
    dealtOrderCount: selected.length,
    conversionRate: source.length ? Math.round((selected.length / source.length) * 100) : 0,
    revenue,
    orderCount: selected.length,
    soldItems,
    averageOrder: selected.length ? Math.round(revenue / selected.length) : 0,
    trendTotal,
    bestBar,
    bars,
    topItems
  }
}
