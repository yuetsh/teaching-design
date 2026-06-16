import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  BOOK_SCHEMA_VERSION,
  createEmptyBook,
  createEmptyTeachingDesign,
  createTeachingStep,
  type DesignId,
  type TeachingBook,
  type TeachingDesign,
} from './teachingDesign'

describe('createTeachingStep', () => {
  it('creates a named step with editable defaults and an ID', () => {
    const step = createTeachingStep(3)

    expect(step.id).not.toBe('')
    expect(step).toMatchObject({
      name: '3. 教学环节',
      duration: '',
      content: '',
      teacherActivity: '',
      studentActivity: '',
      intention: '',
    })
  })
})

describe('createEmptyTeachingDesign', () => {
  it('creates editable defaults for missing lesson sections', () => {
    const design = createEmptyTeachingDesign('8.md')

    expect(design.id).not.toBe('')
    expect(design.originalFilename).toBe('8.md')
    expect(design.processSteps).toHaveLength(1)
    expect(design.processSteps[0]?.id).not.toBe('')
    expect(design.boardDesign).toBe('')
    expect(design.warnings).toEqual([])
  })

  it('creates independent nested state for each design', () => {
    const first = createEmptyTeachingDesign('1.md')
    const second = createEmptyTeachingDesign('2.md')

    first.processSteps[0]!.name = 'Changed'
    first.warnings.push({ code: 'missing-title', message: 'Missing title' })

    expect(first.id).not.toBe(second.id)
    expect(first.processSteps).not.toBe(second.processSteps)
    expect(first.processSteps[0]).not.toBe(second.processSteps[0])
    expect(second.processSteps[0]?.name).toBe('1. 教学环节')
    expect(second.warnings).toEqual([])
  })
})

describe('createEmptyBook', () => {
  it('creates the schema defaults with no selected page and an ISO timestamp', () => {
    const book = createEmptyBook()

    expect(book.schemaVersion).toBe(BOOK_SCHEMA_VERSION)
    expect(book.selectedId).toBeNull()
    expect(book).not.toHaveProperty('cover')
    expect(new Date(book.updatedAt).toISOString()).toBe(book.updatedAt)
  })

  it('creates independent design collections', () => {
    const first = createEmptyBook()
    const second = createEmptyBook()

    first.designs.push(createEmptyTeachingDesign('1.md'))

    expect(first.designs).not.toBe(second.designs)
    expect(second.designs).toEqual([])
  })
})

describe('domain types', () => {
  it('uses branded string design IDs and literal schema versions', () => {
    expectTypeOf<DesignId>().toExtend<string>()
    expectTypeOf<TeachingDesign['id']>().toEqualTypeOf<DesignId>()
    expectTypeOf<TeachingBook['selectedId']>().toEqualTypeOf<DesignId | null>()
    expectTypeOf<TeachingBook['schemaVersion']>().toEqualTypeOf<
      typeof BOOK_SCHEMA_VERSION
    >()
  })
})
