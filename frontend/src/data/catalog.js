export const products = {
  normal: [
    { id: 'm1', name: '招牌綜合滷味', price: 180, stock: 42, cost: 95, low: 10, desc: '豆干、海帶、滷蛋與人氣滷味一次配好' },
    { id: 'm2', name: '麻辣鴨血', price: 120, stock: 28, cost: 55, low: 10, desc: '微麻微辣，適合加熱後當宵夜' },
    { id: 'm3', name: '滷雞翅', price: 95, stock: 8, cost: 48, low: 10, desc: '每日滷製，口味厚實不死鹹' },
    { id: 'm4', name: '茶葉蛋', price: 15, stock: 120, cost: 6, low: 30, desc: '團購加購人氣品項' },
    { id: 'm5', name: '滷豆干', price: 40, stock: 65, cost: 16, low: 20, desc: '小份量下酒菜，冷吃也適合' },
    { id: 'm6', name: '滷海帶', price: 30, stock: 5, cost: 11, low: 15, desc: '清爽鹹香，適合搭配主餐' },
    { id: 'm13', name: '甜不辣', price: 30, stock: 38, cost: 12, low: 15, desc: 'Q 彈口感，麻辣湯底也合拍' },
    { id: 'c1', name: '招牌雙人拼盤', price: 380, desc: '兩人份熱銷組合，已自動拆入備料單', parts: [['招牌綜合滷味', 1], ['滷雞翅', 1], ['滷豆干', 2], ['茶葉蛋', 2]] },
    { id: 'c2', name: '麻辣過癮組', price: 320, desc: '麻辣系一次補齊，適合重口味團購', parts: [['麻辣鴨血', 2], ['滷海帶', 2], ['甜不辣', 1]] }
  ],
  vacuum: [
    { id: 'v1', name: '真空滷牛腱', price: 240, stock: 18, cost: 130, low: 8, desc: '真空包裝，冷藏保存更方便' },
    { id: 'v2', name: '真空滷大腸', price: 200, stock: 12, cost: 105, low: 8, desc: '退冰加熱即可上桌' },
    { id: 'v3', name: '真空麻辣鴨血', price: 140, stock: 3, cost: 70, low: 8, desc: '麻辣湯汁真空封存，適合囤貨' },
    { id: 'v4', name: '真空豆干(6入)', price: 80, stock: 24, cost: 38, low: 10, desc: '六入小包裝，辦公室分食方便' },
    { id: 'c3', name: '真空下酒精選組', price: 450, desc: '真空牛腱、大腸與豆干一次備齊', parts: [['真空滷牛腱', 1], ['真空滷大腸', 1], ['真空豆干(6入)', 1]] }
  ]
}

export const productTypes = [
  { key: 'normal', label: '一般' },
  { key: 'vacuum', label: '真空' }
]
