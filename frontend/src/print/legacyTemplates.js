const MM_TO_PX = 3.7795275591

const SHIP_PROFILES = {
  clean: { label: '乾淨留白款', family: 'clean', perPage: 8 },
  d1: { label: '密集直排', family: 'dense', perPage: 12 },
  d2: { label: '密集雙欄', family: 'dense', perPage: 12 },
  d3: { label: '小字清單', family: 'dense', perPage: 14 },
  d4: { label: '緊湊標籤', family: 'dense', perPage: 12 },
  d5: { label: '倉儲收貨', family: 'dense', perPage: 12 },
  d6: { label: '極簡密排', family: 'dense', perPage: 16 },
  hl1: { label: '飯店標籤 1', family: 'sticker', perPage: 7 },
  hl2: { label: '飯店標籤 2', family: 'sticker', perPage: 7 },
  hl3: { label: '飯店標籤 3', family: 'sticker', perPage: 8 },
  hl4: { label: '飯店標籤 4', family: 'sticker', perPage: 7 },
  hl5: { label: '飯店標籤 5', family: 'sticker', perPage: 7 },
  hl6: { label: '飯店標籤 6', family: 'sticker', perPage: 6 },
  lux1: { label: '精品吊牌 1', family: 'label', perPage: 8 },
  lux2: { label: '精品吊牌 2', family: 'label', perPage: 8 },
  lux3: { label: '精品吊牌 3', family: 'label', perPage: 8 },
  lux4: { label: '精品吊牌 4', family: 'label', perPage: 9 },
  lux5: { label: '精品吊牌 5', family: 'label', perPage: 8 },
  lux6: { label: '精品吊牌 6', family: 'label', perPage: 8 },
  lux7: { label: '精品吊牌 7', family: 'label', perPage: 8 },
  lux8: { label: '精品吊牌 8', family: 'label', perPage: 10 },
  s1: { label: '現代款 1', family: 'label', perPage: 9 },
  s2: { label: '現代款 2', family: 'label', perPage: 8 },
  s3: { label: '現代款 3', family: 'label', perPage: 9 },
  s4: { label: '現代款 4', family: 'label', perPage: 8 },
  s5: { label: '現代款 5', family: 'label', perPage: 10 },
  s6: { label: '現代款 6', family: 'label', perPage: 8 },
  s7: { label: '現代款 7', family: 'label', perPage: 9 },
  boutique: { label: '精品吊牌 1', family: 'label', perPage: 8, alias: 'lux1' },
  dense: { label: '密集直排', family: 'dense', perPage: 12, alias: 'd1' }
}

const PREP_PROFILES = {
  p1: { label: '清單勾選式', family: 'prep', perPage: 6 },
  p2: { label: '大字工廠式', family: 'prep', perPage: 6 },
  p3: { label: '分類分區', family: 'prep', perPage: 6 },
  k1: { label: '時間軸式', family: 'prep', perPage: 6 },
  k2: { label: '雙欄卡片', family: 'prep', perPage: 6 },
  k3: { label: '核對表', family: 'prep', perPage: 6 },
  k4: { label: '大數字產線', family: 'prep', perPage: 6 },
  k5: { label: '分區看板', family: 'prep', perPage: 6 },
  k6: { label: '出餐板', family: 'prep', perPage: 6 },
  k7: { label: '方格清單', family: 'prep', perPage: 6 },
  k8: { label: '印章核對', family: 'prep', perPage: 6 }
}

function px(mm) {
  return Math.round(Number(mm || 0) * MM_TO_PX)
}

function money(value) {
  return `$${Number(value || 0).toLocaleString()}`
}

function printDateText(value) {
  return String(value || '').replaceAll('/', ' · ')
}

function localDateText(date = new Date()) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function safeStyle(style, profiles, fallback) {
  return Object.prototype.hasOwnProperty.call(profiles, style) ? style : fallback
}

function chunk(items, size) {
  const pages = []
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size))
  }
  return pages.length ? pages : [[]]
}

function normalizePages(htmlPages) {
  return Array.isArray(htmlPages) ? htmlPages : [htmlPages]
}

function memberTotal(member) {
  return (member.items || []).reduce((sum, [, qty, price]) => {
    return sum + Number(qty || 0) * Number(price || 0)
  }, 0)
}

function orderDateTime(order) {
  return [order.date, order.time].filter(Boolean).join(' ')
}

function catalogProductRows(catalogProducts = {}) {
  if (Array.isArray(catalogProducts)) return catalogProducts
  return Object.values(catalogProducts).flat()
}

function productDisplayName(product) {
  return product?.name || product?.nm || ''
}

function prepOrderItemGroups(order) {
  if (Array.isArray(order?.items)) return [order.items]
  return (order?.members || []).map((member) => member.items || [])
}

function tallyPrepItems(orders, catalogProducts = {}) {
  const productByName = new Map()
  catalogProductRows(catalogProducts).forEach((product) => {
    const name = productDisplayName(product)
    if (name) productByName.set(name, product)
  })

  const tally = new Map()
  const comboRows = new Map()
  let comboCount = 0

  const addQty = (map, name, qty) => {
    const amount = Math.max(0, Number(qty) || 0)
    if (!name || !amount) return
    map.set(name, (map.get(name) || 0) + amount)
  }

  orders.forEach((order) => {
    prepOrderItemGroups(order).forEach((items) => {
      items.forEach(([name, qty]) => {
        const key = String(name || '')
        const amount = Math.max(0, Number(qty) || 0)
        if (!key || !amount) return
        const product = productByName.get(key)
        if (Array.isArray(product?.parts) && product.parts.length) {
          comboCount += amount
          addQty(comboRows, key, amount)
          product.parts.forEach(([partName, partQty]) => {
            addQty(tally, String(partName || ''), amount * (Number(partQty) || 1))
          })
          return
        }
        addQty(tally, key, amount)
      })
    })
  })

  const rows = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])
  return {
    rows: rows(tally),
    comboRows: rows(comboRows),
    comboCount
  }
}

function shipItemRows(items, mode = 'default') {
  return items.map(([name, qty, price]) => {
    const amount = Number(qty || 0) * Number(price || 0)
    if (mode === 'dense') {
      return `<div class="dz-it"><span class="dz-n">${escapeHtml(name)}</span><span class="dz-q">x${Number(qty || 0)}</span><span class="dz-p">${money(amount)}</span></div>`
    }
    if (mode === 'clean') {
      return `<div class="cs-it"><span class="cs-n">${escapeHtml(name)}</span><span class="cs-q">x${Number(qty || 0)}</span><span class="cs-p">${money(amount)}</span></div>`
    }
    return `<div class="it"><span>${escapeHtml(name)}<span class="q">x${Number(qty || 0)}</span></span><span class="mono">${money(amount)}</span></div>`
  }).join('')
}

function shipData(order, member) {
  return {
    brand: '健美滷味',
    orderId: member.id || order.id,
    date: orderDateTime(order),
    person: member.name,
    department: member.department || '',
    company: order.company,
    address: order.address,
    phone: member.phone || '',
    note: member.note || '',
    total: memberTotal(member),
    allItems: member.items || []
  }
}

function shipRecipient(data) {
  return `
    <div class="nm">${escapeHtml(data.person)}</div>
    <div class="co-dept"><span class="co">${escapeHtml(data.company)}</span>${data.department ? `<span class="dept-tag">${escapeHtml(data.department)}</span>` : ''}</div>
    <div class="addr">${escapeHtml(data.address)}</div>
    ${data.phone ? `<div class="tel">${escapeHtml(data.phone)}</div>` : ''}
  `
}

function buildCleanShipPage(data, items, pageInfo, docSize) {
  const width = px(docSize.w)
  const height = px(docSize.h)
  const pad = Math.round(width * 0.07)
  const isLast = pageInfo.index === pageInfo.total
  return `<div class="cleanship" style="width:${width}px;height:${height}px;padding:${pad}px">
    <div class="cs-brand">${escapeHtml(data.brand)}</div>
    <div class="cs-bar"><span>出貨配送單</span><span>${pageInfo.total > 1 ? `${pageInfo.index}/${pageInfo.total}` : ''}</span></div>
    <div class="cs-no">No. ${escapeHtml(data.orderId)}</div>
    <div class="cs-meta">${escapeHtml(printDateText(data.date))}</div>
    <div class="cs-to-label">收件人 DELIVER TO</div>
    <div class="cs-name">${escapeHtml(data.person)}</div>
    <div class="cs-co">${escapeHtml(data.company)}${data.department ? ` <span class="cs-dept">${escapeHtml(data.department)}</span>` : ''}</div>
    <div class="cs-addr">${escapeHtml(data.address)}</div>
    ${data.phone ? `<div class="cs-tel">${escapeHtml(data.phone)}</div>` : ''}
    <div class="cs-divider"></div>
    <div class="cs-items">${shipItemRows(items, 'clean')}</div>
    ${isLast ? `<div class="cs-freeze">冷凍保存 · 共 ${data.allItems.length} 項</div>` : `<div class="dz-cont">接續下頁　→　第 ${pageInfo.index + 1} / ${pageInfo.total} 頁</div>`}
    ${isLast && data.note ? `<div class="cs-note"><b>備註</b>${escapeHtml(data.note)}</div>` : ''}
    <div class="cs-total"><span>${isLast ? '應收總額 TOTAL' : 'CONTINUED'}</span><span class="cs-total-v">${isLast ? money(data.total) : ''}</span></div>
  </div>`
}

function buildDenseShipPage(style, data, items, pageInfo, docSize) {
  const width = px(docSize.w)
  const height = px(docSize.h)
  const pad = Math.round(width * 0.055)
  const isLast = pageInfo.index === pageInfo.total
  const isFirst = pageInfo.index === 1
  const head = isFirst
    ? `<div class="dz-brand">${escapeHtml(data.brand)}<span class="dz-en">Braised Cuisine</span></div>
      <div class="dz-bar"><span>出貨配送單</span><span>No. ${escapeHtml(data.orderId)}${pageInfo.total > 1 ? ` · ${pageInfo.index}/${pageInfo.total}` : ''}</span></div>
      <div class="dz-to"><b>${escapeHtml(data.person)}</b>${data.department ? `<span class="dz-dept">${escapeHtml(data.department)}</span>` : ''}</div>
      <div class="dz-co">${escapeHtml(data.company)}</div>
      <div class="dz-addr">${escapeHtml(data.address)}${data.phone ? ` · ${escapeHtml(data.phone)}` : ''}</div>`
    : `<div class="dz-brand sm">${escapeHtml(data.brand)}</div>
      <div class="dz-bar"><span>No. ${escapeHtml(data.orderId)}（續）</span><span>${pageInfo.index}/${pageInfo.total}</span></div>`
  return `<div class="cleanship dense ${style}" style="width:${width}px;height:${height}px;padding:${pad}px">
    ${head}
    <div class="dz-items">${shipItemRows(items, 'dense')}</div>
    ${isLast ? `<div class="dz-freeze">冷凍保存 · 請盡速冷凍 · 共 ${data.allItems.length} 項</div>
      ${data.note ? `<div class="dz-note">備註 ${escapeHtml(data.note)}</div>` : ''}
      <div class="dz-total"><span>應收總額 TOTAL</span><b>${money(data.total)}</b></div>` : `<div class="dz-cont">接續下頁　→　第 ${pageInfo.index + 1} / ${pageInfo.total} 頁</div>`}
  </div>`
}

function buildStickerShipPage(style, data, items, pageInfo, docSize) {
  const width = px(docSize.w)
  const height = px(docSize.h)
  const pad = Math.round(width * 0.085)
  const isLast = pageInfo.index === pageInfo.total
  const isFirst = pageInfo.index === 1
  const head = isFirst
    ? `<div class="sk-top">
        <div class="sk-mk">Braised Cuisine</div>
        <div class="sk-brand">${escapeHtml(data.brand)}</div>
        <div class="sk-rule"><span class="sk-ln"></span><span class="sk-dot"></span><span class="sk-ln"></span></div>
        <div class="sk-sub">出貨配送單　DELIVERY NOTE</div>
      </div>
      <div class="sk-meta"><span>No. ${escapeHtml(data.orderId)}</span><span>${escapeHtml(printDateText(data.date))}</span>${pageInfo.total > 1 ? `<span>${pageInfo.index}/${pageInfo.total}</span>` : ''}</div>
      <div class="sk-to">
        <div class="sk-to-k">收件人 DELIVER TO</div>
        <div class="sk-name">${escapeHtml(data.person)}</div>
        <div class="sk-co">${escapeHtml(data.company)}${data.department ? ` · ${escapeHtml(data.department)}` : ''}</div>
        <div class="sk-addr">${escapeHtml(data.address)}</div>
        ${data.phone ? `<div class="sk-tel">TEL ${escapeHtml(data.phone)}</div>` : ''}
      </div>
      <div class="sk-line"></div>`
    : `<div class="sk-conthead"><span class="sk-brand sm">${escapeHtml(data.brand)}</span><span>No. ${escapeHtml(data.orderId)}（續） ${pageInfo.index}/${pageInfo.total}</span></div>
      <div class="sk-line"></div>`
  return `<div class="cleanship sticker ${style}" style="width:${width}px;height:${height}px;padding:${pad}px">
    ${head}
    <div class="sk-items">${items.map(([name, qty, price]) => `<div class="sk-it"><span class="sk-n">${escapeHtml(name)}</span><span class="sk-q">x${Number(qty || 0)}</span><span class="sk-p">${money(Number(qty || 0) * Number(price || 0))}</span></div>`).join('')}</div>
    ${isLast ? `<div class="sk-freeze">冷 凍 保 存　KEEP FROZEN</div>
      <div class="sk-note"><span class="sk-note-k">備註 NOTE</span><span class="sk-note-v">${data.note ? escapeHtml(data.note) : '—'}</span></div>
      <div class="sk-total"><span>應收總額 TOTAL</span><span class="sk-total-v">${money(data.total)}</span></div>` : `<div class="sk-cont">接續下頁　→　第 ${pageInfo.index + 1} / ${pageInfo.total} 頁</div>`}
  </div>`
}

function buildLabelShipPage(style, data, items, pageInfo) {
  const cssStyle = SHIP_PROFILES[style]?.alias || style
  const isLast = pageInfo.index === pageInfo.total
  return `<div class="lbl ${cssStyle}">
    <div class="crest">
      <div class="mk">Braised Cuisine</div>
      <div class="cn">${escapeHtml(data.brand)}</div>
      <div class="rule"><span class="l"></span><span class="d"></span><span class="l"></span></div>
    </div>
    <div class="oid-big">No. ${escapeHtml(data.orderId)}${pageInfo.total > 1 ? `<span class="pg-tag">${pageInfo.index}/${pageInfo.total}</span>` : ''}</div>
    <div class="meta"><span>出貨配送單</span><span>${escapeHtml(printDateText(data.date))}</span></div>
    <div class="lbl2">Deliver to</div>
    ${shipRecipient(data)}
    <div class="items">${shipItemRows(items)}</div>
    ${isLast ? `<div class="ship-extra">
      <div class="ship-cnt">共 ${data.allItems.length} 項 <span class="freeze-tag">冷凍</span></div>
      ${data.note ? `<div class="ship-note"><span class="ship-note-k">備註</span>${escapeHtml(data.note)}</div>` : ''}
    </div>` : ''}
    <div class="ft ${isLast ? '' : 'cont'}"><span class="fl">${isLast ? '應收總額 TOTAL' : `接續下頁　→　第 ${pageInfo.index + 1} / ${pageInfo.total} 頁`}</span><span class="tot mono">${isLast ? money(data.total) : ''}</span></div>
  </div>`
}

function buildShipPage(style, data, items, pageInfo, docSize) {
  const cssStyle = SHIP_PROFILES[style]?.alias || style
  const family = SHIP_PROFILES[style]?.family || 'clean'
  if (family === 'dense') return buildDenseShipPage(cssStyle, data, items, pageInfo, docSize)
  if (family === 'sticker') return buildStickerShipPage(cssStyle, data, items, pageInfo, docSize)
  if (family === 'label') return buildLabelShipPage(cssStyle, data, items, pageInfo)
  return buildCleanShipPage(data, items, pageInfo, docSize)
}

function prepRowsHtml(items, render) {
  return items.map(([name, qty, unit], index) => render({
    name: escapeHtml(name),
    qty: escapeHtml(qty),
    unit: escapeHtml(unit),
    rowNo: String(index + 1).padStart(2, '0')
  })).join('')
}

function buildPrepPage(style, data, items, pageInfo) {
  const page = pageInfo.total > 1 ? `（${pageInfo.index}/${pageInfo.total}）` : ''
  const isLast = pageInfo.index === pageInfo.total
  const extra = isLast ? `<div class="prep-extra">
    <div class="prep-cnt">共 ${data.items.length} 項</div>
    ${data.note ? `<div class="prep-note"><span class="prep-note-k">備註</span>${escapeHtml(data.note)}</div>` : ''}
  </div>` : ''
  const date = escapeHtml(data.date)
  const dateShort = escapeHtml(String(data.date || '').slice(5))
  const oid = escapeHtml(data.oid)
  const orderCount = Number(data.orders || 0)
  const pageItemCount = items.length

  if (style === 'p2') {
    return `<div class="prep p2">
      <div class="hd"><div class="t">備 料 單</div><div class="d">${date}<span class="prep-oid-inline"> · No.${oid}</span> · ${orderCount} 單 ${page}</div></div>
      ${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="it"><span class="nm">${name}</span><span class="qty">${qty}</span><span class="unit">${unit}</span></div>`)}
      ${extra}<div class="ft"><span class="l">本頁品項</span><span class="v">${pageItemCount} 項</span></div>
    </div>`
  }

  if (style === 'p3') {
    return `<div class="prep p3">
      <div class="hd"><div class="mk">Prep List ${page}</div><div class="t">備料單</div>
        <div class="d">${date}<span class="prep-oid-inline"> · No.${oid}</span> · 共 ${orderCount} 張訂單</div></div>
      <div class="grp"><div class="grp-t">備料項目</div>
      ${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="it"><span>${name}</span><span class="qty">${qty} ${unit}</span></div>`)}</div>
      ${extra}<div class="ft">健美滷味 · 備料單 · 請於 16:00 前完成</div>
    </div>`
  }

  if (style === 'k1') {
    return `<div class="prep k1">
      <div class="hd"><div class="t">備料單<small>PREP / KITCHEN ${page}</small></div>
        <div class="meta">${date}<span class="prep-oid-inline"> · No.${oid}</span><br><b>共 ${orderCount} 張訂單</b></div></div>
      <div class="list">${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="it"><span class="nm">${name}</span><span><span class="qty">${qty}</span><span class="unit">${unit}</span></span></div>`)}</div>
      ${extra}<div class="ft"><span>備料人：____________</span><span>完成：________</span></div>
    </div>`
  }

  if (style === 'k2') {
    return `<div class="prep k2">
      <div class="hd"><div class="em">Prep List</div><div class="t">備料單</div><div class="d">${date}<span class="prep-oid-inline"> · No.${oid}</span> · 共 ${orderCount} 張訂單 ${page}</div></div>
      <div class="cols">${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="it"><span class="nm">${name}</span><span><span class="qty">${qty}</span><span class="unit">${unit}</span></span></div>`)}</div>
      ${extra}<div class="ft">健美滷味 · 備料單 · ${pageItemCount} 項 · 請於 16:00 前完成</div>
    </div>`
  }

  if (style === 'k3') {
    return `<div class="prep k3">
      <div class="hd"><div class="t">備料核對表</div><div class="d">${date}<span class="prep-oid-inline"> · No.${oid}</span><br>共 ${orderCount} 張訂單 ${page}</div></div>
      ${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="it"><span class="box"></span><span class="badge">${qty}</span><span class="nm">${name}</span><span class="unit">${unit}</span></div>`)}
      ${extra}<div class="ft"><span>備料人：____________</span><span>檢核：________</span></div>
    </div>`
  }

  if (style === 'k4') {
    return `<div class="prep k4">
      <div class="hd"><div class="t">備料單</div><div class="d">${dateShort}<span class="prep-oid-inline"> · No.${oid}</span> · ${orderCount}單 ${page}</div></div>
      <div class="list">${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="it"><span class="qty">${qty}</span><span class="nm">${name}</span><span class="unit">${unit}</span></div>`)}</div>
      ${extra}<div class="ft"><span class="l">本頁品項</span><span class="v">${pageItemCount} 項</span></div>
    </div>`
  }

  if (style === 'k5') {
    return `<div class="prep k5">
      <div class="hd"><div class="t">備料看板</div><div class="d">${date}<span class="prep-oid-inline"> · No.${oid}</span> · 共 ${orderCount} 張訂單 ${page}</div></div>
      <div class="zone"><div class="zone-t"><span>備料項目</span><span class="c">${pageItemCount} 項</span></div>
      ${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="it"><span>${name}</span><span class="qty">${qty} ${unit}</span></div>`)}</div>
      ${extra}<div class="ft">健美滷味 · 備料看板 · 請於 16:00 前完成</div>
    </div>`
  }

  if (style === 'k6') {
    return `<div class="prep k6">
      <div class="hd6"><div class="t">出 餐 備 料 板</div><div class="d">${date} · No.${oid} · ${orderCount} 單 ${page}</div></div>
      <div class="list6">${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="it6"><span class="nm6">${name}</span><span class="qty6">${qty}<small>${unit}</small></span></div>`)}</div>
      ${extra}<div class="ft6">健美滷味 · 備料板</div>
    </div>`
  }

  if (style === 'k7') {
    return `<div class="prep k7">
      <div class="hd7"><span class="t">備料方格</span><span class="d">${date} · No.${oid} ${page}</span></div>
      <div class="grid7">${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="cell7"><div class="q7">${qty}</div><div class="u7">${unit}</div><div class="n7">${name}</div></div>`)}</div>
      ${extra}<div class="ft7">健美滷味 · 共 ${data.items.length} 項</div>
    </div>`
  }

  if (style === 'k8') {
    return `<div class="prep k8">
      <div class="hd8"><div class="t">備 料 核 對 表</div><div class="d">${date}<span> · No.${oid}</span> · ${orderCount} 單 ${page}</div></div>
      <div class="list8">${prepRowsHtml(items, ({ name, qty, unit, rowNo }) => `<div class="it8"><span class="ck8"></span><span class="nm8">${name}</span><span class="qty8">${qty} ${unit}</span><span class="no8">${rowNo}</span></div>`)}</div>
      ${extra}<div class="ft8"><span>核對人：____________</span><span>時間：________</span></div>
    </div>`
  }

  return `<div class="prep p1">
    <div class="hd"><div class="t">備料單<small>PREP LIST ${page}</small></div>
      <div class="meta">${date}<span class="prep-oid-inline"> · No.${oid}</span><br><b>共 ${orderCount} 張訂單</b></div></div>
    <div class="list">${prepRowsHtml(items, ({ name, qty, unit }) => `<div class="it"><span class="box"></span><span class="nm">${name}</span><span class="qty">${qty}</span><span class="unit">${unit}</span></div>`)}</div>
    ${extra}<div class="ft"><span>備料人：____________</span><span>完成時間：________</span></div>
  </div>`
}

function buildPrepData(orders, catalogProducts) {
  const tally = tallyPrepItems(orders, catalogProducts)
  return {
    date: localDateText(),
    orders: orders.length,
    oid: `P${Date.now().toString().slice(-8)}`,
    note: tally.comboCount ? `已拆解 ${tally.comboCount} 份組合為單品` : '請依數量備料，冷藏品先處理。',
    items: tally.rows.map(([name, qty]) => [name, String(qty), '份'])
  }
}

export function wrapPages(htmlPages) {
  return normalizePages(htmlPages)
    .map((html) => wrapPage(html))
    .join('')
}

export function wrapPage(html) {
  return `<div class="print-page">${String(html ?? '')}</div>`
}

export function buildShipPages({ orders, style = 'clean', docSize = { w: 70, h: 100 } }) {
  const selectedStyle = safeStyle(style, SHIP_PROFILES, 'clean')
  const profile = SHIP_PROFILES[selectedStyle]
  return orders.flatMap((order) => (order.members || []).flatMap((member) => {
    const data = shipData(order, member)
    const pages = chunk(member.items || [], profile.perPage)
    return pages.map((items, index) => buildShipPage(selectedStyle, data, items, {
      index: index + 1,
      total: pages.length
    }, docSize))
  }))
}

export function buildPrepPages({ orders, style = 'p1', docSize = { w: 70, h: 100 }, catalogProducts = {} }) {
  const selectedStyle = safeStyle(style, PREP_PROFILES, 'p1')
  const profile = PREP_PROFILES[selectedStyle]
  const data = buildPrepData(orders, catalogProducts)
  const pages = chunk(data.items, profile.perPage)
  return pages.map((items, index) => {
    return buildPrepPage(selectedStyle, data, items, {
      index: index + 1,
      total: pages.length
    })
  })
}

export function buildA4OrderPages({ orders = [], title = '團購訂單總表', code = '', meta = '' } = {}) {
  const people = orders.flatMap((order) => (order.members || []).map((member) => ({ order, member })))
  const total = people.reduce((sum, { member }) => sum + memberTotal(member), 0)
  const totalQty = people.reduce((sum, { member }) => {
    return sum + (member.items || []).reduce((itemSum, [, qty]) => itemSum + Number(qty || 0), 0)
  }, 0)
  const printedAt = localDateText()
  const titleText = title || '團購訂單總表'
  const codeText = code ? ` · #${escapeHtml(String(code).toUpperCase())}` : ''
  const extraMetaText = meta ? ` · ${escapeHtml(meta)}` : ''

  const peopleHtml = people.map(({ order, member }, index) => {
    const rows = (member.items || []).map(([name, qty, price]) => `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td class="c">${Number(qty || 0)}</td>
        <td class="r">${money(price)}</td>
        <td class="r">${money(Number(qty || 0) * Number(price || 0))}</td>
      </tr>
    `).join('')

    return `
      <section class="a4-person">
        <div class="a4-person-h">
          <span class="a4-no">${index + 1}</span>
          <span class="a4-nm">${escapeHtml(member.name)}</span>
          ${member.department ? `<span class="a4-dept">${escapeHtml(member.department)}</span>` : ''}
          <span class="a4-company">${escapeHtml(order.company)}</span>
          <span class="a4-amt">${money(memberTotal(member))}</span>
        </div>
        <div class="a4-person-sub">${escapeHtml(order.date)} ${escapeHtml(order.time)} · ${escapeHtml(member.phone || '無電話')} · ${escapeHtml(order.address)}</div>
        <table class="a4-tbl">
          <thead><tr><th>品項</th><th class="c">數量</th><th class="r">單價</th><th class="r">小計</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${member.note ? `<div class="a4-note">備註：${escapeHtml(member.note)}</div>` : ''}
      </section>
    `
  }).join('')

  const summary = new Map()
  people.forEach(({ member }) => {
    ;(member.items || []).forEach(([name, qty, price]) => {
      const key = String(name)
      const prev = summary.get(key) || { qty: 0, amount: 0 }
      prev.qty += Number(qty || 0)
      prev.amount += Number(qty || 0) * Number(price || 0)
      summary.set(key, prev)
    })
  })

  const summaryRows = [...summary.entries()].sort((a, b) => b[1].qty - a[1].qty).map(([name, item]) => `
    <tr>
      <td>${escapeHtml(name)}</td>
      <td class="c">${item.qty}</td>
      <td class="r">${money(item.amount)}</td>
    </tr>
  `).join('')

  return [`
    <article class="a4-doc">
      <header class="a4-head">
        <div class="a4-brand">健美滷味 <span>Braised Cuisine</span></div>
        <div class="a4-meta">
          <div class="a4-title">${escapeHtml(titleText)}</div>
          <div class="a4-sub">團購訂單表${codeText}${extraMetaText} · 列印 ${printedAt}</div>
        </div>
      </header>

      <section class="a4-kpis">
        <div class="a4-kpi"><b>${people.length}</b><span>訂購人數</span></div>
        <div class="a4-kpi"><b>${totalQty}</b><span>品項總數</span></div>
        <div class="a4-kpi"><b>${money(total)}</b><span>訂單總金額</span></div>
      </section>

      <div class="a4-sec-t">訂購明細（依訂購人）</div>
      ${peopleHtml || '<p class="a4-empty">尚無訂購人明細</p>'}

      <div class="a4-sec-t">品項彙總（備料參考）</div>
      <table class="a4-tbl a4-sum">
        <thead><tr><th>品項</th><th class="c">總數量</th><th class="r">金額</th></tr></thead>
        <tbody>${summaryRows}</tbody>
        <tfoot><tr><td class="r" colspan="2">總計</td><td class="r">${money(total)}</td></tr></tfoot>
      </table>
      <footer class="a4-foot">健美滷味 · 本訂單表由團購系統產生 · ${printedAt}</footer>
    </article>
  `]
}
