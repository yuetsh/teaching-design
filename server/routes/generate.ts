import { Hono } from 'hono'

const SYSTEM_PROMPT = `你是一名教学设计专家，需要根据用户提供的主题生成一份 Markdown 格式的教案。
请严格遵循以下结构（标题、表格列数、章节名称必须完全一致，便于程序解析），只输出 Markdown 正文本身，不要使用代码块包裹整篇文档，不要添加任何额外说明：

1. 第一行是一级标题：\`# <课程标题> 教学设计\`
2. 紧接着是一个两列表格（表头使用 \`|:---|:---|\`），依次包含以下行：
   - \`| **课题** | **<课题名称>** |\`
   - \`| **课时** | <课时说明，例如 1课时（40分钟）> |\`
   - \`| **教学目标** | **知识目标**：...<br>**技能目标**：...<br>**素养目标**：... |\`
   - \`| **教学重难点** | **重点**：...<br>**难点**：... |\`
   - \`| **教学资源准备** | ... |\`
3. 二级标题 \`## 教学过程\`，后接一个 5 列表格，表头固定为：
   \`| 教学环节 | 教学内容 | 教师活动 | 学生活动 | 设计意图 |\`，分隔行 \`|:---|:---|:---|:---|:---|\`，
   包含 4-6 个教学环节行，每个环节名称写作 \`**N. 环节名称**<br>（时长）\` 的格式。
4. 二级标题 \`## 板书设计\`，内容放在 \`\`\`text 代码块中。
5. 二级标题 \`## 教学成效与反思\`，后接一个两列表格：
   - \`| **教学成效** | ... |\`
   - \`| **教学反思** | ... |\`
`

function sanitizeFilename(topic: string): string {
  const sanitized = topic.trim().replace(/[\\/:*?"<>|]/g, '_')
  return sanitized || 'lesson'
}

export function createGenerateRouter(apiKey: string | undefined): Hono {
  const app = new Hono()

  app.post('/', async (c) => {
    const body = (await c.req.json().catch(() => null)) as { topic?: unknown } | null
    const topic = body?.topic

    if (typeof topic !== 'string' || topic.trim() === '') {
      return c.json({ error: '请提供教案主题。' }, 400)
    }

    if (!apiKey) {
      return c.json({ error: '未配置 DEEPSEEK_API_KEY。' }, 500)
    }

    let response: Response
    try {
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `请围绕主题"${topic.trim()}"生成一份教案。` },
          ],
        }),
      })
    } catch {
      return c.json({ error: 'Deepseek 请求失败，请检查网络后重试。' }, 502)
    }

    if (!response.ok) {
      return c.json({ error: `Deepseek 请求失败（状态码 ${response.status}）。` }, 502)
    }

    const payload = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null
    const markdown = payload?.choices?.[0]?.message?.content

    if (!markdown) {
      return c.json({ error: 'Deepseek 返回内容为空。' }, 502)
    }

    return c.json({ filename: `${sanitizeFilename(topic)}.md`, markdown })
  })

  return app
}
