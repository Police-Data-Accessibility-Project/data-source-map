// overlayUtils.js - Utilities for handling map overlays

/**
 * Updates overlays when active location changes
 * @param {Object} params - Parameters needed for updating overlays
 */
export function updateOverlays({
	renderStateOverlay,
	renderCountyOverlay,
	deps,
}) {
	const { svg, activeLocationStack } = deps;

	const container = svg.select('.map-container');
	if (container.empty()) {
		console.error('Map container not found for overlay update');
		return;
	}

	// Check if we have an active location
	if (activeLocationStack.length === 0) {
		// No active location, remove any overlays
		svg.select('.stateOverlay-layer').remove();
		svg.select('.countyOverlay-layer').remove();
		return;
	}

	// Get the most recent active location
	const activeLocation = activeLocationStack[activeLocationStack.length - 1];

	// Update overlays based on location type. State is always rendered.
	if (activeLocation) {
		if (activeLocation.type === 'state') {
			// Remove county overlay if it exists
			svg.select('.countyOverlay-layer').remove();
		}

		// Always render state overlay at minimum
		renderStateOverlay(container, deps);

		if (activeLocation.type !== 'state') {
			// Update county overlay
			renderCountyOverlay(container, deps);
		}
	}
}
