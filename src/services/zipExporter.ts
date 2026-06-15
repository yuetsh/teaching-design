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
      const stem = filename.replace(/\.md$/i, '')
      filename = `${stem}-${index + 1}.md`
    }
    usedNames.add(filename)
    order.push(`${index + 1}. ${filename} — ${design.topic}`)
    zip.file(filename, writeTeachingDesignMarkdown(design))
  })

  zip.file('课程顺序.txt', `${order.join('\n')}\n`)
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
