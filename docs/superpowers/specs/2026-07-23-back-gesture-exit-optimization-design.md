# 手机端边缘左滑/返回键交互优化设计文档

## 1. 概述
在 Android 移动端应用中，用户习惯通过屏幕边缘向内左划手势或点击系统返回键进行界面后退。目前在首页（或没有路由栈）时，用户执行返回手势会直接退出 App。

本设计旨在优化 Android 边缘划动/返回键的响应逻辑：
1. **优先关闭层级**：若有打开的弹窗（设置、已掌握列表等），优先关闭弹窗。
2. **后退页面**：若处于刷词模式（`isLearningMode === true`），划动返回首页。
3. **首页防误触退出**：在首页时，首次返回划动弹出 Toast 提示 **“再划一次退出应用”**，2 秒内再次划动才真正调用 `App.exitApp()` 退出软件。

---

## 2. 技术设计

### 2.1 依赖项
- 添加 `@capacitor/app` (`^7.0.0`) 依赖，用于监听 Android 原生 `backButton` 事件以及调用 `App.exitApp()`。

### 2.2 返回动作优先级决策树 (Priority Cascade)
当触发 `backButton` 事件（或 Web `popstate`）时，系统按以下流程处理：

```mermaid
graph TD
    A[触发返回手势 / BackButton] --> B{是否有打开的弹窗?}
    B -- 是 (showSettings / showMastered) --> C[关闭最上层弹窗]
    B -- 否 --> D{是否在刷词学习模式?}
    D -- 是 (isLearningMode) --> E[退出刷词模式, 返回首页 (quitLearning)]
    D -- 否 (在首页) --> F{距离上次划动 < 2秒?}
    F -- 是 --> G[调用 App.exitApp 退出应用]
    F -- 否 --> H[更新上次划动时间, 弹出 Toast 提示 "再划一次退出应用"]
```

### 2.3 Toast 提示设计
- **提示文案**：`再划一次退出应用`
- **显示时长**：2000 ms
- **视觉风格**：
  - 位置：`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100]`
  - 样式：暗色玻璃拟态 `bg-zinc-900/90 text-zinc-100 border border-white/10 backdrop-blur-md shadow-2xl px-4 py-2 rounded-full text-xs font-medium`
  - 动画：淡入并微微向上滑动进场

---

## 3. 文件修改范围
1. `package.json`: 添加 `@capacitor/app` 依赖。
2. `src/hooks/useBackHandler.ts` (新建): 封装 backButton 事件处理逻辑与 Toast 提示状态。
3. `src/components/Toast.tsx` (新建): 轻量玻璃拟态 Toast 提示组件。
4. `src/App.tsx`: 接入 `useBackHandler` 并渲染 Toast 组件。

---

## 4. 验证计划
1. 在网页开发环境 (`npm run dev`) 下验证组件编译与 Toast 渲染。
2. 运行 `npm run build` 确保 TypeScript 类型与 Vite 构建无误。
3. 运行 `npm run cap:sync` 同步至 Capacitor Android。
