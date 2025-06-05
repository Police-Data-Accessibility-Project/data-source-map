<template>{null}</template>
<script setup>
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

onMounted(() => {
	// Get current path and query parameters
	const currentPath = route.path;
	const queryParams = new URLSearchParams(route.query).toString();

	// Construct the new URL
	const baseUrl = 'https://pdap.dev';
	const redirectUrl = queryParams
		? `${baseUrl}${currentPath}?${queryParams}`
		: `${baseUrl}${currentPath}`;

	window.location.replace(redirectUrl);
});
</script>
