<template>
	<main class="h-[calc(100vh-80px)] w-full relative p-0">
		<!-- Map -->
		<div
			v-show="!dataSourcesLoading"
			id="mapboxContainer"
			class="h-full w-full"
		/>

		<Spinner :show="dataSourcesLoading" :size="size" class="h-full w-full" />

		<Sidebar
			v-if="dataSourceMap && dataSources"
			:map="dataSourceMap"
			:data="dataSources"
		/>
	</main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
import Sidebar from './DataSourceMapSidebar.vue';
import { Spinner } from 'pdap-design-system';

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
	dark: 'mapbox://styles/joshuagraber/clusfefd700es01p26np15nwx',
	light: 'mapbox://styles/joshuagraber/clumq3et900wu01qo4lne6eks',
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

function makeMap() {
	const { prefersDarkTheme, mapTheme: style } = handleTheme();

	let mapCenter = DEFAULT_COORDINATES;
	if (window.navigator.getCurrentPosition) {
		window.navigator.getCurrentPosition((pos) => {
			mapCenter.longitude = pos.coords.longitude;
			mapCenter.latitude = pos.coords.latitude;
		});
	}

	// Render map
	dataSourceMap.value = new mapboxgl.Map({
		container: 'mapboxContainer',
		style,
		center: [mapCenter.longitude, mapCenter.latitude],
		zoom: 10,
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

	dataSources.value.forEach((source) => {
		if (!source || !(source.lat || source.lng)) return;

		const markerElement = document.createElement('i');
		markerElement.classList = 'fa fa-map-marker';

		// create the popup
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

	// Event listeners
	// Scale markers on zoom in/out
	dataSourceMap.value.on('zoom', () => {
		const scaleRatio = dataSourceMap.value.getZoom() / 10;
		document
			.querySelector(':root')
			.style.setProperty('--scale-markers-by', scaleRatio);
	});
	// Update map theme on user preference change
	prefersDarkTheme.addEventListener('change', (e) => {
		console.debug('theme preference change', { e });
		dataSourceMap.value.setStyle(
			e.matches ? MAP_STYLES.dark : MAP_STYLES.light,
		);
	});
	// mapLoading.value = false;
}

function makeAnchor(source) {
	const anchor = document.createElement('a');
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

function handleTheme() {
	const prefersDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');

	return {
		prefersDarkTheme,
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
	text-shadow: 0 0 calc(3px * var(--scale-markers-by)) #000;
	font-size: calc(2rem * var(--scale-markers-by));
}
</style>
