import { useEffect, useRef } from "react";
import { X, ArrowUpRight } from "lucide-react";
import {
  catalog,
  runtimeDescription,
  runtimeLabels,
  runtimeSource,
  snapshots,
} from "../lib/catalog";
import type { Runtime } from "../types";

export default function InfoDialog({
  kind,
  onClose,
}: {
  kind: "search" | "data";
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="info-dialog"
      aria-labelledby="info-dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-top">
        <h2 id="info-dialog-title">
          {kind === "search"
            ? "A few ways to find a timezone"
            : "A catalog with its sources attached"}
        </h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {kind === "search" ? (
        <>
          <p>
            Search an ID, city, country, state, province, abbreviation, or UTC
            offset. Multiple terms narrow your results. Accents and case are
            optional.
          </p>
          <div className="search-examples">
            <div>
              <code>EST</code>
              <span>Zones using EST during the selected year</span>
            </div>
            <div>
              <code>Canada Ontario</code>
              <span>Locations matching both terms</span>
            </div>
            <div>
              <code>country:CA state:Ontario</code>
              <span>Country and subdivision filters</span>
            </div>
            <div>
              <code>city:"New York"</code>
              <span>A specific city or quoted phrase</span>
            </div>
            <div>
              <code>region:America offset:-05:00</code>
              <span>A region and offset at the selected instant</span>
            </div>
            <div>
              <code>abbr:IST</code>
              <span>All meanings, across countries</span>
            </div>
            <div>
              <code>id:US/Eastern</code>
              <span>An alias and its related timezone</span>
            </div>
            <div>
              <code>type:alias</code>
              <span>Aliases only; enable “Include aliases”</span>
            </div>
          </div>
          <p>
            Small typos are recovered when a plain-text search has no strong
            matches. Suggested matches are labeled. Geographic results come from
            city records; a state or province can contain more than one
            timezone.
          </p>
          <p>
            <kbd>/</kbd> focuses search. <kbd>Esc</kbd> clears search. Use{" "}
            <kbd>Tab</kbd> to navigate results and <kbd>Enter</kbd> to select.
          </p>
        </>
      ) : (
        <>
          <p>
            The catalog uses bundled IANA <strong>{catalog.version}</strong>{" "}
            rules for every displayed clock and offset. Runtime filters describe
            ID availability; they do not replace the catalog’s clock rules.
          </p>
          <dl className="source-list">
            <dt>Timezone rules</dt>
            <dd>
              <a
                href="https://www.iana.org/time-zones"
                target="_blank"
                rel="noreferrer"
              >
                IANA Time Zone Database <ArrowUpRight size={13} />
              </a>
              , transformed from Moment Timezone’s matching release.
              Calculations are limited to 1970–2100.
            </dd>
            <dt>Places</dt>
            <dd>
              <a
                href="https://www.geonames.org/"
                target="_blank"
                rel="noreferrer"
              >
                GeoNames <ArrowUpRight size={13} />
              </a>{" "}
              cities15000 and administrative divisions.{" "}
              {catalog.cityCount.toLocaleString()} city records. Adapted under{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              . This is a sampled city index, not complete administrative or
              timezone boundary coverage.
            </dd>
            <dt>Map</dt>
            <dd>
              <a
                href="https://www.naturalearthdata.com/"
                target="_blank"
                rel="noreferrer"
              >
                Natural Earth <ArrowUpRight size={13} />
              </a>{" "}
              public domain geography via world-atlas. Dots use IANA reference
              coordinates, not exact boundaries.
            </dd>
            <dt>Runtime snapshots</dt>
            <dd>
              Captured{" "}
              {new Date(snapshots.captured).toLocaleDateString("en", {
                dateStyle: "long",
                timeZone: "UTC",
              })}
              . Java-only IDs use rules from the captured JDK, tzdb{" "}
              {snapshots.java.tzdb}. Java SHORT_IDS mappings are not additional
              ZoneId identifiers.
            </dd>
          </dl>
          <div className="runtime-sources">
            {(
              [
                "java",
                "javascript",
                "python",
                "go",
                "php",
                "dotnet",
              ] as Runtime[]
            ).map((runtime) => (
              <div key={runtime}>
                <a
                  href={runtimeSource(runtime)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {runtimeLabels[runtime]} <ArrowUpRight size={12} />
                </a>
                <p>{runtimeDescription(runtime)}</p>
              </div>
            ))}
          </div>
          <p>
            Abbreviations describe a clock reading, not a unique location.
            Offset searches use the selected instant; abbreviation searches
            consider all rules in the selected year.
          </p>
          <a
            className="provenance-link"
            href={`${import.meta.env.BASE_URL}data/provenance.json`}
            target="_blank"
            rel="noreferrer"
          >
            Download source URLs and SHA-256 checksums{" "}
            <ArrowUpRight size={14} />
          </a>
        </>
      )}
      <button className="secondary-button dialog-done" onClick={onClose}>
        Got it
      </button>
    </dialog>
  );
}
