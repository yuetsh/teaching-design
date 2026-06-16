import { describe, expect, it } from 'vitest'
import './style.css'

describe('shared button styles', () => {
  it('keeps disabled shared button text readable without lowering opacity', () => {
    const button = document.createElement('button')
    button.className = 'ui-button ui-button--primary'
    button.disabled = true
    button.textContent = 'Create'
    document.body.append(button)

    expect(getComputedStyle(button).opacity).toBe('1')

    button.remove()
  })

  it('keeps disabled toolbar button text readable without lowering opacity', () => {
    const toolbar = document.createElement('div')
    toolbar.className = 'workspace-toolbar'

    const button = document.createElement('button')
    button.disabled = true
    button.textContent = 'Export'
    toolbar.append(button)
    document.body.append(toolbar)

    expect(getComputedStyle(button).opacity).toBe('1')

    toolbar.remove()
  })
})
