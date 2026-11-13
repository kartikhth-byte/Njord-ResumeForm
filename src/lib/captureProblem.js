const MAX_PIXELS = 2_800_000

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

async function captureDocument(document, html2canvas, warnings, depth = 0) {
  const win = document.defaultView
  const frames = Array.from(document.querySelectorAll('iframe'))
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
    backgroundColor: win.getComputedStyle(document.body).backgroundColor || '#ffffff',
    logging: false, useCORS: false, allowTaint: false, imageTimeout: 2500,
    ignoreElements: node => node.hasAttribute('data-report-ui') || ['OBJECT', 'EMBED', 'VIDEO'].includes(node.tagName),
    onclone: clone => {
      mask(clone)
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
    },
  })
}

export async function captureProblem() {
  const { default: html2canvas } = await import('html2canvas')
  const warnings = new Set()
  let timer
  const canvas = await Promise.race([
    captureDocument(document, html2canvas, warnings),
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
