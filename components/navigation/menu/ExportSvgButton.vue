<script lang="ts" setup>
import { useEventBus } from '@vueuse/core'
import { ExportSvgSignal } from '~/utils/symbols'

const exportSvgSignal = useEventBus(ExportSvgSignal)

function doExport() {
  exportSvgSignal.emit()
}
</script>

<template>
  <Button
    pt:root:class="important-justify-start"
    :label="$t('ui.menu.export_svg')"
    icon="i-tabler-file-type-svg"
    text
    @click="doExport()"
  />
</template>
