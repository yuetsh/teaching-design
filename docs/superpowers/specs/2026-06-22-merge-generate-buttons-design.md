# 合并「批量生成」与「生成一篇」按钮设计

## 背景

`WorkspaceToolbar.vue` 当前并排放置两个独立按钮：

```vue
<button data-testid="batch-generate" @click="$emit('batchGenerate')">批量生成</button>
<button data-testid="generate" @click="$emit('generate')">生成一篇</button>
```

需求：把这两个按钮合并成一个按钮，点击后通过下拉菜单选择具体执行哪种生成方式。

## 交互

- 合并后的主按钮文案为「生成教案 ▾」。
- 点击主按钮**只**展开/收起下拉菜单，本身不直接触发任何生成动作。
- 下拉菜单包含两个选项：「生成一篇」「批量生成」。点击任意一项后：
  1. 触发对应事件（`generate` / `batchGenerate`）。
  2. 自动收起菜单。
- 点击组件外部区域、或按下 `Escape` 键，菜单自动收起。

## 组件设计

### 新增 `src/components/GenerateMenuButton.vue`

负责封装下拉菜单的全部状态与交互，对外接口与现状保持一致：

```ts
defineEmits<{
  generate: []
  batchGenerate: []
}>()
```

行为：
- 内部 `open = ref(false)` 控制展开状态。
- 根元素绑定 `ref`，`onMounted` 时在 `document` 上注册 `click` 监听，点击目标不在根元素内时关闭菜单；`onUnmounted` 时移除监听。
- 监听 `keydown` 的 `Escape` 关闭菜单。
- 菜单项按钮保留 `data-testid="generate"` 与 `data-testid="batch-generate"`，点击后 `emit` 对应事件并将 `open` 置为 `false`。
- 主按钮 `data-testid="generate-menu-toggle"`，点击切换 `open`，并设置 `aria-expanded` 反映状态；下拉 `<ul>` 设置 `role="menu"`，菜单项 `role="menuitem"`，提升可访问性。

### `WorkspaceToolbar.vue` 改动

将原来两个 `<button>` 替换为：

```vue
<GenerateMenuButton @generate="$emit('generate')" @batch-generate="$emit('batchGenerate')" />
```

`WorkspaceToolbar` 的 `defineEmits`、以及 `WorkspaceView.vue` 中对 `@generate` / `@batch-generate` 的监听逻辑保持不变——这是一次纯粹的局部封装，不影响上层的生成流程（`BatchGenerateDialog.vue`、`GenerateLessonDialog.vue` 均无需改动）。

### 样式 (`src/style.css`)

新增：
- `.generate-menu`：`position: relative; display: inline-flex;`，作为下拉容器的定位基准。
- `.generate-menu-list`：绝对定位在主按钮下方的面板，复用现有设计变量（`var(--line)`、`var(--radius-md)`、`var(--green-100)`、`var(--green-600)`），保持与其余 toolbar 按钮一致的视觉语言（边框、圆角、hover 高亮）。
- 菜单项按钮去除默认边框，改为列表内的 flat 按钮，hover 时使用 `var(--green-100)` 背景，与现有 `.workspace-toolbar button:hover` 视觉一致。

## 测试改动

- `WorkspaceToolbar.test.ts`：原先直接点击 `[data-testid="generate"]` 的用例，改为先点击 `[data-testid="generate-menu-toggle"]` 展开菜单，再点击目标菜单项。
- `WorkspaceView.test.ts`（第 95、131 行附近）：同理，先展开菜单再点击 `generate` / `batch-generate`。
- 新增 `GenerateMenuButton.test.ts`，覆盖：
  - 默认菜单收起（菜单项不在 DOM 中）。
  - 点击主按钮展开菜单。
  - 点击「生成一篇」触发 `generate` 事件并收起菜单。
  - 点击「批量生成」触发 `batchGenerate` 事件并收起菜单。
  - 点击组件外部区域后菜单收起。

## 范围说明

本次改动仅涉及 UI 层的按钮合并与交互封装，不涉及：
- 生成逻辑本身（`booksApi.generateOutline()`、`generateLessons()` 等）。
- `BatchGenerateDialog.vue` / `GenerateLessonDialog.vue` 内部实现。
- 移动端窄屏样式的额外适配（沿用现有 `.workspace-toolbar` 响应式规则，新按钮作为其中一个 flex item 自然换行）。
