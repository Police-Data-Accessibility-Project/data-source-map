/**
 * Helper function to create a clean dependency object for overlay updates
 * This avoids circular references in the mapDeps object
 */
export function createOverlayDeps({
  svg,
  activeLocationStack,
  layers,
  path,
  width,
  height,
  props,
  currentTheme
}) {
  return {
    svg,
    activeLocationStack,
    layers,
    path,
    width,
    height,
    props,
    currentTheme
  };
}