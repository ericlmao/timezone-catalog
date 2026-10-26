import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  Download,
  Globe2,
  Info,
  List,
  LocateFixed,
  Map,
  MapPin,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  aliasesFor,
  catalog,
  cityName,
  coordinatesLabel,
  countryNames,
  locationsFor,
  runtimeDescription,
  runtimeLabels,
  runtimeSource,
  snippet,
  snapshots,
  supports,
  zonesById,
  regions,
} from "./lib/catalog";
import {
  clockAt,
  dateAt,
  MAX_TIME,
  MIN_TIME,
  nextTransition,
  offsetLabel,
  seasonalStates,
  stateAt,
} from "./lib/time";
import { isAbbreviationQuery, search } from "./lib/search";
import { copyText } from "./lib/clipboard";
import type { Runtime, SearchResult, Zone } from "./types";
import InfoDialog from "./components/InfoDialog";

const WorldMap = lazy(() => import("./components/WorldMap"));
const runtimeOrder: Runtime[] = [
  "iana",
  "java",
  "javascript",
  "python",
  "go",
  "php",
  "dotnet",
];
const repository = "https://github.com/ericlmao/timezone-catalog";
const params = new URLSearchParams(window.location.search);
const initialRuntime = runtimeOrder.includes(params.get("runtime") as Runtime)
  ? (params.get("runtime") as Runtime)
  : "java";
const initialAt = params.get("at") ? Date.parse(params.get("at")!) : NaN;
const suggestions = ["EST", "America", "Canada", "Ontario", "UTC+05:30"];

function BrandMark() {
  return (
    <svg
      width="35"
      height="35"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <g stroke="white" strokeWidth="1.3">
        <circle cx="20" cy="20" r="12" />
        <ellipse cx="20" cy="20" rx="5" ry="12" />
        <path d="M8 20h24M10 13h20M10 27h20" />
      </g>
    </svg>
  );
}

export default function App() {
  const [query, setQuery] = useState(params.get("q") || "");
  const deferredQuery = useDeferredValue(query);
  const [runtime, setRuntime] = useState<Runtime>(initialRuntime);
  const [region, setRegion] = useState(
    regions.includes(params.get("region") || "") ? params.get("region")! : "",
  );
  const [aliases, setAliases] = useState(params.get("aliases") === "1");
  const [view, setView] = useState<"list" | "map">(
    params.get("view") === "map" ? "map" : "list",
  );
  const [sort, setSort] = useState<"relevance" | "name" | "offset">(
    "relevance",
  );
  const [selectedId, setSelectedId] = useState(
    zonesById.has(params.get("zone") || "")
      ? params.get("zone")!
      : "America/Toronto",
  );
  const [now, setNow] = useState(Date.now());
  const [frozenAt, setFrozenAt] = useState<number | null>(
    Number.isFinite(initialAt) && initialAt >= MIN_TIME && initialAt <= MAX_TIME
      ? initialAt
      : null,
  );
  const [dateOpen, setDateOpen] = useState(false);
  const [dialog, setDialog] = useState<"search" | "data" | null>(null);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState("");
  const [limit, setLimit] = useState(40);
  const input = useRef<HTMLInputElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const timestamp = frozenAt ?? now;
  // Seconds update the clocks without re-running the geographic search.
  const searchTimestamp = frozenAt ?? Math.floor(now / 60000) * 60000;
  const response = useMemo(
    () =>
      search({
        query: deferredQuery,
        runtime,
        region,
        aliases,
        timestamp: searchTimestamp,
        sort,
      }),
    [deferredQuery, runtime, region, aliases, searchTimestamp, sort],
  );
  const selected = zonesById.get(selectedId)!;
  const selectedSupported = supports(selected, runtime);
  const state = stateAt(selected, timestamp);
  const seasons = seasonalStates(
    selected,
    new Date(timestamp).getUTCFullYear(),
  );
  const transition = nextTransition(selected, timestamp);
  const related = aliasesFor(selected);
  const places = locationsFor(selected);
  const selectedYear = new Date(timestamp).getUTCFullYear();
  const ambiguous = useMemo(
    () => isAbbreviationQuery(deferredQuery, selectedYear),
    [deferredQuery, selectedYear],
  );
  const codeRuntime = runtime === "iana" ? "javascript" : runtime;
  const codeSupported = selectedSupported && supports(selected, codeRuntime);
  const code = snippet(codeRuntime, selected.id);
  const selectedInResults = response.results.some(
    (r) => r.zone.id === selected.id,
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).matches(
          "input, textarea, select, [contenteditable]",
        ) ||
        document.querySelector("dialog[open]")
      )
        return;
      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    setLimit(40);
  }, [deferredQuery, runtime, region, aliases, sort]);
  useEffect(() => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    p.set("runtime", runtime);
    p.set("zone", selectedId);
    if (region) p.set("region", region);
    if (aliases) p.set("aliases", "1");
    if (view === "map") p.set("view", "map");
    if (frozenAt !== null) p.set("at", new Date(frozenAt).toISOString());
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`);
  }, [query, runtime, selectedId, region, aliases, view, frozenAt]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function notify(message: string, id = "") {
    clearTimeout(toastTimer.current);
    setToast(message);
    setCopied(id);
    toastTimer.current = setTimeout(() => {
      setToast("");
      setCopied("");
    }, 2800);
  }
  async function copy(value: string, message: string, id: string) {
    try {
      await copyText(value);
      notify(message, id);
    } catch (error) {
      notify((error as Error).message);
    }
  }
  function choose(zone: Zone, fromResult = false) {
    setSelectedId(zone.id);
    if (fromResult && window.matchMedia("(max-width: 800px)").matches) {
      requestAnimationFrame(() => {
        inspector.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        inspector.current?.focus({ preventScroll: true });
      });
    }
  }
  function exportResults() {
    const payload = {
      tzdb: catalog.version,
      runtime,
      instant: new Date(timestamp).toISOString(),
      query,
      availability: runtimeDescription(runtime),
      zones: response.results.map(({ zone }) => ({
        id: zone.id,
        canonical: zone.canonical,
        kind: zone.kind,
        countries: countryNames(zone),
        ...stateAt(zone, timestamp),
      })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "timezone-catalog.json";
    anchor.click();
    URL.revokeObjectURL(url);
    notify(`Exported ${response.results.length} timezones`);
  }
  function localZone() {
    const id = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zone =
      zonesById.get(id) ||
      catalog.zones.find((z) => z.id.toLowerCase() === id.toLowerCase());
    if (!zone) {
      notify(`Your browser timezone ${id} is not in this catalog.`);
      return;
    }
    setQuery(zone.id);
    setRegion("");
    setAliases(zone.kind === "alias");
    if (!supports(zone, runtime)) setRuntime("iana");
    choose(zone);
    notify(`Your browser timezone is ${zone.id}`);
  }

  return (
    <>
      <a className="skip-link" href="#catalog">
        Skip to timezone catalog
      </a>
      <div className="page-shell">
        <header className="site-header">
          <a className="brand" href={window.location.pathname}>
            <BrandMark />
            <span>
              Timezone
              <br />
              <strong>Catalog</strong>
            </span>
          </a>
          <div className="header-note">
            A developer’s guide to the world’s clocks
          </div>
          <nav aria-label="Main navigation">
            <button onClick={() => setDialog("data")}>
              <Info size={15} />
              About the data
            </button>
            <a href={repository} target="_blank" rel="noreferrer">
              GitHub <ArrowUpRight size={15} />
            </a>
          </nav>
        </header>

        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <h1 id="page-title">
              Find your place
              <br />
              in time.
            </h1>
            <p>
              From a place to a precise timezone.
              <br className="desktop-break" /> Find the right ID. Copy it. Get
              back to building.
            </p>
          </div>
          <div
            className="reference-clock"
            aria-label="Current reference time in UTC"
          >
            <div className="orbit" aria-hidden="true">
              <div className="orbit-cross horizontal" />
              <div className="orbit-cross vertical" />
              <div className="orbit-ring" />
              <div className="orbit-meridian" />
              <span className="orbit-north">N</span>
              <span className="orbit-point" />
            </div>
            <div className="reference-clock-content">
              <span className="live-label">
                <span />
                One world. Many clocks.
              </span>
              <div className="utc-clock">
                {new Date(now).toISOString().slice(11, 19)}
                <span>UTC</span>
              </div>
              <span className="utc-date">
                {new Intl.DateTimeFormat("en", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(now)}
              </span>
            </div>
          </div>
        </section>

        <main id="catalog">
          <div className="search-shell">
            <Search size={23} strokeWidth={1.8} />
            <input
              ref={input}
              id="timezone-search"
              aria-label="Search timezones"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  input.current?.blur();
                }
              }}
              placeholder="City, country, state, timezone, or offset…"
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button
                className="icon-button"
                onClick={() => {
                  setQuery("");
                  input.current?.focus();
                }}
                aria-label="Clear search"
              >
                <X size={18} />
              </button>
            ) : (
              <kbd>/</kbd>
            )}
            <button
              className="search-help"
              onClick={() => setDialog("search")}
              aria-label="Search tips"
            >
              <CircleHelp size={19} />
            </button>
          </div>
          <div className="search-under">
            <div className="suggestions">
              <span>Try</span>
              {suggestions.map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setQuery(term);
                    setRegion("");
                  }}
                >
                  {term}
                  <ArrowUpRight size={11} />
                </button>
              ))}
            </div>
            <button className="locate-button" onClick={localZone}>
              <LocateFixed size={14} />
              Use my timezone
            </button>
          </div>

          <div className="runtime-bar">
            <div
              className="runtime-tabs"
              role="tablist"
              aria-label="Programming runtime"
            >
              {runtimeOrder.map((r) => (
                <button
                  key={r}
                  role="tab"
                  aria-selected={runtime === r}
                  aria-controls="timezone-results"
                  tabIndex={runtime === r ? 0 : -1}
                  onClick={() => setRuntime(r)}
                  onKeyDown={(event) => {
                    const current = runtimeOrder.indexOf(r);
                    let next = current;
                    if (event.key === "ArrowRight")
                      next = (current + 1) % runtimeOrder.length;
                    else if (event.key === "ArrowLeft")
                      next =
                        (current + runtimeOrder.length - 1) %
                        runtimeOrder.length;
                    else if (event.key === "Home") next = 0;
                    else if (event.key === "End")
                      next = runtimeOrder.length - 1;
                    else return;
                    event.preventDefault();
                    setRuntime(runtimeOrder[next]);
                    event.currentTarget.parentElement
                      ?.querySelectorAll("button")
                      [next]?.focus();
                  }}
                >
                  {r === "iana" && <Globe2 size={15} />}
                  <span>{runtimeLabels[r]}</span>
                  {r === "java" && <span className="runtime-api">ZoneId</span>}
                </button>
              ))}
            </div>
            <button
              className={`instant-button ${frozenAt !== null ? "frozen" : ""}`}
              onClick={() => setDateOpen((v) => !v)}
              aria-expanded={dateOpen}
            >
              <Clock3 size={14} />
              {frozenAt === null
                ? "Live offsets"
                : `${new Date(frozenAt).toISOString().slice(0, 16).replace("T", " ")} UTC`}
              <ChevronDown size={13} />
            </button>
          </div>
          {dateOpen && (
            <div className="date-panel">
              <div>
                <strong>Check a different moment</strong>
                <p>
                  All clocks and offset filters use this instant. Enter UTC.
                </p>
              </div>
              <label>
                UTC date and time
                <input
                  aria-label="Reference instant in UTC"
                  type="datetime-local"
                  min="1970-01-01T00:00"
                  max="2100-12-31T23:59"
                  value={new Date(timestamp).toISOString().slice(0, 16)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    const at = Date.parse(`${e.target.value}Z`);
                    if (Number.isFinite(at) && at >= MIN_TIME && at <= MAX_TIME)
                      setFrozenAt(at);
                    else notify("Choose a UTC date between 1970 and 2100.");
                  }}
                />
              </label>
              <button
                className="secondary-button"
                onClick={() => {
                  setFrozenAt(null);
                  setDateOpen(false);
                }}
              >
                Return to live
              </button>
            </div>
          )}
          <div className="runtime-note">
            <Code2 size={14} />
            <p>{runtimeDescription(runtime)}</p>
            <a
              href={runtimeSource(runtime)}
              target="_blank"
              rel="noreferrer"
              aria-label={`${runtimeLabels[runtime]} documentation`}
            >
              <ArrowUpRight size={14} />
            </a>
          </div>

          <div className="workbench">
            <section
              id="timezone-results"
              className="results-panel"
              aria-label="Timezone results"
            >
              <div className="results-toolbar">
                <div className="result-count" aria-live="polite">
                  <strong>{response.results.length}</strong> timezones
                  {query !== deferredQuery && (
                    <span className="updating">Updating…</span>
                  )}
                </div>
                <div className="view-switch" aria-label="Result view">
                  <button
                    className={view === "list" ? "active" : ""}
                    aria-pressed={view === "list"}
                    onClick={() => setView("list")}
                  >
                    <List size={15} />
                    List
                  </button>
                  <button
                    className={view === "map" ? "active" : ""}
                    aria-pressed={view === "map"}
                    onClick={() => setView("map")}
                  >
                    <Map size={15} />
                    Map
                  </button>
                </div>
              </div>
              <div className="filter-row">
                <label className="region-filter">
                  <SlidersHorizontal size={13} />
                  <select
                    aria-label="Filter by IANA region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="">All regions</option>
                    {regions.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label className="alias-toggle">
                  <input
                    type="checkbox"
                    checked={aliases}
                    onChange={(e) => setAliases(e.target.checked)}
                  />
                  <span>Include aliases</span>
                </label>
                <label className="sort-filter">
                  <ArrowDown size={12} />
                  <select
                    aria-label="Sort results"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                  >
                    <option value="relevance">Relevance</option>
                    <option value="name">A–Z</option>
                    <option value="offset">UTC offset</option>
                  </select>
                </label>
              </div>
              {ambiguous && (
                <div className="ambiguity-note">
                  <Info size={16} />
                  <p>
                    <strong>
                      {deferredQuery.replace(/^abbr:/i, "").toUpperCase()} can
                      mean more than one timezone.
                    </strong>{" "}
                    Results include usage across the selected year. Use a
                    location ID for seasonal clock changes.
                  </p>
                </div>
              )}
              {response.fuzzy && (
                <div className="fuzzy-note">
                  <Sparkles size={14} />
                  <span>No exact matches. Showing similar names.</span>
                </div>
              )}
              {response.results.length === 0 ? (
                <div className="empty-state">
                  <Search size={31} strokeWidth={1.4} />
                  <h2>No timezones found</h2>
                  <p>
                    {response.errors[0] ||
                      "Try a nearby city, a country name, or fewer filters. Alias IDs require “Include aliases”."}
                  </p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setQuery("");
                      setRegion("");
                      setAliases(false);
                    }}
                  >
                    Reset search
                  </button>
                </div>
              ) : view === "map" ? (
                <Suspense
                  fallback={
                    <div className="map-loading">Preparing the atlas…</div>
                  }
                >
                  <WorldMap
                    results={response.results}
                    selected={selected}
                    onSelect={(z) => choose(z, true)}
                  />
                </Suspense>
              ) : (
                <>
                  <div className="table-heading">
                    <span>Timezone / location</span>
                    <span>Local time</span>
                    <span>UTC offset</span>
                    <span className="sr-only">Copy</span>
                  </div>
                  <div className="results-list">
                    {response.results
                      .slice(0, limit)
                      .map((result: SearchResult) => {
                        const active = result.zone.id === selectedId,
                          s = stateAt(result.zone, timestamp);
                        return (
                          <div
                            className={`result-row ${active ? "selected" : ""}`}
                            key={result.zone.id}
                          >
                            <button
                              className="result-select"
                              onClick={() => choose(result.zone, true)}
                              aria-pressed={active}
                              aria-label={`Inspect ${result.zone.id}`}
                            >
                              <span className="result-identity">
                                <span className="result-city">
                                  {cityName(result.zone)}
                                  {result.zone.kind === "alias" && (
                                    <span className="alias-tag">alias</span>
                                  )}
                                  {result.zone.kind === "runtime" && (
                                    <span className="alias-tag">Java</span>
                                  )}
                                </span>
                                <code>{result.zone.id}</code>
                                <span className="match-reason">
                                  {result.reason}
                                </span>
                              </span>
                              <span className="result-time">
                                {clockAt(result.zone, timestamp)}
                                <small>{s.abbreviation}</small>
                              </span>
                              <span className="result-offset">
                                {offsetLabel(s.offset, "")}
                              </span>
                            </button>
                            <button
                              className={`row-copy ${copied === result.zone.id ? "copied" : ""}`}
                              title="Copy timezone ID"
                              aria-label={`Copy ${result.zone.id}`}
                              onClick={() =>
                                copy(
                                  result.zone.id,
                                  `Copied ${result.zone.id}`,
                                  result.zone.id,
                                )
                              }
                            >
                              {copied === result.zone.id ? (
                                <Check size={15} />
                              ) : (
                                <Copy size={15} />
                              )}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                  {limit < response.results.length && (
                    <button
                      className="load-more"
                      onClick={() => setLimit((v) => v + 60)}
                    >
                      Show more timezones <ChevronDown size={14} />
                      <span>
                        {Math.min(limit, response.results.length)} of{" "}
                        {response.results.length}
                      </span>
                    </button>
                  )}
                </>
              )}
              <div className="results-footer">
                <span>
                  {view === "map"
                    ? "Select a point to explore"
                    : "Select a timezone to explore"}
                </span>
                <button
                  onClick={exportResults}
                  disabled={!response.results.length}
                >
                  <Download size={13} />
                  Export JSON
                </button>
              </div>
            </section>

            <aside
              ref={inspector}
              tabIndex={-1}
              className="inspector"
              aria-label="Selected timezone details"
            >
              <div className="inspector-top">
                <span>
                  <span className="selection-dot" />
                  Selected timezone
                </span>
                <button
                  className="icon-button"
                  aria-label="Copy shareable lookup link"
                  title="Copy shareable lookup link"
                  onClick={() =>
                    copy(window.location.href, "Copied lookup link", "share")
                  }
                >
                  <Share2 size={16} />
                </button>
              </div>
              <div className="selected-place">
                <div className="place-region">
                  <MapPin size={13} />
                  {countryNames(selected).join(", ") ||
                    (selected.kind === "runtime" ? "Java runtime" : "Global")}
                </div>
                <h2>{cityName(selected)}</h2>
                <p>{coordinatesLabel(selected)}</p>
              </div>
              {!selectedInResults && (
                <p className="inspector-notice">
                  This selection is outside your current search. Select a result
                  to inspect it.
                </p>
              )}
              <button
                className="id-copy"
                onClick={() =>
                  copy(selected.id, `Copied ${selected.id}`, "selected-id")
                }
              >
                <span>
                  <small>Timezone ID</small>
                  <code>{selected.id}</code>
                </span>
                {copied === "selected-id" ? (
                  <Check size={17} />
                ) : (
                  <Copy size={17} />
                )}
                <span className="sr-only">Copy selected timezone ID</span>
              </button>
              {selected.kind === "alias" && (
                <div className="alias-notice">
                  Alias of{" "}
                  <button
                    onClick={() => choose(zonesById.get(selected.canonical)!)}
                  >
                    {selected.canonical}
                  </button>
                </div>
              )}
              {selected.id.startsWith("Etc/GMT") && (
                <p className="inspector-notice">
                  Etc/GMT uses POSIX signs: “+” means west of UTC and “−” means
                  east. Check the offset below.
                </p>
              )}
              {selected.id === "Factory" && (
                <p className="inspector-notice">
                  Factory is an unspecified-timezone placeholder, not a real
                  location. “−00” means the local offset is unknown.
                </p>
              )}
              <div className="selected-clock">
                <div>
                  <span>
                    {frozenAt === null
                      ? "Local time now"
                      : "Local time at selected instant"}
                  </span>
                  <strong>{clockAt(selected, timestamp, true)}</strong>
                  <small>{dateAt(selected, timestamp)}</small>
                </div>
                <div className="offset-stamp">
                  <span>{state.abbreviation}</span>
                  <strong>{offsetLabel(state.offset)}</strong>
                </div>
              </div>
              <div className="season-summary">
                <span
                  className={`season-dot ${seasons.length > 1 ? "seasonal" : ""}`}
                />
                <span>
                  {seasons.length > 1
                    ? `Clock rules change in ${new Date(timestamp).getUTCFullYear()}`
                    : `One offset in ${new Date(timestamp).getUTCFullYear()}`}
                </span>
                <span>
                  {seasons
                    .map((s) => s.abbreviation)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .join(" / ")}
                </span>
              </div>
              {transition && (
                <p className="next-transition">
                  Next offset change:{" "}
                  {new Intl.DateTimeFormat("en", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(transition.at)}
                  <span>
                    {offsetLabel(transition.before, "")} →{" "}
                    {offsetLabel(transition.after, "")}
                  </span>
                </p>
              )}
              <div className="code-section">
                <div className="section-heading">
                  <h3>Use in {runtimeLabels[codeRuntime]}</h3>
                  <button
                    aria-label="Copy code snippet"
                    disabled={!codeSupported}
                    onClick={() => copy(code, "Copied code snippet", "code")}
                  >
                    {copied === "code" ? (
                      <Check size={13} />
                    ) : (
                      <Copy size={13} />
                    )}{" "}
                    {copied === "code" ? "Copied" : "Copy code"}
                  </button>
                </div>
                {codeSupported ? (
                  <pre>
                    <code>{code}</code>
                  </pre>
                ) : (
                  <p className="unsupported-note">
                    This ID is unavailable in the selected runtime profile.
                    Choose another result or runtime to get a working snippet.
                  </p>
                )}
                {runtime !== "iana" && (
                  <p
                    className={`support-note ${!selectedSupported ? "unsupported" : ""}`}
                  >
                    <span />
                    {selectedSupported
                      ? runtime === "go" ||
                        runtime === "php" ||
                        runtime === "dotnet"
                        ? "IANA reference. Verify availability on your system."
                        : runtime === "javascript"
                          ? "ID accepted in this browser"
                          : "ID present in the captured runtime"
                      : "ID unavailable in this runtime profile"}
                  </p>
                )}
              </div>
              {places.length > 0 && (
                <div className="places-section">
                  <h3>Places using these rules</h3>
                  <div>
                    {places.slice(0, 5).map((p, i) => (
                      <button
                        key={`${p[0]}-${i}`}
                        onClick={() => {
                          setQuery(`city:"${p[0]}" country:${p[2]}`);
                          setRegion("");
                        }}
                      >
                        {p[0]}
                        <span>{p[1]}</span>
                      </button>
                    ))}
                  </div>
                  {places.length > 5 && (
                    <p>And {places.length - 5} more indexed cities</p>
                  )}
                </div>
              )}
              {related.length > 0 && (
                <details className="related-ids">
                  <summary>
                    {related.length} related{" "}
                    {related.length === 1 ? "ID" : "IDs"}
                    <ChevronDown size={13} />
                  </summary>
                  <div>
                    {related.map((z) => (
                      <button key={z.id} onClick={() => choose(z)}>
                        <code>{z.id}</code>
                        <span>{z.kind === "alias" ? "alias" : "zone"}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </aside>
          </div>
          <div className="catalog-footnote">
            <Info size={14} />
            <p>
              Clocks use IANA {catalog.version}; Java-only IDs use JDK tzdb{" "}
              {snapshots.java.tzdb}. Runtime versions and geographic coverage
              can differ.{" "}
              <button onClick={() => setDialog("data")}>
                Read the data notes
              </button>
            </p>
          </div>
        </main>
        <footer className="site-footer">
          <div>
            <Globe2 size={17} />
            <span>Timezone Catalog</span>
            <span className="footer-separator" />
            Built for a world that never shares one clock.
          </div>
          <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
            Places by GeoNames
          </a>
          <button onClick={() => setDialog("search")}>
            Search tips <CircleHelp size={13} />
          </button>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {dialog && <InfoDialog kind={dialog} onClose={() => setDialog(null)} />}
    </>
  );
}
