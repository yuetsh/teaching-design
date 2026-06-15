import MarkdownIt from 'markdown-it'

const renderer = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: false,
  typographer: false,
})

export function renderMarkdown(value: string): string {
  return renderer.render(value || '')
}
