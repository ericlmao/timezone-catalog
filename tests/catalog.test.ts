import { describe, expect, it } from "vitest";
import {
  catalog,
  snapshots,
  supports,
  zonesById,
  snippet,
} from "../src/lib/catalog";
import { parseQuery, search } from "../src/lib/search";
import {
  clockAt,
  nextTransition,
  offsetLabel,
  parseOffset,
  seasonalStates,
  stateAt,
} from "../src/lib/time";
import type { Runtime, SearchOptions } from "../src/types";

const winter = Date.parse("2026-01-15T12:00:00Z");
const summer = Date.parse("2026-07-15T12:00:00Z");
const defaults: SearchOptions = {
  query: "",
  runtime: "iana",
  region: "",
  aliases: false,
  timestamp: winter,
  sort: "relevance",
};
const lookup = (query: string, extra: Partial<SearchOptions> = {}) =>
  search({ ...defaults, ...extra, query });
const ids = (query: string, extra: Partial<SearchOptions> = {}) =>
  lookup(query, extra).results.map((r) => r.zone.id);
const zone = (id: string) => zonesById.get(id)!;

describe("catalog completeness and provenance", () => {
  it("includes every pinned IANA ID and all Java runtime IDs", () => {
    expect(catalog.version).toBe("2026e");
    expect(catalog.zones.filter((z) => z.kind !== "runtime")).toHaveLength(598);
    expect(new Set(catalog.zones.map((z) => z.id)).size).toBe(
      catalog.zones.length,
    );
    const java = catalog.zones
      .filter((z) => supports(z, "java"))
      .map((z) => z.id)
      .sort();
    expect(java).toEqual([...snapshots.java.ids].sort());
    expect(ids("", { runtime: "java", aliases: true })).toHaveLength(604);
    expect(ids("", { runtime: "python", aliases: true }).sort()).toEqual(
      [...snapshots.python.ids].sort(),
    );
  });
  it("resolves every alias and supplies valid, ordered transition data", () => {
    for (const z of catalog.zones) {
      expect(zonesById.has(z.canonical), z.id).toBe(true);
      const r = catalog.rules[z.canonical];
      expect(r.untils.length, z.id).toBe(r.offsets.length);
      expect(r.untils.length, z.id).toBe(r.abbrs.length);
      expect(
        r.untils.every(
          (u, i) => Number.isFinite(u) && (!i || u > r.untils[i - 1]),
        ),
        z.id,
      ).toBe(true);
      expect(r.untils.at(-1), z.id).toBe(Date.UTC(2101, 0, 1) / 1000);
    }
    expect(zone("US/Eastern").canonical).toBe("America/New_York");
    expect(zone("Canada/Eastern").canonical).toBe("America/Toronto");
    expect(zone("America/Toronto").coordinates?.[1]).toBeCloseTo(43.65, 2);
    expect(zone("Asia/Tokyo").coordinates?.[1]).toBeCloseTo(35.6544, 2);
    expect(zone("America/Nassau").coordinates?.[1]).toBeCloseTo(25.0833, 2);
  });
});

describe("geographic and sophisticated lookup", () => {
  it("finds countries, regions, states, provinces, cities and accented names", () => {
    expect(ids("Canada")).toContain("America/Toronto");
    expect(ids("America")[0]).toMatch(/^America\//);
    expect(ids("America")).toContain("America/Sao_Paulo");
    expect(ids("Ontario")).toContain("America/Toronto");
    expect(ids("Ontario")).toContain("America/Winnipeg");
    expect(ids("California")).toContain("America/Los_Angeles");
    expect(ids("Montreal")).toContain("America/Toronto");
    expect(ids("Sao Paulo")).toContain("America/Sao_Paulo");
    expect(ids("country:CA state:Ontario")).toContain("America/Toronto");
    expect(ids('city:"New York" country:US')).toContain("America/New_York");
    expect(ids("country:IN")).toContain("Asia/Kolkata");
    expect(ids("country:US state:CA")).toContain("America/Los_Angeles");
    expect(ids("country:CA province:NS")).toContain("America/Halifax");
  });
  it("retains ambiguity and matches seasonal abbreviations regardless of the selected season", () => {
    const est = ids("EST", { timestamp: summer });
    expect(est).toContain("America/New_York");
    expect(est).toContain("America/Panama");
    const ist = ids("abbr:IST");
    expect(ist).toContain("Asia/Kolkata");
    expect(ist).toContain("Europe/Dublin");
    expect(ist).toContain("Asia/Jerusalem");
    expect(ids("EST")).not.toContain("Asia/Yekaterinburg");
    expect(ids("Eastern Standard Time")).toContain("America/New_York");
    expect(ids("India Standard Time")).toContain("Asia/Kolkata");
    expect(ids("India Standard Time")).not.toContain("Europe/Dublin");
    expect(ids("China Standard Time")).toContain("Asia/Shanghai");
    expect(ids("Central Standard Time")).not.toContain("Asia/Shanghai");
  });
  it("matches the actual offset at the selected instant, including fractional offsets", () => {
    expect(ids("UTC+05:30")).toContain("Asia/Kolkata");
    expect(ids("offset:+05:45")).toContain("Asia/Kathmandu");
    expect(ids("offset:-05:00")).toContain("America/New_York");
    expect(ids("offset:-05:00", { timestamp: summer })).not.toContain(
      "America/New_York",
    );
    expect(
      ids("region:America offset:-05:00").every((id) =>
        id.startsWith("America/"),
      ),
    ).toBe(true);
  });
  it("ranks exact IDs first, resolves hidden aliases and filters aliases explicitly", () => {
    expect(ids("US/Eastern")[0]).toBe("America/New_York");
    expect(ids("US/Eastern", { aliases: true })[0]).toBe("US/Eastern");
    expect(ids("type:alias", { aliases: true }).length).toBeGreaterThan(200);
    expect(
      lookup("type:alias", { aliases: true }).results.every(
        (r) => r.zone.kind === "alias",
      ),
    ).toBe(true);
    expect(ids("SystemV/EST5EDT", { runtime: "java" })).toContain(
      "SystemV/EST5EDT",
    );
    expect(ids("SystemV/EST5EDT")).toHaveLength(0);
  });
  it("recovers typos only after exact results fail and validates syntax", () => {
    const typo = lookup("Tornto");
    expect(typo.fuzzy).toBe(true);
    expect(typo.results.map((r) => r.zone.id)).toContain("America/Toronto");
    expect(lookup("Toronto").fuzzy).toBe(false);
    expect(parseQuery('country:CA city:"New York"').clauses).toHaveLength(2);
    expect(lookup("offset:+99:00").errors.length).toBeGreaterThan(0);
    expect(lookup("nonsense:value").errors.length).toBeGreaterThan(0);
    expect(lookup('city:"Toronto').errors.length).toBeGreaterThan(0);
    expect(ids("doesnotexistanywhere")).toHaveLength(0);
  });
});

describe("date-sensitive time rules", () => {
  it("uses correct winter and summer offsets and midnight formatting", () => {
    expect(stateAt(zone("America/New_York"), winter).offset).toBe(-18000);
    expect(stateAt(zone("America/New_York"), summer).offset).toBe(-14400);
    expect(stateAt(zone("Asia/Kathmandu"), winter).offset).toBe(20700);
    expect(clockAt(zone("Etc/UTC"), Date.parse("2026-01-01T00:00:00Z"))).toBe(
      "00:00",
    );
    expect(offsetLabel(20700)).toBe("UTC+05:45");
    expect(offsetLabel(-12600)).toBe("UTC−03:30");
    expect(parseOffset("GMT-0330")).toBe(-12600);
    expect(parseOffset("UTC+14:30")).toBeNull();
  });
  it("changes offsets at the exact transition instant", () => {
    const at = Date.parse("2026-03-08T07:00:00Z");
    expect(stateAt(zone("America/New_York"), at - 1).offset).toBe(-18000);
    expect(stateAt(zone("America/New_York"), at).offset).toBe(-14400);
    expect(nextTransition(zone("America/New_York"), winter)?.at).toBe(at);
  });
  it("includes recent Manitoba rules and POSIX Etc signs", () => {
    expect(
      stateAt(zone("America/Winnipeg"), Date.parse("2026-12-01T12:00:00Z"))
        .offset,
    ).toBe(-18000);
    expect(stateAt(zone("Etc/GMT+5"), winter).offset).toBe(-18000);
    expect(stateAt(zone("Etc/GMT-5"), winter).offset).toBe(18000);
    expect(seasonalStates(zone("Asia/Kolkata"), 2026)).toHaveLength(1);
    expect(seasonalStates(zone("America/New_York"), 2026)).toHaveLength(2);
  });
  it("generates snippets using the selected ID and handles Go errors", () => {
    for (const runtime of [
      "java",
      "javascript",
      "python",
      "go",
      "php",
      "dotnet",
    ] as Runtime[])
      expect(snippet(runtime, "America/Toronto")).toContain("America/Toronto");
    expect(snippet("go", "America/Toronto")).toContain("if err != nil");
    expect(snippet("java", "America/Toronto")).toContain("ZoneId.of");
  });
});
