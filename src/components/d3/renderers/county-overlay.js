// countyOverlayRenderer.js - Renders the county overlay layer

/**
 * Renders the county overlay layer
 * @param {Object} container - D3 selection for the container
 * @param {Object} deps - Master dependencies object
 */
export function renderCountyOverlay(container, deps) {
	const {
		layers,
		activeLocationStack,
		svg,
		width,
		height,
		path,
		currentTheme,
		STATUSES,
	} = deps;

	if (
		layers.countyOverlay.status !== STATUSES.IDLE ||
		activeLocationStack.length === 0
	)
		return;

	const activeLocation = activeLocationStack[activeLocationStack.length - 1];
	if (activeLocation.type === 'state') return;

	// Remove any existing overlay first to prevent duplicates
	svg.select('.countyOverlay-layer').remove();

	const overlayLayer = container
		.append('g')
		.attr('class', 'layer countyOverlay-layer')
		.style(
			'display',
			layers.countyOverlay.status === STATUSES.IDLE ? 'block' : 'none',
		);

	// Create a mask for the active county
	const maskId = `mask-county-${Date.now()}`; // Use timestamp to ensure uniqueness

	// Add a mask definition
	const defs = overlayLayer.append('defs');
	const mask = defs.append('mask').attr('id', maskId);

	// Add a white background to the mask (white = visible area)
	mask
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', width)
		.attr('height', height)
		.attr('fill', 'white');

	// Add the county shape to the mask in black (black = invisible area)
	mask
		.append('path')
		.attr(
			'd',
			path(
				layers.countyOverlay.data.features.find((d) => {
					const fips = d.properties.STATE + d.properties.COUNTY;
					return (
						fips === (activeLocation.fips || activeLocation.data.county_fips)
					);
				}),
			),
		)
		.attr('fill', 'black');

	// Add a semi-transparent background that covers everything EXCEPT the active county
	overlayLayer
		.append('rect')
		.attr('x', 0)
		.attr('y', 0)
		.attr('width', width)
		.attr('height', height)
		.attr('fill', currentTheme.theme.map.overlayColor)
		.attr('mask', `url(#${maskId})`)
		.attr('pointer-events', 'none'); // Allow clicks to pass through

	// Add a stroke around the active county
	overlayLayer
		.selectAll('path.active-county-border')
		.data([
			layers.countyOverlay.data.features.find((d) => {
				const fips = d.properties.STATE + d.properties.COUNTY;
				return fips === activeLocation.fips;
			}),
		])
		.enter()
		.append('path')
		.attr('class', 'active-county-border')
		.attr('fill', 'none')
		.attr('stroke', currentTheme.theme.map.strokeColor)
		.attr('stroke-width', 0.5)
		.attr('d', path)
		.attr('pointer-events', 'none');
}
