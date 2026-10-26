import {
  catalog,
  countryNames,
  cityName,
  locationsFor,
  supports,
} from "./catalog";
import { offsetLabel, parseOffset, seasonalStates, stateAt } from "./time";
import type { SearchOptions, SearchResult, Zone } from "../types";

export function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
type Field =
  "id" | "city" | "state" | "country" | "region" | "abbr" | "offset" | "type";
export interface Clause {
  field?: Field;
  value: string;
}
const fields: Field[] = [
  "id",
  "city",
  "state",
  "country",
  "region",
  "abbr",
  "offset",
  "type",
];
export function parseQuery(query: string) {
  const clauses: Clause[] = [],
    errors: string[] = [];
  const pattern = /([a-z]+):(?:"([^"]*)"|(\S+))|"([^"]+)"|(\S+)/gi;
  for (const match of query.matchAll(pattern)) {
    if (match[1]) {
      const key =
        match[1].toLowerCase() === "province"
          ? "state"
          : match[1].toLowerCase();
      if (!fields.includes(key as Field))
        errors.push(
          `Unknown filter “${match[1]}”. Try country:, state:, city:, region:, id:, abbr:, offset: or type:.`,
        );
      else clauses.push({ field: key as Field, value: match[2] ?? match[3] });
    } else clauses.push({ value: match[4] ?? match[5] });
  }
  if ((query.match(/"/g)?.length || 0) % 2)
    errors.push("Close the quotation mark to search a phrase.");
  for (const clause of clauses) {
    if (clause.field === "offset" && parseOffset(clause.value) === null)
      errors.push("Use an offset such as offset:-05:00 or offset:+05:30.");
    if (
      clause.field === "type" &&
      !["zone", "alias", "runtime"].includes(clause.value.toLowerCase())
    )
      errors.push("Use type:zone, type:alias or type:runtime.");
  }
  return { clauses, errors };
}

interface Entry {
  value: string;
  normalized: string;
  field: Field;
  reason: string;
  weight: number;
}
const index = new Map<string, Entry[]>();
const commonNames: Record<string, string[]> = {
  EST: ["Eastern", "Eastern Time", "Eastern Standard Time"],
  EDT: ["Eastern", "Eastern Time", "Eastern Daylight Time"],
  CST: ["Central", "Central Time", "Central Standard Time"],
  CDT: ["Central", "Central Time", "Central Daylight Time"],
  MST: ["Mountain", "Mountain Time", "Mountain Standard Time"],
  MDT: ["Mountain", "Mountain Time", "Mountain Daylight Time"],
  PST: ["Pacific", "Pacific Time", "Pacific Standard Time"],
  PDT: ["Pacific", "Pacific Time", "Pacific Daylight Time"],
  AST: ["Atlantic Standard Time"],
  ADT: ["Atlantic Daylight Time"],
  NST: ["Newfoundland Standard Time"],
  NDT: ["Newfoundland Daylight Time"],
  GMT: ["Greenwich Mean Time"],
  BST: ["British Summer Time"],
  CET: ["Central European Time"],
  CEST: ["Central European Summer Time"],
  IST: ["India Standard Time", "Irish Standard Time", "Israel Standard Time"],
  JST: ["Japan Standard Time"],
  KST: ["Korea Standard Time"],
  AEST: ["Australian Eastern Standard Time"],
  AEDT: ["Australian Eastern Daylight Time"],
  NZST: ["New Zealand Standard Time"],
  NZDT: ["New Zealand Daylight Time"],
};
const featured = [
  "America/New_York",
  "America/Toronto",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Etc/UTC",
];
const postalCodes: Record<string, string> = Object.fromEntries(
  [
    [
      "CA",
      "AB:Alberta|BC:British Columbia|MB:Manitoba|NB:New Brunswick|NL:Newfoundland and Labrador|NS:Nova Scotia|NT:Northwest Territories|NU:Nunavut|ON:Ontario|PE:Prince Edward Island|QC:Quebec|SK:Saskatchewan|YT:Yukon",
    ],
    [
      "US",
      "AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming",
    ],
  ].flatMap(([country, entries]) =>
    entries.split("|").map((entry) => {
      const [code, name] = entry.split(":");
      return [`${country}:${normalize(name)}`, code];
    }),
  ),
);

function namesForAbbreviation(zone: Zone, abbreviation: string) {
  if (abbreviation === "IST") {
    if (zone.canonical === "Asia/Kolkata")
      return ["India Standard Time", "Indian Standard Time"];
    if (zone.canonical === "Europe/Dublin") return ["Irish Standard Time"];
    if (zone.canonical === "Asia/Jerusalem") return ["Israel Standard Time"];
  }
  if (abbreviation === "CST") {
    if (["Asia/Shanghai", "Asia/Taipei", "Asia/Macau"].includes(zone.canonical))
      return ["China Standard Time"];
    if (zone.canonical === "America/Havana") return ["Cuba Standard Time"];
  }
  return commonNames[abbreviation] || [];
}

function entries(zone: Zone) {
  let result = index.get(zone.id);
  if (result) return result;
  result = [];
  const seen = new Set<string>();
  const add = (value: string, field: Field, reason: string, weight: number) => {
    const normalized = normalize(value),
      key = `${field}:${normalized}`;
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    result!.push({ value, normalized, field, reason, weight });
  };
  add(zone.id, "id", "Timezone identifier", 120);
  add(cityName(zone), "city", "Reference location", 100);
  add(zone.id.split("/")[0], "region", "IANA region", 65);
  for (const alias of catalog.zones.filter(
    (z) => z.canonical === zone.canonical && z.id !== zone.id,
  ))
    add(alias.id, "id", `Related ID: ${alias.id}`, 95);
  for (const country of zone.countries) {
    add(country, "country", catalog.countries[country] || country, 75);
    add(catalog.countries[country] || country, "country", "Country", 85);
  }
  for (const city of locationsFor(zone)) {
    const reason = [city[0], city[1], catalog.countries[city[2]]]
      .filter(Boolean)
      .join(", ");
    add(city[0], "city", reason, 95);
    for (const alternate of city[4].split("|"))
      add(alternate, "city", reason, 90);
    add(
      city[1],
      "state",
      `${city[1]}, ${catalog.countries[city[2]] || city[2]}`,
      85,
    );
    add(
      city[5],
      "state",
      `${city[1]}, ${catalog.countries[city[2]] || city[2]}`,
      85,
    );
    const postalCode = postalCodes[`${city[2]}:${normalize(city[1])}`];
    if (postalCode)
      add(
        postalCode,
        "state",
        `${city[1]}, ${catalog.countries[city[2]] || city[2]}`,
        85,
      );
    add(city[2], "country", catalog.countries[city[2]] || city[2], 70);
    add(catalog.countries[city[2]] || city[2], "country", "Country", 80);
  }
  if (zone.countries.includes("US")) {
    add("USA", "country", "United States", 80);
    add("United States of America", "country", "Country", 85);
  }
  if (zone.countries.includes("GB")) {
    add("UK", "country", "United Kingdom", 80);
    add("Great Britain", "country", "United Kingdom", 80);
  }
  index.set(zone.id, result);
  return result;
}

function match(
  zone: Zone,
  clause: Clause,
  timestamp: number,
): { score: number; reason: string } | null {
  const needle = normalize(clause.value);
  if (clause.field === "type")
    return zone.kind === needle
      ? { score: 60, reason: `${zone.kind} identifier` }
      : null;
  const offset = parseOffset(clause.value);
  if (
    clause.field === "offset" ||
    (!clause.field && offset !== null && !/^(UTC|GMT)$/i.test(clause.value))
  ) {
    return offset !== null && stateAt(zone, timestamp).offset === offset
      ? {
          score: 100,
          reason: `Offset at selected instant: ${offsetLabel(offset)}`,
        }
      : null;
  }
  const year = new Date(timestamp).getUTCFullYear();
  let best: { score: number; reason: string } | null = null;
  if (!clause.field || clause.field === "abbr") {
    for (const state of seasonalStates(zone, year)) {
      const abbreviation = normalize(state.abbreviation);
      if (
        needle === abbreviation ||
        (!clause.field &&
          namesForAbbreviation(zone, state.abbreviation).some(
            (name) =>
              normalize(name) === needle ||
              normalize(name).split(" ").includes(needle),
          ))
      ) {
        best = {
          score: 105,
          reason: `${state.abbreviation} (${offsetLabel(state.offset)}) in ${year}`,
        };
      }
    }
  }
  if (clause.field === "abbr") return best;
  for (const entry of entries(zone)) {
    if (clause.field && clause.field !== entry.field) continue;
    let bonus = 0;
    if (entry.normalized === needle) bonus = 35;
    else if (needle.length <= 3) {
      if (!entry.normalized.split(/[\s,.-]+/).includes(needle)) continue;
      bonus = 3;
    } else if (entry.normalized.startsWith(needle)) bonus = 15;
    else if (!entry.normalized.includes(needle)) continue;
    const score = entry.weight + bonus;
    if (!best || score > best.score) best = { score, reason: entry.reason };
  }
  return best;
}

// Bounded Damerau-Levenshtein: small typo recovery only after exact search fails.
function distance(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const rows = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = limit + 1;
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, rows[i][j]);
    }
    if (rowMin > limit) return limit + 1;
  }
  return rows[a.length][b.length];
}

export function search(options: SearchOptions) {
  const { clauses, errors } = parseQuery(options.query);
  if (errors.length)
    return { results: [] as SearchResult[], errors, fuzzy: false };
  const eligible = catalog.zones.filter(
    (z) =>
      supports(z, options.runtime) &&
      (options.aliases || z.kind !== "alias") &&
      (!options.region || z.id.startsWith(`${options.region}/`)),
  );
  let results: SearchResult[] = [];
  for (const zone of eligible) {
    let score = 0,
      reason =
        countryNames(zone).join(", ") ||
        (zone.kind === "runtime" ? "Java runtime ID" : "Global / fixed offset");
    let matched = true;
    for (const clause of clauses) {
      const found = match(zone, clause, options.timestamp);
      if (!found) {
        matched = false;
        break;
      }
      score += found.score;
      if (found.reason !== "Country" && found.reason !== "IANA region")
        reason = found.reason;
    }
    if (matched) {
      const featuredIndex = featured.indexOf(zone.id);
      score += featuredIndex < 0 ? 0 : (featured.length - featuredIndex) / 100;
      if (zone.kind === "alias") score -= 8;
      // An exact ID should always win over its related canonical ID.
      if (normalize(zone.id) === normalize(options.query)) score += 200;
      results.push({ zone, score, reason, fuzzy: false });
    }
  }
  if (
    (!results.length || results.every((r) => r.score < 120)) &&
    clauses.length === 1 &&
    !clauses[0].field &&
    clauses[0].value.length >= 4
  ) {
    const needle = normalize(clauses[0].value),
      limit = needle.length > 7 ? 2 : 1;
    const existing = new Set(results.map((r) => r.zone.id));
    for (const zone of eligible) {
      if (existing.has(zone.id)) continue;
      const candidate = entries(zone).find(
        (e) =>
          e.field !== "id" && distance(needle, e.normalized, limit) <= limit,
      );
      if (candidate)
        results.push({
          zone,
          score: candidate.weight + 20,
          reason: `Similar to ${candidate.value}: ${candidate.reason}`,
          fuzzy: true,
        });
    }
  }
  results.sort((a, b) => {
    if (options.sort === "offset")
      return (
        stateAt(a.zone, options.timestamp).offset -
          stateAt(b.zone, options.timestamp).offset ||
        a.zone.id.localeCompare(b.zone.id)
      );
    if (options.sort === "name") return a.zone.id.localeCompare(b.zone.id);
    return b.score - a.score || a.zone.id.localeCompare(b.zone.id);
  });
  return { results, errors, fuzzy: results.some((r) => r.fuzzy) };
}

export function isAbbreviationQuery(
  query: string,
  year = new Date().getUTCFullYear(),
) {
  return (
    /^(?:abbr:)?[A-Za-z]{2,5}$/.test(query.trim()) &&
    !["UTC", "GMT"].includes(query.toUpperCase()) &&
    catalog.zones.some((z) =>
      seasonalStates(z, year).some(
        (s) =>
          s.abbreviation.toLowerCase() ===
          query.replace(/^abbr:/i, "").toLowerCase(),
      ),
    )
  );
}
