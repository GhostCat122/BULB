import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import DEFAULT_NETWORK from '~/data/networks/mpm.json'
import { parseNetwork, serializeNetwork, slugify } from '~/utils/network'
import type { NetworkFile, ParsedNetwork } from '~/utils/network'

/**
 * Réseau courant : celui du dépôt (data/networks/mpm.json) par défaut,
 * ou un réseau importé depuis l'éditeur (mémorisé dans le navigateur).
 */
export const useNetwork = defineStore('network', () => {
  const imported = ref<NetworkFile | null>(null)

  const defaultNetwork = parseNetwork(DEFAULT_NETWORK as unknown as NetworkFile)

  const current = computed<ParsedNetwork>(() => {
    if (imported.value) {
      try {
        return parseNetwork(imported.value)
      } catch (e) {
        console.warn('Réseau importé illisible, retour au réseau par défaut', e)
      }
    }
    return defaultNetwork
  })

  const isDefault = computed(() => imported.value === null)
  const name = computed(() => current.value.name)
  const indices = computed(() => current.value.indices)

  function findById(id: string): CustomLineIndexDescription | null {
    return indices.value.find(it => it.id === id) ?? null
  }

  function getModeIndices(mode: Mode | null): CustomLineIndexDescription[] {
    return indices.value.filter(it => it.mode === mode)
  }

  /** Importe un réseau ; renvoie les avertissements (lignes ignorées). Lève une erreur si invalide. */
  function importNetwork(raw: unknown, fileName: string): string[] {
    const parsed = parseNetwork(raw, fileName.replace(/\.json$/i, ''))
    imported.value = { ...parsed.file, name: parsed.name }
    return parsed.warnings
  }

  function resetNetwork() {
    imported.value = null
  }

  function exportNetwork(): { fileName: string, content: string } {
    return {
      fileName: `${slugify(current.value.name) || 'reseau'}.json`,
      content: serializeNetwork(current.value),
    }
  }

  return {
    imported,
    isDefault,
    name,
    indices,
    findById,
    getModeIndices,
    importNetwork,
    resetNetwork,
    exportNetwork,
  }
}, {
  persist: {
    storage: localStorage,
    pick: ['imported'],
  },
})
