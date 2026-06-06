import html2canvas from 'html2canvas'
import { wrapPage } from '../print/legacyTemplates.js'

export function buildNasBaseUrl(config) {
  const proto = config.proto || 'http'
  const host = String(config.host || '').trim()
  const port = String(config.port || '').trim()
  const rawPath = String(config.path || '/print').trim()
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const portPart = port ? `:${port}` : ''
  return `${proto}://${host}${portPart}${path}`
}

export async function testNasConnection(config) {
  const baseUrl = buildNasBaseUrl(config)
  const pingUrl = baseUrl.replace(/\/print$/, '/ping')
  const response = await fetch(pingUrl, { method: 'GET', mode: 'cors' })
  return {
    ok: response.ok,
    status: response.status,
    url: pingUrl
  }
}

export async function renderHtmlToImages(htmlPages, widthMm) {
  const pages = Array.isArray(htmlPages) ? htmlPages : [htmlPages]
  const images = []

  for (const pageHtml of pages) {
    const holder = document.createElement('div')
    holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${widthMm}mm;background:#fff;color:#111;z-index:-1`
    holder.innerHTML = wrapPage(pageHtml)
    document.body.appendChild(holder)

    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const target = holder.firstElementChild || holder
      target.style.width = `${widthMm}mm`
      target.style.display = 'flex'
      target.style.justifyContent = 'center'
      target.style.background = '#fff'
      target.style.color = '#111'

      const canvas = await html2canvas(target, {
        scale: 3,
        backgroundColor: '#fff',
        useCORS: true
      })
      binarizeCanvas(canvas)
      images.push(canvas.toDataURL('image/png'))
    } finally {
      document.body.removeChild(holder)
    }
  }

  return images
}

export function binarizeCanvas(canvas, threshold = 160) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = img.data

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const value = lum < threshold ? 0 : 255
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }

  ctx.putImageData(img, 0, 0)
  return canvas
}

export function createPrintPayload({ kind, queue, widthMm, heightMm, images }) {
  return {
    kind,
    queue,
    widthMm: Number(widthMm),
    heightMm: Number(heightMm),
    format: 'image',
    images,
    ts: Date.now()
  }
}

export async function sendNasPrint({ kind, queue, widthMm, heightMm, htmlPages, config }) {
  const images = await renderHtmlToImages(htmlPages, widthMm)
  const payload = createPrintPayload({ kind, queue, widthMm, heightMm, images })
  const response = await fetch(buildNasBaseUrl(config), {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  let body = null
  try {
    body = await response.json()
  } catch (_) {
    body = { ok: response.ok }
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    body
  }
}
