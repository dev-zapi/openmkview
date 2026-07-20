# 大纲（Outline）滚动性能调查报告

## 问题描述

用户反馈：markdown 渲染后，**鼠标滚轮滚动大纲面板本身**会随着使用时间增长而越来越卡顿；**刷新页面后立即恢复流畅**。

- 出问题的文档规模并不大（约 24KB / 640 行 / 47 个标题 / 1 个 mermaid 图 / 15 个代码块 / 无图片）
- 变卡的时间量级：不确定（分钟级到小时级均有可能）
- "刷新立即恢复"表明存在某种**页面内状态累积**（排除后端、排除浏览器级问题）

## 调查方法（可复现的测量回路）

搭建了 Playwright 无头测量回路，要点：

- `page.route` 拦截 `/api/files/content`，注入大文档（601 标题）或用户的真实文档
- `addInitScript` 插桩：IntersectionObserver / MutationObserver 构造与 disconnect 计数、`addEventListener`/`removeEventListener` 净值（并按 window/document/ detached 节点分类）、`PerformanceObserver('longtask')`、DOM 节点总数、`performance.memory` JS 堆
- 真实滚轮事件（`page.mouse.wheel`）作用于大纲面板，rAF 逐帧计时
- 多轮（20~60 轮，最长约 10 分钟）观察趋势

已跑场景（结果均为**平直，无累积**）：

| 场景 | 轮数 | 帧耗时 | DOM 节点 | 存活 IO/MO | 监听器 | JS 堆 |
|------|------|--------|----------|-----------|--------|-------|
| 601 标题文档，正文+大纲滚动 soak | 20+60 | 平 | 平 | 平 | 平 | 平 |
| 同上 + mermaid 图 | 15 | 平 | 平 | 平 | 平 | 平 |
| 30 次完整重渲染（主题切换） | 15 周期 | 平 | 平 | 平 | window/document 零增长* | 平 |
| 真实文档 + 真实滚轮滚大纲面板 | 25 | 全程 16.7ms | 平 | — | — | 平 |

\* 重渲染测试中监听器计数一度增长，按目标分类复查后确认全部挂在**已分离（detached）的 DOM 节点**上，可被 GC，不构成实际泄漏。但其来源暴露了下文缺陷 #3。

**结论：受控实验未能复现"越用越卡"。** DOM 节点、监听器、观察者、JS 堆四类常见累积源均已排除。剩余可能：合成器/GPU 侧状态、或小时级慢速增长。**下一步需要一次真实卡顿时的 Chrome DevTools Performance 录制（约 20 秒，录制时滚动大纲面板）来锁定真正的累积点。**

## 已确认存在的缺陷（按与症状的关联排序，建议修复 1~3）

### 1. 大纲面板被无条件平滑滚动，与用户滚轮输入冲突 【关联最高】

`frontend/src/components/OutlinePanel.tsx:20-28`

```ts
createEffect(() => {
  const activeId = props.activeHeadingId;
  ...
  activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
```

- 滚动正文时 scroll-spy 持续更新 `activeHeadingId`，大纲面板被**反复重启平滑滚动动画**
- 用户此时用滚轮滚大纲面板，程序动画与用户输入互相拉扯；实测将 behavior 改为 `auto` 时面板被"拽回"4 次（yank），smooth 时被动画掩盖但面板持续漂移
- 没有"用户正在手动滚动大纲"的抑制逻辑

**修复建议：**
- 仅当 active 项不在面板可视区内时才滚动（`block: 'nearest'` 部分覆盖，但建议显式判断）
- 用户最近 N 秒（如 1s）内滚轮滚过大纲面板时，跳过自动滚动（监听面板 `wheel` 事件打时间戳）
- 考虑将 `behavior` 改为 `'auto'`（瞬时），消除动画堆积感

### 2. `.outline-item` 的 `transition: all` 在滚动关键路径上引发布局动画

`frontend/src/index.css:1832`

```css
.outline-item {
  ...
  transition: all 0.15s ease;  /* all 包含 padding-left（布局属性） */
}
```

- `.active` 翻转会同时动画 `padding-left`（见 `:1856, :1863` 的 hover/active 样式），属于布局属性动画
- 滚动正文期间 active 高亮频繁切换，每次切换都是逐帧布局；大纲条目多时成本放大

**修复建议：** 将 `transition: all` 限定为合成器属性：

```css
transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
```

并去掉 hover/active 时的 `padding-left` 变化（或改为固定 padding + 视觉指示用 `border-left`/`box-shadow` 实现）。

### 3. `renderTimer` 竞态导致 `setupCodeBlocks()` 重复执行

`frontend/src/components/MarkdownView.tsx:425`

```ts
renderTimer = setTimeout(() => { ... setupCodeBlocks(); ... }, 0);
```

- 重新赋值前没有 `clearTimeout(renderTimer)`
- 快速连续重渲染（快速切换文件、连切主题）时，多个 timer 先后对**同一份最终 DOM** 重复执行 `setupCodeBlocks()`：
  - diagram 的 `pre` 被套两层 `wrapper`
  - 头部复制/切换/放大按钮重复创建
  - mermaid 重复渲染（每次 `mermaid.render` 数十 ms）
  - 内部链接重复绑定点击监听（即测量中监听器增长的来源）
- 会被下一次 innerHTML 替换清掉，属正确性 bug 而非无限泄漏，但每次都产生垃圾和浪费的 mermaid 渲染

**修复建议：** 在 `renderMarkdown()` 入口（或 `setTimeout` 赋值前）先 `clearTimeout(renderTimer)`。

### 4. scroll-spy 的 IntersectionObserver 每次渲染全量重建

`frontend/src/hooks/useScrollSpy.ts:24-73`

- `createEffect` 订阅了 `headings()`；每次 markdown 渲染都产生**新数组**（即使内容相同），导致 observer 全量销毁重建
- 属于无谓抖动，正常文档下成本可忽略，长文档 + 高频重渲染时放大

**修复建议（可选）：** 在 store 层对 headings 做内容相等缓存（相同则不更新引用），或在 `useScrollSpy` 内做 diff 后增量 observe/unobserve。

### 5. 大纲点击导航的锁定期短于 smooth scroll 时长

`frontend/src/hooks/useScrollSpy.ts:5` `LOCKOUT_MS = 600`

- 长文档点击大纲跳转时，smooth scroll 动画超过 600ms，锁定中途过期，spy 连续命中滚动路径上的中间标题，引发大纲面板连锁平滑滚动（叠加缺陷 #1 的效果）

**修复建议（可选）：** 锁定期改为监听 `scrollend` 事件（或按滚动距离动态计算时长）。

## 验证方法

1. 修复后重跑本报告"调查方法"中的测量回路（重点：真实文档 + 滚轮滚大纲面板场景），确认帧耗时稳定
2. 手工验证：
   - 滚动正文时大纲高亮跟随正常，active 项保持在面板可视区
   - 手动滚轮滚大纲面板后 1 秒内不被自动滚动打断
   - 快速连续切换 5 个含 mermaid 的文件，检查 diagram 无双层 wrapper、按钮无重复（DOM 检查 `.code-block-wrapper .code-block-wrapper` 应为 0 个）
3. 若修复后用户仍反馈随时间变卡：抓取卡顿时的 Chrome Performance 录制（DevTools → Performance → 录制约 20 秒，期间滚动大纲面板），重点看 Long Task 的调用栈和 Compositor 帧

## 附：调查中排除的假设

| 假设 | 排除依据 |
|------|----------|
| mermaid 渲染残留节点累积 | 含 mermaid 场景 15 轮 DOM 节点数恒定，`body > div` 无孤儿 |
| 事件监听器泄漏（window/document） | 按目标分类计数，10 次重渲染后 window/document 监听器数零增长 |
| IntersectionObserver / MutationObserver 泄漏 | 存活计数全程 = 1 |
| JS 堆内存增长 | 10 分钟 soak 堆内存平直（27~35MB 波动无趋势） |
| `html { scroll-behavior: smooth }` 污染滚动容器 | 实测 `.content-main` / `.outline-panel-content` 计算值均为 `auto`（该属性不继承） |
| headings 跨文件累积 | `fileStore.setHeadings` 为整体替换，非追加 |
