import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import moment from "moment-timezone";
import { feature } from "topojson-client";

const VERSION = "2026e";
const cache = ".cache";
mkdirSync(`${cache}/tzdata`, { recursive: true });
mkdirSync("src/data", { recursive: true });
mkdirSync("public/data", { recursive: true });
const sources = [
  [
    `https://data.iana.org/time-zones/releases/tzdata${VERSION}.tar.gz`,
    `tzdata${VERSION}.tar.gz`,
  ],
  [
    "https://download.geonames.org/export/dump/cities15000.zip",
    "cities15000.zip",
  ],
  [
    "https://download.geonames.org/export/dump/admin1CodesASCII.txt",
    "admin1CodesASCII.txt",
  ],
  [
    "https://download.geonames.org/export/dump/countryInfo.txt",
    "countryInfo.txt",
  ],
];
for (const [url, file] of sources) {
  if (process.argv.includes("--download") || !existsSync(`${cache}/${file}`)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    writeFileSync(
      `${cache}/${file}`,
      Buffer.from(await response.arrayBuffer()),
    );
  }
}
execFileSync("tar", [
  "-xzf",
  `${cache}/tzdata${VERSION}.tar.gz`,
  "-C",
  `${cache}/tzdata`,
]);
execFileSync("unzip", ["-oq", `${cache}/cities15000.zip`, "-d", cache]);
if (moment.tz.dataVersion !== VERSION)
  throw new Error(
    `Moment data ${moment.tz.dataVersion} does not match pinned IANA ${VERSION}`,
  );
const text = (file) => readFileSync(`${cache}/${file}`, "utf8");
const ids = new Set();
const links = {};
for (const file of [
  "africa",
  "antarctica",
  "asia",
  "australasia",
  "europe",
  "northamerica",
  "southamerica",
  "etcetera",
  "backward",
  "factory",
]) {
  for (const line of text(`tzdata/${file}`).split("\n")) {
    const parts = line.split("#")[0].trim().split(/\s+/);
    if (parts[0] === "Zone") ids.add(parts[1]);
    if (parts[0] === "Link") {
      links[parts[2]] = parts[1];
      ids.add(parts[2]);
    }
  }
}
function resolve(id) {
  const seen = new Set();
  while (links[id]) {
    if (seen.has(id)) throw new Error(`Cyclic alias ${id}`);
    seen.add(id);
    id = links[id];
  }
  return id;
}
const countries = {};
for (const line of text("countryInfo.txt")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))) {
  const row = line.split("\t");
  countries[row[0]] = row[4];
}
const divisions = {};
for (const line of text("admin1CodesASCII.txt").split("\n").filter(Boolean)) {
  const [code, name, ascii] = line.split("\t");
  divisions[code] = { name, ascii };
}
const meta = {};
const ownMeta = {};
function coordinates(value) {
  const [, lat, lon] = value.match(/^([+-]\d+)([+-]\d+)$/);
  const angle = (s, digits) => {
    const abs = s.slice(1);
    return (
      (s[0] === "-" ? -1 : 1) *
      (Number(abs.slice(0, digits)) +
        Number(abs.slice(digits, digits + 2)) / 60 +
        Number(abs.slice(digits + 2) || 0) / 3600)
    );
  };
  return [angle(lon, 3), angle(lat, 2)].map((n) => +n.toFixed(4));
}
for (const file of ["zone.tab", "zone1970.tab"]) {
  for (const line of text(`tzdata/${file}`)
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))) {
    const [country, coord, id, comment = ""] = line.split("\t");
    const target = resolve(id);
    if (file === "zone.tab")
      ownMeta[id] = {
        countries: country.split(","),
        coordinates: coordinates(coord),
        comment,
      };
    meta[target] ??= {
      countries: [],
      coordinates: coordinates(coord),
      comment,
    };
    // An alias can appear first alphabetically (Nassau before Toronto). The
    // canonical zone's own reference point must win over an alias's location.
    if (id === target) {
      meta[target].coordinates = coordinates(coord);
      meta[target].comment = comment;
    }
    meta[target].countries = [
      ...new Set(
        id === target
          ? [...country.split(","), ...meta[target].countries]
          : [...meta[target].countries, ...country.split(",")],
      ),
    ];
  }
}
const locations = {};
let cityCount = 0;
for (const line of text("cities15000.txt").split("\n").filter(Boolean)) {
  const row = line.split("\t");
  const target = resolve(row[17]);
  if (!ids.has(target)) continue;
  const division = divisions[`${row[8]}.${row[10]}`];
  // Keep only Latin alternative names to avoid a very large search download.
  const alternates = [
    ...new Set([
      row[2],
      ...row[3]
        .split(",")
        .filter(
          (n) => /^[\p{Script=Latin}\p{M}\d .'-]+$/u.test(n) && n.length <= 50,
        ),
    ]),
  ].slice(0, 12);
  (locations[target] ??= []).push([
    row[1],
    division?.name || "",
    row[8],
    Number(row[14]),
    alternates.join("|"),
    division?.ascii || "",
  ]);
  cityCount++;
}
for (const cities of Object.values(locations))
  cities.sort((a, b) => b[3] - a[3]);
const runtimes = JSON.parse(readFileSync("src/data/runtimes.json", "utf8"));
const rules = {};
const start = Date.UTC(1970, 0, 1) / 1000;
const end = Date.UTC(2101, 0, 1) / 1000;
for (const id of ids) {
  const target = resolve(id);
  if (rules[target]) continue;
  if (target === "Factory") {
    rules[target] = { untils: [end], offsets: [0], abbrs: ["-00"] };
    continue;
  }
  const zone = moment.tz.zone(target);
  if (!zone) throw new Error(`Missing rules for ${target}`);
  const r = { untils: [], offsets: [], abbrs: [] };
  for (let i = 0; i < zone.untils.length; i++) {
    if (zone.untils[i] / 1000 <= start) continue;
    r.untils.push(Math.min(end, zone.untils[i] / 1000));
    r.offsets.push(Math.round(-zone.offsets[i] * 60));
    r.abbrs.push(zone.abbrs[i]);
    if (zone.untils[i] / 1000 >= end) break;
  }
  rules[target] = r;
}
const zones = [...ids].sort().map((id) => {
  const canonical = resolve(id);
  const location = links[id] && ownMeta[id] ? ownMeta[id] : meta[canonical];
  return {
    id,
    canonical,
    kind: links[id] ? "alias" : "zone",
    ...(location || { countries: [], coordinates: null, comment: "" }),
  };
});
for (const id of runtimes.java.ids.filter((id) => !ids.has(id))) {
  if (!runtimes.java.rules[id])
    throw new Error(`Missing Java-only rules for ${id}`);
  zones.push({
    id,
    canonical: id,
    kind: "runtime",
    countries: [],
    coordinates: null,
    comment: "Java runtime identifier",
  });
  rules[id] = runtimes.java.rules[id];
}
const catalog = {
  version: VERSION,
  generated: new Date().toISOString(),
  range: [1970, 2100],
  cityCount,
  countries,
  zones: zones.sort((a, b) => a.id.localeCompare(b.id)),
  locations,
  rules,
};
writeFileSync("src/data/catalog.json", JSON.stringify(catalog));
const topology = JSON.parse(
  readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"),
);
writeFileSync(
  "src/data/world.json",
  JSON.stringify(feature(topology, topology.objects.countries)),
);
writeFileSync(
  "public/data/provenance.json",
  JSON.stringify(
    {
      generated: catalog.generated,
      tzdb: VERSION,
      sources: sources.map(([url, file]) => ({
        url,
        sha256: createHash("sha256")
          .update(readFileSync(`${cache}/${file}`))
          .digest("hex"),
      })),
      geonamesLicense: "CC BY 4.0",
      naturalEarthLicense: "Public domain",
      geographicCoverage:
        "GeoNames cities15000, not a timezone boundary dataset",
    },
    null,
    2,
  ),
);
console.log(
  `Built IANA ${VERSION}: ${ids.size} IDs + ${zones.length - ids.size} Java-only IDs, ${Object.keys(rules).length} rulesets, ${cityCount} cities.`,
);
