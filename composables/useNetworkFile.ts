import { useFileDialog } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import { useNetwork } from '~/stores/useNetwork'

/** Import / export du fichier réseau depuis le menu. */
export default function useNetworkFile() {
  const toast = useToast()
  const network = useNetwork()

  const { open, onChange } = useFileDialog({
    accept: 'application/json,.json',
    multiple: false,
    directory: false,
    reset: true,
  })

  onChange(async (files) => {
    const file = files?.[0]
    if (!file) {
      return
    }
    try {
      const warnings = network.importNetwork(JSON.parse(await file.text()), file.name)
      warnings.forEach(w => console.warn(w))
      toast.add({
        summary: 'ui.toasts.network.success.title',
        detail: warnings.length ? 'ui.toasts.network.success.detail_warnings' : 'ui.toasts.network.success.detail',
        severity: warnings.length ? 'warn' : 'success',
        life: 5000,
      })
    } catch (err) {
      console.error(err)
      toast.add({
        summary: 'ui.toasts.network.failure.title',
        detail: 'ui.toasts.network.failure.detail',
        severity: 'error',
        life: 6000,
      })
    }
  })

  function exportNetwork() {
    const { fileName, content } = network.exportNetwork()
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  return { importNetwork: open, exportNetwork, resetNetwork: network.resetNetwork }
}
