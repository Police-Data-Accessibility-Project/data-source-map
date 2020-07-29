# PDAP Map Interface

This repository will contain the up-to-date version of our map mvp.

This README will update frequently to include relevant technical details, point to documentation on Jira or elsewhere, and explain how to perform various procedures (development environment setup, how to deploy, etc.)

## Basics

Please open issues for discussion about relevant features.

New features should be kept to feature branches and reviewed before being committed to master.

Master should reflect the current, stable MVP.

Ping someone in Slack if you want to chat!

## Installation

### Python libraries
Install virtualenv (https://virtualenv.pypa.io/en/stable/installation.html) if you don't have it. Then, run `make venv` then `source venv/bin/activate` from the root directory, and you should be set.

### Postgresql
Mac (https://www.postgresqltutorial.com/install-postgresql-macos/)
Linux (https://www.postgresqltutorial.com/install-postgresql-linux/)
Windows (https://www.postgresqltutorial.com/install-postgresql/)
## Task items

Todos:
  - [ ] Determine licensing
  - [ ] Agree upon frameworks for the frontend (e.g. React.js, d3.js and canvas, or something else)
    - Leaflet.js or mapboxgl-js are good choices if we want to use a tileset (pros: some tilesets are really pretty, e.g. Mapbox)
    - D3.js is a decent choice if we want to use GeoJSON/TopoJSON data for drawing the map on a canvas (pros: saves bandwidth)


