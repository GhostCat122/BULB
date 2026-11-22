/*
 * Fichier « réseau » : la liste des lignes (indices) d'un réseau, séparée des plans.
 *
 * Format accepté (le même que lignes_MPM_*.json, avec deux ajouts facultatifs) :
 *
 *   {
 *     "name": "Mumta Panem Marsanos",
 *     "modes": { "Métrolin": "METROLIN", "HEP": "HEP" },      ← type → mode BULB (facultatif)
 *     "lines": [
 *       { "id": "hep-A", "type": "HEP", "code": "A", "name": "HEP Azéotro",
 *         "primary_color": "#EC1E2B", "secondary_color": "#FFFFFF" }
 *     ]
 *   }
 *
 * - Un simple tableau de lignes (sans "name" ni "modes") est aussi accepté.
 * - "id" est facultatif : s'il manque, il vaut « type-code » (ex. « hep-A », « metrolin-12 »).
 *   C'est cet identifiant que les plans retiennent : garde-le fixe si tu renommes une ligne.
 * - Champs facultatifs par ligne : "mode" (prioritaire sur "modes"), "shape"
 *   (CIRCLE, ROUNDED_SQUARE, RECTANGLE, CUT_RECTANGLE, LINES), "prefix", "suffix".
 * - Les autres champs (color_name, etc.) sont conservés tels quels à l'export.
 */
import { modeToShape } from '~/data/modes'

export interface NetworkLine {
  id?: string
  type: string
  code: string
  name?: string
  primary_color: string
  secondary_color?: string
  mode?: Mode
  shape?: IndexShape
  prefix?: string
  suffix?: string
  [extra: string]: unknown
}

export interface NetworkFile {
  name?: string
  modes?: Record<string, Mode>
  lines: NetworkLine[]
}

export interface ParsedNetwork {
  name: string
  file: NetworkFile
  indices: CustomLineIndexDescription[]
  warnings: string[]
}

const KNOWN_MODES: Mode[] = ['BOAT', 'BRT', 'BUS', 'CABLE', 'METRO', 'NOCTILIEN', 'RER', 'TRAIN', 'TRAIN_RER', 'TRAM', 'VELO', 'METROLIN', 'EDOMETROLIN', 'HEP', 'HUP']
const KNOWN_SHAPES: IndexShape[] = ['CIRCLE', 'ROUNDED_SQUARE', 'LINES', 'RECTANGLE', 'CUT_RECTANGLE']

/** Correspondances par défaut entre un « type » écrit librement et un mode BULB. */
const DEFAULT_TYPE_MODES: Record<string, Mode> = {
  'metrolin': 'METROLIN',
  'edometrolin': 'EDOMETROLIN',
  'hep': 'HEP',
  'hup': 'HUP',
  'metro': 'METRO',
  'rer': 'RER',
  'tram': 'TRAM',
  'tramway': 'TRAM',
  'transilien': 'TRAIN',
  'train': 'TRAIN',
  'bus': 'BUS',
  'brt': 'BRT',
  'bhns': 'BRT',
  'cable': 'CABLE',
  'telepherique': 'CABLE',
  'boat': 'BOAT',
  'bateau': 'BOAT',
  'noctilien': 'NOCTILIEN',
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function networkLineId(line: NetworkLine): string {
  return (typeof line.id === 'string' && line.id.trim()) || `${slugify(String(line.type))}-${String(line.code)}`
}

function resolveMode(line: NetworkLine, modes: Record<string, Mode>): Mode | null {
  if (line.mode && KNOWN_MODES.includes(line.mode)) {
    return line.mode
  }
  const explicit = modes[line.type]
  if (explicit && KNOWN_MODES.includes(explicit)) {
    return explicit
  }
  const upper = line.type.toUpperCase() as Mode
  if (KNOWN_MODES.includes(upper)) {
    return upper
  }
  return DEFAULT_TYPE_MODES[slugify(line.type)] ?? null
}

/** Libellé lisible : « HEP A – Azéotro », « Métrolin 12 », « Édométrolin α – Alpha ». */
function lineLabel(line: NetworkLine): string {
  const base = `${line.type} ${line.code}`
  let extra = (line.name ?? '').trim()
  if (extra.toLowerCase().startsWith(line.type.toLowerCase())) {
    extra = extra.slice(line.type.length).trim()
  }
  extra = extra.replace(/\(à nommer\)/i, '').trim()
  if (!extra || extra === line.code) {
    return base
  }
  return `${base} – ${extra}`
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Lit et valide un fichier réseau (objet JSON déjà parsé). Lève une erreur si inutilisable. */
export function parseNetwork(raw: unknown, fallbackName = 'Réseau'): ParsedNetwork {
  let file: NetworkFile
  if (Array.isArray(raw)) {
    file = { lines: raw as NetworkLine[] }
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as NetworkFile).lines)) {
    file = raw as NetworkFile
  } else {
    throw new Error('Format de réseau non reconnu : il faut un tableau de lignes ou un objet { "lines": [...] }')
  }

  const modes = file.modes ?? {}
  const warnings: string[] = []
  const seen = new Set<string>()
  const indices: CustomLineIndexDescription[] = []

  file.lines.forEach((line, i) => {
    if (!line || typeof line !== 'object' || !line.type || line.code === undefined || line.code === null) {
      warnings.push(`Ligne n°${i + 1} ignorée : « type » et « code » sont obligatoires`)
      return
    }
    const code = String(line.code)
    const id = networkLineId(line)
    if (seen.has(id)) {
      warnings.push(`Ligne « ${id} » ignorée : identifiant en double`)
      return
    }
    const mode = resolveMode(line, modes)
    if (!mode) {
      warnings.push(`Ligne « ${id} » ignorée : type « ${line.type} » sans mode correspondant (ajoute-le dans "modes")`)
      return
    }
    if (!HEX.test(line.primary_color ?? '')) {
      warnings.push(`Ligne « ${id} » ignorée : couleur principale invalide (${line.primary_color})`)
      return
    }
    seen.add(id)
    indices.push({
      id,
      mode,
      shape: line.shape && KNOWN_SHAPES.includes(line.shape) ? line.shape : modeToShape(mode),
      prefix: line.prefix ?? '',
      index: code,
      suffix: line.suffix ?? '',
      color: line.primary_color,
      textColor: line.secondary_color && HEX.test(line.secondary_color) ? line.secondary_color : undefined,
      name: lineLabel({ ...line, code }),
    })
  })

  if (indices.length === 0) {
    throw new Error(`Aucune ligne utilisable dans ce réseau${warnings.length ? ` (${warnings[0]})` : ''}`)
  }

  return { name: file.name?.trim() || fallbackName, file, indices, warnings }
}

/** Version du fichier prête à être exportée : identifiants explicités, nom renseigné. */
export function serializeNetwork(network: ParsedNetwork): string {
  const { name: _name, lines: _lines, ...others } = network.file
  const file: NetworkFile = {
    name: network.name,
    ...others,
    lines:network.file.lines.map((line) => {
      if (!line || !line.type) {
        return line
      }
      const { id: _id, ...rest } = line
      return { id: networkLineId(line), ...rest }
    }),
  }
  return `${JSON.stringify(file, null, 2)}\n`
}
