<template>
	<main>
		<DataSourceMap :data-sources="dataSources" :error="error" />
	</main>
</template>

<script setup>
import DataSourceMap from '../components/DataSourceMap.vue';
import { ref, onMounted } from 'vue';
import recordTypesToDisplay from '../util/recordTypesToDisplay';
import axios from 'axios';

const PDAP_DATA_SOURCE_SEARCH =
	import.meta.env.VITE_API_URL + '/map/data-sources';

const dataSources = ref([]);
const error = ref(undefined);

function filterByRecords(source) {
	return recordTypesToDisplay.has(source.record_type);
}

onMounted(async () => {
	await loadDataSources();
});

async function loadDataSources() {
	dataSources.value = await fetchDataSourceData()
		.then((data) => data.data.data.filter(filterByRecords))
		.catch((e) => {
			error.value = e?.message;
		});
	console.debug('parent', { dS: dataSources.value });
}

async function fetchDataSourceData() {
	return await axios.get(PDAP_DATA_SOURCE_SEARCH, {
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Basic ' + import.meta.env.VITE_API_KEY,
		},
	});
}
</script>
