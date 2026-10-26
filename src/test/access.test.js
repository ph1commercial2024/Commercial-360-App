import { describe, it, expect } from "vitest";
import { accessState } from "../lib/access";

describe("accessState", () => {
  it("is loading until the profile arrives", () => {
    expect(accessState(null)).toBe("loading");
  });

  it("gives staff access to an active account with a position", () => {
    expect(accessState({ position: "Supervisor", is_active: true })).toBe("staff");
    expect(accessState({ position: "Commercial Officer" })).toBe("staff");
  });

  it("gives an admin access even without a position", () => {
    expect(accessState({ position: null, is_admin: true })).toBe("staff");
  });

  it("keeps a new sign-up with no position waiting", () => {
    expect(accessState({ position: null, is_admin: false })).toBe("pending");
    expect(accessState({ position: "  " })).toBe("pending");
  });

  it("blocks a deactivated account, even an admin", () => {
    expect(accessState({ position: "Supervisor", is_active: false })).toBe("inactive");
    expect(accessState({ is_admin: true, is_active: false })).toBe("inactive");
  });
});
