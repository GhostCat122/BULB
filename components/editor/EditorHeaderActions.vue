<script setup lang="ts">
import { useEventBus } from '@vueuse/core'
import { ref } from 'vue'
import useLoadProject from '~/composables/useLoadProject'
import { useEditorView } from '~/stores/useEditorView'
import { ExportSignal, ExportSvgSignal } from '~/utils/symbols'

// Actions rapides affichées dans l'en-tête de l'éditeur
const view = useEditorView()
const openProject = useLoadProject()
const exportPng = useEventBus(ExportSignal)
const exportSvg = useEventBus(ExportSvgSignal)
const showSaveDialog = ref(false)
</script>

<template>
  <div class="flex items-center gap-1 flex-wrap">
    <Button
      :icon="view.sidebarCollapsed ? 'i-tabler-layout-sidebar-left-expand' : 'i-tabler-layout-sidebar-left-collapse'"
      :title="$t('ui.editor_view.toggle_sidebar')"
      severity="secondary"
      text
      rounded
      @click="view.toggleSidebar()"
    />
    <div class="sep" />
    <Button icon="i-tabler-zoom-out" :title="$t('ui.editor_view.zoom_out')" severity="secondary" text rounded @click="view.zoomOut()" />
    <Button
      :label="`${Math.round(view.zoom * 100)} %`"
      :title="$t('ui.editor_view.zoom_reset')"
      severity="secondary"
      text
      size="small"
      class="zoom-label"
      @click="view.resetZoom()"
    />
    <Button icon="i-tabler-zoom-in" :title="$t('ui.editor_view.zoom_in')" severity="secondary" text rounded @click="view.zoomIn()" />
    <Button icon="i-tabler-arrows-maximize" :title="$t('ui.editor_view.zoom_fit')" severity="secondary" text rounded @click="view.fit()" />
    <div class="sep" />
    <Button icon="i-tabler-folder-open" :title="$t('ui.menu.open')" severity="secondary" text rounded @click="openProject()" />
    <Button icon="i-tabler-device-floppy" :title="$t('ui.menu.save')" severity="secondary" text rounded @click="showSaveDialog = true" />
    <Button icon="i-tabler-file-type-svg" :title="$t('ui.menu.export_svg')" text rounded @click="exportSvg.emit()" />
    <Button icon="i-tabler-file-type-png" :title="$t('ui.menu.export')" text rounded @click="exportPng.emit()" />
  </div>

  <SaveDialog v-model:visible="showSaveDialog" />
</template>

<style scoped>
.sep {
  width: 1px;
  height: 1.5rem;
  margin: 0 .25rem;
  background: var(--p-content-border-color);
}

.zoom-label {
  min-width: 4.5rem;
  font-variant-numeric: tabular-nums;
}
</style>
