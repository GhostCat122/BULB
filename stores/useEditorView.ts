import { defineStore } from 'pinia'
import { ref } from 'vue'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 3

/** Réglages d'affichage de l'éditeur (zoom, barre latérale), mémorisés dans le navigateur. */
export const useEditorView = defineStore('editorView', () => {
  const zoom = ref(1)
  const sidebarCollapsed = ref(false)
  const sidebarTab = ref<'properties' | 'stops' | 'file'>('properties')
  /** Incrémenté pour demander à l'éditeur d'ajuster le zoom à la taille du plan. */
  const fitRequest = ref(0)

  function setZoom(value: number) {
    zoom.value = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)) * 100) / 100
  }

  function zoomIn() {
    setZoom(zoom.value * 1.2)
  }

  function zoomOut() {
    setZoom(zoom.value / 1.2)
  }

  function resetZoom() {
    setZoom(1)
  }

  function fit() {
    fitRequest.value++
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return { zoom, sidebarCollapsed, sidebarTab, fitRequest, setZoom, zoomIn, zoomOut, resetZoom, fit, toggleSidebar }
}, {
  persist: {
    storage: localStorage,
    pick: ['zoom', 'sidebarCollapsed', 'sidebarTab'],
  },
})
