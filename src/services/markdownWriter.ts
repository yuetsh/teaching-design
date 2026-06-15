import type { TeachingDesign } from '../domain/teachingDesign'

function escapeCell(value: string): string {
  return value
    .replace(/\r?\n/g, '<br>')
    .replace(/(?<!\\)\|/g, '\\|')
    .trim()
}

function objectiveCell(design: TeachingDesign): string {
  return [
    `**知识目标**：${design.knowledgeObjective}`,
    `**技能目标**：${design.skillObjective}`,
    `**素养目标**：${design.literacyObjective}`,
  ].join('\n')
}

function keyPointCell(design: TeachingDesign): string {
  return [`**重点**：${design.keyPoint}`, `**难点**：${design.difficultPoint}`].join('\n')
}

function processNameCell(step: TeachingDesign['processSteps'][number]): string {
  return step.duration ? `**${step.name}**\n（${step.duration}）` : `**${step.name}**`
}

export function writeTeachingDesignMarkdown(design: TeachingDesign): string {
  const title = design.title || `${design.topic} 教学设计`

  const processRows = design.processSteps.map((step) =>
    [
      escapeCell(processNameCell(step)),
      escapeCell(step.content),
      escapeCell(step.teacherActivity),
      escapeCell(step.studentActivity),
      escapeCell(step.intention),
    ]
      .map((cell) => `| ${cell}`)
      .join(' ') + ' |',
  )

  const sections = [
    `# ${title}`,
    '',
    `| **课题** | **${escapeCell(design.topic)}** |`,
    '|:---|:---|',
    `| **课时** | ${escapeCell(design.duration)} |`,
    `| **教学目标** | ${escapeCell(objectiveCell(design))} |`,
    `| **教学重难点** | ${escapeCell(keyPointCell(design))} |`,
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

  return `${sections.join('\n')}\n`
}
