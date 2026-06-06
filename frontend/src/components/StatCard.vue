<script setup>
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  sub: { type: String, default: '' }
})
</script>

<template>
  <div class="stat-card">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
    <small v-if="sub">{{ sub }}</small>
  </div>
</template>
