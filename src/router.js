import { createWebHistory, createRouter } from 'vue-router';
import DataSourceMap from './components/DataSourceMap.vue';

const routes = [
	{
		path: '/',
		component: DataSourceMap,
		name: 'DataSourceMap',
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

export default router;
