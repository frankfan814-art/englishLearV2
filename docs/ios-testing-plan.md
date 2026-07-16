# iOS 测试与构建方案设计

> 日期：2026-07-16
> 状态：方案设计，待后续实施

## 1. 背景与目标

### 1.1 当前状态

| 项目 | 状态 |
|------|------|
| Android 平台 | ✅ 已配置，GitHub Actions 自动构建 APK |
| iOS 平台 | ❌ 未添加 |
| Apple Developer 账号 | ❌ 未注册 |
| Mac 硬件 | ❌ 无 |
| PWA 支持 | ⚠️ 部分支持（有 meta 标签，无 manifest 和 service worker） |

### 1.2 目标

设计一套完整的 iOS 测试与构建方案，包括：
- 本地开发调试
- CI/CD 自动化构建
- 分发方式选择

---

## 2. 方案概览

### 2.1 方案矩阵

| 方案 | 硬件要求 | Apple Developer | 成本 | 分发范围 | 推荐场景 |
|------|----------|-----------------|------|----------|----------|
| **PWA** | 无 | 不需要 | 免费 | 任何用户 | 快速验证、跨平台 |
| **TestFlight** | 云端 Mac | 需要 | 99$/年 + 云服务费 | 测试团队 (10000人) | 团队测试 |
| **Ad-hoc** | 云端 Mac | 需要 | 99$/年 + 云服务费 | 指定设备 (100台/年) | 小范围测试 |
| **App Store** | 云端 Mac | 需要 | 99$/年 + 云服务费 | 公开上架 | 正式发布 |

### 2.2 推荐路径

```
阶段1: PWA (立即可用，零成本)
    ↓
阶段2: TestFlight (团队测试，注册 Developer 后)
    ↓
阶段3: App Store (正式发布)
```

---

## 3. 方案一：PWA（Progressive Web App）

### 3.1 概述

将现有 Web 应用增强为 PWA，iPhone 用户通过 Safari "添加到主屏幕" 使用。

### 3.2 优点

- ✅ 零成本、零审核
- ✅ 无需 Apple Developer 账号
- ✅ 无需 Mac 硬件
- ✅ 跨平台（Android/iOS/桌面）
- ✅ 现有代码几乎无需修改

### 3.3 缺点

- ❌ 无后台播放能力
- ❌ 必须有网络连接（除非配置离线缓存）
- ❌ 体验略逊于原生 App
- ❌ 无法上架 App Store

### 3.4 实施步骤

#### 步骤 1：添加 PWA Manifest

```json
// public/manifest.webmanifest
{
  "name": "单词朗读",
  "short_name": "单词朗读",
  "description": "英语单词自动朗读学习应用",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 步骤 2：在 index.html 中引用

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#3b82f6" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="单词朗读" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

#### 步骤 3：添加 Service Worker（可选，用于离线支持）

```javascript
// public/sw.js
const CACHE_NAME = 'vocab-app-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

#### 步骤 4：注册 Service Worker

```typescript
// src/main.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
```

#### 步骤 5：生成图标

需要准备以下尺寸的图标：
- 192x192 (Android)
- 512x512 (Android)
- 180x180 (Apple touch icon)

可使用在线工具：https://realfavicongenerator.net/

### 3.5 用户使用方式

1. 在 iPhone Safari 中打开应用网址
2. 点击分享按钮 (方框箭头图标)
3. 选择 "添加到主屏幕"
4. 确认添加
5. 主屏幕会出现应用图标，点击即可使用

---

## 4. 方案二：iOS 原生应用（需要 Apple Developer 账号）

### 4.1 前置条件

| 条件 | 说明 |
|------|------|
| Apple Developer 账号 | 99$/年，https://developer.apple.com |
| macOS 环境 | 云端托管或本地 Mac |
| Xcode | 15.0+ |
| 证书和描述文件 | 在 Apple Developer 后台创建 |

### 4.2 云端 macOS 服务选项

| 服务 | 价格 | 特点 |
|------|------|------|
| **GitHub Actions (macOS runner)** | 免费 (公开仓库) / 0.08$/分钟 (私有仓库) | 最简单，无需额外配置 |
| **Codemagic** | 免费 (公开仓库) / 按需付费 | 专为 Flutter/Capacitor 优化 |
| **Bitrise** | 有免费额度 | CI/CD 专业服务 |
| **MacStadium** | 按月付费 | 专用 Mac 硬件 |

### 4.3 实施步骤

#### 步骤 1：注册 Apple Developer 账号

1. 访问 https://developer.apple.com
2. 使用 Apple ID 登录
3. 加入 Apple Developer Program（99$/年）
4. 完成支付和验证

#### 步骤 2：添加 iOS 平台

```bash
# 添加 iOS 平台
npx cap add ios

# 同步
npm run build
npx cap sync ios
```

#### 步骤 3：配置证书和描述文件

在 Apple Developer 后台创建：
1. **App ID**: `com.vocab.app`
2. **Development Certificate**: 用于开发测试
3. **Distribution Certificate**: 用于正式发布
4. **Provisioning Profile**: 开发/分发描述文件

#### 步骤 4：配置 GitHub Actions（使用 macOS runner）

```yaml
# .github/workflows/ios-build.yml
name: Build iOS IPA

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: macos-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build Web App
        run: npm run build

      - name: Sync Capacitor
        run: npx cap sync ios

      - name: Setup Xcode
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: latest-stable

      - name: Build iOS App
        run: |
          cd ios/App
          xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Release \
            -archivePath build/App.xcarchive \
            archive

      - name: Export IPA
        run: |
          cd ios/App
          xcodebuild -exportArchive \
            -archivePath build/App.xcarchive \
            -exportPath build/ipa \
            -exportOptionsPlist ExportOptions.plist
        env:
          # 需要配置 secrets
          # APPLE_CERTIFICATES: base64 编码的证书
          # APPLE_CERTIFICATES_PASSWORD: 证书密码
          # APPLE_PROVISIONING_PROFILE: 描述文件
          # APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_KEY_CONTENT: App Store Connect API

      - name: Upload IPA
        uses: actions/upload-artifact@v4
        with:
          name: app-ios
          path: ios/App/build/ipa/*.ipa
```

#### 步骤 5：配置证书（使用 GitHub Secrets）

需要在 GitHub 仓库设置中添加以下 Secrets：

```
APPLE_CERTIFICATES          # base64 编码的 .p12 证书文件
APPLE_CERTIFICATES_PASSWORD # 证书密码
APPLE_PROVISIONING_PROFILE  # base64 编码的 .mobileprovision 文件
APPLE_KEY_ID                # App Store Connect API Key ID
APPLE_ISSUER_ID             # App Store Connect Issuer ID
APPLE_KEY_CONTENT           # App Store Connect API Key (p8 文件内容)
```

### 4.4 分发方式

#### 4.4.1 TestFlight（推荐）

- 适合：团队测试、Beta 测试
- 人数：最多 10,000 测试人员
- 流程：
  1. 上传 IPA 到 App Store Connect
  2. 添加测试人员（邮箱邀请）
  3. 测试人员安装 TestFlight App
  4. 接受邀请后可安装测试版

#### 4.4.2 Ad-hoc

- 适合：小范围测试
- 人数：每年最多 100 台设备
- 流程：
  1. 收集测试设备 UDID
  2. 在 Apple Developer 后台注册设备
  3. 创建 Ad-hoc 描述文件
  4. 打包并分发给测试人员
  5. 测试人员通过 Apple Configurator 或第三方工具安装

#### 4.4.3 App Store

- 适合：正式发布
- 审核：通常 1-3 天
- 流程：
  1. 准备应用信息（截图、描述等）
  2. 提交审核
  3. 等待审核通过
  4. 上架发布

---

## 5. 方案对比与推荐

### 5.1 短期方案（立即实施）

**推荐：PWA**

| 项目 | 说明 |
|------|------|
| 实施时间 | 1-2 天 |
| 成本 | 免费 |
| 难度 | 低 |
| 用户体验 | 良好 |

iPhone 用户立即可用，无需等待。

### 5.2 中期方案（有需求后）

**推荐：TestFlight**

当有以下需求时考虑：
- 需要 10+ 人测试
- 需要更原生体验
- 准备上架 App Store

### 5.3 长期方案（正式发布）

**推荐：App Store**

当应用成熟、有足够用户量时考虑上架。

---

## 6. 实施检查清单

### 6.1 PWA 实施（可立即开始）

- [ ] 创建 `public/manifest.webmanifest`
- [ ] 更新 `index.html` 添加 PWA meta 标签
- [ ] 创建 `public/sw.js`（可选，离线支持）
- [ ] 在 `src/main.tsx` 注册 Service Worker
- [ ] 生成应用图标（192x192, 512x512, 180x180）
- [ ] 部署并测试
- [ ] 编写用户使用说明

### 6.2 iOS 原生应用（后续实施）

#### 准备阶段
- [ ] 注册 Apple Developer 账号（99$/年）
- [ ] 添加 iOS 平台（`npx cap add ios`）
- [ ] 测试 iOS 构建

#### 证书配置
- [ ] 创建 App ID (`com.vocab.app`)
- [ ] 创建开发证书
- [ ] 创建分发证书
- [ ] 创建描述文件

#### CI/CD 配置
- [ ] 创建 iOS 构建 workflow
- [ ] 配置 GitHub Secrets
- [ ] 测试自动化构建

#### 分发配置
- [ ] 配置 TestFlight（或 Ad-hoc）
- [ ] 邀请测试人员
- [ ] 收集反馈

---

## 7. 参考资料

### 7.1 官方文档

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Apple Developer Program](https://developer.apple.com/programs/)
- [TestFlight Guide](https://developer.apple.com/testflight/)
- [PWA Documentation](https://web.dev/progressive-web-apps/)

### 7.2 工具

- [Real Favicon Generator](https://realfavicongenerator.net/) - 生成各平台图标
- [App Store Connect](https://appstoreconnect.apple.com/) - 管理应用和测试
- [Fastlane](https://fastlane.tools/) - iOS 自动化工具

### 7.3 GitHub Actions 示例

- [cordova-action](https://github.com/marketplace/actions/cordova-action) - Cordova/Capacitor 构建
- [ios-build-action](https://github.com/marketplace/actions/ios-build) - iOS 构建

---

## 8. 总结

| 阶段 | 方案 | 时间 | 成本 | 推荐度 |
|------|------|------|------|--------|
| **立即** | PWA | 1-2 天 | 免费 | ⭐⭐⭐⭐⭐ |
| **后续** | TestFlight | 1-2 周 | 99$/年 + 云服务费 | ⭐⭐⭐⭐ |
| **正式** | App Store | 审核期 | 99$/年 | ⭐⭐⭐ |

**建议**：先实施 PWA 方案，让 iPhone 用户立即可以使用。待应用成熟、有明确 iOS 原生需求后，再投入 iOS 原生开发。
