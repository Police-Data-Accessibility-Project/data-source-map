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
import location from '../assets/location.png';

const MAP_STYLES = {
	dark: 'mapbox://styles/josh-pdap/clyejn3bg014x01nzg6786ozv?optimize=true',
	light: 'mapbox://styles/josh-pdap/clyejn7qx017601qoa3bo8wni?optimize=true',
};

// Setup
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Props
const props = defineProps({
	dataSources: {
		type: Array,
		required: true,
	},
	error: {
		type: String,
		default: '',
	},
});

// Reactive vars
const currentDataSources = computed(() => props.dataSources);
const map = ref();
const isLoading = computed(() => !props.dataSources?.length);
const isMapReady = ref(false);
const loadingText = ref('Data sources loading...');
const size = ref(window.innerHeight / 15);
const zoom = ref(3.5);

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
	if (currentDataSources.value?.length) {
		try {
			attachDataSourcesToMap();
		} catch (error) {
			console.error('Error attaching data sources:', error);
		}
	}
});

watch(
	() => props.dataSources,
	(newSources, prevSources) => {
		if (isMapReady.value && newSources?.length !== prevSources?.length) {
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
		zoom: 3.5,
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
		map.value.setStyle(e.matches ? MAP_STYLES.dark : MAP_STYLES.light);
		map.value.once('style.load', () => {
			// Wait for the composite source to be loaded
			attachDataSourcesToMap();
		});
	});
}

function attachDataSourcesToMap() {
	const { clusterColor, fillColor, textColor } = handleTheme();

	//#region states fill
	const stateLayer = map.value
		.getStyle()
		.layers.find(
			(layer) =>
				layer['source-layer'] === 'us_states_shp-d71mca' &&
				layer.type === 'fill',
		);
	const stateLayerId = stateLayer?.id;

	if (stateLayerId) {
		const stateCounts = {};
		props.dataSources.forEach((source) => {
			if (source.state_iso) {
				stateCounts[source.state_iso] =
					(stateCounts[source.state_iso] || 0) + 1;
			}
		});
		// Set feature state for each state
		Object.entries(stateCounts).forEach(([stateIso, count]) => {
			const id = STATE_ISO_TO_FEATURE_ID.get(stateIso);
			map.value.setFeatureState(
				{
					source: 'composite',
					sourceLayer: 'us_states_shp-d71mca',
					id: id,
				},
				{
					source_count: count,
				},
			);
		});

		const { minzoom: minzoomState, maxzoom: maxzoomState } = stateLayer;
		map.value.addLayer(
			{
				id: 'state-fills',
				source: 'composite',
				'source-layer': 'us_states_shp-d71mca',
				type: 'fill',
				minzoom: minzoomState,
				maxzoom: maxzoomState ?? 22,
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
				layer['source-layer'] === 'us_counties_shp-9dia4a' &&
				layer.type === 'fill',
		);
	const countyLayerId = countyLayer?.id;

	if (countyLayerId) {
		const countyFeatures = map.value.querySourceFeatures('composite', {
			sourceLayer: 'us_counties_shp-9dia4a',
		});

		// 2. Create lookup map and verify keys
		const countyLookup = new Map();
		countyFeatures.forEach((feature) => {
			const key = `${feature.properties.NAME}_${feature.properties.STATE}`;
			countyLookup.set(key, feature);
		});

		// 3. Create and verify county counts
		const countyCounts = {};
		props.dataSources.forEach((source) => {
			if (source.county_name && source.state_iso) {
				const stateFips = STATE_ISO_TO_FIPS.get(source.state_iso);
				const countyKey = `${source.county_name}_${stateFips}`;
				countyCounts[countyKey] = (countyCounts[countyKey] || 0) + 1;
			}
		});

		// 4. Verify feature state setting
		Object.entries(countyCounts).forEach(([countyKey, count]) => {
			const countyFeature = countyLookup.get(countyKey);
			if (countyFeature) {
				map.value.setFeatureState(
					{
						source: 'composite',
						sourceLayer: 'us_counties_shp-9dia4a',
						id: countyFeature.id,
					},
					{
						source_count: count,
					},
				);
			}
		});
		const { minzoom: minzoomCounty, maxzoom: maxzoomCounty } = countyLayer;
		map.value.addLayer({
			id: 'county-fills',
			source: 'composite',
			'source-layer': 'us_counties_shp-9dia4a',
			type: 'fill',
			minzoom: minzoomCounty,
			maxzoom: maxzoomCounty ?? 22,
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
	}

	//#endregion counties fill

	//#region markers and clusters
	map.value.loadImage(location, (error, image) => {
		if (error) throw error;
		map.value.addImage('custom-marker', image);

		const markerPoints = props.dataSources.map((source) => {
			return {
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [source.lng, source.lat],
				},
				properties: {
					title: source.agency_name,
				},
			};
		});

		map.value.addSource('markers', {
			type: 'geojson',
			data: {
				type: 'FeatureCollection',
				features: markerPoints,
			},
			cluster: true,
			clusterMaxZoom: 8,
			clusterRadius: 50,
		});

		map.value.addLayer({
			id: 'clusters',
			type: 'circle',
			source: 'markers',
			filter: ['has', 'point_count'],
			paint: {
				'circle-color': clusterColor,
				'circle-opacity': [
					'step',
					['get', 'point_count'],
					0.5,
					1,
					0.6,
					10,
					0.7,
					20,
					0.8,
					30,
					0.9,
					50,
					1,
				],
				'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
				'circle-stroke-width': 1,
				'circle-stroke-color': textColor,
			},
		});

		map.value.addLayer({
			id: 'cluster-count',
			type: 'symbol',
			source: 'markers',
			filter: ['has', 'point_count'],
			layout: {
				'text-field': ['get', 'point_count_abbreviated'],
				'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
				'text-size': 12,
			},
		});

		// inspect a cluster on click
		map.value.on('click', 'clusters', (e) => {
			const features = map.value.queryRenderedFeatures(e.point, {
				layers: ['clusters'],
			});
			const clusterId = features[0].properties.cluster_id;
			map.value
				.getSource('markers')
				.getClusterExpansionZoom(clusterId, (err, zoom) => {
					if (err) return;

					map.value.easeTo({
						center: features[0].geometry.coordinates,
						zoom: zoom,
					});
				});
		});

		map.value.addLayer({
			id: 'unclustered-markers',
			type: 'symbol',
			source: 'markers',
			filter: ['!', ['has', 'point_count']],
			layout: {
				'icon-image': 'custom-marker',
				'icon-size': 0.75,
				'icon-allow-overlap': true,
			},
		});

		map.value.addLayer({
			id: 'unclustered-markers-label',
			type: 'symbol',
			source: 'markers',
			minzoom: 3,
			filter: ['!', ['has', 'point_count']],
			layout: {
				'text-allow-overlap': true,
				'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
				'text-size': 14,
				'text-field': ['get', 'title'],
				'text-offset': [0, 1.25],
				'text-anchor': 'top',
			},
			paint: {
				'text-color': 'rgb(255,255,255)',
				'text-halo-width': 2,
				'text-halo-color': 'rgb(0,0,0)',
			},
		});

		map.value.on('mouseenter', 'clusters', () => {
			map.value.getCanvas().style.cursor = 'pointer';
		});
		map.value.on('mouseleave', 'clusters', () => {
			map.value.getCanvas().style.cursor = '';
		});
	});
	//#endregion markers and clusters

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

		map.value.fitBounds(bounds, {
			padding: 20,
			linear: true,
			// Remove maxZoom to let the bounds determine the zoom level
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
		textColor: prefersDarkTheme.matches
			? 'rgb(255, 253, 253)'
			: 'rgb(34, 34, 34)',
		clusterColor: prefersDarkTheme.matches
			? 'rgb(223, 214, 222)'
			: 'rgb(223, 214, 222)',
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
