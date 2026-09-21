/**
 * Content categories — InterPoll's taxonomy, kept id for id.
 *
 * In their build the list mirrors a backend schema and the trending counts come
 * from a relay's API. Here it is a fixed list in the client and the counts are
 * derived from the nodes this device holds, which is the only honest source in
 * a peer-to-peer app: there is no global tally to ask for, and a peer could
 * claim any number it liked.
 *
 * Content written before categories existed carries none, and reads as `other`.
 */
import {
  tvOutline, musicalNotesOutline, starOutline, bookOutline,
  helpCircleOutline, chatbubblesOutline, businessOutline, codeSlashOutline,
  flaskOutline, cashOutline, heartOutline, trophyOutline, leafOutline,
  schoolOutline, logoBitcoin, gameControllerOutline, happyOutline,
  megaphoneOutline, newspaperOutline, ellipsisHorizontalOutline,
} from 'ionicons/icons'

export interface CategoryDef {
  id: string
  label: string
  icon: string
  /** Hue used for the category's dot and chip, as a CSS colour. */
  tone: string
}

export const ALL_CATEGORIES: CategoryDef[] = [
  { id: 'politics', label: 'Politics', icon: businessOutline, tone: '#fb7185' },
  { id: 'technology', label: 'Technology', icon: codeSlashOutline, tone: '#a78bfa' },
  { id: 'science', label: 'Science', icon: flaskOutline, tone: '#38bdf8' },
  { id: 'finance', label: 'Finance', icon: cashOutline, tone: '#34d399' },
  { id: 'health', label: 'Health', icon: heartOutline, tone: '#f87171' },
  { id: 'sports', label: 'Sports', icon: trophyOutline, tone: '#2dd4bf' },
  { id: 'environment', label: 'Environment', icon: leafOutline, tone: '#4ade80' },
  { id: 'education', label: 'Education', icon: schoolOutline, tone: '#60a5fa' },
  { id: 'crypto', label: 'Crypto', icon: logoBitcoin, tone: '#fbbf24' },
  { id: 'gaming', label: 'Gaming', icon: gameControllerOutline, tone: '#c084fc' },
  { id: 'opinion', label: 'Opinion', icon: chatbubblesOutline, tone: '#7c8cff' },
  { id: 'humour', label: 'Humour', icon: happyOutline, tone: '#fcd34d' },
  { id: 'movies-tv', label: 'Movies & TV', icon: tvOutline, tone: '#f9a8d4' },
  { id: 'music', label: 'Music', icon: musicalNotesOutline, tone: '#c4b5fd' },
  { id: 'celebrity', label: 'Celebrity', icon: starOutline, tone: '#fda4af' },
  { id: 'story', label: 'Story', icon: bookOutline, tone: '#93c5fd' },
  { id: 'ask', label: 'Ask', icon: helpCircleOutline, tone: '#5eead4' },
  { id: 'discussion', label: 'Discussion', icon: megaphoneOutline, tone: '#818cf8' },
  { id: 'news', label: 'News', icon: newspaperOutline, tone: '#a5b4fc' },
]

/** What uncategorised content reads as — never offered as a choice. */
export const OTHER_CATEGORY: CategoryDef = {
  id: 'other',
  label: 'Other',
  icon: ellipsisHorizontalOutline,
  tone: '#9aa1ad',
}

const BY_ID = new Map<string, CategoryDef>(
  [...ALL_CATEGORIES, OTHER_CATEGORY].map(category => [category.id, category])
)

/** The category for an id, falling back to `other` for anything unknown. */
export function categoryFor(id?: string | null): CategoryDef {
  return (id && BY_ID.get(id)) || OTHER_CATEGORY
}

/** The first `count` categories, as the sidebar shows them before "more". */
export function primaryCategories(count = 5): CategoryDef[] {
  return ALL_CATEGORIES.slice(0, count)
}
