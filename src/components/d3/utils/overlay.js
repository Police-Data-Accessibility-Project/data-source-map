// overlayUtils.js - Utilities for handling dynamic map layers

/**
 * Updates dynamic layers when active location changes
 * @param {Object} params - Parameters needed for updating dynamic layers
 */
export function updateDynamicLayers({
	renderStateOverlay,
	renderCountyOverlay,
	renderLocalityMarkers,
	deps,
}) {
	const { svg, activeLocationStack } = deps;

	const container = svg.select('.map-container');
	if (container.empty()) {
		console.error('Map container not found for dynamic layer update');
		return;
	}

	// Check if we have an active location
	if (activeLocationStack.length === 0) {
		// No active location, remove any overlays
		svg.select('.stateOverlay-layer').remove();
		svg.select('.countyOverlay-layer').remove();
		svg.select('.localities-layer').remove();
		return;
	}

	// Get the most recent active location
	const activeLocation = activeLocationStack[activeLocationStack.length - 1];

	// Update layers based on location type
	if (activeLocation) {
		if (activeLocation.type === 'state') {
			// Remove county overlay and localities if they exist
			svg.select('.countyOverlay-layer').remove();
			svg.select('.localities-layer').remove();
		}

		// Always render state overlay at minimum
		renderStateOverlay(container, deps);

		if (activeLocation.type !== 'state') {
			// Update county overlay
			renderCountyOverlay(container, deps);

			// Render locality markers for county or locality selections
			if (
				activeLocation.type === 'county' ||
				activeLocation.type === 'locality'
			) {
				renderLocalityMarkers(container, deps);
			}
		}
	}
}
