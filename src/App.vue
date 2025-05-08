<template>
	<Header />
	<router-view />
	<Footer />
</template>

<script setup>
import { Header, Footer } from 'pdap-design-system';
</script>

<style scoped>
body {
	height: 100%;
}
main {
	min-height: calc(100vh - 80px - 60px);
}
</style>
