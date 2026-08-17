# RA2 Cameo Generator / 红色警戒2图标生成器

一个用于生成《命令与征服：红色警戒2》单位图标的 Web 工具。

## 功能特性

- 🖼️ 支持上传自定义图片作为图标素材
- ✏️ 自定义单位名称（支持多行）
- 🔤 支持完整英文单位名称模式
- ⭐ 可选显示升级图示（军衔标志）
- 🎨 可选使用原版游戏色盘（ACT色盘）进行颜色映射
- ✅ 可选显示"就绪"文字，支持自定义颜色
- 📦 多种导出格式：
  - **PNG** — 标准 PNG 图片
  - **斗图（高清PNG）** — 5倍放大像素风格 PNG
  - **SHP** — 游戏使用的 SHP 格式（256色调色板）
  - **256色 PCX** — 256 色调色板 PCX 格式
  - **全彩 PCX** — 真彩色 PCX 格式

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run pack
```

## 技术栈

- **构建工具**: Webpack
- **图像处理**: [pica](https://github.com/nodeca/pica)（高质量图像缩放）
- **颜色量化**: [rgbquant](https://github.com/leeoniya/RgbQuant.js)
- **色差计算**: color-delta-e（CIE Delta E 色差算法）
- **位图字体**: [bdfjs](https://github.com/nicokant/bdfjs)（BDF 字体解析与渲染）

## 项目结构

```
ra2-cameo-gen/
├── public/          # 静态资源（HTML、图片、字体、色盘文件等）
├── hdimg/           # 高清素材
├── src/             # 源代码
│   └── index.js     # 主逻辑入口
├── webpack.config.js
└── package.json
```

## 使用说明

1. 打开页面后，点击弹窗中的"确定"按钮
2. 点击"选择文件"上传一张图片（建议使用 60×48 像素左右的素材）
3. 在文本框中输入单位名称（支持多行）
4. 根据需要勾选选项（英文名称、升级图示、原版色盘、就绪文字等）
5. 点击"绘制图像"预览效果
6. 选择合适的导出格式下载

## 免责声明

本工具仅供学习交流使用，不得用于商业用途。本程序是非营利性的粉丝项目，与 Electronic Arts Inc. 没有任何关联。所有权利均由其各自所有者持有。

## 致谢

- 程序：[手柄](https://www.bysb.net/)
- 界面：[极客谈](https://ra2cameo.geek-talk.cn)

## 许可证

本项目基于 GNU Affero General Public License v3.0 (AGPL-3.0) 开源。详见 [LICENSE](LICENSE) 文件。
