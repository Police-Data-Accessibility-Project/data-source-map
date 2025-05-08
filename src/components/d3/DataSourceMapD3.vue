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
// Define breakpoints that match the colors
const colorBreakpoints = [1, 5, 10, 15, 25, 40, 60, 100];

// Props definition
const props = defineProps({
	counties: {
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
// const countyData = ref(null);
const colorScale = ref(null);
// const projection = ref(null);
const currentTheme = ref(null);

// Computed property for county data map
const dataMap = computed(() => {
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

// Computed property for color scale domain
// const colorDomain = computed(() => {
// 	if (!dataMap.value || Object.keys(dataMap.value).length === 0) {
// 		return [1, 10]; // Default domain starting at 1
// 	}

// 	const values = Object.values(dataMap.value).filter(
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

	// Create color scale with specific thresholds
	colorScale.value = scaleThreshold()
		.domain(colorBreakpoints) // Breakpoints for different colors
		.range(FILL_COLORS); // Use all custom colors

	updateMap();
}

// Update the map with current data
function updateMap() {
	if (!countiesGeoJSON || !props.counties || props.counties.length === 0)
		return;

	// Clear previous map if any
	svg.value.selectAll('*').remove();

	// Get features from GeoJSON
	const { features } = countiesGeoJSON;

	// Draw counties with choropleth coloring
	svg.value
		.append('g')
		.attr('class', 'counties')
		.selectAll('path')
		.data(features)
		.enter()
		.append('path')
		.attr('fill', (d) => {
			// Use STATE + COUNTY as the FIPS code
			const props = d.properties;
			let value;

			if (props.STATE && props.COUNTY) {
				const fips = props.STATE + props.COUNTY;
				value = dataMap.value[fips];
			}

			// Only color counties with at least 1 source
			return value !== undefined && value > 0
				? colorScale.value(value)
				: currentTheme.value.theme.map.noDataColor; // Theme-appropriate color for counties with no data
		})
		.attr('d', path.value)
		.attr('stroke', currentTheme.value.theme.map.strokeColor) // Theme-appropriate stroke for county boundaries
		.attr('stroke-width', 0.2)
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

	// Add legend
	createLegend();
}

// Create a simple legend for the map
function createLegend() {
	// Get the maximum value for the legend
	// const max = colorDomain.value[1];

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
		.attr('height', legendHeight + 40) // Make taller to include "No data" below
		.attr('x', -10)
		.attr('y', -5)
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
		.text(`${Math.min(...colorBreakpoints)}`);

	legend
		.append('text')
		.attr('x', legendWidth)
		.attr('y', 35)
		.attr('text-anchor', 'end')
		.attr('font-size', '10px')
		.attr('fill', currentTheme.value.theme.legend.textColor)
		.text(`${Math.max(...colorBreakpoints)}+`);

	// Add title
	// legend
	// 	.append('text')
	// 	.attr('x', legendWidth / 2)
	// 	.attr('y', 45)
	// 	.attr('text-anchor', 'middle')
	// 	.attr('font-size', '11px')
	// 	.attr('fill', currentTheme.value.theme.legend.textColor)
	// 	.text('0-' + max + ' data sources');

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

:deep(.counties path) {
	cursor: pointer;
}

:deep(.counties path:hover) {
	stroke: rgb(42, 36, 41);
	filter: brightness(105%);
}

:deep(.states path) {
	pointer-events: none;
}

@media (prefers-color-scheme: dark) {
	:deep(.counties path:hover) {
		stroke: rgb(247, 234, 247);
	}
}
</style>
