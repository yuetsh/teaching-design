export const BOOK_SCHEMA_VERSION = 1

declare const designIdBrand: unique symbol

export type DesignId = string & {
  readonly [designIdBrand]: true
}

export type ParseWarningCode =
  | 'missing-title'
  | 'missing-basic-field'
  | 'missing-process'
  | 'invalid-process-table'
  | 'missing-board'
  | 'missing-reflection'
  | 'unclassified-content'

export interface ParseWarning {
  code: ParseWarningCode
  message: string
}

export interface TeachingStep {
  id: string
  name: string
  duration: string
  content: string
  teacherActivity: string
  studentActivity: string
  intention: string
}

export interface TeachingDesign {
  id: DesignId
  originalFilename: string
  title: string
  topic: string
  duration: string
  knowledgeObjective: string
  skillObjective: string
  literacyObjective: string
  keyPoint: string
  difficultPoint: string
  resources: string
  processSteps: TeachingStep[]
  boardDesign: string
  effectiveness: string
  reflection: string
  additionalContent: string
  warnings: ParseWarning[]
}

export interface TeachingBook {
  schemaVersion: typeof BOOK_SCHEMA_VERSION
  designs: TeachingDesign[]
  selectedId: DesignId | null
  updatedAt: string
}

function createDesignId(): DesignId {
  return crypto.randomUUID() as DesignId
}

export function createTeachingStep(index = 1): TeachingStep {
  return {
    id: crypto.randomUUID(),
    name: `${index}. 教学环节`,
    duration: '',
    content: '',
    teacherActivity: '',
    studentActivity: '',
    intention: '',
  }
}

export function createEmptyTeachingDesign(filename: string): TeachingDesign {
  return {
    id: createDesignId(),
    originalFilename: filename,
    title: '',
    topic: '',
    duration: '',
    knowledgeObjective: '',
    skillObjective: '',
    literacyObjective: '',
    keyPoint: '',
    difficultPoint: '',
    resources: '',
    processSteps: [createTeachingStep()],
    boardDesign: '',
    effectiveness: '',
    reflection: '',
    additionalContent: '',
    warnings: [],
  }
}

export function createEmptyBook(): TeachingBook {
  return {
    schemaVersion: BOOK_SCHEMA_VERSION,
    designs: [],
    selectedId: null,
    updatedAt: new Date().toISOString(),
  }
}
