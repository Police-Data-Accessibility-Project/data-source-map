// google sheet data
var googleSheet

function getSheet() {
	$.getJSON( "https://sheets.googleapis.com/v4/spreadsheets/1BVG0By0wuB2eE93NjYIkWDaHsfVrsPc5wOSNw8-yp34/values/Counties to Scrape?key=AIzaSyAQGuzh7Nnn3RhxiMyoLrxwDGln9wh9MCg", function(data) {
	googleSheet = data;
	init();
}).fail(function () {
	console.log("Failed to get google sheet.");
})
}

// init() is called as soon as the page loads
function init() {

function loadedStyle(i){
	return {
		weight: 0.5,
		fillColor: getColor(googleSheet.values[i].length),
		color: "#666",
		fillOpacity: 0.7
	}
	}

function unloadedStyle(){
	return {
		fillColor: '#666', //getColor(feature.properties.density)
		weight: 1,
		opacity: 1,
		color: 'black',
		fillOpacity: 0.2
	}
	}

	function highlightStyle(i){
		return {
			weight: 2,
			fillColor: getColor(googleSheet.values[i].length),
			color: "#000",
			fillOpacity: 0.7
		}
	}

	function clickStyle(i){
		return {
			weight: 0.5,
			fillColor: getColor(googleSheet.values[i].length),
			color: "#666",
			fillOpacity: 0.7
		}
	}

	function getColor(d) {
		return d > 8 ? '#00AB08' :
			   d > 7  ? '#00C301' :
			   d > 6  ? '#26D701' :
			   d > 5  ? '#4DED30' :
			   d > 4   ? '#95F985' :
			   d > 3   ? '#B7FFBF' :
			   d > 2   ? '#FED976' :
						  '#FFEDA0';
	}

// Initialize all feature styles here
	function style(feature) {
		for (i = 0; i < googleSheet.values.length; i++) {
			if(
				(googleSheet.values[i][0] == feature.properties.STATE && googleSheet.values[i][1] == feature.properties.NAME + " County") ||
				(googleSheet.values[i][0] == feature.properties.STATE && googleSheet.values[i][1] == feature.properties.NAME + " Parish") ||
				(googleSheet.values[i][0] == feature.properties.STATE && googleSheet.values[i][1] == feature.properties.NAME + " Borough") ||
				(googleSheet.values[i][0] == feature.properties.STATE && googleSheet.values[i][1] == feature.properties.NAME + " Census Area")
				){
				return loadedStyle(i);
				info.update(googleSheet.values[i]);
				}
		  }
		return unloadedStyle();
	}


  var info = L.control();

	info.onAdd = function (map) {
		this._div = L.DomUtil.create('div', 'info');
		this.update();
		return this._div;
	};


	info.update = function (props) {
		if(typeof(props) !== "undefined"){
			output = '<b> State</b>: ' + props[0] + '<br>' +
					 '<b> County</b>: ' + props[1] + '<br>' +
					 '<b> Agency</b>: ' + props[2] + '<br>' +
					 '<b> Scraper</b>: ' + props[3] + '<br>' +
					 '<b> Website</b>: ' + props[4] + '<br>' +
					 '<b> Courts Website</b>: ' + props[5] + '<br>' +
					 '<b> What Data Exists</b>: ' + props[6] + '<br>' +
					 '<b> Code</b>: ' + props[7] + '<br>' +
					 '<b> FOIA Required</b>: ' + props[8] + '<br>'
		}else{output = "Hover over a county"}

		this._div.innerHTML = '<h4>US Counties</h4>' +  output

	};


	info.addTo(map);


	function highlightFeature(e) {
	var layer = e.target;

	if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
			layer.bringToFront();
		}

	for (i = 0; i < googleSheet.values.length; i++) {
		if(
			(googleSheet.values[i][0] == layer.feature.properties.STATE && googleSheet.values[i][1] == layer.feature.properties.NAME + " County") ||
			(googleSheet.values[i][0] == layer.feature.properties.STATE && googleSheet.values[i][1] == layer.feature.properties.NAME + " Parish") ||
			(googleSheet.values[i][0] == layer.feature.properties.STATE && googleSheet.values[i][1] == layer.feature.properties.NAME + " Borough") ||
			(googleSheet.values[i][0] == layer.feature.properties.STATE && googleSheet.values[i][1] == layer.feature.properties.NAME + " Census Area")
			){
			layer.setStyle(highlightStyle(i));
			info.update(googleSheet.values[i]);
		}
	  }

	}


	function clickFeature(e) {
		var layer = e.target;

		for (i = 0; i < googleSheet.values.length; i++) {
			if(
				(googleSheet.values[i][0] == layer.feature.properties.STATE && googleSheet.values[i][1] == layer.feature.properties.NAME + " County") ||
				(googleSheet.values[i][0] == layer.feature.properties.STATE && googleSheet.values[i][1] == layer.feature.properties.NAME + " Parish") ||
				(googleSheet.values[i][0] == layer.feature.properties.STATE && googleSheet.values[i][1] == layer.feature.properties.NAME + " Borough") ||
				(googleSheet.values[i][0] == layer.feature.properties.STATE && googleSheet.values[i][1] == layer.feature.properties.NAME + " Census Area")
				){
				layer.setStyle(clickStyle(i));
			}
		  }
	}

	function resetHighlight(e) {
		clickFeature(e);
		info.update()
	}


	function onEachFeature(feature, layer) {
		layer.on({
			mouseover: highlightFeature,
			mouseout: resetHighlight,
			click: clickFeature
		});
		layer._leaflet_id = feature.id;
	}


	geojson = L.geoJson(polygonData, {
		style: style,
		onEachFeature: onEachFeature
	}).addTo(map);

}


window.addEventListener("DOMContentLoaded", getSheet);


// Create a new Leaflet map centered on the continental US
var map = L.map("map").setView([40, -100], 4);

// This is the Carto Positron basemap
var basemap = L.tileLayer(
  "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}{r}.png",
  {
    attribution:
      "&copy; <a href='http://www.openstreetmap.org/copyright'>OpenStreetMap</a> &copy; <a href='http://cartodb.com/attributions'>CartoDB</a>",
    subdomains: "abcd",
    maxZoom: 19
  }
);
basemap.addTo(map);