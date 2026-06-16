import assert from 'node:assert/strict'
import { buildOrderPrepSummary, buildPrepTally, topPrepRows } from '../src/utils/prepTally.js'

const catalogProducts = {
  normal: [
    { id: 'n1', name: '豆干', price: 30 },
    { id: 'n2', name: '海帶', price: 25 },
    { id: 'n3', name: '家庭分享組', price: 399, parts: [['豆干', 2], ['海帶', 1], ['真空鴨血', 1]] }
  ],
  vacuum: [
    { id: 'v1', name: '真空鴨血', price: 150 }
  ]
}

const orders = [
  {
    id: 'O-1',
    members: [
      {
        id: 'M-1',
        name: '王小明',
        items: [
          ['豆干', 3, 30],
          ['家庭分享組', 2, 399],
          ['未建檔品項', 1, 10],
          ['海帶', 0, 25]
        ]
      }
    ]
  },
  {
    id: 'O-2',
    members: [
      {
        id: 'M-2',
        name: '李美華',
        items: [
          ['真空鴨血', 4, 150],
          ['海帶', 3, 25]
        ]
      }
    ]
  }
]

const tally = buildPrepTally(orders, catalogProducts)

assert.deepEqual(tally.normal, [
  ['豆干', 7],
  ['海帶', 5],
  ['未建檔品項', 1]
])
assert.deepEqual(tally.vacuum, [['真空鴨血', 6]])
assert.deepEqual(tally.combo, [['家庭分享組', 2]])
assert.equal(tally.totalRows, 4)
assert.equal(tally.totalQty, 19)
assert.equal(tally.comboQty, 2)

assert.deepEqual(topPrepRows(tally, 3), [
  { name: '豆干', qty: 7, type: 'normal', label: '一般滷味' },
  { name: '真空鴨血', qty: 6, type: 'vacuum', label: '真空包裝' },
  { name: '海帶', qty: 5, type: 'normal', label: '一般滷味' }
])

assert.deepEqual(buildOrderPrepSummary(orders[0], catalogProducts), {
  rows: [
    ['豆干', 7],
    ['海帶', 2],
    ['未建檔品項', 1],
    ['真空鴨血', 2]
  ],
  comboRows: [['家庭分享組', 2]],
  comboCount: 2
})

console.log('prep tally ok')
