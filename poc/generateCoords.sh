#!/bin/bash
# Usage generateCoords.sh query latitude longitude
curl "https://duckduckgo.com/local.js?q=${1}&tg=maps_places&latitude=${2}&longitude=${3}&location_type=obfuscated" -H 'Accept: application/json' | jq '[.results[] | {name: .name, address: .address, coordinates: .coordinates}]' > coords.json
