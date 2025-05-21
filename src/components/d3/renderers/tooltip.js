import * as d3 from 'd3';

export function createTooltip(tooltip, currentTheme) {
	// Create tooltip
	tooltip.value = d3
		.select('body')
		.append('div')
		.attr('class', 'tooltip')
		.style('opacity', 0)
		.style('position', 'absolute')
		.style('background-color', currentTheme.value.theme.tooltip.backgroundColor)
		.style('color', currentTheme.value.theme.tooltip.textColor)
		.style(
			'border',
			`1px solid ${currentTheme.value.theme.tooltip.borderColor}`,
		)
		.style('padding', '10px')
		.style('border-radius', '3px')
		.style('pointer-events', 'none')
		.style('z-index', 1000)
		.style('font-size', '12px')
		.style('box-shadow', '0 2px 5px rgba(0,0,0,0.2)');
}
