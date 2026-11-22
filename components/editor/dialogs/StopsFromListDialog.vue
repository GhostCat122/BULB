<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProject } from '~/stores/useProject'
import { newStop, parseStopList } from '~/utils/stops'

// Création rapide : colle une liste de stations, une par ligne.
const visible = defineModel<boolean>('visible', { required: true })
const { branches } = defineProps<{
  branches: { branch: Branch, label: string }[]
}>()

const { line } = storeToRefs(useProject())
const { t } = useI18n()

const text = ref('')
const markTerminus = ref(true)
const target = ref<string>('new')

const parsed = computed(() => parseStopList(text.value))

const targets = computed(() => [
  ...branches.map(b => ({ value: b.branch.id, label: t('ui.stops_from_list.target_replace', { n: b.label }) })),
  { value: 'new', label: t('ui.stops_from_list.target_new') },
])

watch(visible, (v) => {
  if (v) {
    // Par défaut : remplacer la branche unique si elle est vide, sinon créer une nouvelle branche
    const only = branches.length === 1 ? branches[0].branch : null
    target.value = only && only.$branch.elements.length <= 1 ? only.id : 'new'
  }
})

function apply() {
  const stops = parsed.value.map(s => newStop(s.name, s.subtitle))
  if (stops.length === 0) {
    return
  }
  if (markTerminus.value) {
    stops[0].$stop.terminus = true
    stops[stops.length - 1].$stop.terminus = true
  }

  const existing = branches.find(b => b.branch.id === target.value)
  if (existing) {
    existing.branch.$branch.elements.splice(0, existing.branch.$branch.elements.length, ...stops)
  } else {
    line.value.topology[0].$lineSection.elements.push({
      id: uuidv4(),
      $branch: {
        elementSpacing: 0,
        marginLeft: 0,
        marginRight: 0,
        invertedElements: false,
        elements: stops,
      },
    })
  }
  text.value = ''
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="$t('ui.stops_from_list.header')"
    :style="{ width: 'min(36rem, 95vw)' }"
  >
    <div class="flex flex-col gap-3">
      <p class="text-sm opacity-80 m-0 whitespace-pre-line">
        {{ $t('ui.stops_from_list.help') }}
      </p>
      <Textarea
        v-model="text"
        rows="12"
        class="w-full font-mono text-sm"
        :placeholder="$t('ui.stops_from_list.placeholder')"
        autofocus
      />
      <div class="flex flex-col gap-2">
        <Select v-model="target" :options="targets" option-label="label" option-value="value" class="w-full" />
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox v-model="markTerminus" binary />
          {{ $t('ui.stops_from_list.terminus_ends') }}
        </label>
      </div>
    </div>
    <template #footer>
      <span class="text-sm opacity-70 mr-auto">{{ $t('ui.stops_panel.count', { n: parsed.length }) }}</span>
      <Button :label="$t('ui.stops_from_list.cancel')" severity="secondary" text @click="visible = false" />
      <Button :label="$t('ui.stops_from_list.apply')" icon="i-tabler-check" :disabled="parsed.length === 0" @click="apply()" />
    </template>
  </Dialog>
</template>
