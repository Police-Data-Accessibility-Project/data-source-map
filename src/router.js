import { createWebHistory, createRouter } from 'vue-router';
import Redirect from './pages/Redirect.vue';
import MapRouteMapbox from './pages/MapboxRoute.vue';
import MapRouteD3 from './pages/d3Route.vue';
import HomeRoute from './pages/HomeRoute.vue';

const routes = [
	{
		path: '/',
		component: HomeRoute,
	},
	{
		path: '/mapbox',
		component: MapRouteMapbox,
		name: 'MapboxMap',
	},
	{
		path: '/d3',
		component: MapRouteD3,
		name: 'D3Map',
	},
	{
		path: '/search/results',
		component: Redirect,
		name: 'RedirectSearch',
	},
	{
		path: '/data-request/:id',
		component: Redirect,
		name: 'RedirectDataR',
	},
	{
		path: '/data-source/:id',
		component: Redirect,
		name: 'RedirectDataS',
	},
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

export default router;
