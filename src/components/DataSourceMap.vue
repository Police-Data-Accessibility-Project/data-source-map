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
// import polylabel from '@mapbox/polylabel';
// TODO: implement "sidebar" in a more Mapbox-friendly way
// import Sidebar from './DataSourceMapSidebar.vue';
import { Spinner } from 'pdap-design-system';
// import countyGeoJson from '../util/geoJSON/counties.json';
// import stateGeoJson from '../util/geoJSON/states.json';
import _debounce from 'lodash/debounce';
// import { STATEFP_TO_ABBR } from '../util/constants';

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
const isLoading = computed(() => !props.dataSources.length);
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
		fitBoundsOptions: { linear: true, zoom: map.value.getZoom() },
		trackUserLocation: true,
	});
	map.value.addControl(nav, 'top-right');
	map.value.addControl(geolocate, 'top-right');

	// Set up zoom handler
	const handleZoom = _debounce(() => {
		zoom.value = map.value.getZoom();
		const scaleRatio = map.value.getZoom() / 10;
		document
			.querySelector(':root')
			.style.setProperty('--scale-markers-by', scaleRatio);
	}, 100);

	map.value.on('zoom', handleZoom);

	// Theme change listener
	prefersDarkTheme.addEventListener('change', (e) => {
		map.value.setStyle(e.matches ? MAP_STYLES.dark : MAP_STYLES.light);
	});
}

function attachDataSourcesToMap() {
	// const { color, fillColor } = handleTheme();

	// Process GeoJSON data with data sources
	// TODO: No do this work on the vector tile layer instead
	// countyGeoJson.features = countyGeoJson.features.map((feature) => {
	// 	dataSources.value.forEach((source) => {
	// 		if (
	// 			source.state_iso === STATEFP_TO_ABBR.get(feature.properties.STATEFP) &&
	// 			source?.county_name?.includes(feature.properties.NAME)
	// 		) {
	// 			const { sources } = feature.properties;
	// 			feature.properties.sources =
	// 				typeof sources === 'number' ? sources + 1 : 0;
	// 		} else {
	// 			feature.properties.sources = feature.properties.sources ?? 0;
	// 		}
	// 	});
	// 	return feature;
	// });

	// Process state GeoJSON
	// TODO: No do this work on the vector tile layer instead
	// stateGeoJson.features = stateGeoJson.features.map((feature) => {
	// 	dataSources.value.forEach((source) => {
	// 		if (source.state_iso === feature.id) {
	// 			const { sources } = feature.properties;
	// 			feature.properties.sources =
	// 				typeof sources === 'number' ? sources + 1 : 0;
	// 		}
	// 	});
	// 	return feature;
	// });

	map.value.loadImage(
		'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
		(error, image) => {
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
					'circle-color': [
						'step',
						['get', 'point_count'],
						'#51bbd6',
						100,
						'#f1f075',
						750,
						'#f28cb1',
					],
					'circle-radius': [
						'step',
						['get', 'point_count'],
						20,
						100,
						30,
						750,
						40,
					],
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
					'icon-size': 0.5,
					'icon-allow-overlap': true,
				},
			});

			map.value.addLayer({
				id: 'unclustered-markers-label',
				type: 'symbol',
				source: 'markers',
				minzoom: 10,
				filter: ['!', ['has', 'point_count']],
				layout: {
					'text-allow-overlap': true,
					'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
					'text-size': 10,
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
		},
	);

	// const firstSymbolId = dataSourceMap.value
	// 	.getStyle()
	// 	.layers.filter((layer) => layer.type === 'symbol')
	// 	.reverse()
	// 	.reduce((_, cur) => cur.id, '');

	// Add layers
	// TODO: Base this on the vector tile layer instead of geojson
	// dataSourceMap.value.addLayer(
	// 	{
	// 		id: 'county-fills',
	// 		type: 'fill',
	// 		source: 'counties',
	// 		layout: {},
	// 		minzoom: 5,
	// 		// maxzoom: 7,
	// 		paint: {
	// 			'fill-color': fillColor,
	// 			'fill-opacity': {
	// 				property: 'sources',
	// 				stops: [
	// 					[0, 0],
	// 					[1, 0.4],
	// 					[5, 0.5],
	// 					[10, 0.6],
	// 					[25, 0.7],
	// 					[50, 0.8],
	// 					[100, 0.9],
	// 					[200, 1],
	// 				],
	// 			},
	// 		},
	// 	},
	// 	firstSymbolId,
	// );

	// TODO: Base this on the vector tile layer instead of geojson
	// dataSourceMap.value.addLayer(
	// 	{
	// 		id: 'state-fills',
	// 		type: 'fill',
	// 		source: 'states',
	// 		layout: {},
	// 		maxzoom: 5,

	// 		paint: {
	// 			'fill-color': fillColor,
	// 			'fill-opacity': {
	// 				property: 'sources',
	// 				// TODO: get steps dynamically based on highest and lowest number of data-sources?
	// 				stops: [
	// 					[0, 0],
	// 					[10, 0.1],
	// 					[25, 0.2],
	// 					[50, 0.3],
	// 					[100, 0.4],
	// 					[200, 0.5],
	// 					[300, 0.6],
	// 					[400, 0.7],
	// 					// [80, 0.8],
	// 					// [90, 0.9],
	// 					// [100, 1],
	// 				],
	// 			},
	// 		},
	// 	},
	// 	firstSymbolId,
	// );

	console.log('layers', map.value.getStyle().layers);
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
</style>
