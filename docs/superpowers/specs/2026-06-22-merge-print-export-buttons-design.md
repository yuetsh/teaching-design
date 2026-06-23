# 合并「打印整册」与「导出 MD」按钮设计

## 背景

`WorkspaceToolbar.vue` 当前并排放置两个独立按钮，均在 `lessonCount === 0` 时禁用：

```vue
<button data-testid="print" :disabled="lessonCount === 0" @click="$emit('print')">打印整册</button>
<button data-testid="export" :disabled="lessonCount === 0" @click="$emit('export')">导出 MD</button>
```

此前已经把「批量生成」「生成一篇」合并为一个下拉菜单按钮（`GenerateMenuButton.vue`，2026-06-22 提交）。本次需求是用同样的交互模式合并「打印整册」「导出 MD」，并借此机会把两个下拉菜单共用的逻辑抽取成通用组件，避免重复。

## 交互

- 合并后的主按钮文案为「导出 ▾」。
- 点击主按钮只展开/收起下拉菜单，不直接触发任何操作。
- 下拉菜单包含「打印整册」「导出 MD」两项，点击任意一项后触发对应事件并收起菜单。
- 点击外部区域或按 `Escape` 收起菜单（与生成菜单一致）。
- 主按钮在 `lessonCount === 0` 时整体禁用（原生 `disabled`），此时无法展开菜单——与现有两个按钮各自禁用的行为等价。

## 组件设计

### 新增通用组件 `src/components/ToolbarMenuButton.vue`

把下拉菜单的通用逻辑（展开状态、点击外部关闭、Escape 关闭、disabled 处理）收进这一个组件，具体菜单项通过默认 slot 传入，slot 透出 `close` 方法供菜单项点击后调用：

```ts
defineProps<{
  label: string
  toggleTestid: string
  disabled?: boolean
}>()
```

行为：
- 内部 `open = ref(false)`；`toggle()` 切换 `open`（已经走过原生 `disabled` 拦截，无需在 JS 里再判断一次）。
- 根元素 `ref`，`onMounted` 注册 `document` 的 `click` 监听判断点击是否在组件外部，`onUnmounted` 移除；`keydown` 监听 `Escape` 关闭。
- 主按钮：`<button :data-testid="toggleTestid" :disabled="disabled" :aria-expanded="open" @click.stop="toggle">{{ label }}</button>`。
- 菜单：`<ul v-if="open" class="toolbar-menu-list" role="menu"><slot :close="close" /></ul>`——因为主按钮 disabled 时浏览器不会触发其 click，`open` 永远不会在 disabled 状态下变为 true，不需要在 `v-if` 里重复判断 `!disabled`。
- 根元素 class 由 `generate-menu` 改名为通用的 `toolbar-menu`。

### `GenerateMenuButton.vue` 改为薄封装

```vue
<ToolbarMenuButton label="生成教案 ▾" toggle-testid="generate-menu-toggle">
  <template #default="{ close }">
    <li role="menuitem">
      <button data-testid="batch-generate" @click="emit('batchGenerate'); close()">批量生成</button>
    </li>
    <li role="menuitem">
      <button data-testid="generate" @click="emit('generate'); close()">生成一篇</button>
    </li>
  </template>
</ToolbarMenuButton>
```

对外接口（`data-testid` 值、按钮文案、`generate` / `batchGenerate` 事件）完全不变，`WorkspaceToolbar.vue` 和 `WorkspaceView.vue` 不需要任何改动。

### 新增 `src/components/ExportMenuButton.vue`

```vue
<script setup lang="ts">
defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ print: []; export: [] }>()
</script>

<template>
  <ToolbarMenuButton label="导出 ▾" toggle-testid="export-menu-toggle" :disabled="disabled">
    <template #default="{ close }">
      <li role="menuitem">
        <button data-testid="print" @click="emit('print'); close()">打印整册</button>
      </li>
      <li role="menuitem">
        <button data-testid="export" @click="emit('export'); close()">导出 MD</button>
      </li>
    </template>
  </ToolbarMenuButton>
</template>
```

### `WorkspaceToolbar.vue` 改动

将原来的 `<button data-testid="print">` / `<button data-testid="export">` 替换为：

```vue
<ExportMenuButton :disabled="lessonCount === 0" @print="$emit('print')" @export="$emit('export')" />
```

`defineEmits` 块（`print`、`export` 等）和 `WorkspaceView.vue` 的监听逻辑不变。

### 样式 (`src/style.css`)

- 把现有 `.generate-menu` / `.generate-menu-list` / `.generate-menu-list button` 三条规则改名为通用的 `.toolbar-menu` / `.toolbar-menu-list` / `.toolbar-menu-list button`，两个下拉按钮共用，不重复定义。
- 移动端媒体查询里的 `.workspace-toolbar .generate-menu { flex: 0 0 auto; }` 同样改名为 `.workspace-toolbar .toolbar-menu { flex: 0 0 auto; }`。
- 不引入任何新的颜色/圆角取值，继续复用 `var(--line)`、`var(--radius-md)`、`var(--green-100)`、`var(--green-700)` 等既有变量。

## 测试改动

- 新增 `ToolbarMenuButton.test.ts`：覆盖默认收起、点击展开、点击菜单项后通过 slot 的 `close()` 收起、点击外部收起、`Escape` 收起、`disabled` 时主按钮不可点击（因此菜单永远不会展开）。
- `GenerateMenuButton.test.ts`：现有用例保持不变，唯一改动是把断言根元素 class 的那一行从 `div.generate-menu` 改成 `div.toolbar-menu`（实现细节变化，行为不变）。
- 新增 `ExportMenuButton.test.ts`：覆盖点击「打印整册」触发 `print` 并收起菜单、点击「导出 MD」触发 `export` 并收起菜单、`disabled` 为 `true` 时主按钮 `disabled` 属性存在。
- `WorkspaceToolbar.test.ts`：
  - `disables print, export and clear when there are no lessons` 用例改写——`lessonCount === 0` 时菜单项不在 DOM 里（菜单不会展开），改为断言 `export-menu-toggle` 的 `disabled` 属性存在，以及 `clear` 的 `disabled` 属性存在。
  - 如需要保留对菜单项可点击性的验证，新增一条用例：在 `lessonCount` 大于 0 时展开菜单点击 `print` / `export`，确认事件被触发。
- `WorkspaceView.test.ts`：第 207 行 `await wrapper.get('[data-testid="export"]').trigger('click')` 之前补一步 `await wrapper.get('[data-testid="export-menu-toggle"]').trigger('click')`。

## 范围说明

本次改动仅涉及 UI 层的按钮合并、通用下拉逻辑抽取，不涉及：
- 打印逻辑（`$emit('print')` 之后 `WorkspaceView.vue` 内部如何打印）或导出逻辑（`zipExporter` 相关代码）。
- 移动端窄屏样式的额外适配（沿用现有响应式规则，新按钮作为 flex item 自然换行）。
- 对 `GenerateMenuButton.vue` 公开接口或文案的任何改动。
