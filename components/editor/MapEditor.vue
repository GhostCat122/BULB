<script setup lang="ts">
import { useEventBus, useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import useExportMap from '~/composables/useExportMap'
import useSvgExportMap from '~/composables/useSvgExportMap'
import { useProjectVersionCheck } from '~/composables/useProjectVersionCheck'
import useVersion from '~/composables/useVersion'
import { useEditorView } from '~/stores/useEditorView'
import { useProject } from '~/stores/useProject'
import { ExportSignal, ExportSvgSignal, LineContextKey } from '~/utils/symbols'

const { version, line } = storeToRefs(useProject())
const exportMap = useExportMap()
const exportSignal = useEventBus(ExportSignal)
const exportSvgMap = useSvgExportMap()
const exportSvgSignal = useEventBus(ExportSvgSignal)
const { projectMinimumVersion } = useVersion()
const checkVersion = useProjectVersionCheck()

const el = ref()
const error = ref(false)
const viewport = ref<HTMLElement>()
const deadZone = ref<HTMLElement>()

// Zoom d'affichage : remis à 100 % pendant les exports pour ne pas modifier le résultat
const view = useEditorView()
const exporting = ref(false)
const effectiveZoom = computed(() => (exporting.value ? 1 : view.zoom))

async function withNaturalZoom(task: () => Promise<unknown> | unknown) {
  exporting.value = true
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
  try {
    await task()
  } finally {
    exporting.value = false
  }
}

// Cmd/Ctrl + molette (ou pincement sur trackpad) pour zoomer
useEventListener(viewport, 'wheel', (e: WheelEvent) => {
  if (!e.ctrlKey && !e.metaKey) {
    return
  }
  e.preventDefault()
  view.setZoom(view.zoom * Math.exp(-e.deltaY * 0.0025))
}, { passive: false })

// Ajuster : le plan entier tient dans la zone visible
watch(() => view.fitRequest, () => {
  if (!el.value || !viewport.value || !deadZone.value) {
    return
  }
  const rect = (el.value as HTMLElement).getBoundingClientRect()
  const naturalW = rect.width / view.zoom
  const naturalH = rect.height / view.zoom
  const pad = Number.parseFloat(getComputedStyle(deadZone.value).paddingLeft) || 0
  const availW = viewport.value.clientWidth - 2 * pad - 8
  const availH = viewport.value.clientHeight - 2 * pad - 8
  view.setZoom(Math.min(availW / naturalW, availH / naturalH, 2))
})

provide<LineContext>(LineContextKey, {
  color: computed(() => line.value.color ?? '#000000'),
  lineThickness: computed(() => Number.parseFloat(line.value.lineThickness ?? '1') || 1),
  lineStyle: computed(() => line.value.lineStyle ?? 'PLAIN'),
  dotsColorPolicy: computed(() => line.value.dotsColorPolicy ?? 'INHERIT'),
  frameTerminusNames: computed(() => line.value.frameTerminusNames),
})

function doExport() {
  withNaturalZoom(() => exportMap(el.value))
}

function doExportSvg() {
  withNaturalZoom(() => exportSvgMap(el.value))
}

function onError(e: unknown) {
  console.error(e)
  error.value = true
}

onMounted(() => {
  exportSignal.on(doExport)
  exportSvgSignal.on(doExportSvg)
  checkVersion(version.value, projectMinimumVersion)
})
onBeforeUnmount(() => {
  exportSignal.off(doExport)
  exportSvgSignal.off(doExportSvg)
})
</script>

<template>
  <div class="map-editor">
    <div ref="viewport" class="editor-content">
      <div ref="deadZone" class="dead-zone">
        <NuxtErrorBoundary v-if="!error" @error="onError">
          <div class="zoom-box" :style="{ zoom: effectiveZoom }">
            <div ref="el">
              <LineCanvas />
            </div>
          </div>
        </NuxtErrorBoundary>
        <LineCanvasError v-if="error" />
      </div>
    </div>
    <div class="editor-toolbox">
      <LineSectionToolbox />
      <ToolboxSep />
      <BranchToolbox />
      <div class="flex-grow min-w-1em" />
      <Trash />
    </div>
  </div>
</template>

<style>
:root {
  --base-size: 2;
  --font-size: calc(var(--base-size) * 16px);
}
</style>

<style scoped lang="scss">
.map-editor {
  border: 1px solid var(--p-content-border-color);
  color: var(--p-gray-700);
  height: 100%;
  max-height: 100%;

  display: grid;
  grid-template-rows: 1fr auto;
}

.editor-toolbox {
  padding: .5rem;
  display: flex;
  flex-direction: row;
  align-items: center;
  border-top: 1px solid var(--p-slate-200);
  overflow-x: auto;
  background: var(--p-slate-50);

  & > * {
    flex-shrink: 0;
  }
}

.editor-content {
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: start;
  min-height: 100%;
  min-width: 100%;
}

.dead-zone {
  display: flex;
  align-items: center;
  padding: 5em;
  flex-grow: 1;
  min-width: 100%;
  background: repeating-linear-gradient(45deg, var(--p-gray-50) 0, var(--p-gray-50) 1em, var(--p-gray-100) calc(1em + 1px), var(--p-gray-100) 2em);
  background-size: 100% 100%;
}
</style>
