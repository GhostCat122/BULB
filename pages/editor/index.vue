<script setup lang="ts">
import { definePageMeta } from '#imports'
import { useEditorView } from '~/stores/useEditorView'

definePageMeta({
  layout: 'default-fixed-size',
})

const view = useEditorView()
</script>

<template>
  <div class="layout" :class="{ collapsed: view.sidebarCollapsed }">
    <div v-show="!view.sidebarCollapsed" class="sidebar">
      <Tabs v-model:value="view.sidebarTab" class="sidebar-tabs">
        <TabList>
          <Tab value="properties" class="tab">
            <span class="i-tabler-adjustments-horizontal" />
            <span>{{ $t('ui.sidebar.properties') }}</span>
          </Tab>
          <Tab value="stops" class="tab">
            <span class="i-tabler-list-details" />
            <span>{{ $t('ui.sidebar.stops') }}</span>
          </Tab>
          <Tab value="file" class="tab">
            <span class="i-tabler-folder" />
            <span>{{ $t('ui.sidebar.file') }}</span>
          </Tab>
        </TabList>
        <TabPanels class="sidebar-content">
          <TabPanel value="properties">
            <GeneralMapSettings />
          </TabPanel>
          <TabPanel value="stops">
            <StopsPanel />
          </TabPanel>
          <TabPanel value="file">
            <MainMenu />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <Panel
      pt:root:class="flex flex-col min-h-0 max-h-full"
      pt:content-container:class="flex-grow min-h-0"
      pt:content:class="h-full"
    >
      <template #header>
        <div class="editor-header">
          <span class="font-semibold">{{ $t('ui.map_editor.title') }}</span>
          <EditorHeaderActions />
        </div>
      </template>
      <MapEditor />
    </Panel>
  </div>

  <BrowserCheck />
</template>

<style scoped lang="scss">
.layout {
  display: grid;
  grid-template-columns: 24rem 1fr;
  gap: .5rem;
  min-height: 0;
  max-height: 100%;

  &.collapsed {
    grid-template-columns: 1fr;
  }
}

.sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--p-panel-border-color);
  border-radius: var(--p-panel-border-radius);
  background: var(--p-panel-background);
  overflow: hidden;
}

.sidebar-tabs {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.tab {
  display: flex;
  align-items: center;
  gap: .4rem;
  flex: 1;
  justify-content: center;
  padding: .75rem .5rem;
}

.sidebar-content {
  flex-grow: 1;
  min-height: 0;
  overflow-y: auto;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  flex-wrap: wrap;
}

@media (max-width: 1024px) {
  .layout,
  .layout.collapsed {
    display: flex;
    flex-direction: column;
  }

  .sidebar {
    order: 1;
    max-height: none;
  }
}
</style>
