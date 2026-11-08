const assert = require('node:assert/strict')
const fs = require('node:fs')

// Run with an injected Playwright Page; no browser dependency is added to the application.
module.exports = async function checkBrowser(page, url, artifactDir) {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => new URL(route.request().url()).origin === new URL(url).origin ? route.continue() : route.abort())
  await page.addInitScript(() => {
    window.toy = {
      setContainerMode: async () => {},
      checkInputSafety: async () => ({ passed: true }),
      isSupport: async () => true,
      saveImageToAlbum: async ({ base64Data }) => { window.savedPNG = base64Data },
    }
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.addScriptTag({ path: require.resolve('pica') })
  await page.evaluate(() => { window.legacyPica = window.pica() })
  await page.evaluate(() => { overlay.style.display = modal.style.display = 'none' })
  await page.locator('#UnitName').fill('Alpha')
  const fixture = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 120; canvas.height = 96
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'rgba(240,20,80,0.4)'; ctx.fillRect(0, 0, 120, 96)
    ctx.fillStyle = 'rgba(20,200,100,0.5)'; ctx.fillRect(60, 0, 60, 96)
    return canvas.toDataURL().split(',')[1]
  })
  await page.locator('#IconImage').setInputFiles({ name: 'alpha.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64') })
  await page.waitForFunction(() => ImageStatus.textContent.startsWith('120 × 96'))
  assert.equal(await page.locator('#ImageMode').inputValue(), 'original')

  // Compare each crop preview to a direct aspect-preserving browser draw.
  for (const [width, height] of [[120, 96], [240, 48], [48, 240], [100, 100], [20, 10]]) {
    const base64 = await page.evaluate(([w, h]) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#f00'; ctx.fillRect(0, 0, w / 2, h)
      ctx.fillStyle = '#0f0'; ctx.fillRect(w / 2, 0, w / 2, h)
      return c.toDataURL().split(',')[1]
    }, [width, height])
    await page.locator('#IconImage').setInputFiles({ name: 'ratio.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })
    await page.waitForFunction(([w, h]) => ImageStatus.textContent.startsWith(w + ' × ' + h), [width, height])
    for (const mode of ['original', 'contain', 'cover']) {
      const equal = await page.evaluate(async ({ width, height, mode, base64 }) => {
        ImageMode.value = mode; ImageZoom.value = 150; ImageX.value = 20; ImageY.value = 80
        ImageZoom.dispatchEvent(new Event('input'))
        const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode()
        const scale = (mode === 'contain' ? Math.min(60 / width, 48 / height) : mode === 'cover' ? Math.max(60 / width, 48 / height) : 1) * 1.5
        const c = document.createElement('canvas'); c.width = 60; c.height = 48
        const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(image, (60 - width * scale) * .2, (48 - height * scale) * .8, width * scale, height * scale)
        return c.toDataURL() === CropCanvas.toDataURL() && OutputAsPNG.disabled
      }, { width, height, mode, base64 })
      assert.ok(equal, `crop preview ${width}x${height} ${mode}`)
    }
  }

  for (const [width, height] of [[240, 48], [48, 240], [100, 100], [60, 48], [20, 10]]) {
    for (const transparent of [false, true]) {
      const base64 = await page.evaluate(({ width, height, transparent }) => {
        const c = document.createElement('canvas'); c.width = width; c.height = height
        const ctx = c.getContext('2d'), pixels = ctx.createImageData(width, height)
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          pixels.data.set([(x * 17 + y * 7) % 256, (x * 5 + y * 19) % 256, (x ^ y) % 256,
            transparent ? (x < width / 3 ? 0 : x < width * 2 / 3 ? 96 : 192) : 255], i)
        }
        ctx.putImageData(pixels, 0, 0)
        return c.toDataURL().split(',')[1]
      }, { width, height, transparent })
      await page.locator('#IconImage').setInputFiles({ name: 'legacy.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') })
      await page.waitForFunction(([w, h]) => ImageStatus.textContent.startsWith(w + ' × ' + h), [width, height])
      const comparison = await page.evaluate(async (base64) => {
        ImageMode.value = 'legacy'; ImageZoom.value = 100; ImageX.value = ImageY.value = 50
        ImageMode.dispatchEvent(new Event('input'))
        const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode()
        const oldImport = document.createElement('canvas'); oldImport.width = 60; oldImport.height = 48
        await legacyPica.resize(image, oldImport)
        const oldDraw = document.createElement('canvas'); oldDraw.width = 60; oldDraw.height = 48
        const ctx = oldDraw.getContext('2d', { willReadFrequently: true }); ctx.drawImage(oldImport, 0, 0, 60, 48)
        const expected = ctx.getImageData(0, 0, 60, 48).data
        const actual = CropCanvas.getContext('2d').getImageData(0, 0, 60, 48).data
        const equal = expected.every((value, i) => value === actual[i])
        const differences = Array.from(expected, (value, i) => value === actual[i] ? null : { i, expected: value, actual: actual[i] }).filter(Boolean)
        const first = CropCanvas.toDataURL()
        ImageMode.dispatchEvent(new Event('input'))
        return { equal, differences: differences.slice(0, 12), differenceCount: differences.length, repeatEqual: first === CropCanvas.toDataURL() }
      }, base64)
      assert.ok(comparison.equal, `old Pica import pixels ${width}x${height} alpha=${transparent}: ${JSON.stringify(comparison)}`)
      assert.ok(comparison.repeatEqual, 'legacy preview clears alpha before every redraw')
    }
  }
  await page.locator('#ResetImage').click()
  assert.equal(await page.locator('#ImageMode').inputValue(), 'original')
  assert.equal(await page.locator('#ImageZoom').inputValue(), '100')
  assert.equal(await page.locator('#ImageZoom').getAttribute('min'), '25')

  await page.locator('#IconImage').setInputFiles({ name: 'alpha.png', mimeType: 'image/png', buffer: Buffer.from(fixture, 'base64') })
  await page.waitForFunction(() => ImageStatus.textContent.startsWith('120 × 96'))
  await page.evaluate(() => { ImageMode.value = 'legacy'; ImageZoom.value = 25; ImageZoom.dispatchEvent(new Event('input')) })
  async function redraw() {
    await page.locator('#Redraw').click()
    await page.waitForFunction(() => !Redraw.disabled && !OutputAsPNG.disabled)
    return page.locator('#ViewCanvas').evaluate((c) => Array.from(c.getContext('2d').getImageData(0, 0, 60, 48).data))
  }
  const first = await redraw()
  assert.deepEqual(await redraw(), first, 'repeated half-transparent composition has identical pixels')
  for (const ready of [true, false, true]) {
    await page.evaluate((checked) => { EnableReadyText.checked = checked }, ready)
    const pixels = await redraw()
    assert.deepEqual(await redraw(), pixels, 'ready overlay stays stable')
  }
  await page.evaluate(() => { EnableReadyText.checked = false })
  await redraw()

  const cornerPixels = [0, 1, 58, 59, 60, 119, 2760, 2819, 2820, 2821, 2878, 2879]
  for (const palette of [false, true]) {
    await page.evaluate((checked) => { EnableCameoColor.checked = checked }, palette)
    await redraw()
    for (const button of ['OutputAsPCX', 'OutputAsPCX_FullColor']) {
      const downloadPromise = page.waitForEvent('download')
      await page.locator('#' + button).click()
      const download = await downloadPromise
      const file = artifactDir + '/' + button + '-' + palette + '.pcx'
      await download.saveAs(file)
      const pcx = fs.readFileSync(file)
      assert.equal(pcx[0], 10)
      const planes = pcx[65]
      const stride = pcx.readUInt16LE(66)
      assert.equal(stride, 60)
      assert.equal(planes, button === 'OutputAsPCX' ? 1 : 3)
      const decoded = []
      let pos = 128
      for (let row = 0; row < 48; row++) {
        const scanline = []
        for (let plane = 0; plane < planes; plane++) {
          const bytes = []
          while (bytes.length < stride) {
            const lead = pcx[pos++]
            const count = lead >= 192 ? lead & 63 : 1
            const value = lead >= 192 ? pcx[pos++] : lead
            assert.ok(count && value !== undefined)
            assert.ok(bytes.length + count <= stride, 'RLE run stays within its plane')
            for (let n = 0; n < count; n++) bytes.push(value)
          }
          scanline.push(bytes)
        }
        for (let x = 0; x < 60; x++) decoded.push(planes === 1 ? scanline[0][x] : scanline.map((p) => p[x]))
      }
      if (planes === 1) {
        assert.equal(pcx[pos], 12, 'palette immediately follows the image')
        assert.equal(pos + 769, pcx.length)
        assert.deepEqual(Array.from(pcx.subarray(pos + 1, pos + 4)), [255, 0, 255])
        for (const index of cornerPixels) {
          assert.equal(decoded[index], 0, 'corner uses reserved index zero')
          const offset = pos + 1 + decoded[index] * 3
          assert.deepEqual(Array.from(pcx.subarray(offset, offset + 3)), [255, 0, 255])
        }
      } else {
        assert.equal(pos, pcx.length)
        for (const index of cornerPixels) assert.deepEqual(decoded[index], [255, 0, 255])
      }
    }
  }

  await redraw()
  const expected = await page.locator('#ViewCanvas').evaluate((c) => c.toDataURL())
  if (url.includes('/toy/')) {
    await page.locator('#OutputAsPNG').click()
    await page.waitForFunction(() => !!window.savedPNG)
    assert.equal(await page.evaluate(() => window.savedPNG), expected, 'Toy album receives the generated preview')
    await page.evaluate(() => { overlay.style.display = modal.style.display = 'none' })
  } else {
    const pending = page.waitForEvent('download')
    await page.locator('#OutputAsPNG').click()
    const download = await pending
    await download.saveAs(artifactDir + '/cameo.png')
    assert.equal(fs.readFileSync(artifactDir + '/cameo.png').toString('base64'), expected.split(',')[1])
  }
  let hires
  if (url.includes('/toy/')) {
    await page.evaluate(() => { window.savedPNG = undefined })
    await page.locator('#OutputAsPNG_HiRes').click()
    await page.waitForFunction(() => !!window.savedPNG)
    hires = await page.evaluate(() => window.savedPNG)
    await page.evaluate(() => { overlay.style.display = modal.style.display = 'none' })
  } else {
    const pending = page.waitForEvent('download')
    await page.locator('#OutputAsPNG_HiRes').click()
    const download = await pending
    await download.saveAs(artifactDir + '/cameo-hires.png')
    hires = 'data:image/png;base64,' + fs.readFileSync(artifactDir + '/cameo-hires.png').toString('base64')
  }
  assert.ok(await page.evaluate(async (url) => {
    const image = new Image(); image.src = url; await image.decode()
    const c = document.createElement('canvas'); c.width = 300; c.height = 240
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false
    ctx.drawImage(ViewCanvas, 0, 0, 300, 240)
    return image.width === 300 && image.height === 240 && c.toDataURL() === url
  }, hires), 'hires PNG is the unchanged preview scaled five times')
  const pendingSHP = page.waitForEvent('download')
  await page.locator('#OutputAsSHP').click()
  const shp = await pendingSHP
  await shp.saveAs(artifactDir + '/cameo.shp')
  const shpBytes = fs.readFileSync(artifactDir + '/cameo.shp')
  assert.equal(shpBytes.length, 2912)
  for (const index of cornerPixels) assert.equal(shpBytes[32 + index], 0)
  await page.screenshot({ path: artifactDir + '/screen.png' })
  if (url.includes('/toy/')) {
    await page.setViewportSize({ width: 400, height: 720 })
    await page.waitForFunction(() => document.querySelector('.image-transform').getBoundingClientRect().right <= innerWidth)
    const bounds = await page.locator('.image-transform').boundingBox()
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.y + bounds.height <= 720)
    await page.screenshot({ path: artifactDir + '/screen-mobile.png' })
  }
  assert.deepEqual(errors, [], 'no page runtime errors')
  return { cropCases: 15, legacyPixelCases: 10, defaultMode: 'original', minimumZoom: 25, repeatedAlpha: true, pcxDecoded: 4, png: true, hiresPNG: true, shp: true, pageErrors: errors }
}
