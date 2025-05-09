<template>
	<div class="data-source-map-container">
		<div id="map-container" ref="mapContainer" />
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import * as d3 from 'd3';
import { scaleThreshold } from 'd3-scale';
import countiesGeoJSON from '../../util/geoJSON/counties.json';
import statesGeoJSON from '../../util/geoJSON/states.json';

const FILL_COLORS = [
	// 'rgb(247, 247, 248)',
	// 'rgb(242, 240, 243)',
	'rgb(232, 226, 232)',
	'rgb(212, 204, 213)',
	'rgb(187, 171, 187)',
	'rgb(163, 144, 164)',
	'rgb(140, 118, 140)',
	'rgb(117, 97, 116)',
	'rgb(98, 82, 96)',
	'rgb(80, 66, 79)',
];
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
	states: {
		data: statesGeoJSON,
		visible: true,
		minZoom: 0,
		maxZoom: 3,
	},
	stateBoundaries: {
		data: statesGeoJSON,
		visible: true,
		minZoom: 3, // Same min zoom as counties
		maxZoom: Infinity, // Same max zoom as counties
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

// Computed property to determine the selected location level
// const selectedLocationLevel = computed(() => {
// 	if (activeLocationStack.value.length === 0) return null;
// 	const activeLocation =
// 		activeLocationStack.value[activeLocationStack.value.length - 1];
// 	return activeLocation.fips ? 'county' : 'state';
// });

// Computed property for color scale domain
// const colorDomain = computed(() => {
// 	if (!countyDataMap.value || Object.keys(countyDataMap.value).length === 0) {
// 		return [1, 10]; // Default domain starting at 1
// 	}

// 	const values = Object.values(countyDataMap.value).filter(
// 		(val) => val !== undefined && val > 0, // Only include values > 0
// 	);
// 	if (values.length === 0) {
// 		return [1, 10];
// 	}

// 	const max = Math.max(...values);
// 	return [1, max]; // Start at 1 instead of 0
// });

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
	() => props.counties,
	(newCounties) => {
		if (newCounties && newCounties.length > 0 && countiesGeoJSON) {
			updateMap();
		}
	},
	{ deep: true },
);
watch(
	() => activeLocationStack.value,
	(newStack) => {
		console.debug({ newStack });
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

	// Create tooltip
	tooltip.value = d3
		.select('body')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 0)
		.style('position', 'absolute')
		.style('background-color', currentTheme.value.theme.tooltip.backgroundColor)
		.style('color', currentTheme.value.theme.tooltip.textColor)
		.style(
			'border',
			`1px solid ${currentTheme.value.theme.tooltip.borderColor}`,
		)
		.style('padding', '10px')
		.style('border-radius', '3px')
		.style('pointer-events', 'none')
		.style('z-index', 1000)
		.style('font-size', '12px')
		.style('box-shadow', '0 2px 5px rgba(0,0,0,0.2)');

	const padding = { top: 10, right: 10, bottom: 80, left: 10 };
	const projectionObj = d3
		.geoAlbersUsa()
		.fitSize(
			[
				width.value - padding.left - padding.right,
				height.value - padding.top - padding.bottom,
			],
			countiesGeoJSON,
		);

	path.value = d3.geoPath().projection(projectionObj);

	// Create color scales with specific thresholds for counties and states
	countyColorScale.value = scaleThreshold()
		.domain(countyColorBreakpoints) // County-specific breakpoints
		.range(FILL_COLORS); // Use all custom colors

	stateColorScale.value = scaleThreshold()
		.domain(stateColorBreakpoints) // State-specific breakpoints
		.range(FILL_COLORS); // Use all custom colors

	// Setup zoom behavior
	setupZoom();

	updateMap();
}

// Update the map with current data
function updateMap() {
	if (!countiesGeoJSON || !props.counties || props.counties.length === 0)
		return;

	// Clear previous map if any
	svg.value.selectAll('*').remove();

	// Create container for all layers with zoom transform
	const mapContainer = svg.value.append('g').attr('class', 'map-container');

	if (zoomTransform.value) {
		mapContainer.attr('transform', zoomTransform.value);
	}

	// Render layers in the correct order:
	// 1. Counties (bottom layer)
	// 2. State boundaries (middle layer, only outlines)
	// 3. States (top layer, full choropleth)
	// 4. Overlay layers (top-most, for highlighting selected features)
	renderCountiesLayer(mapContainer);
	renderStateBoundariesLayer(mapContainer);
	renderStatesLayer(mapContainer);

	// Add overlay layers on top
	renderCountyOverlay(mapContainer);
	renderStateOverlay(mapContainer);

	// Update layer visibility based on current zoom
	updateLayerVisibility();

	// Add zoom controls
	addZoomControls();

	// Add legend
	createLegend();

	console.log('Map updated with layers:', Object.keys(layers.value));
}

// Render counties layer
function renderCountiesLayer(container) {
	// Always create the layer, but control visibility with CSS
	const countiesLayer = container
		.append('g')
		.attr('class', 'layer counties-layer')
		.style('display', layers.value.counties.visible ? 'block' : 'none');

	// Draw counties with choropleth coloring
	countiesLayer
		.selectAll('path')
		.data(countiesGeoJSON.features)
		.enter()
		.append('path')
		.attr('fill', (d) => {
			// Use STATE + COUNTY as the FIPS code
			const props = d.properties;
			let value;

			if (props.STATE && props.COUNTY) {
				const fips = props.STATE + props.COUNTY;
				value = countyDataMap.value[fips];
			}

			// Only color counties with at least 1 source
			return value !== undefined && value > 0
				? countyColorScale.value(value)
				: currentTheme.value.theme.map.noDataColor; // Theme-appropriate color for counties with no data
		})
		.attr('d', path.value)
		.attr('stroke', currentTheme.value.theme.map.strokeColor) // Theme-appropriate stroke for county boundaries
		.attr('stroke-width', 0.2)
		.attr('cursor', 'pointer') // Show pointer cursor on counties too
		.on('click', function (event, d) {
			console.log('County clicked:', d.properties.NAME || d.properties.COUNTY);
			event.stopPropagation(); // Stop event bubbling
			handleCountyClick(event, d);
		})
		.on('mouseover', (event, d) => {
			// Use STATE + COUNTY as the FIPS code
			let fips;
			if (d.properties.STATE && d.properties.COUNTY) {
				fips = d.properties.STATE + d.properties.COUNTY;
			}

			// Find the county using the FIPS code
			const county = props.counties.find((c) => c.fips == fips);

			if (county) {
				tooltip.value
					.style('opacity', 0.9)
					.html(
						`
            <div style="font-weight:bold; font-size:14px; margin-bottom:5px;">
              ${county.name}, ${county.state_iso}
            </div>
            <div style="margin-bottom:3px;">FIPS: ${county.fips}</div>
            <div style="font-weight:bold; font-size:13px;">
              Sources: ${county.source_count}
            </div>
          `,
					)
					.style('left', event.pageX + 10 + 'px')
					.style('top', event.pageY - 28 + 'px');
			}
		})
		.on('mouseout', () => {
			tooltip.value.style('opacity', 0);
		});

	console.log(
		'Counties layer rendered, visible:',
		layers.value.counties.visible,
	);
}

// Render state boundaries layer (outlines only)
function renderStateBoundariesLayer(container) {
	// Always create the layer, but control visibility with CSS
	const boundariesLayer = container
		.append('g')
		.attr('class', 'layer stateBoundaries-layer')
		.style('display', layers.value.stateBoundaries.visible ? 'block' : 'none');

	// Draw state boundaries with no fill, just strokes
	boundariesLayer
		.selectAll('path')
		.data(statesGeoJSON.features)
		.enter()
		.append('path')
		.attr('fill', 'none')
		.attr('stroke', currentTheme.value.theme.map.stateBorderColor)
		.attr('stroke-width', 0.4)
		.attr('d', path.value);

	console.log(
		'State boundaries layer rendered, visible:',
		layers.value.stateBoundaries.visible,
	);
}

// Render state overlay layer
function renderStateOverlay(container) {
	if (
		!layers.value.stateOverlay.visible ||
		activeLocationStack.value.length === 0
	)
		return;

	const activeState = props.states.find(
		(state) =>
			state.state_iso ===
			activeLocationStack.value[activeLocationStack.value.length - 1].data
				.state_iso,
	);

	console.debug({
		activeState,
		activeLocationStack: activeLocationStack.value,
	});

	if (!activeState) return;

	// Remove any existing overlay first to prevent duplicates
	svg.value.select('.stateOverlay-layer').remove();

	const overlayLayer = container
		.append('g')
		.attr('class', 'layer stateOverlay-layer')
		.style('display', layers.value.stateOverlay.visible ? 'block' : 'none');

	// Create a mask for the active state
	const maskId = `mask-state-${Date.now()}`; // Use timestamp to ensure uniqueness

	// Add a mask definition
	const defs = overlayLayer.append('defs');
	const mask = defs.append('mask').attr('id', maskId);

	// Add a white background to the mask (white = visible area)
	mask
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', width.value)
		.attr('height', height.value)
		.attr('fill', 'white');

	// Add the state shape to the mask in black (black = invisible area)
	mask
		.append('path')
		.attr(
			'd',
			path.value(
				statesGeoJSON.features.find(
					(d) => d.properties.NAME === activeState.name,
				),
			),
		)
		.attr('fill', 'black');

	// Add a semi-transparent background that covers everything EXCEPT the active state
	overlayLayer
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', width.value)
		.attr('height', height.value)
		.attr('fill', currentTheme.value.theme.map.overlayColor)
		.attr('mask', `url(#${maskId})`)
		.attr('pointer-events', 'none'); // Allow clicks to pass through

	// Add a stroke around the active state
	overlayLayer
		.selectAll('path.active-state-border')
		.data([
			statesGeoJSON.features.find(
				(d) => d.properties.NAME === activeState.name,
			),
		])
		.enter()
		.append('path')
		.attr('class', 'active-state-border')
		.attr('fill', 'none') // No fill, just stroke
		.attr('stroke', currentTheme.value.theme.map.stateBorderColor)
		.attr('stroke-width', 1)
		.attr('d', path.value)
		.attr('pointer-events', 'none'); // Allow clicks to pass through

	console.log('State overlay layer rendered, active state:', activeState.name);
}

// Render county overlay layer
function renderCountyOverlay(container) {
	if (
		!layers.value.countyOverlay.visible ||
		activeLocationStack.value.length === 0
	)
		return;

	const activeCounty =
		activeLocationStack.value[activeLocationStack.value.length - 1];
	if (activeCounty.type !== 'county') return;

	// Remove any existing overlay first to prevent duplicates
	svg.value.select('.countyOverlay-layer').remove();

	const overlayLayer = container
		.append('g')
		.attr('class', 'layer countyOverlay-layer')
		.style('display', layers.value.countyOverlay.visible ? 'block' : 'none');

	// Create a mask for the active county
	const maskId = `mask-county-${Date.now()}`; // Use timestamp to ensure uniqueness

	// Add a mask definition
	const defs = overlayLayer.append('defs');
	const mask = defs.append('mask').attr('id', maskId);

	// Add a white background to the mask (white = visible area)
	mask
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', width.value)
		.attr('height', height.value)
		.attr('fill', 'white');

	// Add the county shape to the mask in black (black = invisible area)
	mask
		.append('path')
		.attr(
			'd',
			path.value(
				countiesGeoJSON.features.find((d) => {
					const fips = d.properties.STATE + d.properties.COUNTY;
					return fips === activeCounty.fips;
				}),
			),
		)
		.attr('fill', 'black');

	// Add a semi-transparent background that covers everything EXCEPT the active county
	overlayLayer
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', width.value)
		.attr('height', height.value)
		.attr('fill', currentTheme.value.theme.map.overlayColor)
		.attr('mask', `url(#${maskId})`)
		.attr('pointer-events', 'none'); // Allow clicks to pass through

	// Add a stroke around the active county
	overlayLayer
		.selectAll('path.active-county-border')
		.data([
			countiesGeoJSON.features.find((d) => {
				const fips = d.properties.STATE + d.properties.COUNTY;
				return fips === activeCounty.fips;
			}),
		])
		.enter()
		.append('path')
		.attr('class', 'active-county-border')
		.attr('fill', 'none') // No fill, just stroke
		.attr('stroke', currentTheme.value.theme.map.strokeColor)
		.attr('stroke-width', 0.5)
		.attr('d', path.value)
		.attr('pointer-events', 'none'); // Allow clicks to pass through

	console.log(
		'County overlay layer rendered, active county:',
		activeCounty.data.name,
	);
}

// Render states layer
function renderStatesLayer(container) {
	// Always create the layer, but control visibility with CSS
	const statesLayer = container
		.append('g')
		.attr('class', 'layer states-layer')
		.style('display', layers.value.states.visible ? 'block' : 'none');

	// Draw states with choropleth coloring
	statesLayer
		.selectAll('path')
		.data(statesGeoJSON.features)
		.enter()
		.append('path')
		.attr('fill', (d) => {
			// Use state name to look up data
			const stateName = d.properties.NAME;
			const value = stateDataMap.value[stateName];

			// Only color states with at least 1 source
			return value !== undefined && value > 0
				? stateColorScale.value(value)
				: currentTheme.value.theme.map.noDataColor; // Theme-appropriate color for states with no data
		})
		.attr('stroke', currentTheme.value.theme.map.stateBorderColor)
		.attr('stroke-width', 0.5)
		.attr('d', path.value)
		.attr('cursor', 'pointer')
		.on('click', function (event, d) {
			console.log('State path clicked');
			event.stopPropagation(); // Stop event bubbling
			handleStateClick(event, d);
		})
		.on('mouseover', (event, d) => {
			// Find the state using the name
			const stateName = d.properties.NAME;
			const state = props.states.find((s) => s.name === stateName);

			if (state) {
				tooltip.value
					.style('opacity', 0.9)
					.html(
						`
            <div style="font-weight:bold; font-size:14px; margin-bottom:5px;">
              ${state.name}
            </div>
            <div style="font-weight:bold; font-size:13px;">
              Sources: ${state.source_count}
            </div>
          `,
					)
					.style('left', event.pageX + 10 + 'px')
					.style('top', event.pageY - 28 + 'px');
			}
		})
		.on('mouseout', () => {
			tooltip.value.style('opacity', 0);
		});

	console.log('States layer rendered, visible:', layers.value.states.visible);
}

// Create a simple legend for the map
function createLegend() {
	// Determine which layer is visible
	const visibleLayer = layers.value.counties.visible ? 'counties' : 'states';

	// Use the appropriate color breakpoints based on visible layer
	const breakpoints =
		visibleLayer === 'counties'
			? countyColorBreakpoints
			: stateColorBreakpoints;

	// Use the appropriate color scale
	// const activeColorScale =
	// 	visibleLayer === 'counties'
	// 		? countyColorScale.value
	// 		: stateColorScale.value;

	// Create legend dimensions
	const legendWidth = 200;
	const legendHeight = 30;

	// Position in bottom-right corner with offset to avoid Florida
	const legendX = width.value - legendWidth - 40;
	const legendY = height.value - legendHeight - 40;

	// Add more space for the "No data" indicator
	const noDataX = 10;
	const noDataY = legendHeight + 15;

	// Create legend group
	const legend = svg.value
		.append('g')
		.attr('class', 'legend')
		.attr('transform', `translate(${legendX}, ${legendY})`);

	// Add background with theme-appropriate color and border
	legend
		.append('rect')
		.attr('width', legendWidth + 20) // Make wider to include padding
		.attr('height', legendHeight + 60) // Make taller to include title and "No data" below
		.attr('x', -10)
		.attr('y', -25) // Extend upward for title
		.attr('fill', currentTheme.value.theme.legend.backgroundColor)
		.attr('stroke', currentTheme.value.theme.legend.textColor)
		.attr('stroke-width', 0.5)
		.attr('stroke-opacity', 0.3)
		.attr('rx', 3)
		.attr('ry', 3);

	// Create color rectangles for the gradient
	FILL_COLORS.forEach((color, i) => {
		legend
			.append('rect')
			.attr('x', i * (legendWidth / FILL_COLORS.length))
			.attr('width', legendWidth / FILL_COLORS.length)
			.attr('height', 20)
			.attr('fill', color);
	});

	// Add text labels for min and max
	legend
		.append('text')
		.attr('x', 0)
		.attr('y', 35)
		.attr('text-anchor', 'start')
		.attr('font-size', '10px')
		.attr('fill', currentTheme.value.theme.legend.textColor)
		.text(`${Math.min(...breakpoints)}`);

	legend
		.append('text')
		.attr('x', legendWidth)
		.attr('y', 35)
		.attr('text-anchor', 'end')
		.attr('font-size', '10px')
		.attr('fill', currentTheme.value.theme.legend.textColor)
		.text(`${Math.max(...breakpoints)}+`);

	// Add title based on visible layer
	const title =
		visibleLayer === 'counties' ? 'County Data Sources' : 'State Data Sources';
	legend
		.append('text')
		.attr('x', legendWidth / 2)
		.attr('y', -10)
		.attr('text-anchor', 'middle')
		.attr('font-size', '12px')
		.attr('font-weight', 'bold')
		.attr('fill', currentTheme.value.theme.legend.textColor)
		.text(title);

	// Add "No data" indicator below the gradient
	legend
		.append('rect')
		.attr('x', noDataX)
		.attr('y', noDataY)
		.attr('width', 10)
		.attr('height', 10)
		.attr('fill', currentTheme.value.theme.legend.noDataColor);

	legend
		.append('text')
		.attr('x', noDataX + 15)
		.attr('y', noDataY + 9) // Align with the square
		.attr('text-anchor', 'start')
		.attr('font-size', '9px')
		.attr('fill', currentTheme.value.theme.legend.textColor)
		.text('No data');

	// Log which legend is being displayed
	console.log(
		'Legend displayed for:',
		visibleLayer,
		'with breakpoints:',
		breakpoints,
	);
}

// Setup zoom behavior
function setupZoom() {
	// Create zoom behavior
	const zoom = d3
		.zoom()
		.scaleExtent([1, 50]) // Min/max zoom levels
		.on('zoom', handleZoom);

	console.log('Setting up zoom behavior');

	// Apply zoom to SVG
	svg.value.call(zoom);

	// Store the zoom behavior for later use
	svg.value.__zoom__ = zoom;

	// Initialize with no zoom
	svg.value.call(zoom.transform, d3.zoomIdentity);
}

// Handle zoom events
function handleZoom(event) {
	// Update overlay visibility before overwriting current zoom
	handleOverlaysOnZoom(event, currentZoom.value);

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
	updateLayerVisibility();
}

function handleOverlaysOnZoom(event, currentZoom) {
	if (event.transform.k < currentZoom) {
		const COUNTY_THRESHOLD = 5.25;
		const STATE_THRESHOLD = 1.25;

		// County overlay
		if (
			layers.value.countyOverlay.visible &&
			event.transform.k < COUNTY_THRESHOLD
		) {
			layers.value.countyOverlay.visible = false;

			// Remove overlay layers from DOM
			svg.value.select('.countyOverlay-layer').remove();
		}

		// State overlay
		if (
			layers.value.stateOverlay.visible &&
			event.transform.k < STATE_THRESHOLD
		) {
			// Update visibility
			layers.value.stateOverlay.visible = false;
			layers.value.countyOverlay.visible = false;

			// Remove overlay layers from DOM
			svg.value.select('.stateOverlay-layer').remove();
			svg.value.select('.countyOverlay-layer').remove();

			// Clear the active location stack since we're zooming out
			activeLocationStack.value = [];
		}
	}
}

// Update layer visibility based on zoom level
function updateLayerVisibility() {
	// Track if visibility changed
	let visibilityChanged = false;
	// const previousVisibility = {
	// 	counties: layers.value.counties.visible,
	// 	states: layers.value.states.visible,
	// };

	// Show/hide layers based on zoom level
	Object.keys(layers.value).forEach((layerName) => {
		const layer = layers.value[layerName];
		const shouldBeVisible =
			currentZoom.value >= layer.minZoom && currentZoom.value <= layer.maxZoom;

		// Check if visibility changed
		if (layer.visible !== shouldBeVisible) {
			visibilityChanged = true;
		}

		// Update visibility state
		layer.visible = shouldBeVisible;

		// Apply visibility to DOM
		const layerElement = svg.value.select(`.${layerName}-layer`);
		if (!layerElement.empty()) {
			layerElement.style('display', shouldBeVisible ? 'block' : 'none');
		}
	});

	// Log current zoom level and layer visibility
	console.log('Current zoom:', currentZoom.value, 'Layers:', {
		counties: layers.value.counties.visible,
		states: layers.value.states.visible,
	});

	// Update legend if layer visibility changed
	if (visibilityChanged) {
		// Remove existing legend
		svg.value.select('.legend').remove();
		// Create new legend with appropriate scale
		createLegend();
	}
}

// Handle state click to zoom
function handleStateClick(event, d) {
	// Add debug logging
	console.log('State clicked:', d.properties.NAME);

	// Prevent default behavior
	event.stopPropagation();

	// Get state bounds
	const bounds = path.value.bounds(d);
	console.log('State bounds:', bounds);

	const dx = bounds[1][0] - bounds[0][0];
	const dy = bounds[1][1] - bounds[0][1];
	const x = (bounds[0][0] + bounds[1][0]) / 2;
	const y = (bounds[0][1] + bounds[1][1]) / 2;

	// Calculate appropriate zoom level
	const scale = 0.9 / Math.max(dx / width.value, dy / height.value);
	console.log('Calculated zoom scale:', scale);

	const translate = [width.value / 2 - scale * x, height.value / 2 - scale * y];

	// Add state to the active location stack
	const stateName = d.properties.NAME;
	const state = props.states.find((s) => s.name === stateName);
	if (state) {
		activeLocationStack.value.push({
			type: 'state',
			name: stateName,
			data: state,
		});

		// Update overlay visibility
		layers.value.stateOverlay.visible = true;

		// Force update the overlay
		updateOverlays();

		console.log('Added state to active location stack:', stateName);
	}

	// Get the stored zoom behavior
	const zoom = svg.value.__zoom__ || d3.zoom();

	// Animate zoom transition
	svg.value
		.transition()
		.duration(750)
		.call(
			zoom.transform,
			d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale),
		);
}

// Handle county click to zoom
function handleCountyClick(event, d) {
	// Add debug logging
	console.log('County clicked:', d.properties.NAME || d.properties.COUNTY);

	// Prevent default behavior
	event.stopPropagation();

	// Get county bounds
	const bounds = path.value.bounds(d);
	console.log('County bounds:', bounds);

	const dx = bounds[1][0] - bounds[0][0];
	const dy = bounds[1][1] - bounds[0][1];
	const x = (bounds[0][0] + bounds[1][0]) / 2;
	const y = (bounds[0][1] + bounds[1][1]) / 2;

	// Calculate appropriate zoom level - moderate zoom for counties
	const scale = 0.4 / Math.max(dx / width.value, dy / height.value);
	console.log('Calculated zoom scale for county:', scale);

	const translate = [width.value / 2 - scale * x, height.value / 2 - scale * y];

	// Add county to the active location stack
	let fips;
	if (d.properties.STATE && d.properties.COUNTY) {
		fips = d.properties.STATE + d.properties.COUNTY;
	}

	const county = props.counties.find((c) => c.fips == fips);
	if (county) {
		activeLocationStack.value.push({
			type: 'county',
			fips: fips,
			data: county,
		});

		// Update overlay visibility
		layers.value.countyOverlay.visible = true;
		layers.value.stateOverlay.visible = true;

		// Force update the overlay
		updateOverlays();

		console.log('Added county to active location stack:', county.name);
	}

	// Get the stored zoom behavior
	const zoom = svg.value.__zoom__ || d3.zoom();

	// Animate zoom transition
	svg.value
		.transition()
		.duration(750)
		.call(
			zoom.transform,
			d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale),
		);
}

// Reset zoom function
function resetZoom() {
	console.log('Resetting zoom');

	// Clear the active location stack
	activeLocationStack.value = [];

	// Reset overlay visibility
	layers.value.stateOverlay.visible = false;
	layers.value.countyOverlay.visible = false;

	// Remove any existing overlays
	svg.value.select('.stateOverlay-layer').remove();
	svg.value.select('.countyOverlay-layer').remove();

	// Get the stored zoom behavior
	const zoom = svg.value.__zoom__ || d3.zoom();

	// Animate back to default view
	svg.value.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
}

// Add zoom controls
function addZoomControls() {
	// Add zoom in/out buttons
	const controls = svg.value
		.append('g')
		.attr('class', 'zoom-controls')
		.attr('transform', `translate(${width.value - 60}, 20)`);

	// Zoom in button
	controls
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', 30)
		.attr('height', 30)
		.attr('fill', 'white')
		.attr('stroke', '#ccc')
		.attr('rx', 3)
		.attr('cursor', 'pointer')
		.on('click', () => {
			console.log('Zoom in clicked');
			const zoom = svg.value.__zoom__ || d3.zoom();
			svg.value.transition().call(zoom.scaleBy, 1.5);
		});

	controls
		.append('text')
		.attr('x', 15)
		.attr('y', 20)
		.attr('text-anchor', 'middle')
		.text('+');

	// Zoom out button
	controls
		.append('rect')
		.attr('x', 0)
		.attr('y', 35)
		.attr('width', 30)
		.attr('height', 30)
		.attr('fill', 'white')
		.attr('stroke', '#ccc')
		.attr('rx', 3)
		.attr('cursor', 'pointer')
		.on('click', () => {
			console.log('Zoom out clicked');
			const zoom = svg.value.__zoom__ || d3.zoom();
			svg.value.transition().call(zoom.scaleBy, 0.75);
		});

	controls
		.append('text')
		.attr('x', 15)
		.attr('y', 55)
		.attr('text-anchor', 'middle')
		.text('-');

	// Reset button
	controls
		.append('rect')
		.attr('x', 0)
		.attr('y', 70)
		.attr('width', 30)
		.attr('height', 30)
		.attr('fill', 'white')
		.attr('stroke', '#ccc')
		.attr('rx', 3)
		.attr('cursor', 'pointer')
		.on('click', resetZoom);

	controls
		.append('text')
		.attr('x', 15)
		.attr('y', 90)
		.attr('text-anchor', 'middle')
		.text('↺');
}

// Function to update overlays when active location changes
function updateOverlays() {
	console.log('Updating overlays based on active location');

	// Get the map container
	const container = svg.value.select('.map-container');
	if (container.empty()) {
		console.error('Map container not found for overlay update');
		return;
	}

	// Check if we have an active location
	if (activeLocationStack.value.length === 0) {
		// No active location, remove any overlays
		svg.value.select('.stateOverlay-layer').remove();
		svg.value.select('.countyOverlay-layer').remove();
		return;
	}

	// Get the most recent active location
	const activeLocation =
		activeLocationStack.value[activeLocationStack.value.length - 1];

	// Update overlays based on location type. State is always rendered.
	if (activeLocation) {
		if (activeLocation.type === 'county') {
			// Remove county overlay if it exists
			svg.value.select('.countyOverlay-layer').remove();
		}

		// Always render state overlay at minimum
		renderStateOverlay(container);

		if (activeLocation.type === 'county') {
			// Remove state overlay if it exists
			// svg.value.select('.stateOverlay-layer').remove();

			// Update county overlay
			renderCountyOverlay(container);
		}
	}
}

function handleTheme() {
	const prefersDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');
	const light = FILL_COLORS[0];
	const mediumLight = FILL_COLORS[2];
	const mediumDark = FILL_COLORS[FILL_COLORS.length - 3];
	const dark = FILL_COLORS[FILL_COLORS.length - 1];

	const isDark = prefersDarkTheme.matches;
	return {
		prefersDarkTheme,
		theme: {
			light,
			dark,
			tooltip: {
				backgroundColor: isDark
					? 'rgba(40, 40, 40, 0.9)'
					: 'rgba(0, 0, 0, 0.8)',
				textColor: light,
				borderColor: isDark ? '#555' : '#444',
			},
			legend: {
				backgroundColor: isDark
					? 'rgba(40, 40, 40, 0.8)'
					: 'rgba(255, 255, 255, 0.7)',
				textColor: isDark ? light : dark,
				noDataColor: isDark ? '#555' : 'rgb(220, 220, 220)',
			},
			map: {
				noDataColor: isDark ? '#555' : 'rgb(220, 220, 220)',
				strokeColor: isDark ? mediumLight : mediumDark,
				stateBorderColor: isDark ? light : dark, // New color for state boundaries when zoomed in
				overlayColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.5)', // Overlay color for non-selected features
			},
		},
	};
}

// Clean up when component is unmounted
onUnmounted(() => {
	if (tooltip.value) {
		tooltip.value.remove();
	}
});
</script>

<style scoped>
/* :root {
rgb(232, 226, 232)
rgb(212, 204, 213)
rgb(187, 171, 187)
rgb(163, 144, 164)
rgb(140, 118, 140)
rgb(117, 97, 116)
rgb(98, 82, 96)
rgb(80, 66, 79)
} */
.data-source-map-container {
	position: relative;
	width: 100%;
	height: 100%;
}

#map-container {
	width: 100%;
	height: 100%;
}

:deep(.counties-layer path) {
	cursor: pointer;
}

:deep(.counties-layer path:hover) {
	/* stroke: rgb(42, 36, 41); */
	/* stroke-width: 0.5; */
	filter: brightness(105%);
}

:deep(.states-layer path) {
	pointer-events: auto;
}

:deep(.states-layer path:hover) {
	/* stroke: #000; */
	/* stroke-width: 0.5; */
	filter: brightness(105%);
}

:deep(.stateBoundaries-layer path) {
	pointer-events: none; /* Don't capture mouse events on state boundaries */
}

:deep(.zoom-controls) {
	cursor: pointer;
	user-select: none;
}

:deep(.zoom-controls text) {
	pointer-events: none;
	font-size: 18px;
	font-weight: bold;
}

@media (prefers-color-scheme: dark) {
	:deep(.counties-layer path:hover) {
		stroke: rgb(247, 234, 247);
	}

	:deep(.zoom-controls rect) {
		fill: #333;
		stroke: #555;
	}

	:deep(.zoom-controls text) {
		fill: #eee;
	}
}
</style>
