# Third-party data and assets

## IANA Time Zone Database

Source: https://www.iana.org/time-zones

The tz database's data and code are in the public domain. This project derives
identifier, link, reference-coordinate, country, and transition information from
release 2026e. Java-only rules come from the captured OpenJDK installation.

## GeoNames

Source: https://www.geonames.org/

Copyright GeoNames contributors. Licensed under Creative Commons Attribution
4.0 International: https://creativecommons.org/licenses/by/4.0/

This project adapts cities15000, admin1CodesASCII, and countryInfo into a compact
search index. Adaptations select fields and Latin alternative names, normalize
administrative divisions, group locations by IANA ruleset, and omit unsupported
records. Attribution is displayed in the application footer and data notes.
GeoNames data is provided as is; coverage and accuracy are not guaranteed.

## Natural Earth / world-atlas

Sources: https://www.naturalearthdata.com/ and https://github.com/topojson/world-atlas

Natural Earth geographic data is in the public domain. World-atlas distributes
that data as TopoJSON under its ISC license. This project converts it to GeoJSON
for a local interactive reference-location map.

## Fonts

DM Sans, Space Grotesk, and IBM Plex Mono are self-hosted through Fontsource.
These fonts are licensed under the SIL Open Font License 1.1. Their upstream
license files are distributed in the respective installed Fontsource packages.
Copies are also included in `public/licenses/` and the production build.

## Software

React (MIT), Lucide (ISC), D3 Geo (ISC), TopoJSON Client (ISC), Moment Timezone
(MIT, build-time only), and the remaining build/test packages retain their
respective upstream licenses. See package-lock.json for exact dependency versions.
