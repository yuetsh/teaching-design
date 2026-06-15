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

  it('omits decorative parentheses for steps without a duration', () => {
    const source = parseTeachingDesign('1.md', readFileSync(
      resolve(process.cwd(), 'data/Web/1.md'),
      'utf8',
    ))
    source.processSteps[0]!.duration = ''
    source.processSteps[0]!.name = '1. 导入'

    const output = writeTeachingDesignMarkdown(source)

    expect(output).toContain('**1. 导入**')
    expect(output).not.toContain('**1. 导入**<br>（）')
    expect(output).not.toContain('**1. 导入**（）')
  })
})
