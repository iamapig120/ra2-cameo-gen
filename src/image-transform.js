const cornerPixels = [0, 1, 58, 59, 60, 119, 2760, 2819, 2820, 2821, 2878, 2879]

function imagePlacement(image, { mode = 'original', zoom = 100, x = 50, y = 50 } = {}) {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const fit = mode === 'contain' ? Math.min(60 / width, 48 / height)
    : mode === 'cover' ? Math.max(60 / width, 48 / height) : 1
  const scale = fit * zoom / 100
  const w = mode === 'legacy' ? 60 * zoom / 100 : width * scale
  const h = mode === 'legacy' ? 48 * zoom / 100 : height * scale
  return [(60 - w) * x / 100, (48 - h) * y / 100, w, h]
}

function drawSource(ctx, image, settings) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, ...imagePlacement(image, settings))
}

function paintPCXCorners(ctx) {
  ctx.fillStyle = '#ff00ff'
  for (const index of cornerPixels) ctx.fillRect(index % 60, Math.floor(index / 60), 1, 1)
}

module.exports = { imagePlacement, drawSource, paintPCXCorners, cornerPixels }
