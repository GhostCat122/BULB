import { useToast } from 'primevue/usetoast'
import { domToSvg } from '~/utils/svgExport'

export default function useSvgExportMap() {
  const toast = useToast()

  async function exportSvg(mapContainer: HTMLElement) {
    try {
      const svg = await domToSvg(mapContainer)
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = 'map.svg'
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)

      toast.add({
        summary: 'ui.toasts.export.success.title',
        detail: 'ui.toasts.export.success.detail',
        severity: 'success',
        life: 5000,
      })
    } catch (err) {
      console.error(err)
      toast.add({
        summary: 'ui.toasts.export.failure.title',
        detail: 'ui.toasts.export.failure.detail',
        severity: 'error',
        life: 5000,
      })
    }
  }

  return exportSvg
}
