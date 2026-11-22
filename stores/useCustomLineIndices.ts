import { defineStore } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { ref } from 'vue'
import { modeToShape } from '~/data/modes'
import { useNetwork } from '~/stores/useNetwork'

export const useCustomLineIndices = defineStore('customLineIndices', () => {
  const indices = ref<CustomLineIndexDescription[]>([])
  const network = useNetwork()

  // Indices personnalisés locaux (hors lignes du réseau courant)
  function getModeIndices(mode: Mode | null): CustomLineIndexDescription[] {
    return indices.value.filter(index => index.mode === mode && !network.findById(index.id))
  }

  // Le réseau courant passe avant les copies locales (celles enregistrées dans les plans)
  function findIndexById(id: string): CustomLineIndexDescription | null {
    return network.findById(id) ?? indices.value.find(index => index.id === id) ?? null
  }

  function deleteById(id: string): void {
    const index = findIndexById(id)
    if (index) {
      indices.value.splice(indices.value.indexOf(index), 1)
    }
  }

  function createNewIndex(mode: Mode): CustomLineIndexDescription {
    const newIndex: CustomLineIndexDescription = {
      id: uuidv4(),
      shape: modeToShape(mode),
      mode,
      prefix: '',
      index: '',
      suffix: '',
      color: '#000000',
    }
    indices.value.push(newIndex)

    return newIndex
  }

  return {
    indices,
    getModeIndices,
    findIndexById,
    deleteById,
    createNewIndex,
  }
}, {
  persist: {
    storage: localStorage,
  },
})
