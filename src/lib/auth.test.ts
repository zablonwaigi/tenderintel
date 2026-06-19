import { describe, it, expect, afterEach } from "vitest";
import { hasCronSecret } from "./auth";

describe("hasCronSecret", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    process.env.CRON_SECRET = original;
  });

  it("accepts the exact bearer token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(hasCronSecret("Bearer s3cret")).toBe(true);
  });

  it("rejects a wrong or malformed token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(hasCronSecret("Bearer nope")).toBe(false);
    expect(hasCronSecret("s3cret")).toBe(false); // missing "Bearer "
    expect(hasCronSecret(null)).toBe(false);
  });

  it("rejects everything when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(hasCronSecret("Bearer anything")).toBe(false);
  });
});
