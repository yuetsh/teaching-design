# Printable Teaching Design Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-only Vue application that imports multiple teaching-design Markdown files, edits them as an ordered A4 book, prints the full book, autosaves locally, and exports the edited Markdown files as a ZIP.

**Architecture:** Parse each Markdown file into a typed `TeachingDesign` model, keep the full book in a single composable state store, and render the selected cover or lesson through focused A4 editor components. Pure services handle parsing, Markdown generation, natural sorting, local persistence, and ZIP creation so they can be tested independently from the Vue UI.

**Tech Stack:** Vue 3, TypeScript, Vite 8, Vitest, Vue Test Utils, jsdom, markdown-it, JSZip, browser File/Print/Storage APIs

---

## Repository Note

The workspace contains an empty `.git` directory rather than valid Git metadata. Each task retains the intended commit command, but execution must first run:

```bash
rtk git rev-parse --is-inside-work-tree
```

If that command fails, skip only the commit step and continue implementation without initializing or rewriting repository history.

## File Map

### Domain and services

- `src/domain/teachingDesign.ts`: shared types, empty-value factories, schema version.
- `src/services/naturalSort.ts`: numeric-aware filename ordering.
- `src/services/markdownTable.ts`: Markdown table row scanner and table extraction helpers.
- `src/services/markdownParser.ts`: tolerant Markdown-to-model parser and warnings.
- `src/services/markdownWriter.ts`: canonical model-to-Markdown generator.
- `src/services/bookStorage.ts`: versioned local autosave and restore.
- `src/services/zipExporter.ts`: ZIP generation and browser download.
- `src/services/markdownRenderer.ts`: safe markdown-it instance for editable previews.

### State and UI

- `src/composables/useTeachingBook.ts`: book state, import, selection, reorder, edit, autosave, clear.
- `src/components/UploadDropzone.vue`: initial and append-file upload surface.
- `src/components/WorkspaceToolbar.vue`: upload, print, export, clear actions and save status.
- `src/components/LessonSidebar.vue`: cover entry, lesson selection, warnings, native drag reorder.
- `src/components/ImportConflictDialog.vue`: explicit replace/keep resolution for duplicate filenames.
- `src/components/RestoreDraftDialog.vue`: restore/discard choice for stored work.
- `src/components/EditableText.vue`: auto-growing plain-text field.
- `src/components/EditableMarkdown.vue`: click-to-edit Markdown field with rendered blur state.
- `src/components/CoverPage.vue`: editable course name and teacher cover.
- `src/components/TeachingDesignPage.vue`: editable information, process, board, and reflection tables.
- `src/components/A4Workspace.vue`: screen-only selected page.
- `src/components/PrintBook.vue`: print-only complete book.
- `src/App.vue`: application composition and modal coordination.

### Styling and tests

- `src/style.css`: application shell, upload screen, workspace, A4 visual styles, responsive rules.
- `src/print.css`: A4 print pages, page breaks, repeated headers, hidden controls.
- `src/test/setup.ts`: Vue/jsdom test setup.
- `src/services/*.test.ts`: unit and corpus regression tests.
- `src/components/*.test.ts`: interaction tests.
- `src/composables/useTeachingBook.test.ts`: state workflow tests.

## Task 1: Establish Test and Runtime Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Create: `src/test/setup.ts`
- Create: `src/domain/teachingDesign.ts`
- Test: `src/domain/teachingDesign.test.ts`

- [ ] **Step 1: Install runtime and test dependencies**

Run:

```bash
rtk npm install jszip@3.10.1 markdown-it@14.2.0
rtk npm install -D vitest@4.1.8 @vue/test-utils@2.4.11 jsdom@29.1.1 @types/markdown-it@14.1.2 @testing-library/jest-dom@6.9.1
```

Expected: `package.json` and `package-lock.json` include the named packages without dependency-resolution errors.

- [ ] **Step 2: Add test scripts and Vitest configuration**

Update `package.json` scripts to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

Update `vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
```

Add `"vitest/globals"` to `compilerOptions.types` in `tsconfig.app.json`.

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Write the failing domain factory test**

Create `src/domain/teachingDesign.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from './teachingDesign'

describe('createEmptyTeachingDesign', () => {
  it('creates editable defaults for missing lesson sections', () => {
    const design = createEmptyTeachingDesign('8.md')

    expect(design.originalFilename).toBe('8.md')
    expect(design.processSteps).toHaveLength(1)
    expect(design.boardDesign).toBe('')
    expect(design.warnings).toEqual([])
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run:

```bash
rtk npm test -- src/domain/teachingDesign.test.ts
```

Expected: FAIL because `src/domain/teachingDesign.ts` does not exist.

- [ ] **Step 5: Implement the domain types and factories**

Create `src/domain/teachingDesign.ts` with:

```ts
export const BOOK_SCHEMA_VERSION = 1

export type ParseWarningCode =
  | 'missing-title'
  | 'missing-basic-field'
  | 'missing-process'
  | 'invalid-process-table'
  | 'missing-board'
  | 'missing-reflection'
  | 'unclassified-content'

export interface ParseWarning {
  code: ParseWarningCode
  message: string
}

export interface TeachingStep {
  id: string
  name: string
  duration: string
  content: string
  teacherActivity: string
  studentActivity: string
  intention: string
}

export interface TeachingDesign {
  id: string
  originalFilename: string
  title: string
  topic: string
  duration: string
  knowledgeObjective: string
  skillObjective: string
  literacyObjective: string
  keyPoint: string
  difficultPoint: string
  resources: string
  processSteps: TeachingStep[]
  boardDesign: string
  effectiveness: string
  reflection: string
  additionalContent: string
  warnings: ParseWarning[]
}

export interface BookCover {
  courseName: string
  teacherName: string
}

export interface TeachingBook {
  schemaVersion: number
  cover: BookCover
  designs: TeachingDesign[]
  selectedId: 'cover' | string
  updatedAt: string
}

export function createTeachingStep(index = 1): TeachingStep {
  return {
    id: crypto.randomUUID(),
    name: `${index}. 教学环节`,
    duration: '',
    content: '',
    teacherActivity: '',
    studentActivity: '',
    intention: '',
  }
}

export function createEmptyTeachingDesign(filename: string): TeachingDesign {
  return {
    id: crypto.randomUUID(),
    originalFilename: filename,
    title: '',
    topic: '',
    duration: '',
    knowledgeObjective: '',
    skillObjective: '',
    literacyObjective: '',
    keyPoint: '',
    difficultPoint: '',
    resources: '',
    processSteps: [createTeachingStep()],
    boardDesign: '',
    effectiveness: '',
    reflection: '',
    additionalContent: '',
    warnings: [],
  }
}

export function createEmptyBook(): TeachingBook {
  return {
    schemaVersion: BOOK_SCHEMA_VERSION,
    cover: { courseName: '', teacherName: '' },
    designs: [],
    selectedId: 'cover',
    updatedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 6: Run tests and type checking**

Run:

```bash
rtk npm test -- src/domain/teachingDesign.test.ts
rtk npm run build
```

Expected: the domain test passes and the production build completes.

- [ ] **Step 7: Commit**

```bash
rtk git add package.json package-lock.json vite.config.ts tsconfig.app.json src/test/setup.ts src/domain
rtk git commit -m "test: establish teaching book domain"
```

## Task 2: Implement Natural Sorting and Markdown Table Scanning

**Files:**
- Create: `src/services/naturalSort.ts`
- Create: `src/services/naturalSort.test.ts`
- Create: `src/services/markdownTable.ts`
- Create: `src/services/markdownTable.test.ts`

- [ ] **Step 1: Write failing natural-sort tests**

Create `src/services/naturalSort.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sortFilesNaturally } from './naturalSort'

describe('sortFilesNaturally', () => {
  it('sorts numbered filenames numerically', () => {
    const files = [{ name: '10.md' }, { name: '2.md' }, { name: '1.md' }]

    expect(sortFilesNaturally(files).map((file) => file.name)).toEqual([
      '1.md',
      '2.md',
      '10.md',
    ])
  })

  it('does not mutate the supplied array', () => {
    const files = [{ name: '2.md' }, { name: '1.md' }]
    sortFilesNaturally(files)
    expect(files.map((file) => file.name)).toEqual(['2.md', '1.md'])
  })
})
```

- [ ] **Step 2: Write failing Markdown table tests**

Create `src/services/markdownTable.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { extractMarkdownTable, splitMarkdownRow } from './markdownTable'

describe('splitMarkdownRow', () => {
  it('preserves escaped pipes and inline code', () => {
    expect(splitMarkdownRow('| A | `x | y` | left \\| right |')).toEqual([
      'A',
      '`x | y`',
      'left \\| right',
    ])
  })
})

describe('extractMarkdownTable', () => {
  it('returns header and body rows after the requested start line', () => {
    const lines = [
      'intro',
      '| A | B |',
      '|:--|--:|',
      '| 1 | 2 |',
      '',
    ]

    expect(extractMarkdownTable(lines, 0)).toEqual({
      start: 1,
      end: 3,
      header: ['A', 'B'],
      rows: [['1', '2']],
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
rtk npm test -- src/services/naturalSort.test.ts src/services/markdownTable.test.ts
```

Expected: FAIL because both service modules are missing.

- [ ] **Step 4: Implement natural sorting**

Create `src/services/naturalSort.ts`:

```ts
const filenameCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
})

export function sortFilesNaturally<T extends { name: string }>(files: readonly T[]): T[] {
  return [...files].sort((left, right) => filenameCollator.compare(left.name, right.name))
}
```

- [ ] **Step 5: Implement the table scanner**

Create `src/services/markdownTable.ts` with a character scanner that ignores pipes inside backtick spans:

```ts
export interface MarkdownTable {
  start: number
  end: number
  header: string[]
  rows: string[][]
}

export function splitMarkdownRow(line: string): string[] {
  const source = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let current = ''
  let escaped = false
  let tickRun = 0

  for (const character of source) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (character === '\\') {
      current += character
      escaped = true
      continue
    }
    if (character === '`') {
      tickRun = tickRun === 0 ? 1 : 0
      current += character
      continue
    }
    if (character === '|' && tickRun === 0) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += character
  }

  cells.push(current.trim())
  return cells
}

function isDivider(line: string): boolean {
  const cells = splitMarkdownRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

export function extractMarkdownTable(
  lines: readonly string[],
  fromIndex: number,
): MarkdownTable | null {
  for (let index = fromIndex; index < lines.length - 1; index += 1) {
    if (!lines[index]?.trim().startsWith('|') || !isDivider(lines[index + 1] ?? '')) {
      continue
    }

    const header = splitMarkdownRow(lines[index] ?? '')
    const rows: string[][] = []
    let end = index + 1

    while (end + 1 < lines.length && lines[end + 1]?.trim().startsWith('|')) {
      end += 1
      rows.push(splitMarkdownRow(lines[end] ?? ''))
    }

    return { start: index, end, header, rows }
  }
  return null
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
rtk npm test -- src/services/naturalSort.test.ts src/services/markdownTable.test.ts
```

Expected: all sorting and table tests pass.

- [ ] **Step 7: Commit**

```bash
rtk git add src/services/naturalSort.ts src/services/naturalSort.test.ts src/services/markdownTable.ts src/services/markdownTable.test.ts
rtk git commit -m "feat: add natural sorting and markdown table scanning"
```

## Task 3: Build the Tolerant Teaching-Design Parser

**Files:**
- Create: `src/services/markdownParser.ts`
- Create: `src/services/markdownParser.test.ts`
- Create: `src/services/markdownParser.corpus.test.ts`
- Modify: `src/services/markdownTable.ts`

- [ ] **Step 1: Write failing parser tests for standard and variant input**

Create `src/services/markdownParser.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseTeachingDesign } from './markdownParser'

const standard = `# 个人主页——项目启动 教学设计

| **课题** | **个人主页——项目启动** |
|:---|:---|
| **课时** | 1课时（40分钟） |
| **教学目标** | **知识目标**：认识 HTML。<br>**技能目标**：创建页面。<br>**素养目标**：规范操作。 |
| **教学重难点** | **重点**：HTML。<br>**难点**：路径。 |
| **教学资源准备** | 浏览器。 |

## 教学过程

| 教学环节 | 教学内容 | 教师活动 | 学生活动 | 设计意图 |
|:---|:---|:---|:---|:---|
| **1. 导入**<br>（6分钟） | 展示案例。 | **情境创设**<br>提问。 | **观察思考**<br>回答。 | 建立目标。 |

## 板书设计

\`\`\`text
HTML → 浏览器
\`\`\`

## 教学成效与反思

| | |
|:---|:---|
| **教学成效** | 完成页面。 |
| **教学反思** | 加强路径讲解。 |
`

describe('parseTeachingDesign', () => {
  it('parses the complete teaching-design structure', () => {
    const design = parseTeachingDesign('1.md', standard)

    expect(design.topic).toBe('个人主页——项目启动')
    expect(design.knowledgeObjective).toBe('认识 HTML。')
    expect(design.processSteps[0]).toMatchObject({
      name: '1. 导入',
      duration: '6分钟',
      content: '展示案例。',
    })
    expect(design.boardDesign).toContain('HTML → 浏览器')
    expect(design.reflection).toBe('加强路径讲解。')
    expect(design.warnings).toEqual([])
  })

  it('accepts half-width punctuation and reports missing sections', () => {
    const markdown = standard
      .replaceAll('：', ':')
      .replace(/## 板书设计[\\s\\S]*?(?=## 教学成效与反思)/, '')

    const design = parseTeachingDesign('8.md', markdown)

    expect(design.knowledgeObjective).toBe('认识 HTML。')
    expect(design.boardDesign).toBe('')
    expect(design.warnings.some((warning) => warning.code === 'missing-board')).toBe(true)
  })
})
```

- [ ] **Step 2: Write the corpus regression test**

Create `src/services/markdownParser.corpus.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTeachingDesign } from './markdownParser'

const fixture = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8')

describe('teaching-design corpus', () => {
  it.each([
    ['data/Web/1.md', '个人主页——项目启动与开发环境搭建'],
    ['data/Python/1.md', '智能学生选课推荐系统——项目启动与Python开发环境搭建'],
    ['data/C#/8.md', '智能仓储管理系统——异常处理与调试确保系统稳定运行'],
    ['data/C#/19.md', '智能教室环境监测系统——数据可视化与历史曲线绘制'],
  ])('parses %s without losing its topic', (path, topic) => {
    const design = parseTeachingDesign(path.split('/').at(-1) ?? path, fixture(path))
    expect(design.topic).toBe(topic)
    expect(design.processSteps.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Run parser tests to verify they fail**

Run:

```bash
rtk npm test -- src/services/markdownParser.test.ts src/services/markdownParser.corpus.test.ts
```

Expected: FAIL because `parseTeachingDesign` is missing.

- [ ] **Step 4: Implement parser helpers**

Create `src/services/markdownParser.ts` with these public and private contracts:

```ts
import {
  createEmptyTeachingDesign,
  createTeachingStep,
  type ParseWarning,
  type TeachingDesign,
} from '../domain/teachingDesign'
import { extractMarkdownTable } from './markdownTable'

const BR = /<br\\s*\\/?>/gi
const LABEL_MARKS = /[*_`]/g

function cleanLabel(value: string): string {
  return value.replace(LABEL_MARKS, '').trim()
}

function stripOuterBold(value: string): string {
  return value.trim().replace(/^\\*\\*(.*?)\\*\\*$/s, '$1').trim()
}

function sectionIndex(lines: readonly string[], heading: string): number {
  return lines.findIndex((line) => new RegExp(`^##\\\\s+${heading}\\\\s*$`).test(line.trim()))
}

function splitLabelledValue(
  value: string,
  labels: readonly string[],
): Record<string, string> {
  const normalized = value.replace(BR, '\\n')
  const result: Record<string, string> = {}

  for (let index = 0; index < labels.length; index += 1) {
    const label = labels[index] ?? ''
    const nextLabel = labels[index + 1]
    const start = normalized.search(new RegExp(`(?:\\\\*\\\\*)?${label}(?:\\\\*\\\\*)?\\\\s*[：:]`))
    if (start < 0) continue
    const afterLabel = normalized.slice(start).replace(
      new RegExp(`^(?:\\\\*\\\\*)?${label}(?:\\\\*\\\\*)?\\\\s*[：:]\\\\s*`),
      '',
    )
    const end = nextLabel
      ? afterLabel.search(new RegExp(`(?:\\\\*\\\\*)?${nextLabel}(?:\\\\*\\\\*)?\\\\s*[：:]`))
      : -1
    result[label] = (end >= 0 ? afterLabel.slice(0, end) : afterLabel).trim()
  }

  return result
}
```

Implement `parseTeachingDesign(filename, markdown)` with this exact parsing flow:

1. normalizes CRLF to LF;
2. reads the first `#` heading and removes a trailing `教学设计`;
3. parses the first two-column table as basic information;
4. splits objective and key-point labels with full-width or half-width colons;
5. locates the teaching-process section and parses its five-column table;
6. extracts name and duration from the first process cell while preserving Markdown in other cells;
7. extracts board content between `## 板书设计` and the next level-two heading, removing only one outer fence;
8. parses the reflection table;
9. stores non-empty unclassified section text in `additionalContent`;
10. creates empty editable values and warnings for missing fields.

Use `createTeachingStep(index + 1)` for stable complete process objects, and replace the default placeholder step when at least one process row parses successfully.

- [ ] **Step 5: Run focused parser tests**

Run:

```bash
rtk npm test -- src/services/markdownParser.test.ts src/services/markdownParser.corpus.test.ts
```

Expected: all parser and selected corpus tests pass.

- [ ] **Step 6: Add all-file corpus assertions**

Extend `src/services/markdownParser.corpus.test.ts`:

```ts
import { readdirSync } from 'node:fs'

it('imports every numbered corpus file without throwing', () => {
  const directories = ['data/Web', 'data/Python', 'data/C#']
  const paths = directories.flatMap((directory) =>
    readdirSync(resolve(process.cwd(), directory))
      .filter((name) => /^\\d+\\.md$/.test(name))
      .map((name) => `${directory}/${name}`),
  )

  expect(paths).toHaveLength(55)
  for (const path of paths) {
    const design = parseTeachingDesign(path.split('/').at(-1) ?? path, fixture(path))
    expect(design.topic || design.title).not.toBe('')
    expect(design.originalFilename).toMatch(/\\.md$/)
  }
})
```

- [ ] **Step 7: Run full parser regression**

Run:

```bash
rtk npm test -- src/services/markdownParser
```

Expected: all 55 files import without exceptions.

- [ ] **Step 8: Commit**

```bash
rtk git add src/services/markdownParser.ts src/services/markdownParser.test.ts src/services/markdownParser.corpus.test.ts src/services/markdownTable.ts
rtk git commit -m "feat: parse teaching design markdown"
```

## Task 4: Generate Markdown and Export ZIP Files

**Files:**
- Create: `src/services/markdownWriter.ts`
- Create: `src/services/markdownWriter.test.ts`
- Create: `src/services/zipExporter.ts`
- Create: `src/services/zipExporter.test.ts`

- [ ] **Step 1: Write failing Markdown round-trip tests**

Create `src/services/markdownWriter.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTeachingDesign } from './markdownParser'
import { writeTeachingDesignMarkdown } from './markdownWriter'

describe('writeTeachingDesignMarkdown', () => {
  it('writes canonical sections that can be parsed again', () => {
    const source = readFileSync(resolve(process.cwd(), 'data/Web/1.md'), 'utf8')
    const parsed = parseTeachingDesign('1.md', source)
    const output = writeTeachingDesignMarkdown(parsed)
    const reparsed = parseTeachingDesign('1.md', output)

    expect(output).toContain('## 板书设计')
    expect(reparsed.topic).toBe(parsed.topic)
    expect(reparsed.processSteps).toHaveLength(parsed.processSteps.length)
    expect(reparsed.reflection).toBe(parsed.reflection)
  })

  it('escapes table-breaking pipes but preserves inline markdown', () => {
    const source = parseTeachingDesign('1.md', readFileSync(
      resolve(process.cwd(), 'data/Web/1.md'),
      'utf8',
    ))
    source.resources = '终端 | 浏览器与 `index.html`'

    expect(writeTeachingDesignMarkdown(source)).toContain(
      '终端 \\| 浏览器与 `index.html`',
    )
  })
})
```

- [ ] **Step 2: Write failing ZIP tests**

Create `src/services/zipExporter.test.ts`:

```ts
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from '../domain/teachingDesign'
import { createBookZip } from './zipExporter'

describe('createBookZip', () => {
  it('keeps original lesson filenames and adds an order manifest', async () => {
    const second = createEmptyTeachingDesign('2.md')
    second.topic = '第二课'
    const first = createEmptyTeachingDesign('1.md')
    first.topic = '第一课'

    const blob = await createBookZip([second, first])
    const zip = await JSZip.loadAsync(blob)

    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(['2.md', '1.md', '课程顺序.txt']),
    )
    await expect(zip.file('课程顺序.txt')?.async('text')).resolves.toContain('1. 2.md')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
rtk npm test -- src/services/markdownWriter.test.ts src/services/zipExporter.test.ts
```

Expected: FAIL because writer and ZIP services are missing.

- [ ] **Step 4: Implement canonical Markdown generation**

Create `src/services/markdownWriter.ts` with:

```ts
import type { TeachingDesign } from '../domain/teachingDesign'

function escapeCell(value: string): string {
  return value
    .replace(/\\r?\\n/g, '<br>')
    .replace(/(?<!\\\\)\\|/g, '\\\\|')
    .trim()
}

function objectiveCell(design: TeachingDesign): string {
  return [
    `**知识目标**：${design.knowledgeObjective}`,
    `**技能目标**：${design.skillObjective}`,
    `**素养目标**：${design.literacyObjective}`,
  ].join('<br>')
}

export function writeTeachingDesignMarkdown(design: TeachingDesign): string {
  const title = design.title || `${design.topic} 教学设计`
  const processRows = design.processSteps.map((step) =>
    `| ${escapeCell(`${step.name}<br>（${step.duration}）`)} | ${escapeCell(step.content)} | ${escapeCell(step.teacherActivity)} | ${escapeCell(step.studentActivity)} | ${escapeCell(step.intention)} |`,
  )

  const sections = [
    `# ${title}`,
    '',
    `| **课题** | **${escapeCell(design.topic)}** |`,
    '|:---|:---|',
    `| **课时** | ${escapeCell(design.duration)} |`,
    `| **教学目标** | ${escapeCell(objectiveCell(design))} |`,
    `| **教学重难点** | ${escapeCell(`**重点**：${design.keyPoint}<br>**难点**：${design.difficultPoint}`)} |`,
    `| **教学资源准备** | ${escapeCell(design.resources)} |`,
    '',
    '## 教学过程',
    '',
    '| 教学环节 | 教学内容 | 教师活动 | 学生活动 | 设计意图 |',
    '|:---|:---|:---|:---|:---|',
    ...processRows,
    '',
    '## 板书设计',
    '',
    '```text',
    design.boardDesign.trim(),
    '```',
    '',
    '## 教学成效与反思',
    '',
    '| | |',
    '|:---|:---|',
    `| **教学成效** | ${escapeCell(design.effectiveness)} |`,
    `| **教学反思** | ${escapeCell(design.reflection)} |`,
  ]

  if (design.additionalContent.trim()) {
    sections.push('', '## 附加内容', '', design.additionalContent.trim())
  }

  return `${sections.join('\\n')}\\n`
}
```

Adjust `escapeCell` so generated `<br>` tags are not double-escaped and empty durations do not render decorative parentheses.

- [ ] **Step 5: Implement ZIP creation and browser download**

Create `src/services/zipExporter.ts`:

```ts
import JSZip from 'jszip'
import type { TeachingDesign } from '../domain/teachingDesign'
import { writeTeachingDesignMarkdown } from './markdownWriter'

export async function createBookZip(designs: readonly TeachingDesign[]): Promise<Blob> {
  const zip = new JSZip()
  const usedNames = new Set<string>()
  const order: string[] = []

  designs.forEach((design, index) => {
    let filename = design.originalFilename || `${index + 1}.md`
    if (usedNames.has(filename)) {
      const stem = filename.replace(/\\.md$/i, '')
      filename = `${stem}-${index + 1}.md`
    }
    usedNames.add(filename)
    order.push(`${index + 1}. ${filename} — ${design.topic}`)
    zip.file(filename, writeTeachingDesignMarkdown(design))
  })

  zip.file('课程顺序.txt', `${order.join('\\n')}\\n`)
  return zip.generateAsync({ type: 'blob' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 6: Run writer and ZIP tests**

Run:

```bash
rtk npm test -- src/services/markdownWriter.test.ts src/services/zipExporter.test.ts
```

Expected: canonical round-trip and ZIP tests pass.

- [ ] **Step 7: Commit**

```bash
rtk git add src/services/markdownWriter.ts src/services/markdownWriter.test.ts src/services/zipExporter.ts src/services/zipExporter.test.ts
rtk git commit -m "feat: export teaching designs as markdown zip"
```

## Task 5: Add Versioned Autosave and Book State

**Files:**
- Create: `src/services/bookStorage.ts`
- Create: `src/services/bookStorage.test.ts`
- Create: `src/composables/useTeachingBook.ts`
- Create: `src/composables/useTeachingBook.test.ts`

- [ ] **Step 1: Write failing storage tests**

Create `src/services/bookStorage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyBook } from '../domain/teachingDesign'
import { clearStoredBook, loadStoredBook, saveBook } from './bookStorage'

describe('bookStorage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a versioned book', () => {
    const book = createEmptyBook()
    book.cover.courseName = 'Web 前端开发'

    expect(saveBook(book)).toEqual({ ok: true })
    expect(loadStoredBook()?.cover.courseName).toBe('Web 前端开发')
  })

  it('returns null for malformed storage', () => {
    localStorage.setItem('teaching-design-book', '{bad json')
    expect(loadStoredBook()).toBeNull()
  })

  it('clears saved work', () => {
    saveBook(createEmptyBook())
    clearStoredBook()
    expect(loadStoredBook()).toBeNull()
  })
})
```

- [ ] **Step 2: Write failing composable workflow tests**

Create `src/composables/useTeachingBook.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTeachingBook } from './useTeachingBook'

describe('useTeachingBook', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })

  it('imports files in natural order and selects the first lesson', async () => {
    const store = useTeachingBook()
    const files = [
      new File(['# 第十课 教学设计'], '10.md', { type: 'text/markdown' }),
      new File(['# 第二课 教学设计'], '2.md', { type: 'text/markdown' }),
    ]

    await store.importFiles(files, 'keep')

    expect(store.book.value.designs.map((design) => design.originalFilename)).toEqual([
      '2.md',
      '10.md',
    ])
    expect(store.book.value.selectedId).toBe(store.book.value.designs[0]?.id)
  })

  it('reorders lessons without changing their identities', async () => {
    const store = useTeachingBook()
    await store.importFiles([
      new File(['# One 教学设计'], '1.md'),
      new File(['# Two 教学设计'], '2.md'),
    ], 'keep')

    const ids = store.book.value.designs.map((design) => design.id)
    store.moveDesign(0, 1)

    expect(store.book.value.designs.map((design) => design.id)).toEqual(ids.reverse())
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
rtk npm test -- src/services/bookStorage.test.ts src/composables/useTeachingBook.test.ts
```

Expected: FAIL because storage and composable modules are missing.

- [ ] **Step 4: Implement versioned storage**

Create `src/services/bookStorage.ts`:

```ts
import {
  BOOK_SCHEMA_VERSION,
  type TeachingBook,
} from '../domain/teachingDesign'

const STORAGE_KEY = 'teaching-design-book'

export type SaveResult =
  | { ok: true }
  | { ok: false; message: string }

export function saveBook(book: TeachingBook): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(book))
    return { ok: true }
  } catch {
    return { ok: false, message: '浏览器存储空间不足，当前修改尚未暂存。' }
  }
}

export function loadStoredBook(): TeachingBook | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TeachingBook
    return parsed.schemaVersion === BOOK_SCHEMA_VERSION ? parsed : null
  } catch {
    return null
  }
}

export function clearStoredBook(): void {
  localStorage.removeItem(STORAGE_KEY)
}
```

- [ ] **Step 5: Implement the book composable**

Create `src/composables/useTeachingBook.ts` exposing:

```ts
export type DuplicateStrategy = 'replace' | 'keep'

export interface ImportResult {
  imported: number
  failed: Array<{ filename: string; message: string }>
  duplicates: string[]
}

export function useTeachingBook() {
  // refs: book, saveStatus, lastError, pendingDuplicateFiles
  // computed: selectedDesign, hasDesigns, warningCount
  // methods:
  // importFiles(files, strategy)
  // detectDuplicates(files)
  // selectPage(id)
  // moveDesign(from, to)
  // removeDesign(id)
  // updateCover(patch)
  // updateDesign(id, updater)
  // restore(book)
  // clearBook()
}
```

Implement the composable with these exact behaviors:

- read files with `await file.text()`;
- reject non-`.md` files individually;
- sort newly read files with `sortFilesNaturally`;
- call `parseTeachingDesign`;
- with `replace`, replace the existing design at the same list position;
- with `keep`, retain both records and let ZIP export disambiguate duplicate names;
- debounce `saveBook` by 300 ms after reactive book changes;
- expose save status as `'idle' | 'saving' | 'saved' | 'error'`;
- never discard successful imports when another file fails;
- update `updatedAt` on meaningful edits.

- [ ] **Step 6: Run storage and composable tests**

Run:

```bash
rtk npm test -- src/services/bookStorage.test.ts src/composables/useTeachingBook.test.ts
```

Expected: autosave service and core import/reorder workflows pass.

- [ ] **Step 7: Commit**

```bash
rtk git add src/services/bookStorage.ts src/services/bookStorage.test.ts src/composables/useTeachingBook.ts src/composables/useTeachingBook.test.ts
rtk git commit -m "feat: manage and autosave teaching books"
```

## Task 6: Create Editable A4 Page Components

**Files:**
- Create: `src/services/markdownRenderer.ts`
- Create: `src/components/EditableText.vue`
- Create: `src/components/EditableText.test.ts`
- Create: `src/components/EditableMarkdown.vue`
- Create: `src/components/EditableMarkdown.test.ts`
- Create: `src/components/CoverPage.vue`
- Create: `src/components/TeachingDesignPage.vue`
- Create: `src/components/TeachingDesignPage.test.ts`

- [ ] **Step 1: Write failing editable-field tests**

Create `src/components/EditableText.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EditableText from './EditableText.vue'

describe('EditableText', () => {
  it('emits updates while keeping an accessible label', async () => {
    const wrapper = mount(EditableText, {
      props: { modelValue: '旧内容', label: '课题' },
    })

    await wrapper.get('textarea').setValue('新内容')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['新内容'])
    expect(wrapper.get('textarea').attributes('aria-label')).toBe('课题')
  })
})
```

Create `src/components/EditableMarkdown.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EditableMarkdown from './EditableMarkdown.vue'

describe('EditableMarkdown', () => {
  it('renders markdown when blurred and edits raw markdown when activated', async () => {
    const wrapper = mount(EditableMarkdown, {
      props: { modelValue: '**重点**内容', label: '教师活动' },
    })

    expect(wrapper.get('.markdown-preview strong').text()).toBe('重点')
    await wrapper.get('.markdown-preview').trigger('click')
    expect(wrapper.get('textarea').element.value).toBe('**重点**内容')
  })
})
```

- [ ] **Step 2: Write the failing teaching-page edit test**

Create `src/components/TeachingDesignPage.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from '../domain/teachingDesign'
import TeachingDesignPage from './TeachingDesignPage.vue'

describe('TeachingDesignPage', () => {
  it('adds and removes teaching process rows', async () => {
    const design = createEmptyTeachingDesign('1.md')
    const wrapper = mount(TeachingDesignPage, {
      props: { design, editable: true },
    })

    await wrapper.get('[data-testid="add-step"]').trigger('click')
    expect(wrapper.emitted('update:design')?.at(-1)?.[0].processSteps).toHaveLength(2)
  })
})
```

- [ ] **Step 3: Run component tests to verify they fail**

Run:

```bash
rtk npm test -- src/components/EditableText.test.ts src/components/EditableMarkdown.test.ts src/components/TeachingDesignPage.test.ts
```

Expected: FAIL because the components are missing.

- [ ] **Step 4: Implement safe Markdown rendering**

Create `src/services/markdownRenderer.ts`:

```ts
import MarkdownIt from 'markdown-it'

const renderer = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
})

export function renderMarkdown(value: string): string {
  return renderer.render(value || '')
}
```

- [ ] **Step 5: Implement editable fields**

`EditableText.vue` must:

- render an auto-growing `<textarea>`;
- accept `modelValue`, `label`, and optional `multiline`;
- emit `update:modelValue`;
- resize on mount and input;
- use the same text appearance as the printed value;
- expose `.editable-field` for print hiding of edit affordances.

`EditableMarkdown.vue` must:

- show `renderMarkdown(modelValue)` in `.markdown-preview` while inactive;
- switch to an auto-growing textarea on click or keyboard activation;
- emit raw Markdown updates;
- return to rendered preview on blur unless focus moves within the component;
- show a muted placeholder when empty;
- keep raw HTML disabled through the renderer.

- [ ] **Step 6: Implement cover and teaching-design pages**

`CoverPage.vue` props and events:

```ts
defineProps<{ courseName: string; teacherName: string; editable: boolean }>()
defineEmits<{
  'update:courseName': [value: string]
  'update:teacherName': [value: string]
}>()
```

It renders “教学设计” plus two direct-edit lines for course and teacher.

`TeachingDesignPage.vue` props and event:

```ts
const props = defineProps<{ design: TeachingDesign; editable: boolean }>()
const emit = defineEmits<{ 'update:design': [design: TeachingDesign] }>()
```

It must render:

- centered lesson title;
- basic information table;
- three objective fields;
- key and difficult point fields;
- resources field;
- five-column process table;
- add/remove process controls when editable;
- board design section;
- effectiveness and reflection table;
- optional additional content section;
- non-printing warning summary.

Always emit a cloned `TeachingDesign` object rather than mutating the prop.

- [ ] **Step 7: Run editable page tests**

Run:

```bash
rtk npm test -- src/components/EditableText.test.ts src/components/EditableMarkdown.test.ts src/components/TeachingDesignPage.test.ts
```

Expected: all field and A4 page interaction tests pass.

- [ ] **Step 8: Commit**

```bash
rtk git add src/services/markdownRenderer.ts src/components/EditableText.vue src/components/EditableText.test.ts src/components/EditableMarkdown.vue src/components/EditableMarkdown.test.ts src/components/CoverPage.vue src/components/TeachingDesignPage.vue src/components/TeachingDesignPage.test.ts
rtk git commit -m "feat: add editable a4 teaching pages"
```

## Task 7: Build Upload, Sidebar, Conflict, and Restore Workflows

**Files:**
- Create: `src/components/UploadDropzone.vue`
- Create: `src/components/UploadDropzone.test.ts`
- Create: `src/components/LessonSidebar.vue`
- Create: `src/components/LessonSidebar.test.ts`
- Create: `src/components/ImportConflictDialog.vue`
- Create: `src/components/RestoreDraftDialog.vue`
- Create: `src/components/WorkspaceToolbar.vue`

- [ ] **Step 1: Write failing upload tests**

Create `src/components/UploadDropzone.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UploadDropzone from './UploadDropzone.vue'

describe('UploadDropzone', () => {
  it('emits every selected file', async () => {
    const wrapper = mount(UploadDropzone)
    const files = [new File(['# one'], '1.md'), new File(['# two'], '2.md')]
    const input = wrapper.get('input[type="file"]')

    Object.defineProperty(input.element, 'files', { value: files })
    await input.trigger('change')

    expect(wrapper.emitted('files')?.[0]?.[0]).toEqual(files)
  })
})
```

- [ ] **Step 2: Write failing drag-reorder tests**

Create `src/components/LessonSidebar.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from '../domain/teachingDesign'
import LessonSidebar from './LessonSidebar.vue'

describe('LessonSidebar', () => {
  it('emits a move when one lesson is dropped on another', async () => {
    const designs = [createEmptyTeachingDesign('1.md'), createEmptyTeachingDesign('2.md')]
    const wrapper = mount(LessonSidebar, {
      props: { designs, selectedId: designs[0]?.id ?? 'cover' },
    })

    await wrapper.get('[data-index="0"]').trigger('dragstart')
    await wrapper.get('[data-index="1"]').trigger('drop')

    expect(wrapper.emitted('move')?.[0]).toEqual([0, 1])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
rtk npm test -- src/components/UploadDropzone.test.ts src/components/LessonSidebar.test.ts
```

Expected: FAIL because the workflow components are missing.

- [ ] **Step 4: Implement file upload**

`UploadDropzone.vue` must:

- contain a hidden multiple file input with `accept=".md,text/markdown,text/plain"`;
- support click selection and drag/drop;
- emit `files` with `File[]`;
- show a full empty-state card when used without lessons;
- support a compact mode for the toolbar;
- reject nothing itself so the composable can report per-file errors.

- [ ] **Step 5: Implement lesson navigation and native drag reorder**

`LessonSidebar.vue` must:

- render the cover as the first navigation item;
- render naturally ordered lesson numbers and topic summaries;
- show warning count badges;
- make lesson rows `draggable="true"`;
- store the source index on `dragstart`;
- emit `move(from, to)` on drop;
- emit `select(id)` and `remove(id)`;
- provide keyboard-accessible selection and remove buttons.

- [ ] **Step 6: Implement explicit dialogs**

`ImportConflictDialog.vue` receives duplicate filenames and emits:

```ts
defineEmits<{
  replace: []
  keep: []
  cancel: []
}>()
```

The dialog text must explain that replace keeps the old position and keep imports a second copy.

`RestoreDraftDialog.vue` receives the stored update timestamp and emits `restore` or `discard`. It must not restore automatically.

- [ ] **Step 7: Implement the toolbar**

`WorkspaceToolbar.vue` emits `upload`, `print`, `export`, and `clear`, displays lesson count, warning count, and save status, and disables print/export when no lessons exist.

- [ ] **Step 8: Run workflow component tests**

Run:

```bash
rtk npm test -- src/components/UploadDropzone.test.ts src/components/LessonSidebar.test.ts
```

Expected: upload and drag-reorder tests pass.

- [ ] **Step 9: Commit**

```bash
rtk git add src/components/UploadDropzone.vue src/components/UploadDropzone.test.ts src/components/LessonSidebar.vue src/components/LessonSidebar.test.ts src/components/ImportConflictDialog.vue src/components/RestoreDraftDialog.vue src/components/WorkspaceToolbar.vue
rtk git commit -m "feat: add book import and navigation workflows"
```

## Task 8: Assemble the Workspace and Full-Book Print Rendering

**Files:**
- Create: `src/components/A4Workspace.vue`
- Create: `src/components/PrintBook.vue`
- Create: `src/components/PrintBook.test.ts`
- Modify: `src/App.vue`
- Modify: `src/main.ts`

- [ ] **Step 1: Write the failing print-book test**

Create `src/components/PrintBook.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createEmptyTeachingDesign } from '../domain/teachingDesign'
import PrintBook from './PrintBook.vue'

describe('PrintBook', () => {
  it('renders one cover and every lesson in current order', () => {
    const first = createEmptyTeachingDesign('2.md')
    first.topic = '第二课'
    const second = createEmptyTeachingDesign('1.md')
    second.topic = '第一课'

    const wrapper = mount(PrintBook, {
      props: {
        cover: { courseName: 'Web 前端开发', teacherName: '张老师' },
        designs: [first, second],
      },
    })

    expect(wrapper.findAll('.print-section')).toHaveLength(3)
    expect(wrapper.text().indexOf('第二课')).toBeLessThan(wrapper.text().indexOf('第一课'))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
rtk npm test -- src/components/PrintBook.test.ts
```

Expected: FAIL because `PrintBook.vue` is missing.

- [ ] **Step 3: Implement selected-page and print-book containers**

`A4Workspace.vue` accepts the book and selected page, then:

- renders `CoverPage` for `selectedId === 'cover'`;
- otherwise renders the selected `TeachingDesignPage`;
- emits cover and lesson changes;
- shows an A4 scale wrapper but does not duplicate book state.

`PrintBook.vue` accepts `cover` and `designs`, then:

- renders a non-editable cover;
- renders every lesson in array order;
- wraps each in `.print-section`;
- uses the same `TeachingDesignPage` with `editable=false`;
- remains hidden in screen media and present in the DOM for printing.

- [ ] **Step 4: Replace the Vite starter app**

Rewrite `src/App.vue` to:

1. create one `useTeachingBook()` store;
2. load any stored draft on mount and show `RestoreDraftDialog`;
3. show `UploadDropzone` when no designs exist;
4. show toolbar, sidebar, and `A4Workspace` when designs exist;
5. render `PrintBook` once;
6. run duplicate detection before import and show `ImportConflictDialog`;
7. call `window.print()` for printing;
8. call `createBookZip` and `downloadBlob` for export;
9. show non-destructive import/export/storage errors;
10. request confirmation before clearing a non-empty book.

The main workspace structure must be:

```vue
<div class="app-shell">
  <WorkspaceToolbar />
  <div class="workspace-layout">
    <LessonSidebar />
    <A4Workspace />
  </div>
  <PrintBook />
</div>
```

- [ ] **Step 5: Import print styles**

Update `src/main.ts`:

```ts
import { createApp } from 'vue'
import './style.css'
import './print.css'
import App from './App.vue'

createApp(App).mount('#app')
```

- [ ] **Step 6: Run component and build verification**

Run:

```bash
rtk npm test -- src/components/PrintBook.test.ts
rtk npm run build
```

Expected: print composition test passes and the app type-checks.

- [ ] **Step 7: Commit**

```bash
rtk git add src/App.vue src/main.ts src/components/A4Workspace.vue src/components/PrintBook.vue src/components/PrintBook.test.ts
rtk git commit -m "feat: assemble teaching design workspace"
```

## Task 9: Implement Screen and A4 Print Styling

**Files:**
- Modify: `src/style.css`
- Create: `src/print.css`
- Delete: `src/components/HelloWorld.vue`
- Delete: `src/assets/vue.svg`
- Delete: `src/assets/vite.svg`
- Delete: `src/assets/hero.png`

- [ ] **Step 1: Replace starter styles with application tokens**

Rewrite `src/style.css` around:

```css
:root {
  font-family: Inter, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #202a33;
  background: #edf0f2;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --green-700: #216447;
  --green-600: #2d7a58;
  --green-100: #dceee5;
  --line: #cfd5da;
  --muted: #68747f;
  --paper-width: 210mm;
  --paper-min-height: 297mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
}

button,
textarea,
input {
  font: inherit;
}
```

Add focused rules for:

- fixed-height toolbar;
- 260 px sidebar;
- scrollable paper canvas;
- white A4 paper with `210mm` width, `297mm` minimum height, shadow, and `16mm` screen padding;
- formal title typography;
- collapsed-border information, process, and reflection tables;
- green section markers;
- editable fields with subtle hover/focus backgrounds;
- warning badges;
- upload dropzone;
- dialogs and error notices;
- responsive sidebar collapse below 900 px.

- [ ] **Step 2: Add print stylesheet**

Create `src/print.css`:

```css
@page {
  size: A4;
  margin: 12mm;
}

@media print {
  html,
  body,
  #app {
    margin: 0;
    padding: 0;
    background: #fff;
  }

  .screen-only,
  .app-toolbar,
  .lesson-sidebar,
  .workspace-layout,
  .dialog-backdrop,
  .notice-stack,
  .edit-control,
  .warning-summary {
    display: none !important;
  }

  .print-book {
    display: block !important;
  }

  .print-section {
    break-before: page;
  }

  .print-section:first-child {
    break-before: auto;
  }

  .a4-page {
    width: auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }

  .process-table {
    break-inside: auto;
  }

  .process-table thead {
    display: table-header-group;
  }

  .process-table tr {
    break-inside: avoid;
  }

  .section-title {
    break-after: avoid;
  }

  .info-table,
  .reflection-table,
  .board-section {
    break-inside: avoid;
  }
}
```

Add print-only declarations that show the rendered Markdown previews, remove textarea borders/backgrounds, preserve grayscale borders, and wrap long code/text.

- [ ] **Step 3: Remove unused starter assets**

Delete the unused Vite starter component and images after confirming no imports remain:

```bash
rtk rg -n 'HelloWorld|vue.svg|vite.svg|hero.png' src
```

Expected before deletion: no references outside the files being removed.

- [ ] **Step 4: Build after styling and cleanup**

Run:

```bash
rtk npm run build
```

Expected: production build completes with no missing imports.

- [ ] **Step 5: Commit**

```bash
rtk git add src/style.css src/print.css src/components/HelloWorld.vue src/assets
rtk git commit -m "style: add printable a4 teaching design layout"
```

## Task 10: End-to-End Browser Verification and Regression Hardening

**Files:**
- Create: `src/App.test.ts`
- Verify: `src/services/markdownParser.ts`
- Verify: `src/components/*.vue`
- Verify: `src/style.css`
- Verify: `src/print.css`

- [ ] **Step 1: Add an application smoke test**

Create `src/App.test.ts`:

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.vue'

describe('App', () => {
  beforeEach(() => localStorage.clear())

  it('starts with the multi-file upload screen', () => {
    const wrapper = mount(App)
    expect(wrapper.get('input[type="file"]').attributes('multiple')).toBeDefined()
    expect(wrapper.text()).toContain('上传 Markdown')
  })
})
```

- [ ] **Step 2: Run the complete automated suite**

Run:

```bash
rtk npm test
rtk npm run build
```

Expected: all unit/component/corpus tests pass and Vite produces `dist`.

- [ ] **Step 3: Start the development server**

Run:

```bash
rtk npm run dev -- --host 127.0.0.1
```

Expected: Vite reports a local URL and stays running for browser verification.

- [ ] **Step 4: Verify the main user journey with agent-browser**

Using the local URL:

1. upload `data/Web/1.md`, `data/Web/2.md`, and `data/Web/10.md`;
2. confirm sidebar order is 1, 2, 10;
3. confirm the first lesson topic, objectives, five process rows, board, and reflection appear;
4. edit the topic and teacher activity directly in the A4 page;
5. drag lesson 10 before lesson 2;
6. reload and choose restore;
7. confirm edits and order persisted;
8. export ZIP and inspect that it contains three Markdown files plus `课程顺序.txt`;
9. invoke print preview and confirm the cover plus three lesson starts.

Capture a full-page screenshot to `/tmp/teaching-design-workspace.png`.

- [ ] **Step 5: Run full-corpus browser import**

Upload all 55 numbered Markdown files from `data/Web`, `data/Python`, and `data/C#`.

Expected:

- no page crash;
- all 55 lessons appear;
- warning badges appear for incomplete files;
- switching to a warned lesson shows blank editable sections rather than lost content;
- print/export controls remain enabled.

- [ ] **Step 6: Inspect print output**

Generate a browser PDF to `/tmp/teaching-design-book.pdf` and inspect representative pages:

- cover;
- Web lesson 1;
- a long Python lesson;
- C# lesson 8;
- C# lesson 19.

Expected: no controls, clipping, horizontal overflow, or lesson-to-lesson page merging.

- [ ] **Step 7: Apply the regression gate**

If Steps 4-6 expose a defect, return to the task owning that behavior and follow its failing-test, minimal-fix, focused-test sequence before continuing. Do not make an untested browser-only fix.

- [ ] **Step 8: Commit**

```bash
rtk git add src
rtk git commit -m "test: harden full teaching book workflow"
```

## Task 11: Final Verification

**Files:**
- Verify: all changed application and test files

- [ ] **Step 1: Run static and automated verification**

Run:

```bash
rtk npm test
rtk npm run build
```

Expected: all tests pass and the production build succeeds.

- [ ] **Step 2: Verify required feature markers**

Run:

```bash
rtk rg -n '课程名称|教师姓名|打印整册|导出 Markdown|板书设计|课程顺序' src
rtk rg -n '@page|table-header-group|break-before: page' src/print.css
```

Expected: every required screen, export, and print marker is present.

- [ ] **Step 3: Confirm no starter content remains**

Run:

```bash
rtk rg -n 'Get started|Count is|Vite logo|Learn more' src
```

Expected: no matches.

- [ ] **Step 4: Review changed files**

Run:

```bash
rtk git status --short
rtk git diff --stat
```

If Git metadata is still unavailable, use:

```bash
rtk rg --files src docs/superpowers | sort
```

Expected: only scoped application, test, style, and planning files are present.
