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

const FENCE_OPEN_PATTERN = / {0,3}(`{3,}|~{3,})/
const FENCE_CLOSE_PATTERN = / {0,3}(`+|~+)\s*$/

function isTableRow(line: string): boolean {
  const leading = line.match(/^[ \t]*/)?.[0] ?? ''
  if (leading.includes('\t') || leading.length >= 4) {
    return false
  }
  return line.trimStart().startsWith('|')
}

function computeFenceMask(lines: readonly string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false)
  let fenceChar: string | null = null
  let fenceLength = 0

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!

    if (fenceChar === null) {
      const open = line.match(new RegExp(`^${FENCE_OPEN_PATTERN.source}`))
      if (open) {
        mask[index] = true
        fenceChar = open[1]![0]!
        fenceLength = open[1]!.length
      }
      continue
    }

    mask[index] = true
    const close = line.match(new RegExp(`^${FENCE_CLOSE_PATTERN.source}`))
    if (close && close[1]![0] === fenceChar && close[1]!.length >= fenceLength) {
      fenceChar = null
      fenceLength = 0
    }
  }

  return mask
}

export function extractMarkdownTable(
  lines: readonly string[],
  fromIndex = 0,
): MarkdownTable | null {
  const insideFence = computeFenceMask(lines)

  for (
    let start = Math.max(0, fromIndex);
    start < lines.length - 1;
    start++
  ) {
    if (insideFence[start] || insideFence[start + 1]) {
      continue
    }

    const headerLine = lines[start]!
    const dividerLine = lines[start + 1]!

    if (!isTableRow(headerLine) || !isTableRow(dividerLine)) {
      continue
    }

    const header = splitMarkdownRow(headerLine)
    const divider = splitMarkdownRow(dividerLine)

    // Handle separator-first tables (no header row: starts with |:---|:---|)
    if (header.length > 0 && header.every((cell) => dividerCellPattern.test(cell))) {
      const rows: string[][] = []
      let end = start

      while (end + 1 < lines.length && !insideFence[end + 1] && isTableRow(lines[end + 1]!)) {
        end++
        const row = splitMarkdownRow(lines[end]!)
        if (!row.every((cell) => dividerCellPattern.test(cell))) {
          rows.push(row)
        }
      }

      if (rows.length > 0) {
        return { start, end, header: [], rows }
      }
    }

    if (
      header.length === 0 ||
      divider.length !== header.length ||
      !divider.every((cell) => dividerCellPattern.test(cell))
    ) {
      continue
    }

    const rows: string[][] = []
    let end = start + 1

    while (
      end + 1 < lines.length &&
      !insideFence[end + 1] &&
      isTableRow(lines[end + 1]!)
    ) {
      end++
      rows.push(splitMarkdownRow(lines[end]!))
    }

    return { start, end, header, rows }
  }

  return null
}
