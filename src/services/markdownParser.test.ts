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
      .replace(/## 板书设计[\s\S]*?(?=## 教学成效与反思)/, '')

    const design = parseTeachingDesign('8.md', markdown)

    expect(design.knowledgeObjective).toBe('认识 HTML。')
    expect(design.boardDesign).toBe('')
    expect(design.warnings.some((warning) => warning.code === 'missing-board')).toBe(true)
  })

  it('parses process steps where the step number is outside the bold name', () => {
    const markdown = standard.replace(
      '| **1. 导入**<br>（6分钟） | 展示案例。 | **情境创设**<br>提问。 | **观察思考**<br>回答。 | 建立目标。 |',
      '| 1. **导入**<br>(6分钟) | 展示案例。 | **情境创设**<br>提问。 | **观察思考**<br>回答。 | 建立目标。 |',
    )

    const design = parseTeachingDesign('1.md', markdown)

    expect(design.processSteps[0]).toMatchObject({
      name: '1. 导入',
      duration: '6分钟',
    })
  })

  it('reports a missing title when no level-one heading exists', () => {
    const markdown = standard.replace('# 个人主页——项目启动 教学设计\n\n', '')

    const design = parseTeachingDesign('1.md', markdown)

    expect(design.warnings.some((warning) => warning.code === 'missing-title')).toBe(true)
  })
})
