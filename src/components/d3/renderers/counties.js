// countiesRenderer.js - Renders the counties layer

/**
 * Renders the counties layer with choropleth coloring
 * @param {Object} container - D3 selection for the container
 * @param {Object} deps - Master dependencies object
 */
export function renderCountiesLayer(container, deps) {
	const {
		layers,
		path,
		countyDataMap,
		countyColorScale,
		currentTheme,
		tooltip,
		props,
		handleCountyClick,
		STATUSES,
	} = deps;

	// Always create the layer, but control visibility with CSS
	const countiesLayer = container
		.append('g')
		.attr('class', 'layer counties-layer')
		.style(
			'display',
			layers.counties.status === STATUSES.IDLE ? 'block' : 'none',
		);

	// Draw counties with choropleth coloring
	countiesLayer
		.selectAll('path')
		.data(layers.counties.data.features)
		.enter()
		.append('path')
		.attr('fill', (d) => {
			// Use STATE + COUNTY as the FIPS code
			const props = d.properties;
			let value;

			if (props.STATE && props.COUNTY) {
				const fips = props.STATE + props.COUNTY;
				value = countyDataMap[fips];
			}

			// Only color counties with at least 1 source
			return value !== undefined && value > 0
				? countyColorScale(value)
				: currentTheme.theme.map.noDataColor; // Theme-appropriate color for counties with no data
		})
		.attr('d', path)
		.attr('stroke', currentTheme.theme.map.strokeColor) // Theme-appropriate stroke for county boundaries
		.attr('stroke-width', 0.2)
		.attr('cursor', 'pointer') // Show pointer cursor on counties too
		.on('click', function (event, d) {
			console.log('County clicked:', d.properties.NAME || d.properties.COUNTY);
			event.stopPropagation(); // Stop event bubbling
			handleCountyClick(event, d);
		})
		.on('mouseover', (event, d) => {
			// Use STATE + COUNTY as the FIPS code
			let fips;
			if (d.properties.STATE && d.properties.COUNTY) {
				fips = d.properties.STATE + d.properties.COUNTY;
			}

			// Find the county using the FIPS code
			const county = props.counties.find((c) => c.fips == fips);

			if (county) {
				tooltip
					.style('opacity', 0.9)
					.html(
						`
            <div style="font-weight:bold; font-size:14px; margin-bottom:5px;">
              ${county.name}, ${county.state_iso}
            </div>
            <div style="margin-bottom:3px;">FIPS: ${county.fips}</div>
            <div style="font-weight:bold; font-size:13px;">
              Sources: ${county.source_count}
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
