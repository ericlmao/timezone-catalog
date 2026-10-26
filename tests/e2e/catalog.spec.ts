import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("searches places and copies the exact ID and runtime code", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your place in time." }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search timezones" })
    .fill("country:CA state:Ontario");
  await expect(
    page.getByRole("button", { name: "Inspect America/Toronto", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Copy America/Toronto", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Copied America/Toronto",
  );
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("America/Toronto");
  await page
    .getByRole("button", { name: "Inspect America/Toronto", exact: true })
    .click();
  await page.getByRole("button", { name: "Copy code snippet" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('ZoneId.of("America/Toronto")');
  await page.getByRole("tab", { name: "Python", exact: true }).click();
  await expect(page.locator("pre")).toContainText(
    'ZoneInfo("America/Toronto")',
  );
  await page.getByRole("tab", { name: "Go", exact: true }).click();
  await expect(page.locator("pre")).toContainText("if err != nil");
});

test("retains ambiguous abbreviations, recovers typos and handles empty results", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Search timezones" });
  await input.fill("EST");
  await expect(page.locator(".ambiguity-note")).toContainText(
    "EST can mean more than one timezone",
  );
  await expect(
    page.getByRole("button", { name: "Inspect America/New_York", exact: true }),
  ).toBeVisible();
  await input.fill("Tornto");
  await expect(page.locator(".fuzzy-note")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect America/Toronto", exact: true }),
  ).toBeVisible();
  await input.fill("xxxxxxxxxxxxxxxxxxxxxxxxxxxx");
  await expect(
    page.getByRole("heading", { name: "No timezones found" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset search" }).click();
  await expect(input).toHaveValue("");
});

test("exposes all 604 Java IDs including runtime-only IDs and filters by region", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Include aliases" }).check();
  await expect(page.locator(".result-count strong")).toHaveText("604");
  await page
    .getByRole("textbox", { name: "Search timezones" })
    .fill("SystemV/EST5EDT");
  await page
    .getByRole("button", { name: "Inspect SystemV/EST5EDT", exact: true })
    .click();
  await expect(page.locator("pre")).toContainText(
    'ZoneId.of("SystemV/EST5EDT")',
  );
  await page.getByRole("tab", { name: "All IANA", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No timezones found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy code snippet" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reset search" }).click();
  await page
    .getByRole("combobox", { name: "Filter by IANA region" })
    .selectOption("Europe");
  await expect(
    page.getByRole("button", { name: "Inspect Europe/London", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect America/New_York", exact: true }),
  ).toHaveCount(0);
});

test("explores the map, changes the reference instant and restores a shared lookup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(
    page.getByLabel("World map of timezone reference locations"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select Asia/Tokyo", exact: true })
    .click();
  await expect(
    page
      .getByRole("complementary")
      .getByRole("heading", { name: "Tokyo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Reset map", exact: true }).click();
  await page.getByRole("button", { name: "Live offsets", exact: true }).click();
  await page.getByLabel("Reference instant in UTC").fill("2026-01-15T12:00");
  await expect(
    page.getByRole("complementary").locator(".selected-clock strong").first(),
  ).toHaveText("21:00:00");
  const url = page.url();
  await page.reload();
  expect(page.url()).toBe(url);
  await expect(
    page
      .getByRole("complementary")
      .getByRole("heading", { name: "Tokyo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").locator(".selected-clock strong").first(),
  ).toHaveText("21:00:00");
});

test("exports matching results and opens accessible help dialogs", async ({
  page,
}) => {
  await page.goto("/?q=city%3AToronto&runtime=java");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toBe("timezone-catalog.json");
  await page
    .getByRole("button", { name: "Search tips", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "country:CA state:Ontario",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "About the data" }).click();
  await expect(page.getByRole("dialog")).toContainText("CC BY 4.0");
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("has no horizontal overflow or runtime errors and captures the layout", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".result-count strong")).not.toHaveText("0");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `.cache/${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(
    page.getByLabel("World map of timezone reference locations"),
  ).toBeVisible();
  await page.screenshot({
    path: `.cache/${info.project.name}-map.png`,
    fullPage: true,
  });
});

test("passes WCAG AA accessibility checks in list, map and help views", async ({
  page,
}) => {
  await page.goto("/");
  const scan = async () => {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  };
  await scan();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(
    page.getByLabel("World map of timezone reference locations"),
  ).toBeVisible();
  await scan();
  await page.getByRole("button", { name: "About the data" }).click();
  await scan();
});
