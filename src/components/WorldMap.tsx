import { useMemo, useRef, useState } from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import { Crosshair, Minus, Plus, RotateCcw } from "lucide-react";
import world from "../data/world.json";
import { cityName, coordinatesLabel } from "../lib/catalog";
import type { SearchResult, Zone } from "../types";

const projection = geoNaturalEarth1().scale(177).translate([500, 270]);
const path = geoPath(projection);
const land = world as unknown as FeatureCollection;

export default function WorldMap({
  results,
  selected,
  onSelect,
}: {
  results: SearchResult[];
  selected: Zone;
  onSelect: (zone: Zone) => void;
}) {
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    viewX: number;
    viewY: number;
    moved: boolean;
  } | null>(null);
  const points = useMemo(() => {
    const seen = new Set<string>();
    return results.filter(({ zone }) => {
      if (!zone.coordinates || seen.has(zone.canonical)) return false;
      seen.add(zone.canonical);
      return true;
    });
  }, [results]);
  const zoom = (factor: number) =>
    setView((v) => {
      const scale = Math.min(6, Math.max(1, v.scale * factor));
      if (scale === 1) return { x: 0, y: 0, scale };
      const ratio = scale / v.scale;
      return {
        x: 500 - (500 - v.x) * ratio,
        y: 270 - (270 - v.y) * ratio,
        scale,
      };
    });
  function focusSelected() {
    if (!selected.coordinates) return;
    const point = projection(selected.coordinates as [number, number]);
    if (point)
      setView({ x: 500 - point[0] * 3, y: 270 - point[1] * 3, scale: 3 });
  }
  return (
    <div className="map-view">
      <div className="map-caption">
        <span>
          <span className="map-dot" />
          {points.length} reference locations
        </span>
        <span>Drag to explore</span>
      </div>
      <svg
        ref={svg}
        className="world-map"
        viewBox="0 0 1000 540"
        aria-label="World map of timezone reference locations"
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            (event.target as Element).closest("[data-point]")
          )
            return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            viewX: view.x,
            viewY: view.y,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start) return;
          const ratio =
            1000 / (svg.current?.getBoundingClientRect().width || 1000);
          const dx = (event.clientX - start.x) * ratio,
            dy = (event.clientY - start.y) * ratio;
          if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;
          setView((v) => ({
            ...v,
            x: Math.max(-1000 * v.scale + 180, Math.min(820, start.viewX + dx)),
            y: Math.max(-540 * v.scale + 100, Math.min(440, start.viewY + dy)),
          }));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <defs>
          <radialGradient id="ocean">
            <stop offset="0" stopColor="#304e64" />
            <stop offset="1" stopColor="#253c50" />
          </radialGradient>
        </defs>
        <rect width="1000" height="540" fill="url(#ocean)" />
        <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
          <path
            d={path(geoGraticule10()) || ""}
            className="map-graticule"
            vectorEffect="non-scaling-stroke"
          />
          {land.features.map((f, i) => (
            <path
              key={i}
              d={path(f) || ""}
              className="map-land"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {points.map(({ zone }) => {
            const point = projection(zone.coordinates as [number, number]);
            if (!point) return null;
            const active = zone.canonical === selected.canonical;
            return (
              <g
                key={zone.id}
                data-point="true"
                role="button"
                tabIndex={0}
                aria-label={`Select ${zone.id}`}
                aria-pressed={active}
                className={`map-point ${active ? "active" : ""}`}
                transform={`translate(${point[0]},${point[1]})`}
                onClick={() => onSelect(zone)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(zone);
                  }
                }}
              >
                <title>{zone.id}</title>
                <circle r={9 / view.scale} fill="transparent" />
                {active && <circle r={11 / view.scale} className="map-halo" />}
                <circle
                  r={(active ? 4.5 : 2.7) / view.scale}
                  className="map-marker"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="map-controls" aria-label="Map controls">
        <button
          onClick={() => zoom(1.5)}
          aria-label="Zoom in"
          disabled={view.scale >= 6}
        >
          <Plus size={17} />
        </button>
        <button
          onClick={() => zoom(1 / 1.5)}
          aria-label="Zoom out"
          disabled={view.scale <= 1}
        >
          <Minus size={17} />
        </button>
        <button
          onClick={focusSelected}
          aria-label="Focus selected timezone"
          disabled={!selected.coordinates}
        >
          <Crosshair size={17} />
        </button>
        <button
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          aria-label="Reset map"
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="map-selected">
        <span className="map-dot selected" />
        <div>
          <strong>{cityName(selected)}</strong>
          <span>{coordinatesLabel(selected)}</span>
        </div>
      </div>
      <div className="map-note">
        Reference locations, not timezone boundaries. Select a point to inspect
        its ID.
      </div>
    </div>
  );
}
