const TYPE_LABELS = {
  normal: '一般滷味',
  vacuum: '真空包裝'
}

function buildProductMeta(catalogProducts = {}) {
  const byName = new Map()
  Object.entries(catalogProducts || {}).forEach(([type, list]) => {
    if (!Array.isArray(list)) return
    list.forEach((item) => {
      if (item?.name) byName.set(item.name, { item, type })
    })
  })
  return byName
}

function normalizeQty(qty) {
  return Math.max(0, Number(qty) || 0)
}

function addQty(map, name, qty) {
  const amount = normalizeQty(qty)
  if (!name || !amount) return
  map.set(name, (map.get(name) || 0) + amount)
}

function sortedRows(map) {
  return [...map.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return String(a[0]).localeCompare(String(b[0]), 'zh-Hant')
  })
}

function rowQty(rows) {
  return rows.reduce((sum, [, qty]) => sum + qty, 0)
}

export function buildPrepTally(orders = [], catalogProducts = {}) {
  const products = buildProductMeta(catalogProducts)
  const normal = new Map()
  const vacuum = new Map()
  const combo = new Map()

  const addItem = (name, qty) => {
    const amount = normalizeQty(qty)
    if (!name || !amount) return
    const meta = products.get(name)
    const parts = Array.isArray(meta?.item?.parts) ? meta.item.parts : []

    if (parts.length) {
      addQty(combo, name, amount)
      parts.forEach(([partName, partQty]) => addItem(partName, amount * (Number(partQty) || 1)))
      return
    }

    addQty(meta?.type === 'vacuum' ? vacuum : normal, name, amount)
  }

  orders.forEach((order) => {
    order?.members?.forEach((member) => {
      member?.items?.forEach(([name, qty]) => addItem(name, qty))
    })
  })

  const normalRows = sortedRows(normal)
  const vacuumRows = sortedRows(vacuum)
  const comboRows = sortedRows(combo)
  const normalQty = rowQty(normalRows)
  const vacuumQty = rowQty(vacuumRows)
  const comboQty = rowQty(comboRows)

  return {
    normal: normalRows,
    vacuum: vacuumRows,
    combo: comboRows,
    totalRows: normalRows.length + vacuumRows.length,
    totalQty: normalQty + vacuumQty,
    comboQty,
    normalQty,
    vacuumQty
  }
}

export function topPrepRows(tally, limit = 8) {
  return [
    ...(tally?.normal || []).map(([name, qty]) => ({ name, qty, type: 'normal', label: TYPE_LABELS.normal })),
    ...(tally?.vacuum || []).map(([name, qty]) => ({ name, qty, type: 'vacuum', label: TYPE_LABELS.vacuum }))
  ]
    .sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty
      return a.name.localeCompare(b.name, 'zh-Hant')
    })
    .slice(0, Math.max(0, Number(limit) || 0))
}

export function buildOrderPrepSummary(order, catalogProducts = {}) {
  const tally = buildPrepTally(order ? [order] : [], catalogProducts)
  return {
    rows: [...tally.normal, ...tally.vacuum],
    comboRows: tally.combo,
    comboCount: tally.comboQty
  }
}
