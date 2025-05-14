// localityMarkersRenderer.js - Renders the locality markers
import * as d3 from 'd3';

/**
 * Renders the locality markers
 * @param {Object} container - D3 selection for the container
 * @param {Object} deps - Master dependencies object
 */
export function renderLocalityMarkers(container, deps) {
	const {
		layers,
		props,
		currentZoom,
		path,
		tooltip,
		handleLocalityClick,
		LAT_CORRECTION
	} = deps;

	console.log('Rendering locality markers, count:', props.localities.length);
	console.log('Current zoom level:', currentZoom);

	// Skip if no localities
	if (!props.localities || props.localities.length === 0) {
		console.log('No localities to render');
		return;
	}

	// Create a layer for locality markers
	const localitiesLayer = container
		.append('g')
		.attr('class', 'layer localities-layer')
		.style('display', layers.localities.visible ? 'block' : 'none');

	// Create GeoJSON points for each locality
	const localityGeoJSON = {
		type: 'FeatureCollection',
		features: props.localities
			.map((locality) => {
				if (
					locality.coordinates &&
					locality.coordinates.lat &&
					locality.coordinates.lng
				) {
					const correctedLat = locality.coordinates.lat + LAT_CORRECTION;

					return {
						type: 'Feature',
						properties: locality,
						geometry: {
							type: 'Point',
							// GeoJSON format is [longitude, latitude]
							coordinates: [locality.coordinates.lng, correctedLat],
						},
					};
				}
				return null;
			})
			.filter(Boolean), // Remove null entries
	};

	console.log('Created GeoJSON for localities:', localityGeoJSON);

	// Calculate marker size based on zoom level
	const iconSize = 3;

	// Add markers using path generator directly
	const markers = localitiesLayer
		.selectAll('.locality-marker')
		.data(localityGeoJSON.features)
		.enter()
		.append('g')
		.attr('class', 'locality-marker')
		.attr('transform', (d) => {
			// Project the coordinates to screen space
			console.log('Projecting coordinates:', d.geometry.coordinates);

			// Make sure we have valid coordinates before projecting
			if (!d.geometry.coordinates || d.geometry.coordinates.length !== 2) {
				console.error('Invalid coordinates:', d.geometry.coordinates);
				return null;
			}

			// Use path.centroid instead of direct projection for more reliable results
			const centroid = path.centroid(d);
			if (
				centroid &&
				centroid.length === 2 &&
				!isNaN(centroid[0]) &&
				!isNaN(centroid[1])
			) {
				return `translate(${centroid[0]}, ${centroid[1]})`;
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
		.attr('fill', '#ffffff')
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
            ${locality.county_name ? locality.county_name + ' County' : ''}
          </div>
          <div style="font-weight:bold; font-size:13px;">
            Sources: ${locality.source_count}
          </div>
        `,
				)
				.style('left', event.pageX + 10 + 'px')
				.style('top', event.pageY - 28 + 'px');

			// Highlight the marker
			d3.select(this)
				.select('text')
				.attr('font-size', `${iconSize * 1.25}px`);
		})
		.on('mouseout', function () {
			// Hide tooltip
			tooltip.style('opacity', 0);

			// Reset marker style
			d3.select(this).select('text').attr('font-size', `${iconSize}px`);
		});

	console.log('Localities layer rendered with', markers.size(), 'markers');
}