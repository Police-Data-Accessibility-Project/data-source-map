<template>
	<main id="mapboxContainer" class="mapbox-container" />
</template>

<script setup>
import { onMounted, ref } from 'vue';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';
import { ENDPOINTS } from '../util/constants';

// Constants
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
	// Get map center
	const userIp = await getUserIp();
	const userLocation = await geocodeReverse(userIp);
	const mapCenter = userLocation ?? DEFAULT_COORDINATES;

	// Render map
	mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
	const dataSourceMap = new mapboxgl.Map({
		container: 'mapboxContainer',
		style: 'mapbox://styles/mapbox/streets-v11',
		center: [mapCenter.longitude, mapCenter.latitude],
		zoom: 10,
		// maxBounds: [
		// 	[103.6, 1.1704753],
		// 	[104.1, 1.4754753],
		// ],
	});
	const nav = new mapboxgl.NavigationControl();
	dataSourceMap.addControl(nav, 'top-right');
	const geolocate = new mapboxgl.GeolocateControl({
		positionOptions: {
			enableHighAccuracy: true,
		},
		trackUserLocation: true,
	});

	dataSourceMap.addControl(geolocate, 'top-right');

	// Populate map with data sources
	const dataSources = await getDataSourceLocationData();

	//#region testing code, lots of filtering going on here to keep from pinging API with 1300+ requests
	const sourcesFiltered = dataSources.filter(
		(source) => source.state_iso === userLocation.region_code,
	);
	const pins = await Promise.all(
		sourcesFiltered
			.slice(0, 25) // Only fetch the first twenty-five results, this is just for testing
			.map((source) => geocodeForward(source.agency_name)),
	);
	//#endregion testing code

	pins.forEach((pin, _, self) => {
		// create the popup
		const popup = new mapboxgl.Popup({ offset: 25 }).setText(
			sourcesFiltered[self.indexOf(pin)].agency_name,
		);

		new mapboxgl.Marker()
			.setLngLat([pin.longitude, pin.latitude])
			.setPopup(popup)
			.addTo(dataSourceMap);
	});

	console.debug({ sourcesFiltered, pins, userLocation });
});

async function getUserIp() {
	return await axios
		.get(ENDPOINTS.IPIFY)
		.then((resp) => resp.data.ip)
		.catch((e) => console.error(e)); // Error does not need handling. Fall back to Pittsburgh as default location.
}

async function geocodeForward(query) {
	const params = {
		access_key: import.meta.env.VITE_POSITION_STACK_TOKEN,
		query,
	};

	return await axios
		.get(ENDPOINTS.GEOCODE_FORWARD, { params })
		.then((resp) => resp.data.data[0])
		.catch((e) => (error.value = e));
}

async function geocodeReverse(query) {
	const params = {
		access_key: import.meta.env.VITE_POSITION_STACK_TOKEN,
		query,
	};

	return await axios
		.get(ENDPOINTS.GEOCODE_REVERSE, { params })
		.then((resp) => resp.data.data[0])
		.catch((e) => (error.value = e.data.message));
}

async function getDataSourceLocationData() {
	return await axios
		.get(ENDPOINTS.PDAP_DATA_SOURCE_SEARCH)
		.then((resp) => resp.data.data)
		.catch((e) => (error.value = e.data.message));
}
</script>

<style>
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
</style>
