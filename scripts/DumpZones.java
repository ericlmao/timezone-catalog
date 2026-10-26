import java.time.*;
import java.time.format.*;
import java.time.zone.*;
import java.util.*;

/** Lists ZoneId IDs, rather than the legacy TimeZone API's silent GMT fallback. */
class DumpZones {
  static String quote(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String array(Collection<String> values) {
    return "[" + String.join(",", values.stream().map(DumpZones::quote).toList()) + "]";
  }
  public static void main(String[] args) {
    var ids = new TreeSet<>(ZoneId.getAvailableZoneIds());
    var rules = new StringJoiner(",", "{", "}");
    var needed = args.length > 0 ? new HashSet<>(Arrays.asList(args[0].split(","))) : Set.<String>of();
    for (String id : ids) {
      if (!needed.contains(id)) continue;
      var zone = ZoneId.of(id);
      var r = zone.getRules();
      var instant = Instant.parse("1970-01-01T00:00:00Z");
      var end = Instant.parse("2101-01-01T00:00:00Z");
      var untils = new ArrayList<Long>();
      var offsets = new ArrayList<Integer>();
      var abbrs = new ArrayList<String>();
      while (instant.isBefore(end)) {
        offsets.add(r.getOffset(instant).getTotalSeconds());
        abbrs.add(DateTimeFormatter.ofPattern("z", Locale.ENGLISH).format(instant.atZone(zone)));
        var next = r.nextTransition(instant);
        var until = next == null || next.getInstant().isAfter(end) ? end : next.getInstant();
        untils.add(until.getEpochSecond());
        instant = until;
      }
      rules.add(quote(id) + ":{\"untils\":" + untils + ",\"offsets\":" + offsets + ",\"abbrs\":" + array(abbrs) + "}");
    }
    var shortIds = new StringJoiner(",", "{", "}");
    new TreeMap<>(ZoneId.SHORT_IDS).forEach((k,v) -> shortIds.add(quote(k) + ":" + quote(v)));
    System.out.println("{\"version\":" + quote(System.getProperty("java.runtime.version"))
      + ",\"tzdb\":" + quote(ZoneRulesProvider.getVersions("America/New_York").lastKey())
      + ",\"ids\":" + array(ids) + ",\"shortIds\":" + shortIds + ",\"rules\":" + rules + "}");
  }
}
