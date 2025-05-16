<template>
	<div class="data-source-map-container">
		<div id="map-container" ref="mapContainer" />
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import * as d3 from 'd3';
import { scaleThreshold } from 'd3-scale';

import { FILL_COLORS, handleTheme } from './utils/theme';
import {
	setupZoom,
	updateLayerVisibility,
	addZoomControls,
	updateIconSize,
	updateZoomLevel,
	handleOverlaysOnZoom,
} from './utils/zoom';
import { renderStatesLayer } from './renderers/states';
import { renderStateOverlay } from './renderers/state-overlay';
import { renderCountiesLayer } from './renderers/counties';
import { renderStateBoundariesLayer } from './renderers/state-boundaries';
import { renderCountyOverlay } from './renderers/county-overlay';
import { renderLocalityMarkers } from './renderers/localities';
import { createTooltip } from './renderers/tooltip';
import { createLegend } from './renderers/legend';
import {
	handleStateClick,
	handleCountyClick,
	handleLocalityClick,
	resetZoom,
} from './utils/interaction';
import { updateDynamicLayers } from './utils/overlay';
// import { createOverlayDeps } from './utils/createOverlayDeps';

import countiesGeoJSON from '../../util/geoJSON/counties.json';
import statesGeoJSON from '../../util/geoJSON/states.json';

const MIN_ZOOM = 1;
const MAX_ZOOM = 50;
// Apply a small correction to lat/lng values (to compensate for albers proj) TODO: figure out why this isn't working OOTB
const LAT_CORRECTION = -0.1; // Negative value moves markers south
const LNG_CORRECTION = -0.03; // Negative value moves markers west
// Define separate breakpoints for counties and states
const countyColorBreakpoints = [1, 5, 10, 15, 25, 40, 60, 100];
const stateColorBreakpoints = [1, 10, 25, 50, 100, 200, 500];

// Props definition
const props = defineProps({
	counties: {
		type: Array,
		required: true,
		default: () => [],
	},
	localities: {
		type: Array,
		required: true,
		default: () => [],
	},
	states: {
		type: Array,
		required: true,
		default: () => [],
	},
});

// Reactive state
const mapContainer = ref(null);
const width = ref(960);
const height = ref(600);
const svg = ref(null);
const path = ref(null);
const projection = ref(null);
const tooltip = ref(null);
const countyColorScale = ref(null);
const stateColorScale = ref(null);
const currentTheme = ref(null);
const activeLocationStack = ref([]); // Stack to track selected locations

// Zoom-related state
const currentZoom = ref(1);
const zoomTransform = ref(null);
const layers = ref({
	counties: {
		data: countiesGeoJSON,
		visible: true,
		minZoom: 3,
		maxZoom: Infinity,
	},
	localities: {
		visible: true,
		minZoom: 9,
		maxZoom: Infinity,
	},
	states: {
		data: statesGeoJSON,
		visible: true,
		minZoom: 0,
		maxZoom: 3,
	},
	stateBoundaries: {
		data: statesGeoJSON,
		visible: true,
		minZoom: 3,
		maxZoom: Infinity,
	},
	countyOverlay: {
		data: countiesGeoJSON,
		visible: false,
		minZoom: 3,
		maxZoom: Infinity,
	},
	stateOverlay: {
		data: statesGeoJSON,
		visible: false,
		minZoom: 0,
		maxZoom: Infinity,
	},
});

// Computed property for county data map
const countyDataMap = computed(() => {
	const map = {};
	if (props.counties && props.counties.length > 0) {
		props.counties.forEach((county) => {
			if (county.fips) {
				map[county.fips] = county.source_count;
			}
		});
	}
	return map;
});

const stateDataMap = computed(() => {
	const map = {};
	if (props.states && props.states.length > 0) {
		props.states.forEach((state) => {
			if (state.name) {
				map[state.name] = state.source_count;
			}
		});
	}
	return map;
});

// Organize localities by county FIPS code for faster lookup
const localitiesByCounty = computed(() => {
	const map = {};
	if (props.localities && props.localities.length > 0) {
		props.localities.forEach((locality) => {
			if (locality.county_fips) {
				if (!map[locality.county_fips]) {
					map[locality.county_fips] = [];
				}
				map[locality.county_fips].push(locality);
			}
		});
	}
	return map;
});

// Initialize map when component is mounted
onMounted(() => {
	currentTheme.value = handleTheme();
	initMap();

	// Listen for changes in color scheme preference
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', () => {
		currentTheme.value = handleTheme();
		if (svg.value) updateMap(); // Redraw the map with new theme
	});
});

// Watch for changes in counties data
watch(
	() => props.states,
	(newStates) => {
		if (newStates.length) {
			updateMap();
		}
	},
	{ deep: true },
);
watch(
	() => activeLocationStack.value,
	() => {
		updateDynamicLayers({
			renderStateOverlay,
			renderCountyOverlay,
			renderLocalityMarkers,
			deps: mapDeps.value,
		});
	},
	{ deep: true },
);

// Initialize the map
function initMap() {
	const container = mapContainer.value;

	// Get container dimensions for responsive sizing
	const containerRect = container.getBoundingClientRect();
	if (containerRect.width && containerRect.height) {
		width.value = containerRect.width;
		height.value = containerRect.height;
	}

	// Ensure minimum dimensions
	if (width.value < 100) width.value = 960;
	if (height.value < 100) height.value = 600;

	// Create SVG with responsive attributes
	svg.value = d3
		.select(container)
		.append('svg')
		.attr('width', '100%')
		.attr('height', '100%')
		.attr('viewBox', `0 0 ${width.value} ${height.value}`)
		.attr('preserveAspectRatio', 'xMidYMid meet');

	createTooltip(tooltip, currentTheme);

	const padding = { top: 10, right: 10, bottom: 80, left: 10 };
	projection.value = d3
		.geoAlbersUsa()
		.fitSize(
			[
				width.value - padding.left - padding.right,
				height.value - padding.top - padding.bottom,
			],
			layers.value.counties.data,
		);

	path.value = d3.geoPath().projection(projection.value);

	// Create color scales with specific thresholds for counties and states
	countyColorScale.value = scaleThreshold()
		.domain(countyColorBreakpoints) // County-specific breakpoints
		.range(FILL_COLORS); // Use all custom colors

	stateColorScale.value = scaleThreshold()
		.domain(stateColorBreakpoints) // State-specific breakpoints
		.range(FILL_COLORS); // Use all custom colors

	// Setup zoom behavior
	setupZoom({
		svg: svg.value,
		MIN_ZOOM,
		MAX_ZOOM,
		handleZoom: (event) => {
			// Update overlay visibility before overwriting current zoom
			activeLocationStack.value = handleOverlaysOnZoom({
				event,
				currentZoom: currentZoom.value,
				layers: layers.value,
				activeLocationStack: activeLocationStack.value,
				props,
				svg: svg.value,
			});

			// Store current zoom transform
			zoomTransform.value = event.transform;
			currentZoom.value = event.transform.k;

			// Apply transform to all layers
			const mapContainer = svg.value.select('.map-container');
			if (!mapContainer.empty()) {
				mapContainer.attr('transform', event.transform);
			} else {
				console.error('Map container not found for zoom transform');
			}

			// Update layer visibility based on zoom level
			updateLayerVisibility({
				layers: layers.value,
				currentZoom: currentZoom.value,
				svg: svg.value,
				createLegend: () => createLegend(mapDeps.value),
			});

			updateIconSize(currentZoom.value, MAX_ZOOM);
			updateZoomLevel(currentZoom.value, MAX_ZOOM);
		},
	});

	updateMap();
}

// Create a computed property for the master dependencies object
// This will be passed to all render functions and handlers
const mapDeps = computed(() => {
	// Helper function to create overlay deps without circular reference
	const getOverlayDeps = () => ({
		svg: svg.value,
		activeLocationStack: activeLocationStack.value,
		layers: layers.value,
		path: path.value,
		width: width.value,
		height: height.value,
		props,
		currentTheme: currentTheme.value,
		localitiesByCounty: localitiesByCounty.value,
		LAT_CORRECTION,
		LNG_CORRECTION,
	});

	return {
		// Core map properties
		svg: svg.value,
		width: width.value,
		height: height.value,
		path: path.value,
		projection: projection.value,
		tooltip: tooltip.value,

		// Data and state
		props,
		layers: layers.value,
		activeLocationStack: activeLocationStack.value,
		currentZoom: currentZoom.value,
		zoomTransform: zoomTransform.value,

		// Color scales and theme
		countyColorScale: countyColorScale.value,
		stateColorScale: stateColorScale.value,
		currentTheme: currentTheme.value,

		// Data maps
		countyDataMap: countyDataMap.value,
		stateDataMap: stateDataMap.value,
		localitiesByCounty: localitiesByCounty.value,

		// Constants
		LAT_CORRECTION,
		LNG_CORRECTION,
		MIN_ZOOM,
		MAX_ZOOM,
		FILL_COLORS,
		countyColorBreakpoints,
		stateColorBreakpoints,

		// Handler functions
		handleStateClick: (event, d) => {
			activeLocationStack.value = handleStateClick({
				event,
				d,
				path: path.value,
				width: width.value,
				height: height.value,
				props,
				activeLocationStack: [...activeLocationStack.value],
				layers: layers.value,
				svg: svg.value,
				updateDynamicLayers: () =>
					updateDynamicLayers({
						renderStateOverlay,
						renderCountyOverlay,
						renderLocalityMarkers,
						deps: getOverlayDeps(),
					}),
			});
		},

		handleCountyClick: (event, d) => {
			activeLocationStack.value = handleCountyClick({
				event,
				d,
				path: path.value,
				width: width.value,
				height: height.value,
				props,
				activeLocationStack: [...activeLocationStack.value],
				layers: layers.value,
				svg: svg.value,
				updateDynamicLayers: () =>
					updateDynamicLayers({
						renderStateOverlay,
						renderCountyOverlay,
						renderLocalityMarkers,
						deps: getOverlayDeps(),
					}),
			});
		},

		handleLocalityClick: (event, locality) => {
			activeLocationStack.value = handleLocalityClick({
				event,
				locality,
				projection: projection.value,
				width: width.value,
				height: height.value,
				activeLocationStack: [...activeLocationStack.value],
				updateDynamicLayers: () =>
					updateDynamicLayers({
						renderStateOverlay,
						renderCountyOverlay,
						renderLocalityMarkers,
						deps: getOverlayDeps(),
					}),
				svg: svg.value,
				LAT_CORRECTION,
				LNG_CORRECTION,
			});
		},

		resetZoom: () => {
			activeLocationStack.value = resetZoom({
				activeLocationStack: [...activeLocationStack.value],
				layers: layers.value,
				svg: svg.value,
			});
		},

		// Utility functions
		updateDynamicLayers: () => {
			return updateDynamicLayers({
				renderStateOverlay,
				renderCountyOverlay,
				renderLocalityMarkers,
				deps: getOverlayDeps(),
			});
		},
	};
});

// Update the map with current data
function updateMap() {
	// Clear previous map if any
	svg.value.selectAll('*').remove();

	// Create container for all layers with zoom transform
	const mapContainer = svg.value.append('g').attr('class', 'map-container');

	if (zoomTransform.value) {
		mapContainer.attr('transform', zoomTransform.value);
	}

	const deps = mapDeps.value;

	// Render static layers in the correct order:
	renderStatesLayer(mapContainer, deps);
	renderCountiesLayer(mapContainer, deps);
	renderStateBoundariesLayer(mapContainer, deps);

	// Render dynamic layers based on active location
	updateDynamicLayers({
		renderStateOverlay,
		renderCountyOverlay,
		renderLocalityMarkers,
		deps,
	});

	// Update layer visibility based on current zoom
	updateLayerVisibility({
		layers: layers.value,
		currentZoom: currentZoom.value,
		svg: svg.value,
		createLegend: () => createLegend(deps),
	});

	// Add zoom controls
	addZoomControls({
		svg: svg.value,
		width: width.value,
		resetZoom: deps.resetZoom,
	});

	// Add legend - ensure it has all required properties
	try {
		createLegend(deps);
	} catch (error) {
		console.error('Error creating legend:', error);
	}

	console.log('Map updated with layers:', Object.keys(layers.value));
}

// Clean up when component is unmounted
onUnmounted(() => {
	if (tooltip.value) {
		tooltip.value.remove();
	}
});
</script>

<style scoped>
@import './styles.css';
</style>
