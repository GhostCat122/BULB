<script setup lang="ts">
import type Popover from 'primevue/popover'
import { v4 as uuidv4 } from 'uuid'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getLinesByMode } from '~/data/lines'
import { MODES } from '~/data/modes'
import { SERVICES } from '~/data/services'
import { useCustomLineIndices } from '~/stores/useCustomLineIndices'
import { useNetwork } from '~/stores/useNetwork'
import { isMode, isService } from '~/utils/types'

/*
 * Éditeur de correspondances d'un arrêt.
 * - Ajout rapide : on cherche une ligne (tous modes confondus) ou un service, elle se range
 *   automatiquement dans le groupe de son mode.
 * - Chaque groupe = une rangée : pictogramme du mode, pastilles des lignes, options.
 * - Clic sur une pastille : options de la ligne (piéton, décoration, retrait).
 * - Aperçu en direct en haut.
 */
const visible = defineModel<boolean>('visible')
const stop = defineModel<Stop>('stop', { required: true })

const { t } = useI18n()
const network = useNetwork()
const custom = useCustomLineIndices()

const connections = computed(() => stop.value.$stop.connections)

/* ---------------------------- Ajout rapide ---------------------------- */

interface LineOption {
  key: string
  label: string
  search: string
  mode: Mode
  value: LineIndex
}

// Recherche insensible aux accents : « metrolin » trouve « Métrolin »
function searchable(text: string): string {
  return `${text} ${text.normalize('NFKD').replace(/[\u0300-\u036F]/g, '')}`
}

const lineGroups = computed(() => MODES.map((m) => {
  const modeLabel = t(m.label)
  const items: LineOption[] = []
  for (const choice of getLinesByMode(m.value)) {
    items.push({ key: `b-${m.value}-${choice.value.$builtinLineIndex.index}`, label: choice.label, search: searchable(`${modeLabel} ${choice.label}`), mode: m.value, value: choice.value })
  }
  for (const c of [...network.getModeIndices(m.value), ...custom.getModeIndices(m.value)]) {
    const label = c.name ?? `${modeLabel} ${c.prefix ?? ''}${c.index}${c.suffix ?? ''}`
    items.push({ key: `c-${c.id}`, label, search: searchable(`${modeLabel} ${label}`), mode: m.value, value: { mode: m.value, $customLineIndex: { id: c.id } } })
  }
  return { label: modeLabel, mode: m.value, items }
}).filter(g => g.items.length > 0))

const quickLine = ref<LineOption | null>(null)
const quickService = ref<ServiceChoice | null>(null)

function sameIndex(a: LineIndex | null, b: LineIndex | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function addLine(option: LineOption | null) {
  if (!option) {
    return
  }
  const list = stop.value.$stop.connections
  let group = list.find(c => isMode(c) && c.$modeConnection.mode === option.mode) as ModeConnection | undefined
  if (!group) {
    list.push({ id: uuidv4(), $modeConnection: { mode: option.mode, elements: [], walk: false } })
    group = list[list.length - 1] as ModeConnection
  }
  if (!group.$modeConnection.elements.some(e => sameIndex(e.$modeConnectionElement.lineIndex, option.value))) {
    group.$modeConnection.elements.push({
      id: uuidv4(),
      $modeConnectionElement: { lineIndex: JSON.parse(JSON.stringify(option.value)), walk: false, ornament: null },
    })
  }
}

function addService(choice: ServiceChoice | null) {
  if (!choice) {
    return
  }
  const list = stop.value.$stop.connections
  let group = list.find(c => isService(c)) as ServiceConnection | undefined
  if (!group) {
    list.push({ id: uuidv4(), $serviceConnection: { elements: [], walk: false } })
    group = list[list.length - 1] as ServiceConnection
  }
  if (!group.$serviceConnection.elements.some(e => e.$serviceConnectionElement.service === choice.value)) {
    group.$serviceConnection.elements.push({
      id: uuidv4(),
      $serviceConnectionElement: { service: choice.value, ornament: null },
    })
  }
}

// Une fois la ligne / le service ajouté, le champ redevient vide pour enchaîner les ajouts
watch(quickLine, async (option) => {
  if (option) {
    addLine(option)
    await nextTick()
    quickLine.value = null
  }
})
watch(quickService, async (choice) => {
  if (choice) {
    addService(choice)
    await nextTick()
    quickService.value = null
  }
})

/* ------------------------------- Groupes ------------------------------- */

function moveGroup(index: number, delta: number) {
  const list = stop.value.$stop.connections
  const target = index + delta
  if (target < 0 || target >= list.length) {
    return
  }
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
}

function deleteGroup(index: number) {
  stop.value.$stop.connections.splice(index, 1)
}

function groupElements(c: Connection): (ModeConnectionElement | ServiceConnectionElement)[] {
  return isMode(c) ? c.$modeConnection.elements : c.$serviceConnection.elements
}

function hasWalkingLine(c: ModeConnection): boolean {
  return c.$modeConnection.elements.some(e => e.$modeConnectionElement.walk)
}

/* --------------------------- Options d'une ligne --------------------------- */

const popover = ref<InstanceType<typeof Popover> | null>(null)
const selected = ref<{ group: number, element: number } | null>(null)

const selectedGroup = computed(() => (selected.value ? connections.value[selected.value.group] : null))
const selectedElement = computed(() => {
  if (!selected.value || !selectedGroup.value) {
    return null
  }
  return groupElements(selectedGroup.value)[selected.value.element] ?? null
})
const selectedLine = computed(() => (selectedElement.value && '$modeConnectionElement' in selectedElement.value ? selectedElement.value : null))
const selectedService = computed(() => (selectedElement.value && '$serviceConnectionElement' in selectedElement.value ? selectedElement.value : null))
const selectedMode = computed(() => (selectedGroup.value && isMode(selectedGroup.value) ? selectedGroup.value.$modeConnection.mode : null))

// Même règle que l'éditeur d'origine : une seule ligne « piétonne » par groupe, jamais la première
const lineWalkDisabled = computed(() => {
  const g = selectedGroup.value
  const line = selectedLine.value
  if (!g || !isMode(g) || !line || !selected.value) {
    return true
  }
  if (line.$modeConnectionElement.walk) {
    return false
  }
  return selectedMode.value === 'BUS' || selectedMode.value === 'NOCTILIEN' || g.$modeConnection.walk || hasWalkingLine(g) || selected.value.element === 0
})

function openOptions(event: Event, group: number, element: number) {
  selected.value = { group, element }
  popover.value?.show(event)
}

function removeSelected() {
  if (!selected.value || !selectedGroup.value) {
    return
  }
  const elements = groupElements(selectedGroup.value)
  elements.splice(selected.value.element, 1)
  if (elements.length === 0) {
    deleteGroup(selected.value.group)
  }
  popover.value?.hide()
  selected.value = null
}

/* ------------------------------ Décorations ------------------------------ */

const showOrnamentEditor = ref(false)
const ornament = computed<Ornament | null>({
  get: () => {
    if (selectedLine.value) {
      return selectedLine.value.$modeConnectionElement.ornament
    }
    if (selectedService.value) {
      return selectedService.value.$serviceConnectionElement.ornament
    }
    return null
  },
  set: (value) => {
    if (selectedLine.value) {
      selectedLine.value.$modeConnectionElement.ornament = value
    } else if (selectedService.value) {
      selectedService.value.$serviceConnectionElement.ornament = value
    }
  },
})
const ornamentTypes = computed<OrnamentType[] | undefined>(() => {
  if (selectedService.value?.$serviceConnectionElement.service === 'AIRPORT') {
    return ['AIRPORT_NAME']
  }
  if (selectedMode.value === 'BUS' || selectedMode.value === 'NOCTILIEN') {
    return []
  }
  return undefined
})

function editOrnament() {
  popover.value?.hide()
  showOrnamentEditor.value = true
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="$t('ui.dialogs.connections_editor.header', { stopName: stop.$stop.name.replace('\n', ' ') })"
    :style="{ width: 'min(48rem, 96vw)' }"
  >
    <div class="flex flex-col gap-4">
      <!-- Aperçu -->
      <div class="preview">
        <Connections v-if="connections.length" :connections="connections" />
        <span v-else class="empty">{{ $t('ui.dialogs.connections_editor.empty') }}</span>
      </div>

      <!-- Ajout rapide -->
      <div class="quick-add">
        <Select
          v-model="quickLine"
          :options="lineGroups"
          option-group-label="label"
          option-group-children="items"
          option-label="label"
          :filter-fields="['search']"
          :placeholder="$t('ui.dialogs.connections_editor.add_line')"
          filter
          auto-filter-focus
          reset-filter-on-hide
          class="flex-[2] min-w-0"
        >
          <template #optiongroup="{ option }">
            <div class="flex items-center gap-2 font-semibold">
              <Mode class="text-1.25em" :mode="option.mode" />
              <span>{{ option.label }}</span>
            </div>
          </template>
          <template #option="{ option }">
            <div class="flex items-center gap-3">
              <LineIndex class="text-1.25em" :mode="option.mode" :index="option.value" />
              <span>{{ option.label }}</span>
            </div>
          </template>
        </Select>
        <Select
          v-model="quickService"
          :options="SERVICES"
          option-label="label"
          :placeholder="$t('ui.dialogs.connections_editor.add_service')"
          class="flex-1 min-w-0"
        >
          <template #option="{ option }">
            <div class="flex items-center gap-3">
              <Service class="text-xl" :service="option.value" />
              <span>{{ $t(option.label.toLowerCase()) }}</span>
            </div>
          </template>
        </Select>
      </div>

      <!-- Groupes -->
      <div v-if="connections.length" class="groups">
        <div v-for="(connection, gi) in connections" :key="connection.id" class="group">
          <div class="group-mode">
            <template v-if="isMode(connection)">
              <Mode v-if="connection.$modeConnection.mode" class="text-2xl" :mode="connection.$modeConnection.mode" />
              <ModeSelect v-else v-model="connection.$modeConnection.mode" />
            </template>
            <span v-else class="service-label">{{ $t('ui.dialogs.connections_editor.services') }}</span>
          </div>

          <div class="chips">
            <button
              v-for="(element, ei) in groupElements(connection)"
              :key="element.id"
              type="button"
              class="chip"
              :title="$t('ui.dialogs.connections_editor.line_options')"
              @click="openOptions($event, gi, ei)"
            >
              <template v-if="'$modeConnectionElement' in element">
                <span v-if="element.$modeConnectionElement.walk" class="i-tabler-walk" />
                <LineIndex
                  v-if="element.$modeConnectionElement.lineIndex"
                  class="text-xl"
                  :mode="isMode(connection) ? connection.$modeConnection.mode : null"
                  :index="element.$modeConnectionElement.lineIndex"
                />
                <span v-else class="text-sm opacity-70">?</span>
                <span v-if="element.$modeConnectionElement.ornament" class="i-tabler-sparkles text-xs" />
              </template>
              <template v-else>
                <Service v-if="element.$serviceConnectionElement.service" class="text-xl" :service="element.$serviceConnectionElement.service" />
                <span v-else class="text-sm opacity-70">?</span>
                <span v-if="element.$serviceConnectionElement.ornament" class="i-tabler-sparkles text-xs" />
              </template>
            </button>
          </div>

          <div class="group-actions">
            <ToggleButton
              v-if="isMode(connection)"
              v-model="connection.$modeConnection.walk"
              :disabled="hasWalkingLine(connection)"
              on-icon="i-tabler-walk"
              off-icon="i-tabler-walk"
              on-label=""
              off-label=""
              size="small"
              :title="$t('ui.dialogs.connections_editor.group_walk')"
            />
            <ToggleButton
              v-else
              v-model="connection.$serviceConnection.walk"
              on-icon="i-tabler-walk"
              off-icon="i-tabler-walk"
              on-label=""
              off-label=""
              size="small"
              :title="$t('ui.dialogs.connections_editor.group_walk')"
            />
            <Button icon="i-tabler-chevron-up" severity="secondary" text rounded size="small" :disabled="gi === 0" :title="$t('ui.stops_panel.move_up')" @click="moveGroup(gi, -1)" />
            <Button icon="i-tabler-chevron-down" severity="secondary" text rounded size="small" :disabled="gi === connections.length - 1" :title="$t('ui.stops_panel.move_down')" @click="moveGroup(gi, 1)" />
            <Button icon="i-tabler-trash" severity="danger" text rounded size="small" :title="$t('ui.dialogs.connections_editor.group.delete')" @click="deleteGroup(gi)" />
          </div>
        </div>
      </div>
      <p class="hint">
        {{ $t('ui.dialogs.connections_editor.hint') }}
      </p>
    </div>
  </Dialog>

  <!-- Options d'une ligne / d'un service -->
  <Popover ref="popover">
    <div v-if="selectedElement" class="flex flex-col gap-3 min-w-16rem">
      <template v-if="selectedLine">
        <IndexSelect v-model="selectedLine.$modeConnectionElement.lineIndex" :mode="selectedMode" />
        <label class="flex items-center gap-2 text-sm" :class="{ 'opacity-50': lineWalkDisabled }">
          <Checkbox v-model="selectedLine.$modeConnectionElement.walk" binary :disabled="lineWalkDisabled" />
          {{ $t('ui.dialogs.connections_editor.line_walk') }}
        </label>
      </template>
      <ServiceSelect v-else-if="selectedService" v-model="selectedService.$serviceConnectionElement.service" />
      <div class="flex gap-2">
        <Button
          class="flex-grow"
          size="small"
          icon="i-tabler-sparkles"
          :label="$t('ui.dialogs.connections_editor.group.ornament')"
          :severity="ornament ? 'primary' : 'secondary'"
          :disabled="ornamentTypes !== undefined && ornamentTypes.length === 0"
          @click="editOrnament()"
        />
        <Button size="small" severity="danger" icon="i-tabler-x" :label="$t('ui.dialogs.connections_editor.remove')" @click="removeSelected()" />
      </div>
    </div>
  </Popover>

  <OrnamentEditor
    v-model="ornament"
    v-model:visible="showOrnamentEditor"
    :permitted-types="ornamentTypes"
  />
</template>

<style scoped lang="scss">
.preview {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 4rem;
  padding: 1rem;
  border-radius: .5rem;
  background: white;
  color: var(--blue-ratp-paper, #1f3c90);
  font-family: 'Parisine Ptf', sans-serif;
  font-size: 24px;
  overflow-x: auto;

  .empty {
    font-family: var(--p-font-family, sans-serif);
    font-size: .9rem;
    color: #6b7280;
    align-self: center;
  }
}

.quick-add {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}

.groups {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-content-border-color);
  border-radius: .5rem;
}

.group {
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .5rem .75rem;

  & + & {
    border-top: 1px solid var(--p-content-border-color);
  }
}

.group-mode {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.5rem;
  flex-shrink: 0;
}

.service-label {
  font-size: .75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  opacity: .7;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
  flex: 1;
  min-width: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: .25rem;
  padding: .2rem .35rem;
  border-radius: .4rem;
  border: 1px solid transparent;
  background: white;
  color: #1f3c90;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s;

  &:hover {
    border-color: var(--p-primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color) 25%, transparent);
  }
}

.group-actions {
  display: flex;
  align-items: center;
  gap: .1rem;
  flex-shrink: 0;
}

.hint {
  margin: 0;
  font-size: .8rem;
  opacity: .65;
}
</style>
