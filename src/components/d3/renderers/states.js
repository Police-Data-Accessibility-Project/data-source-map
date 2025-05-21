// statesRenderer.js - Renders the states layer

/**
 * Renders the states layer with choropleth coloring
 * @param {Object} container - D3 selection for the container
 * @param {Object} deps - Master dependencies object
 */
export function renderStatesLayer(container, deps) {
	const {
		layers,
		path,
		stateDataMap,
		stateColorScale,
		currentTheme,
		tooltip,
		handleStateClick,
		props,
		STATUSES,
	} = deps;

	// Always create the layer, but control visibility with CSS
	const statesLayer = container
		.append('g')
		.attr('class', 'layer states-layer')
		.style(
			'display',
			layers.states.status === STATUSES.IDLE ? 'block' : 'none',
		);

	// Draw states with choropleth coloring
	statesLayer
		.selectAll('path')
		.data(layers.states.data.features)
		.enter()
		.append('path')
		.attr('fill', (d) => {
			// Use state name to look up data
			const stateName = d.properties.NAME;
			const value = stateDataMap[stateName];

			// Only color states with at least 1 source
			return value !== undefined && value > 0
				? stateColorScale(value)
				: currentTheme.theme.map.noDataColor; // Theme-appropriate color for states with no data
		})
		.attr('stroke', currentTheme.theme.map.stateBorderColor)
		.attr('stroke-width', 0.5)
		.attr('d', path)
		.attr('cursor', 'pointer')
		.on('click', function (event, d) {
			event.stopPropagation(); // Stop event bubbling
			handleStateClick(event, d);
		})
		.on('mouseover', (event, d) => {
			// Find the state using the name
			const stateName = d.properties.NAME;
			const state = props.states.find((s) => s.name === stateName);

			if (state) {
				tooltip
					.style('opacity', 0.9)
					.html(
						`
            <div style="font-weight:bold; font-size:14px; margin-bottom:5px;">
              ${state.name}
            </div>
            <div style="font-weight:bold; font-size:13px;">
              Sources: ${state.source_count}
            </div>
          `,
					)
					.style('left', event.pageX + 10 + 'px')
					.style('top', event.pageY - 28 + 'px');
			}
		})
		.on('mouseout', () => {
			tooltip.style('opacity', 0);
		});
}
