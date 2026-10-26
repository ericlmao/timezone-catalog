import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import moment from "moment-timezone";

mkdirSync("src/data", { recursive: true });
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16e6,
    ...options,
  });
const missing = JSON.parse(
  run(process.env.JAVA_BIN || "java", ["scripts/DumpZones.java"]),
).ids.filter((id) => !moment.tz.zone(id));
const java = JSON.parse(
  run(process.env.JAVA_BIN || "java", [
    "scripts/DumpZones.java",
    missing.join(","),
  ]),
);
const python = JSON.parse(
  run(process.env.PYTHON_BIN || "python3", [
    "-c",
    `
import json, platform, zoneinfo, pathlib
version = 'unknown (system database)'
for p in zoneinfo.TZPATH:
    source = pathlib.Path(p) / 'tzdata.zi'
    if source.exists():
        version = source.read_text().splitlines()[0].removeprefix('# version ')
        break
print(json.dumps({'version': platform.python_version(), 'tzdb': version, 'ids': sorted(z for z in zoneinfo.available_timezones() if z != 'localtime' and not z.startswith(('posix/', 'right/')))}))
`,
  ]),
);
const javascript = {
  version: process.version,
  tzdb: process.versions.tz,
  primaryIds: Intl.supportedValuesOf("timeZone"),
  ids: [...new Set([...moment.tz.names(), ...java.ids])]
    .filter((id) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: id });
        return true;
      } catch {
        return false;
      }
    })
    .sort(),
};
writeFileSync(
  "src/data/runtimes.json",
  JSON.stringify({
    captured: new Date().toISOString(),
    java,
    python,
    javascript,
  }),
);
console.log(
  `Captured Java ${java.version}: ${java.ids.length} IDs (${missing.length} runtime-only rules); Python ${python.version}: ${python.ids.length}; Node ${javascript.version}: ${javascript.ids.length}.`,
);
