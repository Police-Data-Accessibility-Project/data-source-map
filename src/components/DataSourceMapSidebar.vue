<!-- create shell for vue SFC -->
<template>
	<!-- Sidebar for list view of data sources -->
	<aside
		v-if="Object.keys(sourcesInMapBoundsByCountyThenAgency).length > 0"
		class="absolute border-neutral-950 border-[1px] border-solid left-[5%] bottom-6 text-neutral-950 text-sm py-4 px-2 overflow-y-scroll bg-neutral-200 bg-opacity-85 max-w-[90%] my-0 mx-auto inline-flex gap-4 md:block md:max-h-[75%] md:max-w-[25%] md:overflow-y-scroll md:right-6 md:left-[unset]"
	>
		<div
			v-for="county of sourcesInMapBoundsSidebarRenderOrderByCounty"
			:key="county"
			class="grid grid-cols-[repeat(auto-fill,_minmax(150px,_max-content))] grid-rows-[auto,_1fr] min-w-[max-content] gap-2 md:min-w-[unset] md:block md:w-full md:mt-4"
		>
			<a
				class="row-span-1 col-start-1 col-end-[-1] text-neutral-950"
				:href="
					encodeURI(
						`https://data-sources.pdap.io/search/all/${`${county} ${getStateFromCounty(county) === 'LA' ? 'Parish' : 'County'}`}`,
					)
				"
				rel="noreferrer"
				target="_blank"
			>
				<h3>
					{{ county }}
					{{ getStateFromCounty(county) === 'LA' ? 'Parish' : 'County' }}
				</h3>
			</a>
			<a
				v-for="([agency, data], index) of Object.entries(
					sourcesInMapBoundsByCountyThenAgency[county],
				)"
				:key="agency"
				class="pdap-button-tertiary border-neutral-950 col-span-1 border-[1px] border-solid font-normal text-sm text-left mb-2 p-2 md:w-full md:max-w-[unset]"
				:href="
					encodeURI(
						`https://data-sources.pdap.io/search/all/${data[0]?.municipality ?? agency.toLocaleLowerCase()}`,
					)
				"
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
</template>

<script setup>
import mapboxgl from 'mapbox-gl';
import { defineProps, onMounted, ref } from 'vue';

const props = defineProps({
	map: { type: mapboxgl.Map },
	data: { type: Array },
});

const isSidebarUpdating = ref(false);
const sourcesInMapBounds = ref([]);
const sourcesInMapBoundsByCountyThenAgency = ref([]);
const sourcesInMapBoundsSidebarRenderOrderByCounty = ref([]);

onMounted(() => {
	// Get initial sidebar data
	setSidebarData(props.map);
	// On completion of zoom or move events, update sidebar
	props.map.on('zoomend', () => {
		setSidebarData(props.map);
	});
	props.map.on('moveend', () => {
		setSidebarData(props.map);
	});
});

async function setSidebarData(dataSourceMap) {
	isSidebarUpdating.value = true;

	props.data.forEach((source) => {
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
			here: [cur.lng, cur.lat],
			there: [center.lng, center.lat],
		});
		const agency = cur.agency_name;
		const county = cur.county_name?.[0] ?? `${cur.state_iso} — unknown`;

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
		.map(([key]) => key)
		.slice(0, 100);
}

/**
 * Calculates distance with Haversine formula:
 * https://en.wikipedia.org/wiki/Haversine_formula
 *
 * @param {Record<'here' | 'there', [number, number]>} args two points, first and second, each tuple should be arranged as follows: [longitude, latitude]
 */
function distanceBetween({ here: [lon1, lat1], there: [lon2, lat2] }) {
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

function getStateFromCounty(county) {
	return Object.entries(
		sourcesInMapBoundsByCountyThenAgency.value[county],
	)[0][1][0].state_iso;
}
</script>
