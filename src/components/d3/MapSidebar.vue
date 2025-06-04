<template>
  <div class="map-sidebar" :class="{ visible: locations.length > 0 }">
    <!-- 1. Header with back button and title -->
    <div class="flex items-start content-between w-full">
      <button @click="handleBackClick" class="back-button">
        <font-awesome-icon icon="fa-solid fa-chevron-left" />
      </button>
      <h3 class="text-lg font-bold mb-0 mt-0 text-right w-full">{{ headerTitle }}</h3>
    </div>

    <hr class="my-4 border-neutral-500/50" />

    <!-- 2. First action block -->
    <div class="action-block mb-6">
      <router-link 
        :to="`/search/results?location_id=${activeLocation?.data?.location_id || ''}`" 
        class="pdap-button-secondary mb-2 w-full max-w-full text-center flex items-center gap-2"
      >
        View all data sources <font-awesome-icon icon="fa-solid fa-arrow-right" />
      </router-link>
      <Button 
        variant="primary" 
        class="w-full max-w-full" 
        @click="$emit('on-follow', activeLocation?.data?.location_id)"
      >
        Follow for updates
      </Button>
    </div>

    <!-- 3. Content section -->
    <div class="content-section">
      <!-- State level: show counties -->
      <div v-if="activeLocationType === 'state' && countiesInState.length">
        <div v-for="county in countiesInState.toSorted((a,b) => b.source_count - a.source_count)" :key="county.fips" class="location-item">
          <button @click="selectLocation('county', county)" class="location-button">
            <div class="location-name">{{ county.name }}</div>
            <div class="flex justify-between w-full">
              <router-link :to="`/search/results?location_id=${county.location_id}`" class="source-count" @click.stop>
                {{ county.source_count }} sources <font-awesome-icon icon="fa-solid fa-arrow-right" />
              </router-link>
            </div>
          </button>
        </div>
      </div>

      <!-- County level: show localities -->
      <div v-if="activeLocationType === 'county' && localitiesInCounty.length">
        <div v-for="locality in localitiesInCounty.toSorted((a,b) => b.source_count - a.source_count)" :key="locality.id" class="location-item">
          <button @click="selectLocation('locality', locality)" class="location-button">
            <div class="location-name">{{ locality.name }}</div>
            <div class="flex justify-between w-full">
              <router-link :to="`/search/results?location_id=${locality.location_id}`" class="source-count" @click.stop>
                {{ locality.source_count }} sources <font-awesome-icon icon="fa-solid fa-arrow-right" />
              </router-link>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 4. Second action block (pinned to bottom) -->
    <div class="bottom-action-block">
      <router-link to="/data-request/create" class="pdap-secondary-button block w-full text-center">
        Request missing data
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Button } from 'pdap-design-system';

const props = defineProps({
  locations: {
    type: Array,
    required: true,
    default: () => []
  },
  counties: {
    type: Array,
    required: false,
    default: () => []
  },
  localities: {
    type: Array,
    required: false,
    default: () => []
  },
  states: {
    type: Array,
    required: false,
    default: () => []
  }
});

const emit = defineEmits(['on-follow', 'update-active-location', 'zoom-to-location']);

// Get the active location (last item in the stack)
const activeLocation = computed(() => {
  return props.locations.length ? props.locations[props.locations.length - 1] : null;
});

// Determine the type of active location
const activeLocationType = computed(() => {
  if (!activeLocation.value) return null;
  return activeLocation.value.type;
});

// Generate header title based on active location
const headerTitle = computed(() => {
  if (!activeLocation.value) return '';
  
  if (activeLocationType.value === 'state') {
    return `${activeLocation.value.data.state_iso.toUpperCase()} Counties`;
  } else if (activeLocationType.value === 'county') {
    // Check if Louisiana for Parish vs County
    const isLouisiana = activeLocation.value.data.state_iso === 'LA';
    return `${activeLocation.value.data.name} ${isLouisiana ? 'Parish' : 'County'}, ${activeLocation.value.data.state_iso.toUpperCase()}`;
  } else if (activeLocationType.value === 'locality') {
    return `${activeLocation.value.data.name}, ${activeLocation.value.data.state_iso.toUpperCase()}`;
  }
  
  return '';
});

// Get counties in the active state
const countiesInState = computed(() => {
  if (activeLocationType.value !== 'state' || !activeLocation.value) return [];
  
  return props.counties.filter(county => 
    county.state_iso === activeLocation.value.data.state_iso
  );
});

// Get localities in the active county
const localitiesInCounty = computed(() => {
  if (activeLocationType.value !== 'county' || !activeLocation.value) return [];
  
  return props.localities.filter(locality => 
    locality.county_fips === activeLocation.value.fips &&
    locality.state_iso === activeLocation.value.data.state_iso
  );
});

// Handle selecting a location from the list
function selectLocation(type, item) {
  let newStack = [...props.locations];
  
  if (type === 'county') {
    // Create county location object
    const countyLocation = {
      type: 'county',
      fips: item.fips,
      data: item
    };
    
    // If we're at state level, add the county to the stack
    if (activeLocationType.value === 'state') {
      newStack.push(countyLocation);
    } else {
      // Otherwise replace the stack with current state + new county
      const stateIndex = newStack.findIndex(loc => loc.type === 'state');
      if (stateIndex >= 0) {
        newStack = [newStack[stateIndex], countyLocation];
      } else {
        newStack = [countyLocation];
      }
    }
    
    // Update the stack and zoom to the county
    emit('update-active-location', newStack);
    emit('zoom-to-location', { type: 'county', data: item, fips: item.fips });
  } else if (type === 'locality') {
    // Create locality location object
    const localityLocation = {
      type: 'locality',
      name: item.name,
      data: item,
      fips: item.county_fips
    };
    
    // If we're at county level, add the locality to the stack
    if (activeLocationType.value === 'county') {
      newStack.push(localityLocation);
    } else {
      // This shouldn't happen, but handle it anyway
      newStack = [localityLocation];
    }
    
    // Update the stack
    emit('update-active-location', newStack);
    // No need to zoom for localities as they don't have geographic boundaries
  }
}

// Handle back button click based on active location type
function handleBackClick() {
  if (!activeLocation.value) return;
  
  if (activeLocationType.value === 'state') {
    // Reset map and clear location stack
    emit('update-active-location', []);
    // Reset zoom
    emit('zoom-to-location', { type: 'reset' });
  } else if (activeLocationType.value === 'county') {
      const county = activeLocation.value;
      const state = props.states.find(s => s.state_iso === county.data.state_iso);
      if (state) {
        // Create a new stack with just the state
        const newState = {
          type: 'state',
          name: state.name,
          data: state
        };
        emit('update-active-location', [newState]);
        // Zoom to state
        emit('zoom-to-location', { type: 'state', data: state });
      }
  } else if (activeLocationType.value === 'locality') {
    // Find the most recent county in the stack
    const countyIndex = props.locations.findIndex(loc => loc.type === 'county');
    if (countyIndex >= 0) {
      // Create a new stack with just the county
      const county = props.locations[countyIndex];
      emit('update-active-location', [county]);
      // Zoom to county
      emit('zoom-to-location', { type: 'county', data: county.data, fips: county.fips });
    }
  }
}
</script>

<style scoped>
.back-button {
  margin-right: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  background-color: rgba(0, 0, 0, 0.05);
}

.action-block {
  margin-bottom: 1.5rem;
}

.content-section {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.location-item {
  padding: 0.25rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.location-button {
  width: 100%;
  text-align: left;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s;
}

.location-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.location-name {
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.source-count {
  font-size: 0.875rem;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bottom-action-block {
  bottom: 0;
  position: relative;
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  .back-button {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .sidebar-header, .bottom-action-block {
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .location-item {
    border-color: rgba(255, 255, 255, 0.05);
  }
  
  .location-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .source-count {
    color: #aaa;
  }
}
</style>