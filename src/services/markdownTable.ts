function isEscaped(value: string, index: number): boolean {
  let backslashCount = 0

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor--) {
    backslashCount++
  }

  return backslashCount % 2 === 1
}

function hasMatchingCodeFence(
  value: string,
  start: number,
  fenceLength: number,
): boolean {
  for (let index = start + fenceLength; index < value.length; ) {
    if (value[index] !== '`') {
      index++
      continue
    }

    let runLength = 1

    while (value[index + runLength] === '`') {
      runLength++
    }

    if (!isEscaped(value, index) && runLength === fenceLength) {
      return true
    }

    index += runLength
  }

  return false
}

export interface MarkdownTable {
  start: number
  end: number
  header: string[]
  rows: string[][]
}

export function splitMarkdownRow(row: string): string[] {
  const cells: string[] = []
  let cell = ''
  let codeFenceLength = 0

  for (let index = 0; index < row.length; ) {
    const character = row[index]!

    if (character === '`' && !isEscaped(row, index)) {
      let runLength = 1

      while (row[index + runLength] === '`') {
        runLength++
      }

      cell += row.slice(index, index + runLength)

      if (
        codeFenceLength === 0 &&
        hasMatchingCodeFence(row, index, runLength)
      ) {
        codeFenceLength = runLength
      } else if (codeFenceLength === runLength) {
        codeFenceLength = 0
      }

      index += runLength
      continue
    }

    if (
      character === '|' &&
      codeFenceLength === 0 &&
      !isEscaped(row, index)
    ) {
      cells.push(cell.trim())
      cell = ''
      index++
      continue
    }

    cell += character
    index++
  }

  cells.push(cell.trim())

  if (cells[0] === '') {
    cells.shift()
  }
  if (cells.at(-1) === '') {
    cells.pop()
  }

  return cells
}

const dividerCellPattern = /^:?-{3,}:?$/

function startsWithPipe(line: string): boolean {
  return line.trimStart().startsWith('|')
}

export function extractMarkdownTable(
  lines: readonly string[],
  fromIndex = 0,
): MarkdownTable | null {
  for (
    let start = Math.max(0, fromIndex);
    start < lines.length - 1;
    start++
  ) {
    const headerLine = lines[start]!
    const dividerLine = lines[start + 1]!

    if (!startsWithPipe(headerLine) || !startsWithPipe(dividerLine)) {
      continue
    }

    const header = splitMarkdownRow(headerLine)
    const divider = splitMarkdownRow(dividerLine)

    if (
      header.length === 0 ||
      divider.length !== header.length ||
      !divider.every((cell) => dividerCellPattern.test(cell))
    ) {
      continue
    }

    const rows: string[][] = []
    let end = start + 1

    while (end + 1 < lines.length && startsWithPipe(lines[end + 1]!)) {
      end++
      rows.push(splitMarkdownRow(lines[end]!))
    }

    return { start, end, header, rows }
  }

  return null
}
