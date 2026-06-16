import {
  createEmptyTeachingDesign,
  createTeachingStep,
  type ParseWarning,
  type TeachingDesign,
  type TeachingStep,
} from '../../shared/domain/teachingDesign'
import { extractMarkdownTable } from './markdownTable'

const BR = /<br\s*\/?>/gi
const LABEL_MARKS = /[*_`]/g
const COLON = /[:：]\s*$/
const PAREN_DURATION = /[（(]([^（）()]*)[）)]/

const KNOWN_SECTION_HEADINGS = new Set(['教学过程', '板书设计', '教学成效与反思'])

function cleanLabel(value: string): string {
  return value.replace(LABEL_MARKS, '').trim()
}

function stripOuterBold(value: string): string {
  return value.trim().replace(/^\*\*([\s\S]*)\*\*$/, '$1').trim()
}

function normalizeMultiline(value: string): string {
  return value.replace(BR, '\n').trim()
}

function isSectionHeading(line: string, heading: string): boolean {
  const trimmed = line.trim()
  return (
    new RegExp(`^##\\s+${heading}\\s*$`).test(trimmed) || trimmed === `**${heading}**`
  )
}

function findSectionIndex(lines: readonly string[], heading: string, fromIndex = 0): number {
  for (let index = fromIndex; index < lines.length; index += 1) {
    if (isSectionHeading(lines[index] ?? '', heading)) return index
  }
  return -1
}

function isAnyHeading(line: string): boolean {
  const trimmed = line.trim()
  return /^##\s+\S/.test(trimmed) || /^\*\*[^*]+\*\*$/.test(trimmed)
}

function findNextHeadingIndex(lines: readonly string[], fromIndex: number): number {
  for (let index = fromIndex; index < lines.length; index += 1) {
    if (isAnyHeading(lines[index] ?? '')) return index
  }
  return -1
}

function headingName(line: string): string {
  const trimmed = line.trim()
  const levelTwo = trimmed.match(/^##\s+(.+)$/)
  if (levelTwo) return levelTwo[1]!.trim()
  return trimmed.slice(2, -2).trim()
}

function splitLabelledValue(value: string, labels: readonly string[]): Record<string, string> {
  const normalized = value.replace(BR, '\n')
  const alternation = labels.join('|')
  const pattern = new RegExp(`(?:\\*\\*(?:${alternation})\\*\\*|(?:${alternation}))\\s*[:：]`, 'g')
  const matches = [...normalized.matchAll(pattern)]
  const result: Record<string, string> = {}

  matches.forEach((match, index) => {
    const label = cleanLabel(match[0].replace(COLON, ''))
    const start = match.index + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1]!.index : normalized.length
    result[label] = normalized.slice(start, end).trim()
  })

  return result
}

function parseStepNameCell(cell: string, fallbackIndex: number): { name: string; duration: string } {
  const normalized = cell.replace(BR, '\n')
  const parts = normalized
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)

  let namePart = parts[0] ?? ''
  let durationPart = parts[1] ?? ''
  let duration = ''

  const durationMatch = (durationPart || namePart).match(PAREN_DURATION)
  if (durationMatch) {
    duration = durationMatch[1]!.trim()
    if (durationPart) {
      durationPart = ''
    } else {
      namePart = namePart.replace(durationMatch[0], '').trim()
    }
  }

  const name = cleanLabel(namePart) || createTeachingStep(fallbackIndex).name
  return { name, duration }
}

function extractBoardContent(sectionLines: readonly string[]): string {
  const fenceStart = sectionLines.findIndex((line) => /^\s*(`{3,}|~{3,})/.test(line))
  if (fenceStart < 0) {
    return sectionLines.join('\n').trim()
  }

  const fenceMatch = sectionLines[fenceStart]!.match(/^\s*(`{3,}|~{3,})/)!
  const fenceChar = fenceMatch[1]![0]!
  const fenceLength = fenceMatch[1]!.length
  let fenceEnd = sectionLines.length

  for (let index = fenceStart + 1; index < sectionLines.length; index += 1) {
    const close = sectionLines[index]!.match(/^\s*(`+|~+)\s*$/)
    if (close && close[1]![0] === fenceChar && close[1]!.length >= fenceLength) {
      fenceEnd = index
      break
    }
  }

  return sectionLines.slice(fenceStart + 1, fenceEnd).join('\n').trim()
}

export function parseTeachingDesign(filename: string, markdown: string): TeachingDesign {
  const design = createEmptyTeachingDesign(filename)
  const warnings: ParseWarning[] = []
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')

  const titleLineIndex = lines.findIndex((line) => /^#\s+\S/.test(line.trim()))
  let headingTitle = ''
  if (titleLineIndex >= 0) {
    headingTitle = lines[titleLineIndex]!.trim().replace(/^#\s+/, '').trim()
  } else {
    warnings.push({ code: 'missing-title', message: '未找到课程标题（一级标题）。' })
  }

  const basicTable = extractMarkdownTable(lines, titleLineIndex + 1)
  const basicFieldsFound = new Set<string>()

  if (basicTable) {
    for (const row of [basicTable.header, ...basicTable.rows]) {
      const label = cleanLabel(row[0] ?? '')
      const value = (row[1] ?? '').trim()

      switch (label) {
        case '课题':
          design.topic = stripOuterBold(value)
          basicFieldsFound.add('topic')
          break
        case '课时':
          design.duration = value
          basicFieldsFound.add('duration')
          break
        case '教学目标': {
          const objectives = splitLabelledValue(value, ['知识目标', '技能目标', '素养目标'])
          design.knowledgeObjective = objectives['知识目标'] ?? ''
          design.skillObjective = objectives['技能目标'] ?? ''
          design.literacyObjective = objectives['素养目标'] ?? ''
          basicFieldsFound.add('objectives')
          break
        }
        case '教学重难点': {
          const points = splitLabelledValue(value, ['重点', '难点'])
          design.keyPoint = points['重点'] ?? ''
          design.difficultPoint = points['难点'] ?? ''
          basicFieldsFound.add('points')
          break
        }
        case '教学资源准备':
          design.resources = value
          basicFieldsFound.add('resources')
          break
        default:
          break
      }
    }
  }

  if (!basicTable) {
    warnings.push({ code: 'missing-basic-field', message: '未找到基本信息表格。' })
  } else {
    const requiredFields: Array<[string, string]> = [
      ['topic', '课题'],
      ['duration', '课时'],
      ['objectives', '教学目标'],
      ['points', '教学重难点'],
      ['resources', '教学资源准备'],
    ]
    for (const [key, label] of requiredFields) {
      if (!basicFieldsFound.has(key)) {
        warnings.push({ code: 'missing-basic-field', message: `缺少"${label}"信息。` })
      }
    }
  }

  const titleWithoutSuffix = headingTitle.replace(/\s*教学设计\s*$/, '').trim()
  design.title = titleWithoutSuffix && titleWithoutSuffix !== design.topic ? headingTitle : ''

  const processIndex = findSectionIndex(lines, '教学过程', titleLineIndex + 1)
  if (processIndex < 0) {
    warnings.push({ code: 'missing-process', message: '未找到教学过程章节。' })
  } else {
    const processTable = extractMarkdownTable(lines, processIndex + 1)
    if (!processTable || processTable.header.length < 5) {
      warnings.push({ code: 'invalid-process-table', message: '教学过程表格格式不正确。' })
    } else {
      const steps: TeachingStep[] = []
      processTable.rows.forEach((row, index) => {
        if (row.length < 5) return
        const [nameCell, content, teacherActivity, studentActivity, intention] = row
        const { name, duration } = parseStepNameCell(nameCell ?? '', index + 1)
        steps.push({
          id: crypto.randomUUID(),
          name,
          duration,
          content: normalizeMultiline(content ?? ''),
          teacherActivity: normalizeMultiline(teacherActivity ?? ''),
          studentActivity: normalizeMultiline(studentActivity ?? ''),
          intention: normalizeMultiline(intention ?? ''),
        })
      })

      if (steps.length > 0) {
        design.processSteps = steps
      } else {
        warnings.push({ code: 'invalid-process-table', message: '教学过程表格中没有有效的环节行。' })
      }
    }
  }

  const boardIndex = findSectionIndex(lines, '板书设计', titleLineIndex + 1)
  if (boardIndex < 0) {
    warnings.push({ code: 'missing-board', message: '未找到板书设计章节。' })
  } else {
    const nextHeadingIndex = findNextHeadingIndex(lines, boardIndex + 1)
    const sectionEnd = nextHeadingIndex < 0 ? lines.length : nextHeadingIndex
    design.boardDesign = extractBoardContent(lines.slice(boardIndex + 1, sectionEnd))
  }

  const reflectionIndex = findSectionIndex(lines, '教学成效与反思', titleLineIndex + 1)
  if (reflectionIndex < 0) {
    warnings.push({ code: 'missing-reflection', message: '未找到教学成效与反思章节。' })
  } else {
    const reflectionTable = extractMarkdownTable(lines, reflectionIndex + 1)
    if (!reflectionTable) {
      warnings.push({ code: 'missing-reflection', message: '教学成效与反思表格格式不正确。' })
    } else {
      for (const row of [reflectionTable.header, ...reflectionTable.rows]) {
        const label = cleanLabel(row[0] ?? '')
        const value = normalizeMultiline(row[1] ?? '')
        if (label === '教学成效') design.effectiveness = value
        if (label === '教学反思') design.reflection = value
      }
    }
  }

  const additionalParts: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    if (!isAnyHeading(line)) continue
    const name = headingName(line)
    if (KNOWN_SECTION_HEADINGS.has(name)) continue

    const nextHeadingIndex = findNextHeadingIndex(lines, index + 1)
    const sectionEnd = nextHeadingIndex < 0 ? lines.length : nextHeadingIndex
    const content = lines.slice(index + 1, sectionEnd).join('\n').trim()

    if (content) {
      additionalParts.push(`## ${name}\n\n${content}`)
    }
  }

  if (additionalParts.length > 0) {
    design.additionalContent = additionalParts.join('\n\n')
    warnings.push({ code: 'unclassified-content', message: '存在未识别的章节内容。' })
  }

  design.warnings = warnings
  return design
}
