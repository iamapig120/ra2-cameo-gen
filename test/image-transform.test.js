const assert = require('node:assert/strict')
const { test } = require('node:test')
const { imagePlacement, drawSource, paintPCXCorners, cornerPixels } = require('../src/image-transform')

test('default keeps source pixels and centers the crop', () => {
  assert.deepEqual(imagePlacement({ width: 120, height: 48 }), [-30, 0, 120, 48])
  assert.deepEqual(imagePlacement({ width: 20, height: 10 }), [20, 19, 20, 10])
})

test('wide, tall, square and native images keep their aspect ratio in every mode', () => {
  for (const [width, height] of [[240, 48], [48, 240], [100, 100], [60, 48]]) {
    for (const mode of ['original', 'contain', 'cover']) {
      for (const zoom of [25, 100, 400]) {
        const [x, y, w, h] = imagePlacement({ width, height }, { mode, zoom })
        assert.ok(Math.abs(w / h - width / height) < 1e-10)
        assert.equal(x, (60 - w) / 2)
        assert.equal(y, (48 - h) / 2)
        if (zoom === 100 && mode === 'contain') assert.ok(w <= 60 && h <= 48)
        if (zoom === 100 && mode === 'cover') assert.ok(w >= 60 && h >= 48)
      }
    }
  }
})

test('crop controls reach both image edges with browser natural dimensions', () => {
  const image = { naturalWidth: 120, naturalHeight: 96, width: 1, height: 1 }
  assert.deepEqual(imagePlacement(image, { x: 0, y: 0 }).map((value) => value || 0), [0, 0, 120, 96])
  assert.deepEqual(imagePlacement(image, { x: 100, y: 100 }), [-60, -48, 120, 96])
})

test('legacy fill stretches every aspect ratio to the old 60 by 48 baseline', () => {
  for (const [width, height] of [[240, 48], [48, 240], [100, 100], [20, 10]]) {
    assert.deepEqual(imagePlacement({ width, height }, { mode: 'legacy' }), [0, 0, 60, 48])
    assert.deepEqual(imagePlacement({ width, height }, { mode: 'legacy', zoom: 200, x: 100, y: 0 }).map((value) => value || 0), [-60, 0, 120, 96])
  }
})

test('every source paint clears its whole canvas before alpha compositing', () => {
  const calls = []
  const ctx = {
    canvas: { width: 60, height: 48 },
    clearRect: (...args) => calls.push(['clear', ...args]),
    drawImage: (...args) => calls.push(['draw', ...args]),
  }
  const image = { width: 60, height: 48 }
  drawSource(ctx, image)
  drawSource(ctx, image)
  assert.deepEqual(calls.map((call) => call[0]), ['clear', 'draw', 'clear', 'draw'])
  assert.deepEqual(calls[0], ['clear', 0, 0, 60, 48])
})

test('both PCX encoders use the exact twelve-pixel magenta corner mask', () => {
  const pixels = []
  const ctx = { fillRect: (x, y, w, h) => { assert.equal(w * h, 1); pixels.push(y * 60 + x) } }
  paintPCXCorners(ctx)
  assert.equal(ctx.fillStyle, '#ff00ff')
  assert.deepEqual(pixels, cornerPixels)
  assert.equal(new Set(pixels).size, 12)
})
