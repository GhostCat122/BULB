<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { computed, ref } from 'vue'
import { useProject } from '~/stores/useProject'
import { newStop } from '~/utils/stops'
import { isBranch, isParallelBranches, isStop } from '~/utils/types'

// Liste éditable de tous les arrêts du plan, branche par branche.
const { line } = storeToRefs(useProject())

interface BranchEntry {
  branch: Branch
  label: string
}

const branches = computed<BranchEntry[]>(() => {
  const out: BranchEntry[] = []
  const scan = (section: LineSection) => {
    for (const element of section.$lineSection.elements) {
      if (isBranch(element)) {
        out.push({ branch: element, label: '' })
      } else if (isParallelBranches(element)) {
        element.$parallelBranches.sections.forEach(scan)
      }
    }
  }
  line.value.topology.forEach(scan)
  return out.map((entry, i) => ({ ...entry, label: `${i + 1}` }))
})

const stopCount = computed(() => branches.value.reduce((n, b) => n + b.branch.$branch.elements.filter(isStop).length, 0))

function addStop(branch: Branch) {
  branch.$branch.elements.push(newStop())
}

function addBranch() {
  const section = line.value.topology[0]
  section.$lineSection.elements.push({
    id: uuidv4(),
    $branch: {
      elementSpacing: 0,
      marginLeft: 0,
      marginRight: 0,
      invertedElements: false,
      elements: [newStop()],
    },
  })
}

function move(branch: Branch, index: number, delta: number) {
  const elements = branch.$branch.elements
  const target = index + delta
  if (target < 0 || target >= elements.length) {
    return
  }
  const [item] = elements.splice(index, 1)
  elements.splice(target, 0, item)
}

function remove(branch: Branch, index: number) {
  branch.$branch.elements.splice(index, 1)
}

function setSubtitle(stop: Stop, value: string) {
  stop.$stop.subtitle = value
  stop.$stop.interestPoint = value.trim().length > 0
}

// Éditeur de correspondances (composant existant)
const connectionsStop = ref<Stop | null>(null)
const showConnections = computed({
  get: () => connectionsStop.value !== null,
  set: (v: boolean) => {
    if (!v) {
      connectionsStop.value = null
    }
  },
})

function connectionCount(stop: Stop): number {
  return stop.$stop.connections.reduce((n, c) => n + ('$modeConnection' in c ? c.$modeConnection.elements.length : c.$serviceConnection.elements.length), 0)
}

const showFromList = ref(false)
</script>

<template>
  <div class="stops-panel">
    <div class="flex items-center justify-between gap-2 mb-3">
      <span class="text-sm opacity-70">{{ $t('ui.stops_panel.count', { n: stopCount }) }}</span>
      <Button
        :label="$t('ui.stops_panel.from_list')"
        icon="i-tabler-clipboard-text"
        size="small"
        @click="showFromList = true"
      />
    </div>

    <div v-if="branches.length === 0" class="empty">
      <p>{{ $t('ui.stops_panel.empty') }}</p>
      <Button :label="$t('ui.stops_panel.create_branch')" icon="i-tabler-plus" size="small" outlined @click="addBranch()" />
    </div>

    <div v-for="entry in branches" :key="entry.branch.id" class="branch">
      <div v-if="branches.length > 1" class="branch-title">
        <span class="i-tabler-git-branch" />
        {{ $t('ui.stops_panel.branch', { n: entry.label }) }}
      </div>

      <div
        v-for="(element, i) in entry.branch.$branch.elements"
        :key="element.id"
        class="row"
        :class="{ spacer: !isStop(element) }"
      >
        <template v-if="isStop(element)">
          <div class="row-main">
            <span class="dot" :class="{ terminus: element.$stop.terminus }" />
            <Textarea
              v-model="element.$stop.name"
              :placeholder="$t('ui.stops_panel.name_placeholder')"
              rows="1"
              auto-resize
              class="name"
            />
          </div>
          <div class="row-sub">
            <InputText
              :model-value="element.$stop.subtitle ?? ''"
              :placeholder="$t('ui.stops_panel.subtitle_placeholder')"
              size="small"
              class="subtitle"
              @update:model-value="(v: string | undefined) => setSubtitle(element, v ?? '')"
            />
            <div class="actions">
              <Button
                :icon="element.$stop.terminus ? 'i-tabler-flag-filled' : 'i-tabler-flag'"
                :title="$t('ui.stops_panel.terminus')"
                :severity="element.$stop.terminus ? 'primary' : 'secondary'"
                text
                rounded
                size="small"
                @click="element.$stop.terminus = !element.$stop.terminus"
              />
              <Button
                icon="i-tabler-arrows-exchange"
                :title="$t('ui.stops_panel.connections')"
                :label="connectionCount(element) ? `${connectionCount(element)}` : undefined"
                severity="secondary"
                text
                rounded
                size="small"
                @click="connectionsStop = element"
              />
              <Button icon="i-tabler-chevron-up" :title="$t('ui.stops_panel.move_up')" severity="secondary" text rounded size="small" :disabled="i === 0" @click="move(entry.branch, i, -1)" />
              <Button icon="i-tabler-chevron-down" :title="$t('ui.stops_panel.move_down')" severity="secondary" text rounded size="small" :disabled="i === entry.branch.$branch.elements.length - 1" @click="move(entry.branch, i, 1)" />
              <Button icon="i-tabler-trash" :title="$t('ui.stops_panel.delete')" severity="danger" text rounded size="small" @click="remove(entry.branch, i)" />
            </div>
          </div>
        </template>
        <template v-else>
          <span class="spacer-label">{{ $t('ui.stops_panel.spacer') }}</span>
          <div class="actions">
            <Button icon="i-tabler-chevron-up" severity="secondary" text rounded size="small" :disabled="i === 0" @click="move(entry.branch, i, -1)" />
            <Button icon="i-tabler-chevron-down" severity="secondary" text rounded size="small" :disabled="i === entry.branch.$branch.elements.length - 1" @click="move(entry.branch, i, 1)" />
            <Button icon="i-tabler-trash" severity="danger" text rounded size="small" @click="remove(entry.branch, i)" />
          </div>
        </template>
      </div>

      <Button
        :label="$t('ui.stops_panel.add_stop')"
        icon="i-tabler-plus"
        size="small"
        text
        class="w-full mt-1"
        @click="addStop(entry.branch)"
      />
    </div>
  </div>

  <ConnectionsEditor
    v-if="connectionsStop"
    v-model:visible="showConnections"
    :stop="connectionsStop"
  />
  <StopsFromListDialog v-model:visible="showFromList" :branches="branches" />
</template>

<style scoped lang="scss">
.stops-panel {
  display: flex;
  flex-direction: column;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: .75rem;
  font-size: .9rem;
  opacity: .85;
}

.branch {
  margin-bottom: 1rem;
}

.branch-title {
  display: flex;
  align-items: center;
  gap: .4rem;
  font-size: .8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .05em;
  opacity: .7;
  margin: .5rem 0;
}

.row {
  display: flex;
  flex-direction: column;
  gap: .25rem;
  padding: .4rem .25rem .25rem;
  border-bottom: 1px solid var(--p-content-border-color);

  &.spacer {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: .1rem .25rem;
    opacity: .7;
  }
}

.row-main {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.row-sub {
  display: flex;
  align-items: center;
  gap: .25rem;
  padding-left: 1.25rem;
}

.name {
  flex: 1;
  font-weight: 600;
  resize: none;
}

.subtitle {
  flex: 1;
  min-width: 0;
  font-size: .8rem;
}

.actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.dot {
  width: .75rem;
  height: .75rem;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid currentColor;
  opacity: .7;

  &.terminus {
    background: currentColor;
  }
}

.spacer-label {
  font-size: .8rem;
  font-style: italic;
}
</style>
