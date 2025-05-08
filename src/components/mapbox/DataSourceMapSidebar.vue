<template>
	<!-- Sidebar for list view of data sources -->
	<aside
		v-if="Object.keys(sourcesInMapBoundsByCountyThenLocality).length > 0"
		class="absolute border-neutral-950 border-[1px] border-solid left-[5%] bottom-6 text-neutral-950 text-sm py-4 px-2 overflow-y-scroll bg-neutral-200 bg-opacity-85 max-w-[90%] my-0 mx-auto inline-flex gap-4 md:block md:max-h-[75%] md:max-w-[25%] md:overflow-y-scroll md:right-6 md:left-[unset]"
	>
		<div
			v-for="county of sourcesInMapBoundsSidebarRenderOrderByCounty"
			:key="county"
			class="grid grid-cols-[repeat(auto-fill,_minmax(150px,_max-content))] grid-rows-[auto,_1fr] min-w-[max-content] gap-2 md:min-w-[unset] md:block md:w-full"
		>
			<!-- TODO: get the router path more succinctly -->
			<RouterLink
				class="row-span-1 col-start-1 col-end-[-1] text-neutral-950"
				:to="sourcesInMapBoundsByCountyThenLocality[county].path"
			>
				<h3 class="m-0">
					{{ sourcesInMapBoundsByCountyThenLocality[county].displayName }}
				</h3>
				<span class="block">
					{{ sourcesInMapBoundsByCountyThenLocality[county].count }} data
					{{
						pluralize(
							'source',
							sourcesInMapBoundsByCountyThenLocality[county].count,
						)
					}}
					<i class="fa fa-arrow-right" />
				</span>
			</RouterLink>
			<template
				v-if="sourcesInMapBoundsByCountyThenLocality[county]?.children?.length"
			>
				<RouterLink
					v-for="(
						localityData, index
					) of sourcesInMapBoundsByCountyThenLocality[county].children"
					:key="localityData.displayName"
					class="pdap-button-tertiary border-neutral-950 col-span-1 border-[1px] border-solid font-normal text-sm text-left mb-2 p-2 md:w-full md:max-w-[unset]"
					:to="localityData.path"
					:style="{ gridColumnStart: index + 1, gridColumnEnd: index + 2 }"
				>
					<span class="block"> {{ localityData.displayName }} </span>
					<span class="block">
						{{ localityData.count }} data
						{{ pluralize('source', localityData.count) }}
						<i class="fa fa-arrow-right" />
					</span>
				</RouterLink>
			</template>
		</div>
	</aside>
</template>

<script setup>
import mapboxgl from 'mapbox-gl';
import { ABBREVIATIONS_TO_STATES } from '../../util/constants';
import { onMounted, ref } from 'vue';

const props = defineProps({
	map: { type: mapboxgl.Map },
	data: { type: Array },
});

const isSidebarUpdating = ref(false);
const sourcesInMapBounds = ref([]);
const sourcesInMapBoundsByCountyThenLocality = ref({});
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

/**
 * Updates sidebar data on initial load and zoom/move events
 */
async function setSidebarData(dataSourceMap) {
	isSidebarUpdating.value = true;

	const mapBounds = dataSourceMap.getBounds();
	sourcesInMapBounds.value = props.data.filter((source) =>
		mapBounds.contains([source.lng, source.lat]),
	);

	getSideBarRenderDataFormatted(dataSourceMap);
	isSidebarUpdating.value = false;
}

/**
 * Lots of data manipulation here to format data into a shape that is friendly to render
 */
function getSideBarRenderDataFormatted(dataSourceMap) {
	const counties = {};
	const data = {};
	const center = dataSourceMap.getCenter();

	sourcesInMapBounds.value.forEach((cur) => {
		// Get distance of each point from center
		const distanceFromCenter = distanceBetween({
			here: [cur.lng, cur.lat],
			there: [center.lng, center.lat],
		});
		// const agency = cur.agency_name;
		const county = cur.county_name ?? `${cur.state_iso} — unknown`;
		const countyDisplay = cur.county_name
			? cur.county_name + ', ' + cur.state_iso === 'LA'
				? cur.county_name + ' Parish'
				: cur.county_name + ' County'
			: `${cur.state_iso} — unknown`;

		const locality = cur.municipality;

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

		// Set data
		// If county doesn't exist, set it...
		if (!data[county]) {
			data[county] = {
				displayName: countyDisplay,
				path: `/search/results?location_id=${cur.location_id}&state=${ABBREVIATIONS_TO_STATES.get(cur.state_iso)}&county=${county}`,
				count: 1,
				children: locality
					? [
							{
								displayName: locality,
								path: `/search/results?location_id=${cur.location_id}&state=${ABBREVIATIONS_TO_STATES.get(cur.state_iso)}&county=${county}&locality=${locality}`,
								count: 1,
							},
						]
					: [],
			};
		} else {
			data[county].count = data[county].count + 1;
			const existingLocalityIndex = data[county].children.findIndex(
				(child) => child.displayName === locality,
			);

			if (existingLocalityIndex !== -1) {
				// Locality exists, increment its count
				data[county].children[existingLocalityIndex].count++;
			} else {
				// Locality doesn't exist, add it with count of 1
				data[county].children.push({
					displayName: locality,
					path: `/search/results?location_id=${cur.location_id}&state=${ABBREVIATIONS_TO_STATES.get(cur.state_iso)}&county=${county}&locality=${locality}`,
					count: 1,
				});
			}
		}
	});

	console.debug({ data });

	sourcesInMapBoundsByCountyThenLocality.value = data;
	sourcesInMapBoundsSidebarRenderOrderByCounty.value = Object.entries(counties)
		.sort(([, valA], [, valB]) => valA > valB)
		.map(([key]) => key)
		// Max 50 items in sidebar
		.slice(0, 50);

	console.debug({
		shape: sourcesInMapBoundsByCountyThenLocality,
		order: sourcesInMapBoundsSidebarRenderOrderByCounty,
	});
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
 * TODO: if used in data-sources, use existing util
 */
function pluralize(word, count, suffix = 's') {
	return count === 1 ? word : `${word}${suffix}`;
}

// /**
//  * Hacky and very much tied to the shape of the data
//  * TODO: is there a better / more declarative way of accomplishing this?
//  */
// function getStateFromCounty(county) {
// 	console.debug({ sources: sourcesInMapBoundsByCountyThenLocality.value });
// 	return Object.entries(
// 		sourcesInMapBoundsByCountyThenLocality.value[county],
// 	)[0][1][0].state_iso;
// }
</script>
