import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetRateLimitForTests } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => __resetRateLimitForTests());

  it("allows requests up to the limit, then blocks", () => {
    const limit = 3;
    const win = 60_000;
    expect(checkRateLimit("ip", limit, win, 0).ok).toBe(true); // 1
    expect(checkRateLimit("ip", limit, win, 0).ok).toBe(true); // 2
    expect(checkRateLimit("ip", limit, win, 0).ok).toBe(true); // 3
    const blocked = checkRateLimit("ip", limit, win, 0); // 4
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const limit = 1;
    const win = 1_000;
    expect(checkRateLimit("ip", limit, win, 0).ok).toBe(true);
    expect(checkRateLimit("ip", limit, win, 500).ok).toBe(false); // same window
    expect(checkRateLimit("ip", limit, win, 1_000).ok).toBe(true); // window rolled
  });

  it("tracks separate keys independently", () => {
    const limit = 1;
    const win = 60_000;
    expect(checkRateLimit("a", limit, win, 0).ok).toBe(true);
    expect(checkRateLimit("b", limit, win, 0).ok).toBe(true); // different IP, fresh budget
    expect(checkRateLimit("a", limit, win, 0).ok).toBe(false);
  });

  it("reports decreasing remaining within a window", () => {
    const r1 = checkRateLimit("k", 5, 60_000, 0);
    const r2 = checkRateLimit("k", 5, 60_000, 0);
    expect(r1.remaining).toBe(4);
    expect(r2.remaining).toBe(3);
  });
});
