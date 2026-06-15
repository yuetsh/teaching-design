import { describe, expect, it } from 'vitest'
import { extractMarkdownTable, splitMarkdownRow } from './markdownTable'

describe('splitMarkdownRow', () => {
  it('keeps pipes inside code spans and escaped pipes inside cells', () => {
    expect(splitMarkdownRow('| A | `x | y` | left \\| right |')).toEqual([
      'A',
      '`x | y`',
      'left \\| right',
    ])
  })

  it('matches arbitrary backtick fence lengths and ignores escaped backticks', () => {
    expect(splitMarkdownRow('| ``x | y`` | escaped \\` tick |')).toEqual([
      '``x | y``',
      'escaped \\` tick',
    ])
  })

  it('treats an unmatched backtick as literal text', () => {
    expect(splitMarkdownRow('| A | unmatched `code | B |')).toEqual([
      'A',
      'unmatched `code',
      'B',
    ])
  })
})

describe('extractMarkdownTable', () => {
  it('finds a table and gathers its contiguous body rows', () => {
    const lines = [
      'intro',
      '| A | B |',
      '| --- | :---: |',
      '| 1 | 2 |',
      '',
    ]

    expect(extractMarkdownTable(lines)).toEqual({
      start: 1,
      end: 3,
      header: ['A', 'B'],
      rows: [['1', '2']],
    })
  })

  it.each([
    ['backtick', ['```markdown', '| Fake | Table |', '| --- | --- |', '```']],
    ['tilde', ['~~~~', '| Fake | Table |', '| --- | --- |', '~~~~']],
  ])('skips pseudo-tables inside %s fenced code', (_marker, fencedLines) => {
    const lines = [
      ...fencedLines,
      '',
      '| Real | Table |',
      '| --- | --- |',
      '| 1 | 2 |',
    ]
    const realTableStart = fencedLines.length + 1

    expect(extractMarkdownTable(lines)).toEqual({
      start: realTableStart,
      end: realTableStart + 2,
      header: ['Real', 'Table'],
      rows: [['1', '2']],
    })
  })

  it.each([
    ['four spaces', '    '],
    ['a tab', '\t'],
  ])('skips pseudo-tables indented with %s', (_indentation, indent) => {
    const lines = [
      `${indent}| Fake | Table |`,
      `${indent}| --- | --- |`,
      `${indent}| 0 | 0 |`,
      '',
      '| Real | Table |',
      '| --- | --- |',
      '| 1 | 2 |',
    ]

    expect(extractMarkdownTable(lines)).toEqual({
      start: 4,
      end: 6,
      header: ['Real', 'Table'],
      rows: [['1', '2']],
    })
  })

  it('starts its table search at fromIndex', () => {
    const lines = [
      '| First | Table |',
      '| --- | --- |',
      '| 1 | 1 |',
      '',
      '| Second | Table |',
      '| --- | --- |',
      '| 2 | 2 |',
    ]

    expect(extractMarkdownTable(lines, 4)).toEqual({
      start: 4,
      end: 6,
      header: ['Second', 'Table'],
      rows: [['2', '2']],
    })
  })

  it('returns null when no valid table exists', () => {
    expect(extractMarkdownTable(['plain text'])).toBeNull()
    expect(
      extractMarkdownTable(['| A | B |', '| -- | not-a-divider |']),
    ).toBeNull()
  })
})
