<template>
	<main class="h-[calc(100vh-80px)] w-full p-16 pb-24">
		<div class="h-full w-full relative">
			<!-- Dummy search input for testing search of counties - TODO: use typeahead -->
			<div class="absolute top-4 left-4 z-10">
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search for a county..."
					class="px-4 py-2 rounded border bg-black"
					@keyup.enter="handleSearch"
				/>
			</div>

			<!-- Map -->
			<div
				id="mapboxContainer"
				class="h-full w-full"
				:class="{ 'show-markers': zoom >= 6 }"
			/>

			<Spinner
				:show="dataSourcesLoading"
				:size="size"
				class="h-full w-full absolute left-0 top-0 z-50 bg-goldneutral-500/70 dark:bg-wineneutral-500/70"
				:text="loadingText"
			/>

			<Sidebar
				v-if="dataSourceMap && dataSources.length"
				:map="dataSourceMap"
				:data="dataSources"
			/>
		</div>
	</main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
import polylabel from '@mapbox/polylabel';
import Sidebar from './DataSourceMapSidebar.vue';
import { Spinner } from 'pdap-design-system';
import countyGeoJson from '../util/geoJSON/counties.json';
import stateGeoJson from '../util/geoJSON/states.json';
import _debounce from 'lodash/debounce';

import { STATEFP_TO_ABBR } from '../util/constants';
import recordTypesToDisplay from '../util/recordTypesToDisplay';

// Constants
const PDAP_DATA_SOURCE_SEARCH =
	import.meta.env.VITE_API_URL + '/map/data-sources';

const MAP_STYLES = {
	dark: 'mapbox://styles/josh-pdap/clyejn3bg014x01nzg6786ozv',
	light: 'mapbox://styles/josh-pdap/clyejn7qx017601qoa3bo8wni',
};

// Setup
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Emits
const emit = defineEmits(['error', 'loading']);

// Reactive vars
const dataSourceMap = ref();
const dataSources = ref([]);
const error = ref('');
const dataSourcesLoading = ref(true);
const size = ref(window.innerHeight / 15);
const zoom = ref(3.5);
const loadingText = ref('Data sources loading...');
const searchQuery = ref('');

function handleSearch() {
	console.debug('handleSearch', { searchQuery: searchQuery.value });
	if (searchQuery.value) {
		searchAndCenterCounty(searchQuery.value);
	}
}

onMounted(async () => {
	emit('loading', true);
	updateLoadingText();
	await new Promise((resolve) => {
		makeMap();
		resolve();
	});

	// Wait for both the map style to load and data sources
	try {
		// Wait for both the map style to load and data sources
		await Promise.all([
			new Promise((resolve) => dataSourceMap.value.on('style.load', resolve)),
			loadDataSources(),
		]);

		// Only set loading to false after sources fetched
		emit('loading', false);
		dataSourcesLoading.value = false;

		attachDataSourcesToMap();
	} catch (error) {
		console.error('Error initializing map:', error);
		emit('error', error.message);
	}
});

function makeMap() {
	const { prefersDarkTheme, mapTheme: style } = handleTheme();

	// Initialize base map
	dataSourceMap.value = new mapboxgl.Map({
		container: 'mapboxContainer',
		style,
		center: [-98, 36],
		zoom: 3.5,
		maxBounds: [
			[-172.06707715558082, 15.064032429448638],
			[-28.673639540108578, 70.89960589653042],
		],
		minZoom: 3,
		maxZoom: 12,
	});

	// Add controls
	const nav = new mapboxgl.NavigationControl();
	const geolocate = new mapboxgl.GeolocateControl({
		positionOptions: {
			enableHighAccuracy: true,
		},
		fitBoundsOptions: { linear: true, zoom: dataSourceMap.value.getZoom() },
		trackUserLocation: true,
	});
	dataSourceMap.value.addControl(nav, 'top-right');
	dataSourceMap.value.addControl(geolocate, 'top-right');

	// Set up zoom handler
	const handleZoom = _debounce(() => {
		zoom.value = dataSourceMap.value.getZoom();
		const scaleRatio = dataSourceMap.value.getZoom() / 10;
		document
			.querySelector(':root')
			.style.setProperty('--scale-markers-by', scaleRatio);
	}, 100);

	dataSourceMap.value.on('zoom', handleZoom);

	// Theme change listener
	prefersDarkTheme.addEventListener('change', (e) => {
		dataSourceMap.value.setStyle(
			e.matches ? MAP_STYLES.dark : MAP_STYLES.light,
		);
	});
}

function attachDataSourcesToMap() {
	const { color, fillColor } = handleTheme();
	const dataSourcesByMarkersRendered = new Map();

	// Process GeoJSON data with data sources
	countyGeoJson.features = countyGeoJson.features.map((feature) => {
		dataSources.value.forEach((source) => {
			if (
				source.state_iso === STATEFP_TO_ABBR.get(feature.properties.STATEFP) &&
				source?.county_name?.includes(feature.properties.NAME)
			) {
				const { sources } = feature.properties;
				feature.properties.sources =
					typeof sources === 'number' ? sources + 1 : 0;
			} else {
				feature.properties.sources = feature.properties.sources ?? 0;
			}
		});
		return feature;
	});

	// Process labels GeoJSON
	const countiesWithDataSourcesLabelsGeoJson = {
		type: 'FeatureCollection',
		features: countyGeoJson.features
			.map((feature) => {
				if (!feature.properties.sources) return;

				// Create proper Point geometry
				return {
					type: 'Feature',
					properties: feature.properties,
					geometry: {
						type: 'Point',
						coordinates: polylabel(feature.geometry.coordinates, 0.000001),
					},
				};
			})
			.filter(Boolean),
	};

	// Process state GeoJSON
	stateGeoJson.features = stateGeoJson.features.map((feature) => {
		dataSources.value.forEach((source) => {
			if (source.state_iso === feature.id) {
				const { sources } = feature.properties;
				feature.properties.sources =
					typeof sources === 'number' ? sources + 1 : 0;
			}
		});
		return feature;
	});

	// Add markers for data sources
	dataSources.value.forEach((source) => {
		if (!(source.lat || source.lng)) return;

		if (dataSourcesByMarkersRendered.has(source.agency_name)) {
			dataSourcesByMarkersRendered.set([
				source.agency_name,
				dataSourcesByMarkersRendered.get(source.agency_name) + 1,
			]);
		} else {
			dataSourcesByMarkersRendered.set([source.agency_name, 1]);
		}

		const markerElement = document.createElement('i');
		markerElement.classList = 'fa fa-map-marker';

		const popup = new mapboxgl.Popup({ offset: 25 }).setDOMContent(
			makeAnchor(source),
		);

		new mapboxgl.Marker({
			element: markerElement,
		})
			.setLngLat([source.lng, source.lat])
			.setPopup(popup)
			.addTo(dataSourceMap.value);
	});

	// Add sources
	dataSourceMap.value.addSource('counties', {
		type: 'geojson',
		data: { ...countyGeoJson },
	});
	dataSourceMap.value.addSource('counties-labels', {
		type: 'geojson',
		data: { ...countiesWithDataSourcesLabelsGeoJson },
	});
	dataSourceMap.value.addSource('states', {
		type: 'geojson',
		data: { ...stateGeoJson },
	});

	const firstSymbolId = dataSourceMap.value
		.getStyle()
		.layers.filter((layer) => layer.type === 'symbol')
		.reverse()
		.reduce((_, cur) => cur.id, '');

	// Add layers
	dataSourceMap.value.addLayer(
		{
			id: 'county-fills',
			type: 'fill',
			source: 'counties',
			layout: {},
			minzoom: 5,
			// maxzoom: 7,
			paint: {
				'fill-color': fillColor,
				'fill-opacity': {
					property: 'sources',
					stops: [
						[0, 0],
						[1, 0.4],
						[5, 0.5],
						[10, 0.6],
						[25, 0.7],
						[50, 0.8],
						[100, 0.9],
						[200, 1],
					],
				},
			},
		},
		firstSymbolId,
	);
	dataSourceMap.value.addLayer(
		{
			id: 'county-outlines',
			type: 'line',
			source: 'counties',
			minzoom: 5,
			layout: {},
			paint: {
				'line-color': color,
				'line-dasharray': [
					'step',
					['zoom'],
					['literal', [3, 2, 5]],
					7,
					['literal', [2, 1.5]],
				],
				'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 12, 2],
				'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0, 6, 1],
			},
		},
		firstSymbolId,
	);

	dataSourceMap.value.addLayer({
		id: 'counties-labels',
		type: 'symbol',
		source: 'counties-labels',
		minzoom: 5,
		layout: {
			'text-field': '{NAME}\nSources: {sources}',
			// TODO: figure out mapbox's (actually Lisp's) ridiculous expression syntax to make this more dynamic
			// https://docs.mapbox.com/help/tutorials/mapbox-gl-js-expressions/
			// 'text-field': [
			// 	'case',
			// 	['has', 'sources'],
			// 	['concat', ['get', 'NAME'], '\n'[('get', 'sources')]],
			// 	['get', 'name'],
			// ],
			'text-font': ['DIN Pro Medium'],
			'text-size': [
				'interpolate',
				['linear'],
				['zoom'],
				5,
				12, // At zoom level 5, text size will be 12px
				8,
				16, // At zoom level 8, text size will be 16px
				10,
				20, // At zoom level 10, text size will be 20px
			],
		},
		paint: {
			'text-color': 'rgb(255,255,255)',
			'text-halo-width': 2,
			'text-halo-color': 'rgb(0,0,0)',
		},
	});

	dataSourceMap.value.addLayer(
		{
			id: 'state-fills',
			type: 'fill',
			source: 'states',
			layout: {},
			maxzoom: 5,

			paint: {
				'fill-color': fillColor,
				'fill-opacity': {
					property: 'sources',
					// TODO: get steps dynamically based on highest and lowest number of data-sources?
					stops: [
						[0, 0],
						[10, 0.1],
						[25, 0.2],
						[50, 0.3],
						[100, 0.4],
						[200, 0.5],
						[300, 0.6],
						[400, 0.7],
						// [80, 0.8],
						// [90, 0.9],
						// [100, 1],
					],
				},
			},
		},
		firstSymbolId,
	);

	dataSourceMap.value.setLayoutProperty('settlement-major-label', 'minzoom', 7);
	dataSourceMap.value.setLayoutProperty('settlement-minor-label', 'minzoom', 7);
	dataSourceMap.value.setLayoutProperty(
		'settlement-subdivision-label',
		'minzoom',
		9,
	);
}
// Helpers
function handleTheme() {
	const prefersDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');
	return {
		prefersDarkTheme,
		fillColor: prefersDarkTheme.matches
			? 'rgb(223, 214, 222)'
			: 'rgb(19, 9, 18)',
		color: prefersDarkTheme.matches ? 'rgb(255, 253, 253)' : 'rgb(34, 34, 34)',
		mapTheme: prefersDarkTheme.matches ? MAP_STYLES.dark : MAP_STYLES.light,
	};
}

function filterByRecords(source) {
	return recordTypesToDisplay.has(source.record_type);
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

async function loadDataSources() {
	// Check cache first
	const cachedData = localStorage.getItem('pdap-data-sources');
	const cacheTimestamp = localStorage.getItem('pdap-data-sources-timestamp');

	// Cache expires after 24 hours (86400000 ms)
	const CACHE_DURATION = 86400000;
	const isCacheValid =
		cacheTimestamp && Date.now() - parseInt(cacheTimestamp) < CACHE_DURATION;

	if (dataSources.value.length) {
		return;
	}

	if (cachedData && isCacheValid) {
		try {
			dataSources.value = await Promise.resolve().then(() => {
				return JSON.parse(cachedData).filter(filterByRecords);
			});
			return;
		} catch (e) {
			console.error('Error parsing cached data:', e);
			// Continue to fetch fresh data
		}
	}

	// If no cache or cache expired, fetch from API
	dataSources.value = await fetchDataSourceData()
		.then((resp) => {
			// Cache the response
			localStorage.setItem('pdap-data-sources', JSON.stringify(resp.data.data));
			localStorage.setItem(
				'pdap-data-sources-timestamp',
				Date.now().toString(),
			);
			return resp.data.data;
		})
		.then((data) => data.filter(filterByRecords))
		.catch((e) => {
			error.value = e?.message;
			emit('error', e?.message);
		});
}

async function fetchDataSourceData() {
	return await axios.get(PDAP_DATA_SOURCE_SEARCH, {
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Basic ' + import.meta.env.VITE_API_KEY,
		},
	});
}

function makeAnchor(source) {
	const anchor = document.createElement('a');
	// TODO: update with new search endpoint
	anchor.href = encodeURI(
		`https://data-sources.pdap.io/search/all/${source.municipality ?? source.agency_name.toLocaleLowerCase()}`,
	);
	anchor.innerText = source.agency_name;
	anchor.style.height = '100%';
	anchor.style.width = '100%';
	anchor.style.padding = '4px';
	anchor.setAttribute('target', '_blank');
	anchor.setAttribute('rel', 'noreferrers');
	anchor.setAttribute(
		'aria-label',
		`search for data related to ${source.municipality}`,
	);
	return anchor;
}

function searchAndCenterCounty(searchTerm) {
	const search = searchTerm.toLowerCase();

	const matchingCounty = countyGeoJson.features.find((feature) =>
		feature.properties.NAME.toLowerCase().includes(search),
	);

	if (matchingCounty) {
		const centerPoint = polylabel(
			matchingCounty.geometry.coordinates,
			0.000001,
		);

		// Set filter and opacity for the highlight layer
		dataSourceMap.value.setFilter('county-highlight', [
			'==',
			['get', 'NAME'],
			matchingCounty.properties.NAME,
		]);

		dataSourceMap.value.setPaintProperty(
			'county-highlight',
			'fill-opacity',
			0.5,
		);

		// Center the map on the county
		dataSourceMap.value.flyTo({
			center: centerPoint,
			zoom: 8,
			essential: true,
		});

		// Optional: Reset the highlight after a few seconds
		const clearHighlight = () => {
			dataSourceMap.value.setPaintProperty(
				'county-highlight',
				'fill-opacity',
				0,
			);
			// Remove the event listeners after first trigger
			dataSourceMap.value.off('movestart', clearHighlight);
			dataSourceMap.value.off('dragstart', clearHighlight);
		};

		// Add event listeners for map movement
		dataSourceMap.value.on('movestart', clearHighlight);
		dataSourceMap.value.on('dragstart', clearHighlight);
	}
}
</script>

<style>
:root {
	--scale-markers-by: 1;
}

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

.fa-map-marker {
	@apply hidden;
}

.show-markers .fa-map-marker {
	@apply block;
}

.fa-arrow-right::before,
.fa-map-marker::before {
	@apply: font-normal text-neutral-950 dark:text-neutral-50;
}

.fa-map-marker::before {
	-webkit-text-shadow: inset 0px 4px 3px -4px var(--color-neutral-200);
	-moz-text-shadow: inset 0px 4px 3px -4px var(--color-neutral-200);
	text-shadow: inset 0px 4px 3px -4px var(--color-neutral-200);
	box-shadow: 0 0 calc(3px * var(--scale-markers-by)) var(--color-neutral-900);
	font-size: calc(2rem * var(--scale-markers-by));
}
</style>
