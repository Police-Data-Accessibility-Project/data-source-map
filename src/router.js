import { createWebHistory, createRouter } from 'vue-router';
import SearchRedirect from './pages/SearchRedirect.vue';
import MapRoute from './pages/MapRoute.vue';

const routes = [
	{
		path: '/',
		component: MapRoute,
		name: 'DataSourceMap',
	},
	{
		path: '/search/results',
		component: SearchRedirect,
		name: 'SearchRedirect',
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

export default router;
