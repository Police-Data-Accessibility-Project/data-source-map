// localityMarkersRenderer.js - Renders the locality markers
import * as d3 from 'd3';

// Pre-compute GeoJSON for all localities
let localityGeoJSONCache = {};

/**
 * Renders the locality markers
 * @param {Object} container - D3 selection for the container
 * @param {Object} deps - Master dependencies object
 */
export function renderLocalityMarkers(container, deps) {
	const {
		projection,
		tooltip,
		handleLocalityClick,
		LAT_CORRECTION,
		LNG_CORRECTION,
		activeLocationStack,
		localitiesByCounty,
	} = deps;

	// Skip if no localities
	if (!localitiesByCounty) return;

	// Only show localities if a county or locality is selected
	const activeLocation =
		activeLocationStack?.length > 0
			? activeLocationStack[activeLocationStack.length - 1]
			: null;

	if (activeLocation?.type !== 'county' && activeLocation?.type !== 'locality')
		return;

	// Get the county FIPS code
	const countyFips =
		activeLocation.type === 'county'
			? activeLocation.fips
			: activeLocation.data.county_fips;

	// Remove any existing localities layer first
	container.select('.localities-layer').remove();

	// Create a layer for locality markers
	const localitiesLayer = container
		.append('g')
		.attr('class', 'layer localities-layer')
		.style('display', 'block');

	// Use cached GeoJSON if available, otherwise create it
	if (!localityGeoJSONCache[countyFips]) {
		localityGeoJSONCache[countyFips] = {
			type: 'FeatureCollection',
			features: localitiesByCounty[countyFips]
				.map((locality) => {
					if (
						locality.coordinates &&
						locality.coordinates.lat &&
						locality.coordinates.lng
					) {
						const correctedLat = locality.coordinates.lat + LAT_CORRECTION;
						const correctedLng = locality.coordinates.lng + LNG_CORRECTION;

						return {
							type: 'Feature',
							properties: locality,
							geometry: {
								type: 'Point',
								coordinates: [correctedLng, correctedLat],
							},
						};
					}
					return null;
				})
				.filter(Boolean), // Remove null entries
		};
	}

	// Use the cached GeoJSON
	const localityGeoJSON = localityGeoJSONCache[countyFips];

	// Add markers using path generator directly
	const markers = localitiesLayer
		.selectAll('.locality-marker')
		.data(localityGeoJSON.features)
		.enter()
		.append('g')
		.attr('class', (d) => {
			// Check if this locality is the active location
			const isActive = activeLocation.type === 'locality' && 
			activeLocation.data.location_id === d.properties.location_id;
			console.debug({d, activeLocation, isActive})
			
			return `locality-marker ${isActive ? 'active-locality' : ''}`;
		})
		.attr('transform', (d) => {
			// Make sure we have valid coordinates before projecting
			if (!d.geometry.coordinates || d.geometry.coordinates.length !== 2) {
				return null;
			}

			// Use projection directly to convert coordinates to screen position
			const coords = d.geometry.coordinates;
			const pos = projection(coords);
			if (pos && !isNaN(pos[0]) && !isNaN(pos[1])) {
				return `translate(${pos[0]}, ${pos[1]})`;
			}

			return null;
		});

	// Add Font Awesome icon as text element
	markers
		.append('text')
		.attr(
			'class',
			(d) =>
				`fa locality-marker ${d.properties.source_count ? 'has-sources' : 'no-sources'}`,
		)
		.attr('font-family', 'FontAwesome')
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'central')
		.attr('y', -2) // Adjust position slightly
		.attr('fill', 'rgba(255, 255, 255, 0.75)')
		.attr('cursor', 'pointer')
		.text('\uf041'); // Font Awesome map marker unicode

	// Add click and hover handlers
	markers
		.on('click', (event, d) => {
			event.stopPropagation();
			handleLocalityClick(event, d.properties);
		})
		.on('mouseover', function (event, d) {
			const locality = d.properties;
			// Show tooltip with locality information
			tooltip
				.style('opacity', 0.9)
				.html(
					`
          <div style="font-weight:bold; font-size:14px; margin-bottom:5px;">
            ${locality.name}
          </div>
          <div style="margin-bottom:3px;">
            ${locality.county_name}
          </div>
          <div style="font-weight:bold; font-size:13px;">
            Sources: ${locality.source_count}
          </div>
        `,
				)
				.style('left', event.pageX + 10 + 'px')
				.style('top', event.pageY - 28 + 'px');

			// Highlight the marker
			d3.select(this).select('text').attr('font-size', '16px');
		})
		.on('mouseout', function () {
			// Hide tooltip
			tooltip.style('opacity', 0);

			// Reset marker style
			// d3.select(this).select('text').attr('font-size', `${iconSize}px`);
		});
}