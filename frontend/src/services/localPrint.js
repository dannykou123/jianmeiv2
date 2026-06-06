import { wrapPages } from '../print/legacyTemplates.js'

export function printHtmlPages({ kind, htmlPages, docSize }) {
  const styleId = 'vue-print-page-style'
  let style = document.getElementById(styleId)
  if (!style) {
    style = document.createElement('style')
    style.id = styleId
    document.head.appendChild(style)
  }
  style.textContent = `@page{size:${docSize.w}mm ${docSize.h}mm;margin:0;}`

  const printArea = document.getElementById('printArea')
  if (!printArea) throw new Error('找不到 #printArea')

  printArea.dataset.kind = kind
  printArea.dataset.widthMm = String(docSize.w)
  printArea.dataset.heightMm = String(docSize.h)
  printArea.style.width = `${docSize.w}mm`
  printArea.innerHTML = wrapPages(htmlPages)
  setTimeout(() => window.print(), 60)
}
