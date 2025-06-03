// legendUtils.js - Utilities for creating and managing the map legend

/**
 * Creates a simple legend for the map
 * @param {Object} deps - Master dependencies object
 */
export function createLegend(deps) {
	// Check if all required dependencies are available
	if (!deps || !deps.svg || !deps.currentTheme || !deps.FILL_COLORS) {
		console.error('Missing required dependencies for legend:', deps);
		return;
	}

	const {
		layers,
		countyColorBreakpoints,
		stateColorBreakpoints,
		width,
		height,
		svg,
		currentTheme,
		FILL_COLORS,
		STATUSES,
	} = deps;

	// Determine which layer is visible
	const visibleLayer =
		layers.counties.status === STATUSES.IDLE ? 'counties' : 'states';

	// Use the appropriate color breakpoints based on visible layer
	const breakpoints =
		visibleLayer === 'counties'
			? countyColorBreakpoints
			: stateColorBreakpoints;

	// Create legend dimensions
	const legendWidth = 200;
	const legendHeight = 30;

	// Position in bottom-left corner
	const legendX = 40;
	const legendY = height - legendHeight - 40;

	// Add more space for the "No data" indicator
	const noDataX = 10;
	const noDataY = legendHeight + 15;

	// Create legend group
	const legend = svg
		.append('g')
		.attr('class', 'legend')
		.attr('transform', `translate(${legendX}, ${legendY})`);

	// Add background with theme-appropriate color and border
	legend
		.append('rect')
		.attr('width', legendWidth + 20) // Make wider to include padding
		.attr('height', legendHeight + 60) // Make taller to include title and "No data" below
		.attr('x', -10)
		.attr('y', -25) // Extend upward for title
		.attr('fill', currentTheme.theme.legend.backgroundColor)
		.attr('stroke', currentTheme.theme.legend.textColor)
		.attr('stroke-width', 0.5)
		.attr('stroke-opacity', 0.3)
		.attr('rx', 3)
		.attr('ry', 3);

	// Create color rectangles for the gradient
	FILL_COLORS.forEach((color, i) => {
		legend
			.append('rect')
			.attr('x', i * (legendWidth / FILL_COLORS.length))
			.attr('width', legendWidth / FILL_COLORS.length)
			.attr('height', 20)
			.attr('fill', color);
	});

	// Add text labels for min and max
	legend
		.append('text')
		.attr('x', 0)
		.attr('y', 35)
		.attr('text-anchor', 'start')
		.attr('font-size', '10px')
		.attr('fill', currentTheme.theme.legend.textColor)
		.text(`${Math.min(...breakpoints)}`);

	legend
		.append('text')
		.attr('x', legendWidth)
		.attr('y', 35)
		.attr('text-anchor', 'end')
		.attr('font-size', '10px')
		.attr('fill', currentTheme.theme.legend.textColor)
		.text(`${Math.max(...breakpoints)}+`);

	// Add title based on visible layer
	const title =
		visibleLayer === 'counties' ? 'County Data Sources' : 'State Data Sources';
	legend
		.append('text')
		.attr('x', legendWidth / 2)
		.attr('y', -10)
		.attr('text-anchor', 'middle')
		.attr('font-size', '12px')
		.attr('font-weight', 'bold')
		.attr('fill', currentTheme.theme.legend.textColor)
		.text(title);

	// Add "No data" indicator below the gradient
	legend
		.append('rect')
		.attr('x', noDataX)
		.attr('y', noDataY)
		.attr('width', 10)
		.attr('height', 10)
		.attr('fill', currentTheme.theme.legend.noDataColor);

	legend
		.append('text')
		.attr('x', noDataX + 15)
		.attr('y', noDataY + 9) // Align with the square
		.attr('text-anchor', 'start')
		.attr('font-size', '9px')
		.attr('fill', currentTheme.theme.legend.textColor)
		.text('No data');
}
