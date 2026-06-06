import assert from 'node:assert/strict'
import { shipStyles, prepStyles } from '../src/data/printStyles.js'
import { buildA4OrderPages, buildPrepPages, buildShipPages, wrapPages } from '../src/print/legacyTemplates.js'
import { createPrintPayload } from '../src/services/nasPrint.js'

const docSize = { w: 70, h: 100 }

const sampleOrders = [
  {
    id: 'JM-1001',
    company: '健美測試公司',
    address: '台北市測試路 1 號',
    date: '2026-06-05',
    time: '11:30',
    status: 'accepted',
    members: [
      {
        id: 'M-01',
        name: '王小明',
        department: '業務部',
        phone: '0912-345-678',
        note: '不要辣',
        items: [
          ['招牌滷味', 2, 180],
          ['雞腿', 1, 120],
          ['豆干', 3, 30],
          ['海帶', 2, 25],
          ['米血', 1, 35],
          ['甜不辣', 2, 40],
          ['百頁豆腐', 1, 45],
          ['家庭分享組', 1, 399]
        ]
      },
      {
        id: 'M-02',
        name: '李美華',
        department: '設計部',
        phone: '0988-000-111',
        note: '',
        items: [
          ['鴨血', 2, 55],
          ['王子麵', 1, 25],
          ['豆皮', 2, 35]
        ]
      }
    ]
  }
]

const sampleCatalog = {
  normal: [
    { id: 'm1', name: '招牌滷味', price: 180 },
    { id: 'm2', name: '雞腿', price: 120 },
    { id: 'm3', name: '豆干', price: 30 },
    { id: 'm4', name: '家庭分享組', price: 399, parts: [['招牌滷味', 1], ['豆干', 2], ['海帶', 2]] }
  ],
  vacuum: [
    { id: 'v1', name: '真空鴨血', price: 150 }
  ]
}

function countWrappedPages(html) {
  return (html.match(/class="print-page"/g) || []).length
}

function assertNonEmptyPage(page, label) {
  assert.equal(typeof page, 'string', `${label} should return a string page`)
  assert.ok(page.trim().length > 0, `${label} page should not be empty`)
}

const shipKeys = Object.keys(shipStyles)
const prepKeys = Object.keys(prepStyles)

assert.equal(shipKeys.length, 28, 'ship style count should match legacy set')
assert.equal(prepKeys.length, 11, 'prep style count should match legacy set')

for (const key of shipKeys) {
  const pages = buildShipPages({ orders: sampleOrders, style: key, docSize })
  assert.ok(pages.length >= 2, `ship style ${key} should produce member pages`)
  pages.forEach((page, index) => {
    assertNonEmptyPage(page, `ship style ${key} page ${index + 1}`)
    assert.match(page, /class="(?:cleanship|lbl)\b/, `ship style ${key} should use a legacy ship root class`)
    assert.match(page, /No\./, `ship style ${key} should include order number text`)
  })
  assert.equal(countWrappedPages(wrapPages(pages)), pages.length, `ship style ${key} should wrap every page`)
}

for (const key of prepKeys) {
  const pages = buildPrepPages({ orders: sampleOrders, style: key, docSize, catalogProducts: sampleCatalog })
  assert.ok(pages.length >= 1, `prep style ${key} should produce pages`)
  pages.forEach((page, index) => {
    assertNonEmptyPage(page, `prep style ${key} page ${index + 1}`)
    assert.match(page, new RegExp(`class="prep ${key}"`), `prep style ${key} should use the legacy prep root class`)
    assert.match(page, /No\./, `prep style ${key} should include prep/order number text`)
  })
  assert.equal(countWrappedPages(wrapPages(pages)), pages.length, `prep style ${key} should wrap every page`)
}

const a4Pages = buildA4OrderPages({ orders: sampleOrders, title: '團購訂單總表', code: 'T1001', meta: '健美測試公司' })
assert.equal(a4Pages.length, 1, 'A4 order summary should produce one document page')
assert.match(a4Pages[0], /class="a4-doc"/, 'A4 output should keep the legacy a4-doc root class')
assert.match(a4Pages[0], /class="a4-person"/, 'A4 output should include member sections')
assert.match(a4Pages[0], /class="a4-tbl a4-sum"/, 'A4 output should include item summary table')

const payload = createPrintPayload({
  kind: 'ship',
  queue: 'thermal-70x100',
  widthMm: 70,
  heightMm: 100,
  images: ['data:image/png;base64,AAA', 'data:image/png;base64,BBB']
})
assert.deepEqual(Object.keys(payload), ['kind', 'queue', 'widthMm', 'heightMm', 'format', 'images', 'ts'], 'NAS payload keys must stay stable')
assert.equal(payload.kind, 'ship')
assert.equal(payload.queue, 'thermal-70x100')
assert.equal(payload.widthMm, 70)
assert.equal(payload.heightMm, 100)
assert.equal(payload.format, 'image')
assert.equal(payload.images.length, 2)
assert.equal(typeof payload.ts, 'number')

console.log(`print parity ok: ${shipKeys.length} ship styles, ${prepKeys.length} prep styles, A4 summary, NAS payload`)
