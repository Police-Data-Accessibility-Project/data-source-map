<template>
	<main class="h-[calc(100vh-80px)] w-full relative">
		<!-- Map -->
		<div id="mapboxContainer" class="h-full w-full" />

		<!-- Sidebar for list view of data sources -->
		<aside
			v-if="Object.keys(sourcesInMapBoundsByCountyThenAgency).length > 0"
			class="absolute border-neutral-950 border-[1px] border-solid left-[5%] bottom-6 text-neutral-950 text-sm py-4 px-1 overflow-y-scroll bg-neutral-200 bg-opacity-85 max-w-[90%] my-o mx-auto inline-flex gap-4 md:block md:max-h-[75%] md:max-w-[25%] md:overflow-y-scroll md:right-6 md:left-[unset]"
		>
			<div
				v-for="county of sourcesInMapBoundsSidebarRenderOrderByCounty"
				:key="county"
				class="grid grid-cols-[repeat(auto-fill,_minmax(150px,_max-content))] grid-rows-[auto,_1fr] min-w-[max-content] gap-2 md:min-w-[unset] md:block md:w-full md:mt-4"
			>
				<h3 class="row-span-1 col-start-1 col-end-[-1] text-neutral-950">
					{{ county }} County
				</h3>
				<a
					v-for="([agency, data], index) of Object.entries(
						sourcesInMapBoundsByCountyThenAgency[county],
					)"
					:key="agency"
					class="pdap-button-tertiary border-neutral-950 col-span-1 border-[1px] border-solid font-normal text-sm text-left mb-2 p-2 md:w-full md:max-w-[unset]"
					:href="`https://data-sources.pdap.io/search/all/${encodeURI(data[0]?.municipality ?? data[0]?.county_name?.[0] ?? agency.split(' ')[0])}`"
					target="_blank"
					rel="noreferrer"
					:style="{ gridColumnStart: index + 1, gridColumnEnd: index + 2 }"
				>
					<span class="block">
						{{ agency }}
					</span>
					<span class="block"
						>{{ data.length }} data {{ pluralize('source', data.length) }}
						<i class="fa fa-arrow-right" />
					</span>
				</a>
			</div>
		</aside>
	</main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import axios from 'axios';
import mapboxgl from 'mapbox-gl';

import recordTypesToDisplay from '../util/recordTypesToDisplay';

// Constants
const PDAP_DATA_SOURCE_SEARCH =
	'https://data-sources.pdap.io/api/search-tokens?endpoint=data-sources-map';

/**
 * Pittsburgh city center
 */
const DEFAULT_COORDINATES = {
	latitude: 40.44231,
	longitude: -79.98651,
};

const MAP_STYLES = {
	dark: 'mapbox://styles/joshuagraber/clusfefd700es01p26np15nwx',
	light: 'mapbox://styles/joshuagraber/clumq3et900wu01qo4lne6eks',
};

// Reactive vars
const dataSources = ref([]);
const error = ref('');
// TODO: Use mapLoading, dataSourcesLoading, and isSidebarUpdating to handle loading states
// const mapLoading = ref(true);
// const dataSourcesLoading = ref(true);
const isSidebarUpdating = ref(false);
const sourcesInMapBounds = ref([]);
const sourcesInMapBoundsByCountyThenAgency = ref([]);
const sourcesInMapBoundsSidebarRenderOrderByCounty = ref([]);

onMounted(async () => {
	const prefersDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');

	let mapCenter = DEFAULT_COORDINATES;

	if (window.navigator.getCurrentPosition) {
		window.navigator.getCurrentPosition((pos) => {
			mapCenter.longitude = pos.coords.longitude;
			mapCenter.latitude = pos.coords.latitude;
		});
	}

	// Render map
	const theme = prefersDarkTheme.matches ? MAP_STYLES.dark : MAP_STYLES.light;

	mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
	const dataSourceMap = new mapboxgl.Map({
		container: 'mapboxContainer',
		style: theme,
		center: [mapCenter.longitude, mapCenter.latitude],
		zoom: 10,
		// maxBounds: [
		// 	[-172.06707715558082, 15.064032429448638],
		// 	[-28.673639540108578, 70.89960589653042],
		// ],
		minZoom: 3,
		maxZoom: 12,
	});
	const nav = new mapboxgl.NavigationControl();
	const geolocate = new mapboxgl.GeolocateControl({
		positionOptions: {
			enableHighAccuracy: true,
		},
		fitBoundsOptions: { linear: true, zoom: dataSourceMap.getZoom() },
		trackUserLocation: true,
	});
	dataSourceMap.addControl(nav, 'top-right');
	dataSourceMap.addControl(geolocate, 'top-right');

	// Populate map with data sources
	dataSources.value = await getDataSourceLocationData().then((data) =>
		data.filter((source) => recordTypesToDisplay.has(source.record_type)),
	);

	dataSources.value.forEach((source) => {
		if (!source || !(source.lat || source.lng)) return;

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

	// Get initial sidebar data
	setSidebarData(dataSourceMap);

	// Event listeners
	// Scale markers on zoom in/out
	dataSourceMap.on('zoom', () => {
		const scaleRatio = dataSourceMap.getZoom() / 10;
		document
			.querySelector(':root')
			.style.setProperty('--scale-markers-by', scaleRatio);
	});
	// On completion of zoom or move events, update sidebar
	dataSourceMap.on('zoomend', () => {
		setSidebarData(dataSourceMap);
	});
	dataSourceMap.on('moveend', () => {
		setSidebarData(dataSourceMap);
	});
	// Update map theme on user preference change
	prefersDarkTheme.addEventListener('change', (e) => {
		console.debug('theme preference change', { e });
		dataSourceMap.setStyle(e.matches ? MAP_STYLES.dark : MAP_STYLES.light);
	});
});

function setSidebarData(dataSourceMap) {
	isSidebarUpdating.value = true;
	dataSources.value.forEach((source) => {
		const index = sourcesInMapBounds.value.indexOf(source);
		const isVisible = dataSourceMap
			.getBounds()
			.contains([source.lng, source.lat]);

		if (isVisible && index === -1) {
			sourcesInMapBounds.value.push(source);
		} else if (!isVisible && index > -1) {
			sourcesInMapBounds.value.splice(index, 1);
		}
	});
	getSideBarRenderDataFormatted(dataSourceMap);
	isSidebarUpdating.value = false;
}

function getSideBarRenderDataFormatted(dataSourceMap) {
	const counties = {};
	const center = dataSourceMap.getCenter();

	const reducedData = sourcesInMapBounds.value.reduce((acc, cur) => {
		// Get distance of each point from center
		const distanceFromCenter = distanceBetween({
			first: [cur.lng, cur.lat],
			second: [center.lng, center.lat],
		});
		const agency = cur.agency_name;
		const county = cur.county_name?.[0];

		// Keep track of county with closest agency to map center (this is how we will sort render data later)
		if (counties[county]) {
			const updatedDistance =
				distanceFromCenter < counties[county]
					? distanceFromCenter
					: counties[county];

			counties[county] = updatedDistance;
		} else {
			counties[county] = distanceFromCenter;
		}

		// Assign data to an object shaped according to render of sidebar: {COUNTY: {AGENCY: DATA_SOURCE[]}}, i.e. { "Allegheny": {"Pittsburgh PD": [{}, {}, {}]}}
		if (acc?.[county]) {
			const agencyPayload = acc?.[county]?.[agency]
				? [...acc[county][agency], cur]
				: [cur];
			return {
				...acc,
				[county]: {
					...acc[county],
					[agency]: agencyPayload,
				},
			};
		} else {
			return {
				...acc,
				[county]: {
					[agency]: [cur],
				},
			};
		}
	}, {});

	sourcesInMapBoundsByCountyThenAgency.value = reducedData;
	sourcesInMapBoundsSidebarRenderOrderByCounty.value = Object.entries(counties)
		.sort(([, valA], [, valB]) => valA > valB)
		.map(([key]) => key);

	console.debug({
		sourcesFormatted: sourcesInMapBoundsByCountyThenAgency.value,
		renderOrderByCounty: sourcesInMapBoundsSidebarRenderOrderByCounty.value,
	});
}

/**
 * Calculates distance with Haversine formula:
 * https://en.wikipedia.org/wiki/Haversine_formula
 *
 * @param {Record<'first' | 'second', [number, number]>} args two points, first and second, each tuple should be arranged as follows: [longitude, latitude]
 */
function distanceBetween({ first: [lon1, lat1], second: [lon2, lat2] }) {
	const r = 6371; // km
	const p = Math.PI / 180;

	const a =
		0.5 -
		Math.cos((lat2 - lat1) * p) / 2 +
		(Math.cos(lat1 * p) *
			Math.cos(lat2 * p) *
			(1 - Math.cos((lon2 - lon1) * p))) /
			2;

	return 2 * r * Math.asin(Math.sqrt(a));
}

/**
 * Copy of pluralize util from data-sources
 */
function pluralize(word, count, suffix = 's') {
	return count === 1 ? word : `${word}${suffix}`;
}

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

.fa-arrow-right::before {
	@apply: font-normal text-neutral-950;
}

.fa-map-marker::before {
	@apply text-neutral-950;
	font-size: calc(2rem * var(--scale-markers-by));
}
</style>
