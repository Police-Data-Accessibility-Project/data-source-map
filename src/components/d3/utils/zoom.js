// zoomUtils.js - Utilities for handling zoom functionality

import * as d3 from 'd3';
import _debounce from 'lodash/debounce';

/**
 * Sets up zoom behavior for the map
 * @param {Object} params - Parameters needed for zoom setup
 */
export function setupZoom({ svg, MIN_ZOOM, MAX_ZOOM, handleZoom }) {
	// Create zoom behavior
	const zoom = d3
		.zoom()
		.scaleExtent([MIN_ZOOM, MAX_ZOOM]) // Min/max zoom levels
		.on('zoom', handleZoom);

	// Apply zoom to SVG
	svg.call(zoom);

	// Store the zoom behavior for later use
	svg.__zoom__ = zoom;

	// Initialize with no zoom
	svg.call(zoom.transform, d3.zoomIdentity);
}

/**
 * Adds zoom controls to the map
 * @param {Object} params - Parameters needed for adding zoom controls
 */
export function addZoomControls({ svg, width, resetZoom }) {
	// Add zoom in/out buttons
	const controls = svg
		.append('g')
		.attr('class', 'zoom-controls')
		.attr('transform', `translate(${width - 60}, 20)`);

	// Zoom in button
	controls
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', 30)
		.attr('height', 30)
		.attr('fill', 'white')
		.attr('stroke', '#ccc')
		.attr('rx', 3)
		.attr('cursor', 'pointer')
		.on('click', () => {
			const zoom = svg.__zoom__ || d3.zoom();
			svg.transition().call(zoom.scaleBy, 1.5);
		});

	controls
		.append('text')
		.attr('x', 15)
		.attr('y', 20)
		.attr('text-anchor', 'middle')
		.text('+');

	// Zoom out button
	controls
		.append('rect')
		.attr('x', 0)
		.attr('y', 35)
		.attr('width', 30)
		.attr('height', 30)
		.attr('fill', 'white')
		.attr('stroke', '#ccc')
		.attr('rx', 3)
		.attr('cursor', 'pointer')
		.on('click', () => {
			const zoom = svg.__zoom__ || d3.zoom();
			svg.transition().call(zoom.scaleBy, 0.75);
		});

	controls
		.append('text')
		.attr('x', 15)
		.attr('y', 55)
		.attr('text-anchor', 'middle')
		.text('-');

	// Reset button
	controls
		.append('rect')
		.attr('x', 0)
		.attr('y', 70)
		.attr('width', 30)
		.attr('height', 30)
		.attr('fill', 'white')
		.attr('stroke', '#ccc')
		.attr('rx', 3)
		.attr('cursor', 'pointer')
		.on('click', resetZoom);

	controls
		.append('text')
		.attr('x', 15)
		.attr('y', 90)
		.attr('text-anchor', 'middle')
		.text('↺');
}

/**
 * Updates icon size based on zoom level
 */
export const updateIconSize = _debounce(
	(zoomLevel, MAX_ZOOM) => {
		// Calculate icon size: 4px at zoom 1, decreasing to 1px at zoom 22+
		const minSize = 0.75;
		const maxSize = 3;
		const maxZoomRange = MAX_ZOOM / 2.3;

		// Calculate size based on zoom level (inverse relationship)
		let iconSize;
		if (zoomLevel >= maxZoomRange) {
			iconSize = minSize;
		} else {
			// Linear interpolation between maxSize and minSize
			iconSize =
				maxSize - ((zoomLevel - 1) / (maxZoomRange - 1)) * (maxSize - minSize);
		}

		// Round to 2 decimal places
		iconSize = Math.round(iconSize * 100) / 100;

		// Set the CSS variable on the container
		document.documentElement.style.setProperty('--icon-size', `${iconSize}px`);
	},
	100,
	{ leading: true, trailing: true },
);

/**
 * Updates zoom level CSS variable
 */
export const updateZoomLevel = _debounce(
	(zoomLevel, MAX_ZOOM) => {
		const minSize = 0;
		const maxSize = 1;

		// Calculate size based on zoom level (inverse relationship)
		let zoomInversion;
		if (zoomLevel >= MAX_ZOOM) {
			zoomInversion = minSize;
		} else {
			// Linear interpolation between maxSize and minSize
			zoomInversion =
				maxSize - ((zoomLevel - 1) / (MAX_ZOOM - 1)) * (maxSize - minSize);
		}

		// Round to 2 decimal places
		zoomInversion = Math.round(zoomInversion * 100) / 100;

		// Set the CSS variable on the container
		document.documentElement.style.setProperty(
			'--zoom-inversion',
			zoomInversion,
		);
	},
	100,
	{ leading: true, trailing: true },
);

/**
 * Handles overlay visibility based on zoom level
 */
export function handleOverlaysOnZoom({
	event,
	currentZoom,
	layers,
	activeLocationStack,
	props,
	svg,
}) {
	if (event.transform.k < currentZoom) {
		const COUNTY_THRESHOLD = 5.25;
		const STATE_THRESHOLD = 1.25;

		// County overlay
		if (
			!!layers.countyOverlay.visible &&
			event.transform.k < COUNTY_THRESHOLD
		) {
			layers.countyOverlay.visible = false;

			if (
				['fips', 'county_fips'].some(
					(s) =>
						s in (activeLocationStack[activeLocationStack.length - 1] ?? {}),
				)
			) {
				const stateIndex = activeLocationStack.findLastIndex(
					(loc) => loc.type === 'state',
				);
				const inferredState = props.states.find(
					(state) =>
						state.state_iso ===
						activeLocationStack[activeLocationStack.length - 1].data.state_iso,
				);

				activeLocationStack = activeLocationStack
					.slice(0, stateIndex + 1)
					.concat([
						{
							type: 'state',
							name: inferredState.name,
							data: inferredState,
						},
					]);
			}

			// Remove overlay layers from DOM
			svg.select('.countyOverlay-layer').remove();
		}

		// State overlay
		if (!!layers.stateOverlay.visible && event.transform.k < STATE_THRESHOLD) {
			// Update visibility
			layers.stateOverlay.visible = false;
			layers.countyOverlay.visible = false;

			// Remove overlay layers from DOM
			svg.select('.stateOverlay-layer').remove();
			svg.select('.countyOverlay-layer').remove();

			// Clear the active location stack since we're zooming out
			activeLocationStack = [];
		}
	}

	return activeLocationStack;
}

/**
 * Updates layer visibility based on zoom level
 */
export function updateLayerVisibility({
	layers,
	currentZoom,
	svg,
	createLegend,
}) {
	// Track if visibility changed
	let visibilityChanged = false;

	// Show/hide layers based on zoom level
	Object.keys(layers).forEach((layerName) => {
		const layer = layers[layerName];
		const shouldBeVisible =
			currentZoom >= layer.minZoom && currentZoom <= layer.maxZoom;

		// Check if visibility changed
		if (layer.visible !== shouldBeVisible) {
			visibilityChanged = true;
		}

		// Update visibility state
		layer.visible = shouldBeVisible;

		// Apply visibility to DOM
		const layerElement = svg.select(`.${layerName}-layer`);
		if (!layerElement.empty()) {
			layerElement.style('display', shouldBeVisible ? 'block' : 'none');
		}
	});

	// Update legend if layer visibility changed
	if (visibilityChanged) {
		// Remove existing legend
		svg.select('.legend').remove();
		// Create new legend with appropriate scale
		createLegend();
	}
}
