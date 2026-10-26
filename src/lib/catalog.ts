import rawCatalog from "../data/catalog.json";
import rawRuntimes from "../data/runtimes.json";
import type { Catalog, Runtime, Zone } from "../types";

export const catalog = rawCatalog as unknown as Catalog;
export const snapshots = rawRuntimes;
export const zonesById = new Map(catalog.zones.map((z) => [z.id, z]));
export const regions = [
  "Africa",
  "America",
  "Antarctica",
  "Arctic",
  "Asia",
  "Atlantic",
  "Australia",
  "Europe",
  "Indian",
  "Pacific",
  "Etc",
  "SystemV",
];
export const runtimeLabels: Record<Runtime, string> = {
  iana: "All IANA",
  java: "Java",
  javascript: "JavaScript",
  python: "Python",
  go: "Go",
  php: "PHP",
  dotnet: ".NET",
};

const javaIds = new Set(snapshots.java.ids);
const pythonIds = new Set(snapshots.python.ids);
const jsIds = new Set(
  catalog.zones
    .filter((z) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: z.id });
        return true;
      } catch {
        return false;
      }
    })
    .map((z) => z.id),
);

export function supports(zone: Zone, runtime: Runtime) {
  if (runtime === "java") return javaIds.has(zone.id);
  if (runtime === "python") return pythonIds.has(zone.id);
  if (runtime === "javascript") return jsIds.has(zone.id);
  return zone.kind !== "runtime";
}

export function runtimeDescription(runtime: Runtime) {
  switch (runtime) {
    case "java":
      return `ZoneId IDs captured from OpenJDK ${snapshots.java.version}, tzdb ${snapshots.java.tzdb}. Your JDK may differ.`;
    case "javascript":
      return "IDs accepted by Intl.DateTimeFormat in this browser. Its timezone rules may differ from this catalog.";
    case "python":
      return `zoneinfo IDs captured from Python ${snapshots.python.version}, tzdb ${snapshots.python.tzdb}. Availability depends on your system or tzdata package.`;
    case "go":
      return "IANA reference for time.LoadLocation. Availability depends on ZONEINFO, the system database, or imported time/tzdata.";
    case "php":
      return "IANA reference for DateTimeZone. Check DateTimeZone::listIdentifiers(DateTimeZone::ALL_WITH_BC) on your installation.";
    case "dotnet":
      return "IANA IDs for TimeZoneInfo on Linux/macOS. Windows IANA support requires .NET 6+ with ICU enabled. Windows registry IDs are not listed.";
    default:
      return `Complete IANA ${catalog.version} catalog, including backward-compatible aliases. Runtime views have separate availability rules.`;
  }
}

export function runtimeSource(runtime: Runtime) {
  return {
    iana: "https://www.iana.org/time-zones",
    java: "https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/ZoneId.html",
    javascript: "https://tc39.es/ecma402/#sec-intl.datetimeformat",
    python: "https://docs.python.org/3/library/zoneinfo.html",
    go: "https://pkg.go.dev/time#LoadLocation",
    php: "https://www.php.net/manual/en/datetimezone.listidentifiers.php",
    dotnet:
      "https://learn.microsoft.com/en-us/dotnet/api/system.timezoneinfo.findsystemtimezonebyid",
  }[runtime];
}

export function cityName(zone: Zone) {
  return zone.id.split("/").at(-1)!.replaceAll("_", " ");
}
export function countryNames(zone: Zone) {
  return zone.countries.map((c) => catalog.countries[c] || c);
}
export function locationsFor(zone: Zone) {
  return catalog.locations[zone.canonical] || [];
}
export function aliasesFor(zone: Zone) {
  return catalog.zones.filter(
    (z) => z.canonical === zone.canonical && z.id !== zone.id,
  );
}
export function coordinatesLabel(zone: Zone) {
  if (!zone.coordinates) return "No geographic location";
  const [lon, lat] = zone.coordinates;
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
}

export function snippet(runtime: Runtime, id: string) {
  // IDs come from the bundled catalog, never from untrusted search text.
  switch (runtime) {
    case "java":
      return `import java.time.ZoneId;\nimport java.time.ZonedDateTime;\n\nvar zone = ZoneId.of("${id}");\nvar now = ZonedDateTime.now(zone);`;
    case "python":
      return `from datetime import datetime\nfrom zoneinfo import ZoneInfo\n\nzone = ZoneInfo("${id}")\nnow = datetime.now(zone)`;
    case "go":
      return `package main\n\nimport (\n    "fmt"\n    "time"\n    _ "time/tzdata"\n)\n\nfunc main() {\n    zone, err := time.LoadLocation("${id}")\n    if err != nil {\n        panic(err)\n    }\n    fmt.Println(time.Now().In(zone))\n}`;
    case "php":
      return `<?php\n$zone = new DateTimeZone('${id}');\n$now = new DateTimeImmutable('now', $zone);\necho $now->format(DateTimeInterface::ATOM);`;
    case "dotnet":
      return `using System;\n\nvar zone = TimeZoneInfo.FindSystemTimeZoneById(\n    "${id}"\n);\nvar now = TimeZoneInfo.ConvertTime(\n    DateTimeOffset.UtcNow, zone\n);`;
    default:
      return `const formatter = new Intl.DateTimeFormat("en", {\n  timeZone: "${id}",\n  dateStyle: "full",\n  timeStyle: "long",\n});\n\nconsole.log(formatter.format(new Date()));`;
  }
}
