/**
 * Helper function to create a clean dependency object for overlay updates
 * This avoids circular references in the mapDeps object
 */
export function createOverlayDeps(deps) {
	// Extract only the properties needed for overlay operations
	return {
		svg: deps.svg,
		activeLocationStack: deps.activeLocationStack,
		layers: deps.layers,
		path: deps.path,
		width: deps.width,
		height: deps.height,
		props: deps.props,
		currentTheme: deps.currentTheme,
	};
}
