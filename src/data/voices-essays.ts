import data from '../../content/voices-essays.json' with { type: 'json' }

export interface VoiceEssayChip {
  passage: string
  chip: string
}

export interface VoiceEssay {
  paragraphs: string[]
  authorshipChip?: string
  chips?: VoiceEssayChip[]
}

const raw = data as {
  lede: string
  essays: Record<string, VoiceEssay>
}

export const VOICES_LEDE = raw.lede
export const VOICES_ESSAYS: Record<string, VoiceEssay> = raw.essays
