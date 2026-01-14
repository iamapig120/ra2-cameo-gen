const { deltaE } = require('color-delta-e')
const BDF = require('bdfjs')
// const palette = require('image-palette')
const pica = require('pica')()
const RgbQuant = require('rgbquant')

;(async () => {
  const newImg = (src) => {
    const newImgObj = document.createElement('img')
    newImgObj.src = src
    return newImgObj
  }

  const ramCanvas = document.createElement('canvas')
  ramCanvas.width = 60
  ramCanvas.height = 48

  const ramCanvasForReady = document.createElement('canvas')
  ramCanvasForReady.width = 60
  ramCanvasForReady.height = 18

  const ramCanvasForText = document.createElement('canvas')
  ramCanvasForText.width = 1024
  ramCanvasForText.height = 48
  const ramCanvasForTextTop = document.createElement('canvas')
  ramCanvasForTextTop.width = 1024
  ramCanvasForTextTop.height = 48

  // document.body.appendChild(ramCanvasForTextTop)
  // ramCanvasForText.style.width = '160px'
  // ramCanvasForText.style.height = '160px'
  // ramCanvasForText.style.imageRendering = 'pixelated'

  const ramCanvasForOriginalColor = document.createElement('canvas')
  ramCanvasForOriginalColor.width = 60
  ramCanvasForOriginalColor.height = 48

  const resourcesIMG = {
    image: newImg('sample_img.png'),
    sp_sign: newImg('raiting_sign.png'),
    lighter: newImg('cameo_lighter.png'),
    outer: newImg('cameo_outer.png'),
    ready: newImg('ready_text.png'),
    user_select: undefined,
  }
  const defaultName = '补佳乐'
  const cameoFileName = 'cameo.act'

  const fontFileName_en = 'zpix-10.bdf'
  const fontFileName_ch = 'zpix-9.bdf'
  const fontFileName_ch_en = 'zpix-8.bdf'

  const rainbowSheet = {}
  /**
   * 接受一个act文件Blob，返回颜色表
   * @param {ArrayBuffer} buff 二进制文件
   */
  const parseACT = (buff) => {
    //创建一个空数组，用于存储颜色值
    let colors = []
    //以Hex方式读取文件
    const data = buff
    //遍历每个字节，每三个字节代表一个颜色值（RGB）
    //向色盘推送第一个颜色
    colors.push([data[0], data[1], data[2]])
    //起始值为3，用于跳过透明通道
    for (let i = 3; i < data.byteLength; i += 3) {
      //获取当前字节
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]
      //添加颜色到彩虹表中
      rainbowSheet[(r << 16) | (g << 8) | b] = i / 3
      //拼接成一个完整的颜色值，[r,g,b]
      let color = [r, g, b]
      //将颜色值添加到数组中
      colors.push(color)
    }
    return colors
  }
  /** @type {number[][]} */
  let actRGB

  /** @type {{ch:BDF.Font,en:BDF.Font,ch_en:BDF.Font,}} */
  let fonts = {
    ch: undefined,
    en: undefined,
    ch_en: undefined,
  }

  fetch(cameoFileName).then(async (res) => {
    const cameoBIN = await res.arrayBuffer()
    actRGB = parseACT(new Uint8Array(cameoBIN))
  })
  fetch(fontFileName_en).then(async (res) => {
    const bdfStr = await res.text()
    fonts.en = BDF.parse(bdfStr)
  })
  fetch(fontFileName_ch).then(async (res) => {
    const bdfStr = await res.text()
    fonts.ch = BDF.parse(bdfStr)
  })
  fetch(fontFileName_ch_en).then(async (res) => {
    const bdfStr = await res.text()
    fonts.ch_en = BDF.parse(bdfStr)
  })

  IconImage.addEventListener('change', async (e) => {
    if (IconImage.files.length) {
      const img = newImg(URL.createObjectURL(IconImage.files[0]))
      const canvas = document.createElement('canvas')
      canvas.width = 60
      canvas.height = 48
      img.onload = () => {
        URL.revokeObjectURL(img.src)
        pica.resize(img, canvas).then((canvas) => {
          resourcesIMG.user_select = canvas
        })
      }
      resourcesIMG.user_select = canvas
    }
  })

  const getIconCanvas = ({ isSHP = false, isRAW = false } = {}) => {
    const enableFullEnglishName = EnableFullEnglishName.checked
    const enableRatingSign = EnableRatingSign.checked
    const enableCameoColor = EnableCameoColor.checked
    const enableReadyText = EnableReadyText.checked

    const ctx = ramCanvas.getContext('2d', { willReadFrequently: true })

    /** @type {string} */
    const unitName = UnitName.value || defaultName
    const unitNameLines = unitName.split('\n')

    let textLineTotalWidth = new Array(unitNameLines.length).fill(0)

    const lineHeight = enableFullEnglishName ? 6 : 9

    const textCtx = ramCanvasForText.getContext('2d', {
      willReadFrequently: true,
    })
    const textCtxTop = ramCanvasForTextTop.getContext('2d', {
      willReadFrequently: true,
    })

    textCtx.clearRect(0, 0, 1024, 48)
    // textCtx.font = '8px zpix'
    // textCtx.fillStyle = '#000000'

    // 逐行绘制文字
    unitNameLines.forEach((line, lineIndex) => {
      Array.prototype.forEach.call(line, (unitChar, index) => {
        textCtx.fillStyle = '#000000'
        // textCtx.clearRect(0, 0, 8, 8)
        // textCtx.fillText(unitChar, 0, 7)
        const unicode = unitChar.charCodeAt(0)
        /** @type {BDF.Font} */
        let font
        if (enableFullEnglishName) {
          font = fonts.en
        } else if (unicode <= 0x80) {
          font = fonts.ch_en
        } else {
          font = fonts.ch
        }

        const bitmap = BDF.draw(font, unitChar)
        const width = bitmap.width
        const height = bitmap.height
        // console.log(bitmap)

        const textImgData = textCtx.createImageData(10, 10)
        for (let y = 0; y < height; y++) {
          const row = bitmap[y]
          for (let x = 0; x < width; x++) {
            const pix = row[x]
            textImgData.data[(y * 10 + x) * 4] = 0
            textImgData.data[(y * 10 + x) * 4 + 1] = 0
            textImgData.data[(y * 10 + x) * 4 + 2] = 0
            if (pix == 1) {
              textImgData.data[(y * 10 + x) * 4 + 3] = 255
            } else {
              textImgData.data[(y * 10 + x) * 4 + 3] = 0
            }
          }
        }

        textCtx.putImageData(
          textImgData,
          textLineTotalWidth[lineIndex],
          lineIndex * lineHeight - (enableFullEnglishName ? 1 : 0)
        )

        textLineTotalWidth[lineIndex] += width

        if (index < line.length - 1) {
          if (enableFullEnglishName) {
          } else {
            if (unicode <= 0x80) {
              textLineTotalWidth[lineIndex] += 2
            } else {
              if (line.length == 2) {
                textLineTotalWidth[lineIndex] += 4
              } else {
                textLineTotalWidth[lineIndex] += 1
              }
            }
            if (line.length >= 6) {
              textLineTotalWidth[lineIndex] -= 1
            }
          }
        }
      })
    })

    textCtxTop.clearRect(0, 0, 1024, 48)
    const colorMap = enableFullEnglishName
      ? {
          0: '#FFFFFF',
          1: '#FFFFFF',
          2: '#FFFFFF',
          3: '#FFFFFF',
          4: '#dedede',
          5: '#d6d6d6',
          6: '#a5a5a5',
          7: '#a5a5a5',
        }
      : {
          0: '#FFFFFF',
          1: '#FFFFFF',
          2: '#FFFFFF',
          3: '#FFFFFF',
          4: '#f4f4f4',
          5: '#d4d4d4',
          6: '#acacac',
          7: '#a4a4a4',
        }
    for (
      let y = 0;
      y < Math.min(lineHeight * unitNameLines.length - 1, 48);
      y++
    ) {
      textCtxTop.fillStyle =
        colorMap[
          y -
            lineHeight * unitNameLines.length +
            lineHeight +
            (enableFullEnglishName ? 3 : 0)
        ] || colorMap[0]
      for (let x = 0; x < Math.max(...textLineTotalWidth); x++) {
        const [r, g, b, a] = textCtx.getImageData(x, y, 1, 1).data
        if (a === 255) {
          textCtxTop.fillRect(x, y, 1, 1)
        }
      }
    }

    // 最先画背景图
    ctx.drawImage(resourcesIMG.user_select || resourcesIMG.image, 0, 0, 60, 48)
    // 画文字底色
    ctx.fillStyle = 'rgba(0,0,0,0.60)'
    ctx.fillRect(
      0,
      48 - lineHeight * unitNameLines.length - 1,
      60,
      lineHeight * unitNameLines.length + 1
    )
    // 再画外框
    ctx.drawImage(resourcesIMG.lighter, 0, 0, 60, 48)
    // 绘制文字
    const startY = 48 - unitNameLines.length * lineHeight
    for (let i = 0; i < unitNameLines.length; i++) {
      // 画文字阴影
      ctx.drawImage(
        ramCanvasForText,
        0,
        i * lineHeight,
        1024,
        lineHeight,
        Math.ceil(30 - textLineTotalWidth[i] / 2) + 1,
        startY + i * lineHeight,
        1024,
        lineHeight
      )

      // 画文字渐变色
      ctx.drawImage(
        ramCanvasForTextTop,
        0,
        i * lineHeight,
        1024,
        lineHeight,
        Math.ceil(30 - textLineTotalWidth[i] / 2),
        startY + i * lineHeight,
        1024,
        lineHeight
      )
    }
    // 最后将透明通道补全
    ctx.drawImage(resourcesIMG.outer, 0, 0, 60, 48)

    if (enableRatingSign) {
      ctx.drawImage(resourcesIMG.sp_sign, 0, 0, 60, 48)
    }

    if (enableCameoColor || (isSHP && !isRAW)) {
      const imgData = ctx.getImageData(0, 0, 60, 48)
      /** [[r,g,b]] 外层为 60*48 px */
      const imgDataRGB = []
      for (let i = 0; i < imgData.data.length; i += 4) {
        // 获取当前字节
        let r = imgData.data[i]
        let g = imgData.data[i + 1]
        let b = imgData.data[i + 2]
        // 拼接成一个完整的颜色值，[r,g,b]
        let color = [r, g, b]
        // 将颜色值添加到数组中
        imgDataRGB.push(color)
      }
      const indexedMap = imgDataRGB.map(([r, g, b], index) => {
        // 四个角透明色区域返回透明色
        switch (index) {
          case 0:
          case 1:
          case 58:
          case 59:
          case 60:
          case 119:
          case 2760:
          case 2819:
          case 2820:
          case 2821:
          case 2878:
          case 2879:
            return 0
          default:
        }
        // 如果彩虹表已有值，取出
        if (rainbowSheet[(r << 16) | (g << 8) | b] !== undefined) {
          return rainbowSheet[(r << 16) | (g << 8) | b]
        }
        let minDeltaE = 101
        let acTindex = -1
        //初始值为1，屏蔽透明色
        for (let i = 1; i < 255; i++) {
          let res = deltaE(actRGB[i], [r, g, b], 'rgb')
          if (res < minDeltaE) {
            minDeltaE = res
            acTindex = i
          }
        }
        // 否则添加颜色到彩虹表中
        rainbowSheet[(r << 16) | (g << 8) | b] = acTindex
        return acTindex
      })
      for (let pixIndex = 0; pixIndex < indexedMap.length; pixIndex++) {
        const [r, g, b] = actRGB[indexedMap[pixIndex]]
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(pixIndex % 60, Math.floor(pixIndex / 60), 1, 1)
      }
      if (isSHP) {
        // 构建SHP文件

        const buff = new ArrayBuffer(0x08 + 0x18 + 0x3c * 0x30)
        const headerDataView = new DataView(buff, 0)

        headerDataView.setUint16(0x00, 0x0000, true) // Empty
        headerDataView.setUint16(0x02, 0x003c, true) // FullWidth
        headerDataView.setUint16(0x04, 0x0030, true) // FullHeight
        headerDataView.setUint16(0x06, 0x0001, true) // NrOfFrames

        const frameDataView = new DataView(buff, 0x08)

        frameDataView.setUint16(0x00, 0x0000, true) // FrameX
        frameDataView.setUint16(0x02, 0x0000, true) // FrameY
        frameDataView.setUint16(0x04, 0x003c, true) // FrameWidth
        frameDataView.setUint16(0x06, 0x0030, true) // FrameHeight
        frameDataView.setUint32(0x08, 0x01, true) // Flags
        frameDataView.setUint8(0x0c, 0x00) // FrameColor R
        frameDataView.setUint8(0x0d, 0x00) // FrameColor G
        frameDataView.setUint8(0x0e, 0x00) // FrameColor B
        frameDataView.setUint8(0x0f, 0x00) // FrameColor Empty
        frameDataView.setUint32(0x10, 0x00, true) // Reserved
        frameDataView.setUint32(0x14, 0x20, true) // DataOffset

        const indexDataView = new DataView(buff, 0x20)
        indexedMap.forEach((val, idx) => {
          indexDataView.setUint8(idx, val)
        })

        return new Blob([buff], { type: 'application/octet-stream' })
      }
    }

    if (isRAW) {
      return ramCanvas
    }

    if (enableReadyText) {
      const readyTextColor = ReadyTextColor.value
      const readyCanvasCtx = ramCanvasForReady.getContext('2d', {
        willReadFrequently: true,
      })
      readyCanvasCtx.drawImage(resourcesIMG.ready, 0, 0, 35, 18)

      const readyStartX = 13

      for (let y = 0; y < 18; y++) {
        for (let x = 0; x < 35; x++) {
          const [r, g, b, a] = readyCanvasCtx.getImageData(x, y, 1, 1).data
          if (r === 255) {
            ctx.fillStyle = readyTextColor
            ctx.fillRect(readyStartX + x, y, 1, 1)
          } else {
            ctx.fillStyle = 'rgba(0,0,0,0.75)'
            ctx.fillRect(readyStartX + x, y, 1, 1)
          }
        }
      }
    }

    return ramCanvas
  }

  /**
   * 通用的打开下载对话框方法，没有测试过具体兼容性
   * @param url 下载地址，也可以是一个blob对象，必选
   * @param saveName 保存文件名，可选
   */
  const openDownloadDialog = (url, saveName) => {
    if (typeof url == 'object' && url instanceof Blob) {
      url = URL.createObjectURL(url) // 创建blob地址
    }
    var aLink = document.createElement('a')
    aLink.href = url
    aLink.download = saveName || ''
    aLink.click()
  }

  const enabelButtons = () => {
    OutputAsPNG.disabled = false
    OutputAsPNG_HiRes.disabled = false
    OutputAsSHP.disabled = false
    OutputAsPCX.disabled = false
    OutputAsPCX_FullColor.disabled = false
  }

  Redraw.addEventListener("click", () => {
    /** @type {CanvasRenderingContext2D} */
    const ctxView = ViewCanvas.getContext('2d')
    ctxView.clearRect(0, 0, 60, 48)
    ctxView.drawImage(getIconCanvas(), 0, 0, 60, 48)
    enabelButtons()
  })

  OutputAsPNG.onclick = () => {
    const url = ViewCanvas.toDataURL('image/png')
    openDownloadDialog(url, 'cameo.png')
  }

  OutputAsPNG_HiRes.onclick = () => {
    const scale = 5
    const scaledCanvas = document.createElement('canvas')
    scaledCanvas.width = 60 * scale
    scaledCanvas.height = 48 * scale

    const scaledCtx = scaledCanvas.getContext('2d')
    scaledCtx.imageSmoothingEnabled = false
    scaledCtx.drawImage(ViewCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height)

    const url = scaledCanvas.toDataURL('image/png')
    openDownloadDialog(url, 'cameo.png')
  }

  OutputAsSHP.onclick = () => {
    const shpFile = getIconCanvas({
      isSHP: true,
    })

    openDownloadDialog(shpFile, 'cameo.shp')
  }

  OutputAsPCX.onclick = async () => {
    /** @type {HTMLCanvasElement} */
    const rawImg = getIconCanvas({
      isRAW: true,
    })
    const ctx = rawImg.getContext('2d', { willReadFrequently: true })

    ctx.fillStyle = '#000000'

    ctx.fillRect(0, 0, 2, 1)
    ctx.fillRect(0, 1, 1, 1)
    ctx.fillRect(58, 0, 2, 1)
    ctx.fillRect(59, 1, 1, 1)

    ctx.fillRect(0, 46, 1, 1)
    ctx.fillRect(0, 47, 2, 1)
    ctx.fillRect(59, 46, 1, 1)
    ctx.fillRect(58, 47, 2, 1)

    const paletteSettings = {
      colors: 256,
      minHueCols: 2880,
    }
    const quant = new RgbQuant(paletteSettings)
    quant.sample(rawImg)
    // const { colors } = palette(ctx.getImageData(0, 0, 60, 48), 254)
    const colors = quant.palette(true, true)
    const indexedMap = quant.reduce(rawImg, 2)

    //   0 #0000FF
    // 255 #FFFFFF

    // 构建PCX文件

    // 构建文件头
    const headerBuff = new ArrayBuffer(0x80)
    const headerDataView = new DataView(headerBuff, 0)

    headerDataView.setUint8(0x00, 0x0a) // PCX Format
    headerDataView.setUint8(0x01, 0x05) // 版本号
    headerDataView.setUint8(0x02, 0x01) // 启用 RLE压缩
    headerDataView.setUint8(0x03, 0x08) // 表示1px所需bit

    headerDataView.setUint16(0x04, 0x0000, true) // Xmin
    headerDataView.setUint16(0x06, 0x0000, true) // Ymin
    headerDataView.setUint16(0x08, 0x003b, true) // Xmax
    headerDataView.setUint16(0x0a, 0x002f, true) // Ymax

    headerDataView.setUint16(0x0c, 0x0048, true) // X 英寸每px
    headerDataView.setUint16(0x0e, 0x0048, true) // X 英寸每px

    for (let i = 0; i < 48; i++) {
      headerDataView.setInt8(0x10 + i, 0xc0) // 16 色调色板，置 C0
    }

    headerDataView.setInt8(0x40, 0x00) // 保留位
    headerDataView.setInt8(0x41, 0x01) // 色彩平面数
    headerDataView.setUint16(0x42, 0x003c, true) // 每行字节数
    headerDataView.setUint16(0x44, 0x0001, true) // 调色板解释
    headerDataView.setUint16(0x46, 0x0000, true) // 视频屏幕大小X
    headerDataView.setUint16(0x48, 0x0000, true) // 视频屏幕大小Y

    for (let i = 0; i < 54; i++) {
      headerDataView.setInt8(0x49 + i, 0x00) // 全空，补足128byte
    }

    // colors.push([0x00, 0x00, 0x00, 0xff]) // 插入纯黑色色盘
    // for (let index = colors.length; index < 256; index++) {
    //   colors.unshift([0xff, 0xff, 0xff, 0xff]) // 使用白色补齐256色色盘
    // }
    const pal = colors

    const imgData = ctx.getImageData(0, 0, 60, 48)
    /** [[r,g,b]] 外层为 60*48 px */
    const imgDataRGB = []
    for (let i = 0; i < imgData.data.length; i += 4) {
      // 获取当前字节
      let r = imgData.data[i]
      let g = imgData.data[i + 1]
      let b = imgData.data[i + 2]
      // 拼接成一个完整的颜色值，[r,g,b]
      let color = [r, g, b]
      // 将颜色值添加到数组中
      imgDataRGB.push(color)
    }
    // const indexedMap = imgDataRGB.map(([r, g, b]) => {
    //   let minDeltaE = 101
    //   let acTindex = -1
    //   for (let i = 0; i < 256; i++) {
    //     const [pr, pg, pb] = pal[i]
    //     let res = deltaE([pr, pg, pb], [r, g, b], 'rgb')
    //     if (res < minDeltaE) {
    //       minDeltaE = res
    //       acTindex = i
    //     }
    //   }
    //   return acTindex
    // })
    // indexedMap[0] = 255
    // indexedMap[1] = 255
    // indexedMap[58] = 255
    // indexedMap[59] = 255
    // indexedMap[60] = 255
    // indexedMap[119] = 255

    // indexedMap[2879 - 0] = 255
    // indexedMap[2879 - 1] = 255
    // indexedMap[2879 - 58] = 255
    // indexedMap[2879 - 59] = 255
    // indexedMap[2879 - 60] = 255
    // indexedMap[2879 - 119] = 255

    // 在预览界面重绘
    for (let pixIndex = 0; pixIndex < indexedMap.length; pixIndex++) {
      const [r, g, b] = pal[indexedMap[pixIndex]]
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(pixIndex % 60, Math.floor(pixIndex / 60), 1, 1)
    }
    const ctxView = ViewCanvas.getContext('2d')
    ctxView.clearRect(0, 0, 60, 48)
    ctxView.drawImage(rawImg, 0, 0)

    // RLE压缩算法实现
    const pcxMainRaw = new Array()
    const maxSameTimes_indexedMap = new Array(indexedMap.length)
    maxSameTimes_indexedMap[indexedMap.length - 1] = 0
    for (let i = indexedMap.length - 2; i > -1; i--) {
      if (indexedMap[i] != indexedMap[i + 1]) {
        maxSameTimes_indexedMap[i] = 0
        // 按行压缩，更差压缩率，更好兼容性
      } else if (i % 60 == 59) {
        maxSameTimes_indexedMap[i] = 0
      } else {
        maxSameTimes_indexedMap[i] = maxSameTimes_indexedMap[i + 1] + 1
      }
    }
    for (let i = 0; i < indexedMap.length; i++) {
      let sameTimes = maxSameTimes_indexedMap[i]
      let realValue = indexedMap[i]
      i += sameTimes
      if (sameTimes) {
        while (sameTimes) {
          if (sameTimes > 62) {
            pcxMainRaw.push(0xff, realValue)
            sameTimes -= 62
          } else {
            pcxMainRaw.push(0xc0 + sameTimes + 1, realValue)
            sameTimes = 0
          }
        }
      } else if (realValue >= 0xc0) {
        pcxMainRaw.push(0xc1, realValue)
      } else {
        pcxMainRaw.push(realValue)
      }
    }

    // 填充主体数据
    const pcxMainData = new Uint8Array(pcxMainRaw).buffer

    // 填充调色板
    const paletteBuff = new ArrayBuffer(0x100 * 3 + 1)
    const paletteFlagView = new DataView(paletteBuff, 0x00)
    paletteFlagView.setInt8(0x00, 0x0c)
    const paletteBuffView = new DataView(paletteBuff, 0x01)

    for (let index = 0; index < pal.length; index++) {
      const [r, g, b] = pal[index]
      paletteBuffView.setInt8(3 * index, r)
      paletteBuffView.setInt8(3 * index + 1, g)
      paletteBuffView.setInt8(3 * index + 2, b)
    }

    const pxcFile = new Blob([headerDataView, pcxMainData, paletteBuff], {
      type: 'image/pcx',
    })
    openDownloadDialog(pxcFile, 'cameo.pcx')
  }

  OutputAsPCX_FullColor.onclick = async () => {
    /** @type {HTMLCanvasElement} */
    const rawImg = getIconCanvas({
      isRAW: true,
    })
    const ctx = rawImg.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#000000'

    ctx.fillRect(0, 0, 2, 1)
    ctx.fillRect(0, 1, 1, 1)
    ctx.fillRect(58, 0, 2, 1)
    ctx.fillRect(59, 1, 1, 1)

    ctx.fillRect(0, 46, 1, 1)
    ctx.fillRect(0, 47, 2, 1)
    ctx.fillRect(59, 46, 1, 1)
    ctx.fillRect(58, 47, 2, 1)

    // 构建PCX文件

    // 构建文件头
    const headerBuff = new ArrayBuffer(0x80)
    const headerDataView = new DataView(headerBuff, 0)

    headerDataView.setUint8(0x00, 0x0a) // PCX Format
    headerDataView.setUint8(0x01, 0x05) // 版本号
    headerDataView.setUint8(0x02, 0x01) // 启用 RLE压缩
    headerDataView.setUint8(0x03, 0x08) // 表示1px所需bit

    headerDataView.setUint16(0x04, 0x0000, true) // Xmin
    headerDataView.setUint16(0x06, 0x0000, true) // Ymin
    headerDataView.setUint16(0x08, 0x003b, true) // Xmax
    headerDataView.setUint16(0x0a, 0x002f, true) // Ymax

    headerDataView.setUint16(0x0c, 0x0048, true) // X 英寸每px
    headerDataView.setUint16(0x0e, 0x0048, true) // X 英寸每px

    for (let i = 0; i < 48; i++) {
      headerDataView.setInt8(0x10 + i, 0xc0) // 16 色调色板，置 C0
    }

    headerDataView.setInt8(0x40, 0x00) // 保留位
    headerDataView.setInt8(0x41, 0x03) // 色彩平面数
    headerDataView.setUint16(0x42, 0x003c, true) // 每行字节数
    headerDataView.setUint16(0x44, 0x0001, true) // 调色板解释
    headerDataView.setUint16(0x46, 0x0000, true) // 视频屏幕大小X
    headerDataView.setUint16(0x48, 0x0000, true) // 视频屏幕大小Y

    for (let i = 0; i < 54; i++) {
      headerDataView.setInt8(0x49 + i, 0x00) // 全空，补足128byte
    }

    const rgbArray = []

    for (let i = 0; i < 48; i++) {
      const imgData = ctx.getImageData(0, i, 60, 1).data
      const rArray = [],
        gArray = [],
        bArray = []
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i]
        const g = imgData[i + 1]
        const b = imgData[i + 2]
        rArray.push(r)
        gArray.push(g)
        bArray.push(b)
      }
      rgbArray.push(...rArray, ...gArray, ...bArray)
    }

    // RLE压缩算法实现
    const pcxMainRaw = new Array()
    const maxSameTimes_indexedMap = new Array(rgbArray.length)
    maxSameTimes_indexedMap[rgbArray.length - 1] = 0
    for (let i = rgbArray.length - 2; i > -1; i--) {
      if (rgbArray[i] != rgbArray[i + 1]) {
        maxSameTimes_indexedMap[i] = 0
        // 按行压缩，更差压缩率，更好兼容性
      } else if (i % 180 == 179) {
        maxSameTimes_indexedMap[i] = 0
      } else {
        maxSameTimes_indexedMap[i] = maxSameTimes_indexedMap[i + 1] + 1
      }
    }
    for (let i = 0; i < rgbArray.length; i++) {
      let sameTimes = maxSameTimes_indexedMap[i]
      let realValue = rgbArray[i]
      i += sameTimes
      if (sameTimes) {
        while (sameTimes) {
          if (sameTimes > 62) {
            pcxMainRaw.push(0xff, realValue)
            sameTimes -= 62
          } else {
            pcxMainRaw.push(0xc0 + sameTimes + 1, realValue)
            sameTimes = 0
          }
        }
      } else if (realValue >= 0xc0) {
        pcxMainRaw.push(0xc1, realValue)
      } else {
        pcxMainRaw.push(realValue)
      }
    }

    // 填充主体数据
    const pcxMainData = new Uint8Array(pcxMainRaw).buffer

    const pxcFile = new Blob([headerDataView, pcxMainData], {
      type: 'image/pcx',
    })
    openDownloadDialog(pxcFile, 'cameo.pcx')
  }
})()
