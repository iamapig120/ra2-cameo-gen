const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')

const source = readFileSync(require.resolve('../src/index.js'), 'utf8')
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end))
const safety = section('    let passState = false', '    const unitNameLines')
const saving = section('  let savingImage = false', '  const enabelButtons')
const redraw = section('  const enabelButtons', '  OutputAsPNG.onclick')

function setup(toy = {}) {
  const messages = []
  const warnings = []
  const timers = new Map()
  let nextTimer = 0
  const context = vm.createContext({
    bilitoy: toy,
    UnitName: { value: '测试单位' },
    defaultName: '缺失名称',
    console: { warn: (...args) => warnings.push(args), error() {} },
    openModal: (text) => messages.push(text),
    setTimeout: (fn, delay) => { timers.set(++nextTimer, { fn, delay }); return nextTimer },
    clearTimeout: (id) => timers.delete(id),
    Blob,
    fetch,
  })
  const check = () => vm.runInContext(`(async () => { ${safety}; return unitName })()`, context)
  return { context, messages, warnings, timers, check }
}

test('safety passes, rejects content, and skips empty names', async () => {
  let calls = 0
  const env = setup({ checkInputSafety: async () => { calls++; return { passed: true } } })
  assert.equal(await env.check(), '测试单位')
  env.context.bilitoy.checkInputSafety = async () => ({ passed: false })
  assert.equal(await env.check(), '缺失名称')
  assert.equal(env.messages.length, 1)
  env.context.UnitName.value = ''
  assert.equal(await env.check(), '缺失名称')
  assert.equal(calls, 1)
  assert.equal(env.timers.size, 0)
})

test('SDK rejection, synchronous throw, missing method or missing SDK fail open', async () => {
  for (const toy of [
    { checkInputSafety: async () => { throw new Error('x') } },
    { checkInputSafety: () => { throw new Error('x') } },
    {},
    undefined,
  ]) {
    const env = setup(toy)
    env.context.bilitoy = toy
    assert.equal(await env.check(), '测试单位')
    assert.equal(env.messages.length, 0)
    assert.equal(env.timers.size, 0)
  }
})

test('hung safety check times out after five seconds and ignores late results', async () => {
  let resolve
  const env = setup({ checkInputSafety: () => new Promise((done) => { resolve = done }) })
  const pending = env.check()
  const timer = [...env.timers.values()][0]
  assert.equal(timer.delay, 5000)
  timer.fn()
  assert.equal(await pending, '测试单位')
  assert.equal(env.warnings.length, 1)
  assert.equal(env.timers.size, 0)
  resolve({ passed: false })
  await Promise.resolve()
  assert.equal(env.messages.length, 0)
})

function setupRedraw(env, render) {
  let click
  const paints = []
  const button = { disabled: true, textContent: '绘制图像', addEventListener: (_, fn) => { click = fn } }
  Object.assign(env.context, {
    Redraw: button,
    getIconCanvas: render,
    ViewCanvas: { getContext: () => ({ clearRect: () => paints.push('clear'), drawImage: () => paints.push('draw') }) },
  })
  for (const name of ['OutputAsPNG', 'OutputAsPNG_HiRes', 'OutputAsSHP', 'OutputAsPCX', 'OutputAsPCX_FullColor']) {
    env.context[name] = { disabled: true }
  }
  vm.runInContext(redraw, env.context)
  return { button, paints, click: () => click() }
}

test('redraw respects font lock, prevents five rapid clicks, and enables exports only on success', async () => {
  const env = setup()
  let calls = 0
  let done
  const ui = setupRedraw(env, () => { calls++; return new Promise((resolve) => { done = resolve }) })
  await ui.click()
  assert.equal(calls, 0)
  ui.button.disabled = false
  const pending = ui.click()
  for (let i = 0; i < 4; i++) await ui.click()
  assert.equal(calls, 1)
  assert.equal(ui.button.textContent, '绘制中…')
  assert.deepEqual(ui.paints, [])
  done({})
  await pending
  assert.deepEqual(ui.paints, ['clear', 'draw'])
  assert.equal(ui.button.disabled, false)
  assert.equal(ui.button.textContent, '绘制图像')
  assert.equal(env.context.OutputAsPNG.disabled, false)
  assert.equal(env.context.OutputAsPCX_FullColor.disabled, false)
})

test('render failure preserves the preview, shows a modal, and unlocks redraw', async () => {
  const env = setup()
  const ui = setupRedraw(env, async () => { throw new Error('render failed') })
  ui.button.disabled = false
  await ui.click()
  assert.deepEqual(ui.paints, [])
  assert.equal(ui.button.disabled, false)
  assert.equal(env.context.OutputAsPNG.disabled, true)
  assert.match(env.messages[0], /生成失败/)
})

test('hung safety check keeps loading visible and then restores redraw', async () => {
  const env = setup({ checkInputSafety: () => new Promise(() => {}) })
  const ui = setupRedraw(env, () => env.check())
  ui.button.disabled = false
  const pending = ui.click()
  assert.equal(ui.button.disabled, true)
  assert.equal(ui.button.textContent, '绘制中…')
  ;[...env.timers.values()][0].fn()
  await pending
  assert.equal(ui.button.disabled, false)
  assert.deepEqual(ui.paints, ['clear', 'draw'])
})

test('PNG uses capability detection and downloads unchanged PNG bytes as a Blob', async () => {
  const bytes = Buffer.from('89504e470d0a1a0a', 'hex')
  const url = `data:image/png;base64,${bytes.toString('base64')}`
  for (const support of [true, false, 'reject', 'save-reject', 'missing']) {
    let saves = 0
    const toy = support === 'missing' ? {} : {
      isSupport: async (name) => { assert.equal(name, 'saveImageToAlbum'); if (support === 'reject') throw Error('unsupported'); return support !== false },
      saveImageToAlbum: async ({ base64Data }) => { saves++; assert.equal(base64Data, url); if (support === 'save-reject') throw Error('save failed') },
    }
    const env = setup(toy)
    const downloads = []
    Object.assign(env.context, {
      OutputAsPNG: { disabled: false }, OutputAsPNG_HiRes: { disabled: false },
      openDownloadDialog: (blob, name) => downloads.push({ blob, name }),
    })
    vm.runInContext(saving, env.context)
    env.context.url = url
    await vm.runInContext('saveImage(url)', env.context)
    assert.equal(saves, support === true || support === 'save-reject' ? 1 : 0)
    assert.equal(downloads.length, support === true ? 0 : 1)
    if (downloads.length) {
      assert.equal(downloads[0].name, 'cameo.png')
      assert.equal(downloads[0].blob.type, 'image/png')
      assert.deepEqual(Buffer.from(await downloads[0].blob.arrayBuffer()), bytes)
    }
    assert.equal(env.context.OutputAsPNG.disabled, false)
  }
})

test('SHP/PCX export errors show a modal and restore each button', async () => {
  const env = setup()
  for (const name of ['OutputAsSHP', 'OutputAsPCX', 'OutputAsPCX_FullColor']) {
    env.context[name] = { disabled: false, onclick: async () => { throw Error('export failed') } }
  }
  vm.runInContext(source.slice(source.indexOf('  for (const button of [OutputAsSHP'), source.lastIndexOf('})()')), env.context)
  for (const name of ['OutputAsSHP', 'OutputAsPCX', 'OutputAsPCX_FullColor']) {
    await env.context[name].onclick()
    assert.equal(env.context[name].disabled, false)
  }
  assert.equal(env.messages.length, 3)
})
