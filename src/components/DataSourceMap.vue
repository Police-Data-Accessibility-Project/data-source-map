<template>
	<main id="mapboxContainer" class="mapbox-container" />
</template>

<script setup>
import { onMounted, ref } from 'vue';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';

// Constants
// const PDAP_DATA_SOURCE_SEARCH =
// 	'https://data-sources.pdap.io/api/search-tokens?endpoint=data-sources-map',
const PDAP_DATA_SOURCE_SEARCH =
	'http://localhost:5000/search-tokens?endpoint=data-sources-map';

/**
 * Pittsburgh city center
 */
const DEFAULT_COORDINATES = {
	latitude: 40.44231,
	longitude: -79.98651,
};

// Reactive vars
const error = ref('');
// const mapLoading = ref(true);
// const dataSourcesLoading = ref(true);

onMounted(async () => {
	const prefersDarkTheme = window.matchMedia(
		'(prefers-color-scheme: dark)',
	).matches;

	let mapCenter = DEFAULT_COORDINATES;

	if (window.navigator.getCurrentPosition) {
		window.navigator.getCurrentPosition((pos) => {
			mapCenter.longitude = pos.coords.longitude;
			mapCenter.latitude = pos.coords.latitude;
		});
	}

	// Render map
	const theme = prefersDarkTheme
		? 'mapbox://styles/joshuagraber/clusfefd700es01p26np15nwx'
		: 'mapbox://styles/joshuagraber/clumq3et900wu01qo4lne6eks';

	// watchEffect(() => {
	// 	console.debug({ theme });
	// });

	mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
	const dataSourceMap = new mapboxgl.Map({
		container: 'mapboxContainer',
		style: theme,
		center: [mapCenter.longitude, mapCenter.latitude],
		zoom: 10,
		maxBounds: [
			[-172.06707715558082, 15.064032429448638],
			[-28.673639540108578, 70.89960589653042],
		],
	});
	const nav = new mapboxgl.NavigationControl();
	const geolocate = new mapboxgl.GeolocateControl({
		positionOptions: {
			enableHighAccuracy: true,
		},
		trackUserLocation: true,
	});
	dataSourceMap.addControl(nav, 'top-right');
	dataSourceMap.addControl(geolocate, 'top-right');
	dataSourceMap.on('zoom', () => {
		const scaleRatio = dataSourceMap.getZoom() / 10;
		document
			.querySelector(':root')
			.style.setProperty('--scale-markers-by', scaleRatio);
	});

	// Populate map with data sources
	const dataSources = await getDataSourceLocationData();

	dataSources.forEach((source) => {
		if (!source || !(source.lat || source.lng)) return; // TODO: get from object once API fixed

		const markerElement = document.createElement('i');
		markerElement.classList = 'fa fa-map-marker';

		// create the popup
		const popup = new mapboxgl.Popup({ offset: 25 }).setText(
			source.agency_name,
		);

		new mapboxgl.Marker({
			element: markerElement,
		})
			.setLngLat([source.lng, source.lat])
			.setPopup(popup)
			.addTo(dataSourceMap);
	});
});

async function getDataSourceLocationData() {
	return await axios
		.get(PDAP_DATA_SOURCE_SEARCH)
		.then((resp) => resp.data.data)
		.catch((e) => (error.value = e?.message));
}
</script>

<style>
:root {
	--scale-markers-by: 1;
}

.mapbox-container {
	height: 100%;
	width: 100%;
}

.mapboxgl-popup-content {
	background-color: #fff;
	color: #000;
	@apply px-4;
}

.mapboxgl-popup-close-button {
	@apply h-4 w-4 text-lg;
}

.fa-map-marker::before {
	@apply text-neutral-950;
	font-size: calc(2rem * var(--scale-markers-by));
}
</style>
