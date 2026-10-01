import { describe, expect, it } from 'vitest'
import { makeTitle, slugify } from '../apps/desktop/src/main/services/task-manager'

describe('task naming', () => {
  it('creates safe, bounded Git branch slugs', () => {
    expect(slugify('Add password reset!')).toBe('add-password-reset')
    expect(slugify('   ')).toBe('task')
    expect(slugify('A'.repeat(100))).toHaveLength(36)
  })

  it('creates concise display titles from the first line', () => {
    expect(makeTitle('fix the header\nand keep this detail')).toBe('Fix the header')
    expect(makeTitle('a'.repeat(90))).toBe(`${'A'}${'a'.repeat(68)}…`)
  })
})
