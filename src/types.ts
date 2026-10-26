export type Runtime =
  "iana" | "java" | "javascript" | "python" | "go" | "php" | "dotnet";
export type ZoneKind = "zone" | "alias" | "runtime";
export interface Zone {
  id: string;
  canonical: string;
  kind: ZoneKind;
  countries: string[];
  coordinates: number[] | null;
  comment: string;
}
export type City = [
  name: string,
  division: string,
  country: string,
  population: number,
  alternateNames: string,
  asciiDivision: string,
];
export interface Rules {
  untils: number[];
  offsets: number[];
  abbrs: string[];
}
export interface Catalog {
  version: string;
  generated: string;
  range: number[];
  cityCount: number;
  countries: Record<string, string>;
  zones: Zone[];
  locations: Record<string, City[]>;
  rules: Record<string, Rules>;
}
export interface SearchResult {
  zone: Zone;
  score: number;
  reason: string;
  fuzzy: boolean;
}
export interface SearchOptions {
  query: string;
  runtime: Runtime;
  region: string;
  aliases: boolean;
  timestamp: number;
  sort: "relevance" | "name" | "offset";
}
