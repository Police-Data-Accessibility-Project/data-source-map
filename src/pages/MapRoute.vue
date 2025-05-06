<template>
	<main>
		<DataSourceMap :data="data" :error="error" />
	</main>
</template>

<script setup>
import DataSourceMap from '../components/DataSourceMap.vue';
import { ref, onMounted } from 'vue';
import axios from 'axios';

const PDAP_DATA_SOURCE_SEARCH = import.meta.env.VITE_API_URL + '/map/locations';

const data = ref([]);
const error = ref(undefined);

onMounted(async () => {
	await loadData();
});

async function loadData() {
	data.value = await fetchLocationData()
		.then((data) => {
			console.debug({ data });
			return data.data;
		})
		.catch((e) => {
			error.value = e?.message;
		});
}

async function fetchLocationData() {
	return await axios.get(PDAP_DATA_SOURCE_SEARCH, {
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Basic ' + import.meta.env.VITE_API_KEY,
		},
	});
}
</script>
