import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTeachingDesign } from './markdownParser'

const fixture = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

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

  it('imports every numbered corpus file without throwing', () => {
    const directories = ['data/Web', 'data/Python', 'data/C#']
    const paths = directories.flatMap((directory) =>
      readdirSync(resolve(process.cwd(), directory))
        .filter((name) => /^\d+\.md$/.test(name))
        .map((name) => `${directory}/${name}`),
    )

    expect(paths).toHaveLength(55)
    for (const path of paths) {
      const design = parseTeachingDesign(path.split('/').at(-1) ?? path, fixture(path))
      expect(design.topic || design.title).not.toBe('')
      expect(design.originalFilename).toMatch(/\.md$/)
    }
  })
})
