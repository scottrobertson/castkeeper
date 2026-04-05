import { describe, it, expect } from "vitest";
import { formatDuration, calculateProgress, formatRelativeDate } from "../../src/utils";

describe("formatDuration", () => {
  it("returns 0s for zero seconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("returns seconds only for values under a minute", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("returns minutes and seconds", () => {
    expect(formatDuration(125)).toBe("2m 5s");
  });

  it("returns hours, minutes, and seconds", () => {
    expect(formatDuration(3661)).toBe("1h 1m 1s");
  });

  it("returns exact minute with 0 seconds", () => {
    expect(formatDuration(60)).toBe("1m 0s");
  });

  it("returns exact hour with 0 minutes and 0 seconds", () => {
    expect(formatDuration(3600)).toBe("1h 0m 0s");
  });
});

describe("calculateProgress", () => {
  it("returns 100 for a fully listened episode", () => {
    expect(calculateProgress(600, 600)).toBe(100);
  });

  it("returns 50 for a half listened episode", () => {
    expect(calculateProgress(300, 600)).toBe(50);
  });

  it("rounds to the nearest integer", () => {
    expect(calculateProgress(1, 3)).toBe(33);
  });

  it("returns 0 when nothing has been played", () => {
    expect(calculateProgress(0, 600)).toBe(0);
  });

  it("returns 0 when duration is 0 (avoids division by zero)", () => {
    expect(calculateProgress(0, 0)).toBe(0);
  });

  it("caps at 100 when played_up_to exceeds duration", () => {
    expect(calculateProgress(700, 600)).toBe(100);
  });
});

describe("formatRelativeDate", () => {
  it("returns dash for null", () => {
    expect(formatRelativeDate(null)).toBe("\u2014");
  });

  it("returns minutes ago for recent dates", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeDate(fiveMinutesAgo)).toBe("5m ago");
  });

  it("returns hours ago for dates within a day", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(formatRelativeDate(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago for dates within a week", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(formatRelativeDate(twoDaysAgo)).toBe("2d ago");
  });

  it("returns month and day for dates within a year", () => {
    const result = formatRelativeDate("2024-06-15T00:00:00Z");
    expect(result).toContain("Jun");
    expect(result).toContain("15");
  });
});
