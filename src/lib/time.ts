import { catalog } from "./catalog";
import type { Zone } from "../types";

export const MIN_TIME = Date.UTC(1970, 0, 1);
export const MAX_TIME = Date.UTC(2101, 0, 1) - 1;
export function stateAt(zone: Zone, timestamp: number) {
  const rules = catalog.rules[zone.canonical];
  let low = 0,
    high = rules.untils.length - 1;
  const seconds = timestamp / 1000;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (seconds < rules.untils[mid]) high = mid;
    else low = mid + 1;
  }
  return {
    offset: rules.offsets[low],
    abbreviation: rules.abbrs[low],
    until: rules.untils[low] * 1000,
  };
}
export function offsetLabel(seconds: number, prefix = "UTC") {
  const abs = Math.abs(seconds);
  const hours = String(Math.floor(abs / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((abs % 3600) / 60)).padStart(2, "0");
  return `${prefix}${seconds >= 0 ? "+" : "−"}${hours}:${minutes}`;
}
export function clockAt(zone: Zone, timestamp: number, seconds = false) {
  const shifted = new Date(timestamp + stateAt(zone, timestamp).offset * 1000);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    timeZone: "UTC",
    hourCycle: "h23",
  }).format(shifted);
}
export function dateAt(zone: Zone, timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp + stateAt(zone, timestamp).offset * 1000));
}
export function seasonalStates(zone: Zone, year: number) {
  const rules = catalog.rules[zone.canonical];
  const start = Date.UTC(year, 0, 1) / 1000,
    end = Date.UTC(year + 1, 0, 1) / 1000;
  const states = new Map<string, { offset: number; abbreviation: string }>();
  for (let i = 0; i < rules.untils.length; i++) {
    const from = i === 0 ? -Infinity : rules.untils[i - 1];
    if (rules.untils[i] <= start || from >= end) continue;
    states.set(`${rules.offsets[i]}:${rules.abbrs[i]}`, {
      offset: rules.offsets[i],
      abbreviation: rules.abbrs[i],
    });
  }
  return [...states.values()];
}
export function nextTransition(zone: Zone, timestamp: number) {
  const rules = catalog.rules[zone.canonical];
  for (let i = 0; i < rules.untils.length - 1; i++) {
    const at = rules.untils[i] * 1000;
    if (at > timestamp && rules.offsets[i] !== rules.offsets[i + 1]) {
      return { at, before: rules.offsets[i], after: rules.offsets[i + 1] };
    }
  }
  return null;
}
export function parseOffset(input: string): number | null {
  const normalized = input.trim().replaceAll("−", "-");
  if (/^(?:UTC|GMT|Z)$/i.test(normalized)) return 0;
  const match = normalized.match(
    /^(?:(?:UTC|GMT)\s*)?([+-])(\d{1,2})(?::?(\d{2}))?$/i,
  );
  if (!match) return null;
  const hours = Number(match[2]),
    minutes = Number(match[3] || 0);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0))
    return null;
  return (match[1] === "-" ? -1 : 1) * (hours * 3600 + minutes * 60);
}
