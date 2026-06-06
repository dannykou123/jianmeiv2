export function distanceBetween(a, b) {
  const lat = Number(a.lat) - Number(b.lat)
  const lng = Number(a.lng) - Number(b.lng)
  return Math.sqrt(lat * lat + lng * lng)
}

export function orderByNearest(origin, stops) {
  const remaining = [...stops]
  const output = []
  let current = origin

  while (remaining.length) {
    let bestIndex = 0
    let bestDistance = Infinity
    remaining.forEach((stop, index) => {
      const distance = distanceBetween(current, stop)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIndex = index
      }
    })
    const next = remaining.splice(bestIndex, 1)[0]
    output.push(next)
    current = next
  }

  return output
}

export function applyRouteOrder({ origin, stops, routeOrder = [] }) {
  if (!routeOrder.length) return orderByNearest(origin, stops)

  const byId = Object.fromEntries(stops.map((stop) => [stop.id, stop]))
  const ordered = routeOrder.map((id) => byId[id]).filter(Boolean)
  const rest = stops.filter((stop) => !routeOrder.includes(stop.id))
  return [...ordered, ...orderByNearest(origin, rest)]
}
