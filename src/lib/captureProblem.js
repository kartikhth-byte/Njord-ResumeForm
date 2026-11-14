const MAX_PIXELS = 2_800_000

// html2canvas 1.4.1 measures font baselines in the importing document, even
// when rendering a clone/iframe. Tailwind's img { display:block } puts its
// hidden 1px probe on a new line and shifts/clips every captured text run.
// Target only that pinned library probe; never change real page image layout.
function protectFontMetrics(document) {
  const style = document.createElement('style')
  style.dataset.reportFontMetrics = ''
  style.textContent = 'body > div[style*="visibility: hidden"] > img[width="1"][height="1"][src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"] { display: inline !important; }'
  document.head.append(style)
  return () => style.remove()
}

function mask(document) {
  document.querySelectorAll('input[type="password"], [data-report-private]').forEach(node => {
    if ('value' in node) node.value = ''
    node.textContent = '[Hidden]'
    node.style.visibility = 'hidden'
  })
}

function visible(node, win) {
  const r = node.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < win.innerHeight && r.left < win.innerWidth
}

function colorResolver(document) {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const cache = new Map()
  return color => {
    if (!cache.has(color)) {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      cache.set(color, `rgba(${r},${g},${b},${a / 255})`)
    }
    return cache.get(color)
  }
}

// html2canvas 1.x cannot parse CSS Color 4 values used by the embedded app.
// Let the browser resolve these colors into sRGB, in the disposable clone only.
function normalizeColors(clone) {
  const resolveColor = colorResolver(clone)
  // Balanced functions also cover color-mix() containing nested color functions.
  function convert(value) {
    if (!/(?:oklch|oklab|lch|lab|color|color-mix)\(/.test(value)) return value
    let result = '', start = 0
    const pattern = /(?:oklch|oklab|lch|lab|color|color-mix)\(/g
    let match
    while ((match = pattern.exec(value))) {
      let end = pattern.lastIndex, depth = 1
      while (end < value.length && depth) { if (value[end] === '(') depth++; if (value[end] === ')') depth--; end++ }
      const color = value.slice(match.index, end)
      result += value.slice(start, match.index) + resolveColor(color)
      start = end; pattern.lastIndex = end
    }
    return result + value.slice(start)
  }
  const properties = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'text-decoration-color', '-webkit-text-stroke-color', 'box-shadow', 'text-shadow']
  for (const node of clone.querySelectorAll('*')) {
    if (!node.style || node.closest('[data-report-ui]')) continue
    const computed = clone.defaultView.getComputedStyle(node)
    for (const name of properties) {
      const value = computed.getPropertyValue(name), converted = convert(value)
      if (value !== converted) node.style.setProperty(name, converted, 'important')
    }
  }
}

async function captureDocument(document, html2canvas, warnings, depth = 0) {
  const win = document.defaultView
  const frames = Array.from(document.querySelectorAll('iframe'))
  const dialogs = Array.from(document.querySelectorAll('dialog')).filter(node => !node.closest('[data-report-ui], [data-html2canvas-ignore]')).map(node => ({
    modal: node.matches(':modal') && !node.closest('[data-report-ui]'),
    rect: node.getBoundingClientRect(),
  }))
  const images = new Map()
  for (const [index, frame] of frames.entries()) {
    if (!visible(frame, win)) continue
    try {
      const child = frame.contentDocument
      if (depth >= 2 || !child?.body || child.contentType !== 'text/html' || child.querySelector('embed[type="application/pdf"]')) throw new Error('Unavailable frame')
      images.set(index, (await captureDocument(child, html2canvas, warnings, depth + 1)).toDataURL('image/png'))
    } catch { warnings.add('Some embedded content could not be captured. You can upload a screenshot instead.') }
  }
  if ([...document.querySelectorAll('object, embed, video')].some(node => visible(node, win))) {
    warnings.add('PDF or video content may be missing. You can upload a screenshot instead.')
  }
  return html2canvas(document.body, {
    width: win.innerWidth, height: win.innerHeight, x: win.scrollX, y: win.scrollY,
    windowWidth: win.innerWidth, windowHeight: win.innerHeight,
    scale: Math.min(win.devicePixelRatio || 1, 1.5, Math.sqrt(MAX_PIXELS / (win.innerWidth * win.innerHeight))),
    // html2canvas parses the background override separately from cloned styles.
    backgroundColor: colorResolver(document)(win.getComputedStyle(document.body).backgroundColor),
    logging: false, useCORS: false, allowTaint: false, imageTimeout: 2500,
    ignoreElements: node => node.hasAttribute('data-report-ui') || ['OBJECT', 'EMBED', 'VIDEO'].includes(node.tagName),
    onclone: clone => {
      mask(clone)
      // Cloning does not retain the browser's top layer. Explicitly paint open
      // app dialogs above normal stacking contexts using their live geometry.
      clone.querySelectorAll('dialog').forEach((node, index) => {
        const source = dialogs[index]
        if (!source?.modal) return
        Object.assign(node.style, { position: 'fixed', display: 'block', margin: '0',
          inset: 'auto', left: `${source.rect.left}px`, top: `${source.rect.top}px`,
          width: `${source.rect.width}px`, height: `${source.rect.height}px`,
          maxWidth: 'none', maxHeight: 'none', boxSizing: 'border-box', zIndex: `${2147480000 + index}` })
      })
      clone.querySelectorAll('iframe').forEach((frame, index) => {
        const replacement = clone.createElement(images.has(index) ? 'img' : 'div')
        replacement.style.cssText = frame.style.cssText
        replacement.className = frame.className
        replacement.style.width = `${frames[index]?.getBoundingClientRect().width || 0}px`
        replacement.style.height = `${frames[index]?.getBoundingClientRect().height || 0}px`
        replacement.style.border = '0'
        if (images.has(index)) replacement.src = images.get(index)
        else { replacement.textContent = 'Embedded content not captured'; replacement.style.background = '#555'; replacement.style.color = '#fff' }
        frame.replaceWith(replacement)
      })
      normalizeColors(clone)
    },
  })
}

export async function captureProblem() {
  const { default: html2canvas } = await import('html2canvas')
  const warnings = new Set()
  const restoreMetrics = protectFontMetrics(document)
  // A timeout returns control to the user but cannot cancel html2canvas.
  // Keep the probe correction until the underlying render settles.
  const rendering = captureDocument(document, html2canvas, warnings).finally(restoreMetrics)
  let timer
  const canvas = await Promise.race([
    rendering,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Capture timed out')), 12000) }),
  ]).finally(() => clearTimeout(timer))
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Capture unavailable. Upload a screenshot instead.')
  return { blob, warnings: [...warnings] }
}

export async function normalizeScreenshot(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a PNG, JPEG or WebP screenshot under 5 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob || blob.size > 5 * 1024 * 1024) throw new Error('Screenshot is too large. Crop it and try again.')
    return blob
  } finally { bitmap.close() }
}
