<template>
	<main class="h-[calc(100vh-80px)] w-full relative p-0">
		<!-- Map -->
		<div
			v-if="!dataSourcesLoading"
			id="mapboxContainer"
			class="h-full w-full"
		/>

		<Spinner :show="dataSourcesLoading" :size="size" class="h-full w-full" />

		<!-- <Sidebar
			v-if="dataSourceMap && dataSources"
			:map="dataSourceMap"
			:data="dataSources"
		/> -->
	</main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
import polylabel from '@mapbox/polylabel';
// import Sidebar from './DataSourceMapSidebar.vue';
import { Spinner } from 'pdap-design-system';
import countyGeoJson from '../util/geoJSON/counties.json';
import stateGeoJson from '../util/geoJSON/states.json';

import stateFpToAbbreviation from '../util/stateFpToStateAbbreviation';
import recordTypesToDisplay from '../util/recordTypesToDisplay';

// Constants
const PDAP_DATA_SOURCE_SEARCH =
	'https://data-sources.pdap.io/api/search-tokens?endpoint=data-sources-map';

/**
 * ## Pittsburgh city center
 */
const DEFAULT_COORDINATES = {
	latitude: 40.44231,
	longitude: -79.98651,
};

const MAP_STYLES = {
	dark: 'mapbox://styles/josh-pdap/clz092ixe01pp01qo6kqt7i5m',
	light: 'mapbox://styles/josh-pdap/clz092n7o01n401pa6pun6zly',
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

onMounted(async () => {
	emit('loading', true);
	await loadDataSources();
	makeMap();
});

async function makeMap() {
	const { color, fillColor, prefersDarkTheme, mapTheme: style } = handleTheme();

	countyGeoJson.features = countyGeoJson.features.map((feature) => {
		dataSources.value.forEach((source) => {
			if (
				source.state_iso ===
					stateFpToAbbreviation.get(feature.properties.STATEFP) &&
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

	const countiesWithDataSourcesLabelsGeoJson = JSON.parse(
		JSON.stringify(countyGeoJson),
	);
	countiesWithDataSourcesLabelsGeoJson.name = `${countyGeoJson.name}_labels`;
	countiesWithDataSourcesLabelsGeoJson.features =
		countiesWithDataSourcesLabelsGeoJson.features
			.map((feature) => {
				if (!feature.properties.sources) return;
				feature.geometry.type = 'Point';
				feature.geometry.coordinates = polylabel(
					feature.geometry.coordinates,
					0.000001,
				);
				return feature;
			})
			.filter(Boolean);

	console.debug({ countyGeoJson, countiesWithDataSourcesLabelsGeoJson });

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

	/**
	 * Default is Pgh city center unless user location available via navigator
	 */
	let mapCenter = DEFAULT_COORDINATES;
	if (window.navigator.getCurrentPosition) {
		window.navigator.getCurrentPosition((pos) => {
			mapCenter = pos.coords;
		});
	}

	// Render map
	dataSourceMap.value = new mapboxgl.Map({
		container: 'mapboxContainer',
		style,
		center: [mapCenter.longitude, mapCenter.latitude],
		zoom: 5,
		maxBounds: [
			[-172.06707715558082, 15.064032429448638],
			[-28.673639540108578, 70.89960589653042],
		],
		minZoom: 3,
		maxZoom: 12,
	});

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

	dataSourceMap.value.on('load', () => {
		const firstSymbolId = dataSourceMap.value
			.getStyle()
			.layers.filter((layer) => layer.type === 'symbol')
			.reverse()
			.reduce((_, cur) => cur.id, '');

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

		dataSourceMap.value.addLayer(
			{
				id: 'county-fills',
				type: 'fill',
				source: 'counties',
				layout: {},
				minzoom: 5,

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
							// [100, 0.5],
							// [200, 0.6],
							// [300, 0.7],
						],
					},
				},
			},
			firstSymbolId,
		);

		// Hide city labels to avoid conflicts with county labels
		dataSourceMap.value.setLayoutProperty(
			'settlement-major-label',
			'visibility',
			'none',
		);
		dataSourceMap.value.setLayoutProperty(
			'settlement-minor-label',
			'visibility',
			'none',
		);
		dataSourceMap.value.setLayoutProperty(
			'settlement-subdivision-label',
			'visibility',
			'none',
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
			minzoom: 7.6,
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
				'text-size': 16,
			},
			paint: {
				'text-color': 'rgb(255, 253, 253)',
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
	});
	dataSourceMap.value.on('zoom', () => {
		console.debug({ zoom: dataSourceMap.value.getZoom() });
	});

	// Event listeners
	// Update map theme on user preference change
	prefersDarkTheme.addEventListener('change', (e) => {
		dataSourceMap.value.setStyle(
			e.matches ? MAP_STYLES.dark : MAP_STYLES.light,
		);
	});
}

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

async function loadDataSources() {
	// Populate map with data sources
	dataSources.value = await fetchDataSourceData()
		.then((resp) => resp.data.data)
		.then((data) => data.filter(filterByRecords))
		.catch((e) => {
			error.value = e?.message;
			emit('error', e?.message);
		});
	dataSourcesLoading.value = false;
	emit('loading', false);
}

async function fetchDataSourceData() {
	return await axios.get(PDAP_DATA_SOURCE_SEARCH);
}
</script>

<style>
/*
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

.fa-arrow-right::before,
.fa-map-marker::before {
	@apply: font-normal text-neutral-950;
}

.fa-map-marker::before {
	-webkit-text-shadow: inset 0px 4px 3px -4px var(--color-neutral-200);
	-moz-text-shadow: inset 0px 4px 3px -4px var(--color-neutral-200);
	text-shadow: inset 0px 4px 3px -4px var(--color-neutral-200);
	box-shadow: 0 0 calc(3px * var(--scale-markers-by)) var(--color-neutral-900);
	font-size: calc(2rem * var(--scale-markers-by));
}
*/
</style>
