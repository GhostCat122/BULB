import { v4 as uuidv4 } from 'uuid'

/** Crée un arrêt vide (mêmes valeurs par défaut que la boîte à outils). */
export function newStop(name = '', subtitle = ''): Stop {
  return {
    id: uuidv4(),
    $stop: {
      name,
      subtitle,
      placeName: '',
      accessible: 'undefined',
      reverse: false,
      interestPoint: subtitle.length > 0,
      preventSubtitleOverlapping: true,
      terminus: false,
      closed: false,
      connections: [],
    },
  }
}

export interface ParsedStopLine {
  name: string
  subtitle: string
}

/**
 * Lit une liste de stations collée : une station par ligne.
 * - « Nom | Sous-titre » pour ajouter un sous-titre (point d'intérêt) ;
 * - « // » dans le nom pour forcer un retour à la ligne (ex. « Château // de Vincennes ») ;
 * - les lignes vides et celles qui commencent par # sont ignorées ;
 * - les puces ou numéros en début de ligne (« - », « • », « 1. ») sont retirés.
 */
export function parseStopList(text: string): ParsedStopLine[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))
    .map((l) => {
      const cleaned = l.replace(/^(?:[-•*–]\s+|\d+[.)]\s+)/, '')
      const [name, ...rest] = cleaned.split('|')
      return {
        name: name.trim().replace(/\s*\/\/\s*/g, '\n'),
        subtitle: rest.join('|').trim(),
      }
    })
    .filter(s => s.name.length > 0)
}
