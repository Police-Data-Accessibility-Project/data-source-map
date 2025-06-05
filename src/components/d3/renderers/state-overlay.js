// stateOverlayRenderer.js - Renders the state overlay layer

/**
 * Renders the state overlay layer
 * @param {Object} container - D3 selection for the container
 * @param {Object} deps - Master dependencies object
 */
export function renderStateOverlay(container, deps) {
	const {
		layers,
		activeLocationStack,
		props,
		svg,
		width,
		height,
		path,
		currentTheme,
		STATUSES,
	} = deps;

	if (
		layers?.stateOverlay.status !== STATUSES.IDLE ||
		activeLocationStack.length === 0
	)
		return;

	const activeState = props.states.find(
		(state) =>
			state.state_iso ===
			activeLocationStack[activeLocationStack.length - 1].data.state_iso,
	);

	if (!activeState) return;

	// Remove any existing overlay first to prevent duplicates
	svg.select('.stateOverlay-layer').remove();

	const overlayLayer = container
		.append('g')
		.attr('class', 'layer stateOverlay-layer')
		.style(
			'display',
			layers.stateOverlay.status === STATUSES.IDLE ? 'block' : 'none',
		);

	// Create a mask for the active state
	const maskId = `mask-state-${Date.now()}`; // Use timestamp to ensure uniqueness

	// Add a mask definition
	const defs = overlayLayer.append('defs');
	const mask = defs.append('mask').attr('id', maskId);

	// Add a white background to the mask (white = visible area)
	mask
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', '100%')
		.attr('height', '100%')
		.attr('fill', 'white');

	// Add the state shape to the mask in black (black = invisible area)
	mask
		.append('path')
		.attr(
			'd',
			path(
				layers.stateOverlay.data.features.find(
					(d) => d.properties.NAME === activeState.name,
				),
			),
		)
		.attr('fill', 'black');

	// Add a semi-transparent background that covers everything EXCEPT the active state
	overlayLayer
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', width)
		.attr('height', height)
		.attr('fill', currentTheme.theme.map.overlayColor)
		.attr('mask', `url(#${maskId})`)
		.attr('pointer-events', 'none'); // Allow clicks to pass through

	// Add a stroke around the active state
	overlayLayer
		.selectAll('path.active-state-border')
		.data([
			layers.stateOverlay.data.features.find(
				(d) => d.properties.NAME === activeState.name,
			),
		])
		.enter()
		.append('path')
		.attr('class', 'active-state-border')
		.attr('fill', 'none') // No fill, just stroke
		.attr('stroke', currentTheme.theme.map.stateBorderColor)
		.attr('d', path)
		.attr('pointer-events', 'none'); // Allow clicks to pass through

	console.log('State overlay layer rendered, active state:', activeState.name);
}
