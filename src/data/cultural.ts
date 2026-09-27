import type { CulturalContext } from '../types'
import data from '../../content/cultural.json' with { type: 'json' }

export const CULTURAL_CONTEXTS: CulturalContext[] = data.contexts as CulturalContext[]
