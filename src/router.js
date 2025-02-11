import { createWebHistory, createRouter } from 'vue-router';
import DataSourceMap from './components/DataSourceMap.vue';
import SearchRedirect from './pages/SearchRedirect.vue';

const routes = [
	{
		path: '/',
		component: DataSourceMap,
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
