// stateBoundariesRenderer.js - Renders the state boundaries layer

/**
 * Renders the state boundaries layer (outlines only)
 * @param {Object} container - D3 selection for the container
 * @param {Object} deps - Master dependencies object
 */
export function renderStateBoundariesLayer(container, deps) {
	const { layers, path, currentTheme } = deps;

	// Always create the layer, but control visibility with CSS
	const boundariesLayer = container
		.append('g')
		.attr('class', 'layer stateBoundaries-layer')
		.style('display', layers.stateBoundaries.visible ? 'block' : 'none');

	// Draw state boundaries with no fill, just strokes
	boundariesLayer
		.selectAll('path')
		.data(layers.stateBoundaries.data.features)
		.enter()
		.append('path')
		.attr('fill', 'none')
		.attr('stroke', currentTheme.theme.map.stateBorderColor)
		.attr('d', path);

	console.log(
		'State boundaries layer rendered, visible:',
		layers.stateBoundaries.visible,
	);
}
