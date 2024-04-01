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
	new mapboxgl.Map({
		container: 'mapboxContainer',
		style: 'mapbox://styles/mapbox/streets-v11',
		center: [mapCenter.longitude, mapCenter.latitude],
		zoom: 10,
		// maxBounds: [
		// 	[103.6, 1.1704753],
		// 	[104.1, 1.4754753],
		// ],
	});

	// Populate map with data sources
	// const attempt = await geocodeForward('Asheville Police Department - NC');
	const dataSources = await getDataSourceLocationData();
	const pinData = dataSources
		.map((source) => ({
			query: source?.agency_name,
			country: 'US',
			region: source?.state_iso,
		}))
		.slice(0, 1);
	// const pins = await geocodeForwardAsBatch(pinData);
});

async function getUserIp() {
	return await axios
		.get(ENDPOINTS.IPIFY)
		.then((resp) => resp.data.ip)
		.catch((e) => console.error(e)); // Error does not need handling. Fall back to Pittsburgh as default location.
}

// TODO: fix this...
async function geocodeForwardAsBatch(batch) {
	// const params = {
	// 	access_key: import.meta.env.VITE_POSITION_STACK_TOKEN,
	// };

	return await axios
		.get(
			`${ENDPOINTS.GEOCODE_FORWARD}?access_key=${import.meta.env.VITE_POSITION_STACK_TOKEN}`,
			{ batch },
			// { params },
		)
		.then((resp) => resp.data.data)
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

<style scoped>
.mapbox-container {
	height: 100%;
	width: 100%;
}
</style>
