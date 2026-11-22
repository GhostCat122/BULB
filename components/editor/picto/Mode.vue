<script setup lang="ts">
import { computed } from 'vue'

const {
  mode,
} = defineProps<{
  mode: Mode | null
}>()

const circle = computed(() => mode === 'METRO')
const hexagon = computed(() => ['METROLIN', 'EDOMETROLIN'].includes(mode ?? ''))
const panem = computed(() => ['METROLIN', 'EDOMETROLIN', 'HEP', 'HUP'].includes(mode ?? ''))
const roundRectangle = computed(() => ['RER', 'TER', 'TRAIN', 'TRAIN_RER'].includes(mode ?? ''))
const cartouche = computed(() => ['HEP', 'HUP'].includes(mode ?? ''))
const square = computed(() => ['BOAT', 'BUS', 'BRT', 'CABLE', 'NOCTILIEN', 'TRAM', 'VELO'].includes(mode ?? ''))
</script>

<template>
  <div class="relative picto-wrapper">
    <div class="absolute" :class="{ circle, 'round-rectangle': roundRectangle, square, hexagon, cartouche }" />
    <MBoat v-if="mode === 'BOAT'" />
    <MBRT v-if="mode === 'BRT'" />
    <MBus v-if="mode === 'BUS'" />
    <MCable v-if="mode === 'CABLE'" />
    <MMetro v-if="mode === 'METRO'" />
    <MNoctilien v-if="mode === 'NOCTILIEN'" />
    <MRER v-if="mode === 'RER'" />
    <MTram v-if="mode === 'TRAM'" />
    <MTransilien v-if="mode === 'TRAIN'" />
    <MVelo v-if="mode === 'VELO'" />
    <MPanem v-if="panem && mode" :mode="mode" />
  </div>
</template>

<style scoped lang="scss">
.picto-wrapper {
  min-width: 1em;
  min-height: 1em;
}

.circle {
  border-radius: 50%;
  background: white;
  top: .0625em;
  left: .0625em;
  min-width: .875em;
  min-height: .875em;
}

.round-rectangle {
  border-radius: .125em;
  background: white;
  top: .0625em;
  left: .0625em;
  min-width: .875em;
  min-height: .875em;
}

.hexagon {
  background: white;
  top: .04em;
  left: .04em;
  min-width: .92em;
  min-height: .92em;
  clip-path: polygon(100% 50%, 75% 7%, 25% 7%, 0 50%, 25% 93%, 75% 93%);
}

.cartouche {
  border-radius: .12em;
  background: white;
  top: .22em;
  left: .04em;
  min-width: .92em;
  min-height: .56em;
}

.square {
  border-radius: .01em;
  background: white;
  top: .025em;
  min-width: 1em;
  min-height: .95em;
}
</style>
