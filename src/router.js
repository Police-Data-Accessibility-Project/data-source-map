import { createWebHistory, createRouter } from 'vue-router';
import DataSourceMap from './components/DataSourceMap.vue';
import DataSourceCountiesMap from './components/DataSourceCountiesMap.vue';

const routes = [
	{
		path: '/',
		component: DataSourceMap,
		name: 'DataSourceMap',
	},
	{
		path: '/counties',
		component: DataSourceCountiesMap,
		name: 'DataSourceCountiesMap',
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

export default router;
