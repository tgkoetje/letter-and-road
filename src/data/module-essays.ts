import data from '../../content/module-essays.json' with { type: 'json' }

export type ModuleEssayId = 'before-paul' | 'after-acts'

export interface ModuleEssayLabel {
  kind: string
  text: string
}

export interface ModuleEssayLetterAnchor {
  passage: string
  chip: string
  note: string
}

export interface ModuleEssaySection {
  id: string
  label: string
  paragraphs: string[]
  confidence?: string
  chips?: string[]
  labels?: ModuleEssayLabel[]
  letterAnchors?: ModuleEssayLetterAnchor[]
}

export interface ModuleEssay {
  id: ModuleEssayId
  title: string
  cardBlurb: string
  lead: string
  sections: ModuleEssaySection[]
}

const essays = data.essays as Record<ModuleEssayId, ModuleEssay>

export const MODULE_ESSAYS = essays

export function getModuleEssay(id: ModuleEssayId | null | undefined): ModuleEssay | null {
  if (!id) return null
  return essays[id] ?? null
}
