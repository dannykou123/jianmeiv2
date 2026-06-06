export const demoOrders = [
  {
    id: 'O20260604-001',
    company: '明德科技',
    address: '台北市大安區忠孝東路四段 1 號',
    date: '2026-06-05',
    time: '12:00',
    status: 'accepted',
    members: [
      {
        id: 'M001',
        name: 'Danny',
        department: '產品部',
        phone: '0912-000-001',
        note: '不要太辣',
        items: [['招牌綜合滷味', 1, 180], ['茶葉蛋', 2, 15]]
      },
      {
        id: 'M002',
        name: 'Amy',
        department: '設計部',
        phone: '0912-000-002',
        note: '',
        items: [['麻辣鴨血', 1, 120], ['滷豆干', 1, 40]]
      }
    ]
  },
  {
    id: 'O20260604-002',
    company: '青山工作室',
    address: '台北市信義區松仁路 100 號',
    date: '2026-06-06',
    time: '17:30',
    status: 'pending',
    members: [
      {
        id: 'M003',
        name: 'Chris',
        department: '營運',
        phone: '0912-000-003',
        note: '分開包',
        items: [['真空滷牛腱', 1, 240], ['真空豆干(6入)', 2, 80]]
      }
    ]
  }
]

export const demoTeams = [
  {
    id: 'T20260604',
    name: '週五午餐團',
    company: '明德科技',
    open: true,
    paused: false,
    dueDate: '2026-06-05',
    organizer: 'Danny'
  }
]

export const contacts = [
  { id: 'C001', type: 'company', company: '明德科技', name: 'Danny', phone: '0912-000-001', address: '台北市大安區忠孝東路四段 1 號', fav: '招牌綜合滷味、茶葉蛋' },
  { id: 'C002', type: 'company', company: '青山工作室', name: 'Chris', phone: '0912-000-003', address: '台北市信義區松仁路 100 號', fav: '真空滷牛腱、真空豆干(6入)' },
  { id: 'C003', type: 'company', company: '台北 101 觀景台辦公室', name: '王大明', phone: '0935-111-222', address: '台北市信義區信義路五段 7 號', fav: '招牌綜合滷味、茶葉蛋' },
  { id: 'C004', type: 'person', company: '', name: '陳柏宇', phone: '0911-888-999', address: '台北市南港區三重路 19-13 號', fav: '滷雞翅、滷豆干' },
  { id: 'C005', type: 'person', company: '', name: '李思妤', phone: '0988-222-333', address: '台北市信義區光復南路 133 號', fav: '麻辣鴨血、茶葉蛋' }
]
