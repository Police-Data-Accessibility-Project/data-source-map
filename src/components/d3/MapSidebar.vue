<template>
  <div class="map-sidebar" :class="{ visible: locations.length > 0 }">
    <h3 class="text-lg font-bold mb-4">Selected Location</h3>
    <div v-if="locations.length > 0">
      <div v-for="(location, index) in locations" :key="index" class="mb-4">
        <h4 class="font-semibold">{{ location.name || location.type }}</h4>
        <div v-if="location.data" class="mt-2">
          <div v-if="location.data.source_count !== undefined" class="flex justify-between">
            <span>Data Sources:</span>
            <span class="font-medium">{{ location.data.source_count }}</span>
          </div>
          <div v-if="location.data.name" class="flex justify-between">
            <span>Name:</span>
            <span class="font-medium">{{ location.data.name }}</span>
          </div>
          <div v-if="location.data.state_iso" class="flex justify-between">
            <span>State:</span>
            <span class="font-medium">{{ location.data.state_iso }}</span>
          </div>
          <div v-if="location.data.fips" class="flex justify-between">
            <span>FIPS:</span>
            <span class="font-medium">{{ location.data.fips }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  locations: {
    type: Array,
    required: true,
    default: () => []
  }
});
</script>