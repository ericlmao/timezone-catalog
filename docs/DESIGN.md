# Design direction

Timezone Catalog is a developer's geographic workbench. Its job is to turn an
imprecise place or abbreviation into a precise, copyable runtime timezone ID.

## Tokens

- Fog `#f1f4f6`: main canvas, a reference to the paper of a modern field atlas.
- Ink `#233447`: text and headings.
- Ocean `#315ef5`: selection, primary actions, focus.
- Deep water `#253c50`: map and code surfaces.
- Sea glass `#c1dde1`: geography and map points.
- Sand `#f5dda5`: ambiguity notices.

Space Grotesk carries the identity and headings; DM Sans makes dense lookup
results readable. IBM Plex Mono is reserved for actual identifiers and code.

## Layout

Left aligned, with a wide search bar above a master-detail workbench. The result
list and map are two views of the same filtered collection. The right-hand
inspector always provides the exact ID and a runtime-specific snippet.

```text
identity                                      source / help
find your place in time                 live reference clock
search anything                                 shortcut /
runtime tabs                      instant / region / aliases
results or interactive map          timezone inspector
                                    ID / clocks / code
data provenance and limitations
```

The map is the one expressive element: a muted ocean, fine meridians, pale land,
and blue selected locations. Everything surrounding it serves the lookup.
Avoid decorative cards, unnecessary badges, uppercase micro-labels, and generic
marketing sections. Geography and precise code are the content.

## Review against the brief

A cream-and-serif travel atlas would read as a familiar template. This uses cool
technical colors and geometric typography instead. The map is an actual lookup
surface, and runtime tabs change the copied code. Density is appropriate for a
reference tool, with a compact mobile layout and a scrollable result list.

Design guidance: https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md
