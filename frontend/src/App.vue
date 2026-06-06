<script setup>
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useThemeStore } from './stores/theme.js'
import { useUiSettingsStore } from './stores/uiSettings.js'

const themeStore = useThemeStore()
const uiSettings = useUiSettingsStore()
const { theme } = storeToRefs(themeStore)

const fontSizeStyle = computed(() => Object.fromEntries(
  Object.entries(uiSettings.display.fontSizes).map(([key, value]) => [key, `${Number(value) || 16}px`])
))
</script>

<template>
  <div class="app-shell" :data-theme="theme" :style="fontSizeStyle">
    <RouterView />
    <div id="printArea" class="print-area" aria-hidden="true"></div>
  </div>
</template>
