<template>
	<main class="h-[calc(100vh-80px)] w-full p-16 pb-24">
		<div class="h-full w-full relative">
			<div id="mapboxContainer" class="h-full w-full" />

			<Spinner
				:show="isLoading"
				:size="size"
				class="h-full w-full absolute left-0 top-0 z-50 bg-goldneutral-500/70 dark:bg-wineneutral-500/70"
				:text="loadingText"
			/>
		</div>
	</main>
</template>

<script setup>
import { onMounted, ref, watch, computed } from 'vue';
import mapboxgl from 'mapbox-gl';
import _debounce from 'lodash/debounce';
// import polylabel from '@mapbox/polylabel';
// TODO: implement "sidebar" in a more Mapbox-friendly way
// import Sidebar from './DataSourceMapSidebar.vue';
import { Spinner } from 'pdap-design-system';
// import countyGeoJson from '../util/geoJSON/counties.json';
// import stateGeoJson from '../util/geoJSON/states.json';
import { STATE_ISO_TO_FEATURE_ID, STATE_ISO_TO_FIPS } from '../util/constants';
import marker from '../assets/location.png';
import _isEqual from 'lodash/isEqual';

const US_COUNTIES_LAYER = 'counties';
const US_STATES_LAYER = 'us-states-4khti2';
const MAP_STYLES = {
	dark: 'mapbox://styles/josh-pdap/clyejn3bg014x01nzg6786ozv?optimize=true',
	light: 'mapbox://styles/josh-pdap/clyejn7qx017601qoa3bo8wni?optimize=true',
};

// Setup
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Props
const props = defineProps({
	data: {
		type: Object,
		required: true,
	},
	error: {
		type: String,
		default: '',
	},
});

// Reactive vars
const currentData = computed(() => props.data);
const map = ref();
const isLoading = computed(() => !Object.keys(currentData.value ?? {}).length);
const isMapReady = ref(false);
const loadingText = ref('Data sources loading...');
const size = ref(window.innerHeight / 15);
const zoom = ref(3.5);
const countyLookup = ref(new Map());

onMounted(async () => {
	updateLoadingText();
	await new Promise((resolve) => {
		makeMap();
		map.value.on('load', () => {
			isMapReady.value = true;
			resolve();
		});
	});

	// Now that map is ready, try to attach initial data
	if (currentData.value) {
		try {
			attachDataSourcesToMap();
		} catch (error) {
			console.error('Error attaching data sources:', error);
		}
	}
});

watch(
	() => currentData.value,
	(newData, prevData) => {
		if (isMapReady.value && !_isEqual(newData, prevData)) {
			attachDataSourcesToMap();
		}
	},
	{
		deep: true,
		immediate: false,
	},
);

function makeMap() {
	const { prefersDarkTheme, mapTheme: style } = handleTheme();

	// Initialize base map
	map.value = new mapboxgl.Map({
		container: 'mapboxContainer',
		style,
		center: [-98, 36],
		zoom: 3,
		// maxBounds: [
		// 	[-172.06707715558082, 15.064032429448638],
		// 	[-28.673639540108578, 70.89960589653042],
		// ],
		minZoom: 3,
		maxZoom: 16,
	});

	// Add controls
	const nav = new mapboxgl.NavigationControl();
	const geolocate = new mapboxgl.GeolocateControl({
		positionOptions: {
			enableHighAccuracy: true,
		},
		fitBoundsOptions: { linear: true, zoom: map.value.getZoom() },
		trackUserLocation: true,
	});
	map.value.addControl(nav, 'top-right');
	map.value.addControl(geolocate, 'top-right');

	// Set up zoom handler
	const handleZoom = _debounce(() => {
		zoom.value = map.value.getZoom();
	}, 100);

	map.value.on('zoom', handleZoom);

	// Theme change listener
	prefersDarkTheme.addEventListener('change', (e) => {
		console.debug('map: theme change');
		map.value.setStyle(e.matches ? MAP_STYLES.dark : MAP_STYLES.light);
		map.value.once('style.load', () => {
			attachDataSourcesToMap();
		});
	});
}

function attachDataSourcesToMap() {
	const { fillColor, textColor, prefersDarkTheme } = handleTheme();

	//#region states fill
	const stateLayer = map.value
		.getStyle()
		.layers.find(
			(layer) =>
				layer['source-layer'] === US_STATES_LAYER && layer.type === 'fill',
		);
	const stateLayerId = stateLayer?.id;

	if (stateLayerId) {
		// Set feature state for each state
		currentData.value.states.forEach(
			({ state_iso: stateIso, source_count: count }) => {
				const id = STATE_ISO_TO_FEATURE_ID.get(stateIso);

				if (id) {
					map.value.setFeatureState(
						{
							source: 'composite',
							sourceLayer: US_STATES_LAYER,
							id: id,
						},
						{
							source_count: count,
						},
					);
				} else {
					console.warn('No id found for state', { stateIso, count });
				}
			},
		);

		map.value.addLayer(
			{
				id: 'state-fills',
				source: 'composite',
				'source-layer': US_STATES_LAYER,
				type: 'fill',
				minzoom: stateLayer.minzoom, // Preserve zoom settings from source
				maxzoom: stateLayer.maxzoom,
				paint: {
					'fill-color': fillColor,
					'fill-opacity': [
						'interpolate',
						['linear'],
						['coalesce', ['feature-state', 'source_count'], 0],
						0,
						0,
						1,
						0.1,
						10,
						0.2,
						25,
						0.3,
						50,
						0.4,
						75,
						0.5,
						100,
						0.6,
						200,
						0.7,
						300,
						0.8,
					],
				},
			},
			stateLayerId,
		);
	}
	//#endregion states

	//#region counties fill
	const countyLayer = map.value
		.getStyle()
		.layers.find(
			(layer) =>
				layer['source-layer'] === US_COUNTIES_LAYER && layer.type === 'fill',
		);
	const countyLayerId = countyLayer?.id;
	// Create a function to update county feature states for the current viewport

	// Only run this at zoom levels where counties are visible
	// const currentZoom = map.value.getZoom();
	// if (currentZoom < countyLayer.minzoom) {
	// 	console.log(
	// 		`Current zoom ${currentZoom} is below county minzoom ${countyLayer.minzoom}, skipping update`,
	// 	);
	// 	return;
	// }

	// Query counties in the current viewport
	const countyFeatures = map.value.querySourceFeatures('composite', {
		sourceLayer: US_COUNTIES_LAYER,
	});

	countyFeatures.forEach((feat) => {
		if (!countyLookup.value.get(feat.properties.id))
			countyLookup.value.set(feat.properties.id, feat);
	});

	// Create lookup map
	// Set feature states for counties in the current viewport
	currentData.value.counties.forEach((county) => {
		const stateFips = STATE_ISO_TO_FIPS.get(county.state_iso);
		const countyFeatureLookupId = `${county.name.toLowerCase()}_${stateFips}`;
		const countyFeatureId = countyLookup.value.get(countyFeatureLookupId)?.id;

		if (countyFeatureId) {
			map.value.setFeatureState(
				{
					source: 'composite',
					sourceLayer: US_COUNTIES_LAYER,
					id: countyFeatureId,
				},
				{
					source_count: county.source_count,
				},
			);
		}
	});

	if (countyLayerId) {
		// Add the county fills layer without setting feature states yet
		map.value.addLayer({
			id: 'county-fills',
			source: 'composite',
			'source-layer': US_COUNTIES_LAYER,
			type: 'fill',
			minzoom: countyLayer.minzoom,
			maxzoom: countyLayer.maxzoom ?? 22,
			paint: {
				'fill-color': fillColor,
				'fill-opacity': [
					'interpolate',
					['linear'],
					['coalesce', ['feature-state', 'source_count'], 0],
					0,
					0,
					1,
					0.1,
					5,
					0.2,
					10,
					0.3,
					20,
					0.4,
					30,
					0.5,
					50,
					0.6,
					75,
					0.7,
					100,
					0.8,
					150,
					0.9,
					200,
					1,
				],
			},
		});

		// Update feature states when the map moves or zooms
		// map.value.on('moveend', updateCountyFeatureStates);
	}

	//#endregion counties fill

	//#region locality points
	map.value.loadImage(marker, (error, image) => {
		if (error) throw error;
		map.value.addImage('custom-marker', image);

		const markerPoints = currentData.value.localities
			// .filter((muni) => muni.source_count)
			.map((muni) => {
				// Important: Mapbox GL expects GeoJSON coordinates in [longitude, latitude] order
				// No projection transformation needed - Mapbox handles this internally
				return {
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: [muni.coordinates.lng, muni.coordinates.lat],
					},
					properties: {
						title: muni.name,
						source_count: muni.source_count,
					},
				};
			});
		map.value.addSource('markers', {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: markerPoints,
			},
		});

		map.value.addLayer({
			id: 'muni-markers',
			type: 'symbol',
			source: 'markers',
			minzoom: 7,
			filter: ['!', ['has', 'point_count']],
			layout: {
				'icon-image': 'custom-marker',
				'icon-size': [
					'interpolate',
					['linear'],
					['zoom'],
					7,
					0.4, // smaller at zoom level 7
					8,
					0.6, // medium at zoom level 10
					9,
					1.0, // larger at zoom level 13
				],
				'icon-allow-overlap': true,
			},
			paint: {
				'icon-opacity': [
					'interpolate',
					['linear'],
					['get', 'source_count'],
					0,
					0.3,
					1,
					0.6,
					10,
					0.7,
					25,
					0.8,
					50,
					0.9,
					75,
					1,
				],
			},
		});

		map.value.addLayer({
			id: 'muni-markers-label-with-sources',
			type: 'symbol',
			source: 'markers',
			minzoom: 7,
			filter: ['>', ['get', 'source_count'], 0],
			layout: {
				'text-allow-overlap': false,
				'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
				'text-size': 14,
				'text-field': [
					'concat',
					['get', 'title'],
					'\n',
					['get', 'source_count'],
					['case', ['==', ['get', 'source_count'], 1], ' source', ' sources'],
				],

				'text-offset': [0, 1.25],
				'text-anchor': 'top',
			},
			paint: {
				'text-color': textColor,
				'text-opacity': [
					'interpolate',
					['linear'],
					['get', 'source_count'],
					0,
					0.3,
					1,
					0.6,
					10,
					0.7,
					25,
					0.8,
					50,
					0.9,
					75,
					1,
				],
				'text-halo-width': 1,
				'text-halo-color': prefersDarkTheme ? 'rgb(0,0,0)' : 'rgb(255,255,255)',
			},
		});
		map.value.addLayer({
			id: 'muni-markers-label-without-sources',
			type: 'symbol',
			source: 'markers',
			minzoom: 10.5,
			filter: ['==', ['get', 'source_count'], 0],
			layout: {
				'text-allow-overlap': false,
				'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
				'text-size': 14,
				'text-field': [
					'concat',
					['get', 'title'],
					'\n',
					['get', 'source_count'],
					['case', ['==', ['get', 'source_count'], 1], ' source', ' sources'],
				],

				'text-offset': [0, 1.25],
				'text-anchor': 'top',
			},
			paint: {
				'text-color': textColor,
				'text-opacity': 0.3,
				'text-halo-width': 1,
				'text-halo-color': prefersDarkTheme ? 'rgb(0,0,0)' : 'rgb(255,255,255)',
			},
		});
	});
	//#endregion locality points

	//#region zoom handlers
	// State click handler
	map.value.on('click', 'states', (e) => {
		if (!e.features[0].geometry) return;

		const bounds = new mapboxgl.LngLatBounds();

		e.features[0].geometry.coordinates.forEach((ring) => {
			// Handle first ring of coordinates for MultiPolygon
			if (Array.isArray(ring[0][0])) {
				ring[0].forEach((coord) => {
					bounds.extend(coord);
				});
			} else {
				// Handle single polygon
				ring.forEach((coord) => {
					bounds.extend(coord);
				});
			}
		});

		map.value.fitBounds(bounds, {
			padding: { top: 50, bottom: 50, left: 50, right: 50 },
			linear: true,
			maxZoom: 6, // Limit zoom level for states
		});
	});

	// County click handler
	map.value.on('click', 'counties', (e) => {
		if (!e.features[0].geometry) return;

		const bounds = new mapboxgl.LngLatBounds();

		const geometry = e.features[0].geometry;
		if (geometry.type === 'MultiPolygon') {
			geometry.coordinates.forEach((polygon) => {
				polygon[0].forEach((coord) => {
					bounds.extend(coord);
				});
			});
		} else {
			geometry.coordinates[0].forEach((coord) => {
				bounds.extend(coord);
			});
		}

		// Perform the zoom
		map.value.fitBounds(bounds, {
			padding: { top: 50, bottom: 50, left: 50, right: 50 },
			linear: true,
		});
	});

	// Add cursor style changes for better UX
	['states', 'counties'].forEach((layer) => {
		map.value.on('mouseenter', layer, () => {
			map.value.getCanvas().style.cursor = 'pointer';
		});

		map.value.on('mouseleave', layer, () => {
			map.value.getCanvas().style.cursor = '';
		});
	});
	//#endregion zoom handlers
}

//#region helpers
function handleTheme() {
	const prefersDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');
	return {
		prefersDarkTheme,
		fillColor: prefersDarkTheme.matches
			? 'rgb(223, 214, 222)'
			: 'rgb(19, 9, 18)',
		textColor: 'rgb(255, 253, 253)',
		mapTheme: prefersDarkTheme.matches ? MAP_STYLES.dark : MAP_STYLES.light,
	};
}

function updateLoadingText() {
	let index = 0;
	const text = [
		'This may take a while, sit tight.',
		'Still loading, hang on.',
		'There are quite a few data sources in our database, almost done...',
	];

	const interval = setInterval(() => {
		if (index === text.length) {
			clearInterval(interval);
			return;
		}

		loadingText.value = text[index];
		index++;
	}, 3 * 1000);
}

// function searchAndCenterCounty(searchTerm) {
// 	const search = searchTerm.toLowerCase();

// 	const matchingCounty = countyGeoJson.features.find((feature) =>
// 		feature.properties.NAME.toLowerCase().includes(search),
// 	);

// 	if (matchingCounty) {
// 		const centerPoint = polylabel(
// 			matchingCounty.geometry.coordinates,
// 			0.000001,
// 		);

// 		// Set filter and opacity for the highlight layer
// 		dataSourceMap.value.setFilter('county-highlight', [
// 			'==',
// 			['get', 'NAME'],
// 			matchingCounty.properties.NAME,
// 		]);

// 		dataSourceMap.value.setPaintProperty(
// 			'county-highlight',
// 			'fill-opacity',
// 			0.5,
// 		);

// 		// Center the map on the county
// 		dataSourceMap.value.flyTo({
// 			center: centerPoint,
// 			zoom: 8,
// 			essential: true,
// 		});

// 		// Optional: Reset the highlight after a few seconds
// 		const clearHighlight = () => {
// 			dataSourceMap.value.setPaintProperty(
// 				'county-highlight',
// 				'fill-opacity',
// 				0,
// 			);
// 			// Remove the event listeners after first trigger
// 			dataSourceMap.value.off('movestart', clearHighlight);
// 			dataSourceMap.value.off('dragstart', clearHighlight);
// 		};

// 		// Add event listeners for map movement
// 		dataSourceMap.value.on('movestart', clearHighlight);
// 		dataSourceMap.value.on('dragstart', clearHighlight);
// 	}
// }
//#endregion helpers
</script>

<style>
.mapboxgl-ctrl-attrib {
	display: none;
}

.mapboxgl-popup-content {
	background-color: #fff;
	color: #000;
	@apply px-4;
}

.mapboxgl-popup-close-button {
	@apply h-4 w-4 text-lg;
}
</style>
