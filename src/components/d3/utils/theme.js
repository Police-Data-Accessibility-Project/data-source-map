// themeUtils.js - Utilities for handling theme
export const FILL_COLORS = [
	// 'rgb(247, 247, 248)',
	// 'rgb(242, 240, 243)',
	'rgb(232, 226, 232)',
	'rgb(212, 204, 213)',
	'rgb(187, 171, 187)',
	'rgb(163, 144, 164)',
	'rgb(140, 118, 140)',
	'rgb(117, 97, 116)',
	'rgb(98, 82, 96)',
	'rgb(80, 66, 79)',
];

/**
 * Handles theme detection and returns theme configuration
 * @param {Array} COLORS - Array of fill colors for the map
 * @returns {Object} Theme configuration
 */
export function handleTheme(COLORS = FILL_COLORS) {
	const prefersDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');
	const light = COLORS[0];
	const mediumLight = COLORS[2];
	const mediumDark = COLORS[COLORS.length - 3];
	const dark = COLORS[COLORS.length - 1];

	const isDark = prefersDarkTheme.matches;
	return {
		prefersDarkTheme,
		theme: {
			light,
			dark,
			tooltip: {
				backgroundColor: isDark
					? 'rgba(40, 40, 40, 0.9)'
					: 'rgba(0, 0, 0, 0.8)',
				textColor: light,
				borderColor: isDark ? '#555' : '#444',
			},
			legend: {
				backgroundColor: isDark
					? 'rgba(40, 40, 40, 0.8)'
					: 'rgba(255, 255, 255, 0.7)',
				textColor: isDark ? light : dark,
				noDataColor: isDark ? '#555' : 'rgb(220, 220, 220)',
			},
			map: {
				noDataColor: isDark ? '#555' : 'rgb(220, 220, 220)',
				strokeColor: isDark ? mediumLight : mediumDark,
				stateBorderColor: isDark ? light : dark, // New color for state boundaries when zoomed in
				overlayColor: isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.5)', // Overlay color for non-selected features
			},
		},
	};
}
