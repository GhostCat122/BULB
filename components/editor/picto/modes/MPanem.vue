<script setup lang="ts">
import { computed } from 'vue'
import EDOMETROLIN from '~/assets/svg/modes/panem/edometrolin.svg'
import HEP from '~/assets/svg/modes/panem/hep.svg'
import HUP from '~/assets/svg/modes/panem/hup.svg'
import METROLIN from '~/assets/svg/modes/panem/metrolin.svg'

// Pictogrammes des modes de Panem.
// Pour changer un logo, remplacer le fichier SVG correspondant dans assets/svg/modes/panem/
// (dessin d'une seule couleur : il est recoloré automatiquement comme les autres pictos).
const { mode } = defineProps<{
  mode: Mode
}>()

const logo = computed(() => {
  switch (mode) {
    case 'METROLIN':
      return METROLIN
    case 'EDOMETROLIN':
      return EDOMETROLIN
    case 'HEP':
      return HEP
    case 'HUP':
      return HUP
    default:
      return null
  }
})
</script>

<template>
  <div class="picto">
    <div v-if="logo" class="layer1" :style="{ maskImage: `url(&quot;${logo}&quot;)`, WebkitMaskImage: `url(&quot;${logo}&quot;)` }" />
  </div>
</template>

<style scoped lang="scss">
.picto {
  position: relative;
  min-width: 1em;
  min-height: 1em;

  .layer1 {
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
    -webkit-mask-size: contain;
    background-color: var(--blue-ratp-paper);
  }

  & > div {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
}
</style>
