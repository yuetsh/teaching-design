const filenameCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base',
})

export function sortFilesNaturally<T extends { name: string }>(
  files: readonly T[],
): T[] {
  return [...files].sort((left, right) =>
    filenameCollator.compare(left.name, right.name),
  )
}
