const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { test } = require('node:test')
const vm = require('node:vm')

test('embedded palette decodes all bytes without the recent Uint8Array APIs', () => {
  const source = readFileSync(require.resolve('../src/index.js'), 'utf8')
  const palette = source.match(/const cameoBase64 =\s*'([^']+)'/)[1]
  const expression = source.match(/const actRGB = parseACT\(([^\n]+)\)/)[1]
  const context = vm.createContext({ atob, cameoBase64: palette })
  vm.runInContext('Uint8Array.fromBase64 = undefined; Uint8Array.fromHex = undefined; Uint8Array.prototype.toBase64 = undefined; Uint8Array.prototype.setFromBase64 = undefined; Uint8Array.prototype.toHex = undefined; Uint8Array.prototype.setFromHex = undefined', context)
  const bytes = vm.runInContext(expression, context)
  assert.equal(bytes.length, 768)
  assert.deepEqual(Buffer.from(bytes), Buffer.from(palette, 'base64'))
  assert.deepEqual(Buffer.from(bytes), readFileSync(require.resolve('../public/cameo.act')).subarray(0, 768))
})
