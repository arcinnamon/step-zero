import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "@/app/auth/callback/route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
  });

  it("exchanges the code and redirects to the sanitized next path", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const request = new Request("https://example.com/auth/callback?code=abc123&next=/dashboard");

    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toBe("https://example.com/dashboard");
  });

  it("never redirects to an attacker-controlled origin, even on a successful exchange", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const request = new Request("https://example.com/auth/callback?code=abc123&next=https://evil.example");

    const response = await GET(request);

    expect(response.headers.get("location")).toBe("https://example.com/");
  });

  it("redirects to /?auth_error=1 when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });
    const request = new Request("https://example.com/auth/callback?code=bad-code");

    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("bad-code");
    expect(response.headers.get("location")).toBe("https://example.com/?auth_error=1");
  });

  it("redirects to /?auth_error=1 when no code is present", async () => {
    const request = new Request("https://example.com/auth/callback");

    const response = await GET(request);

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://example.com/?auth_error=1");
  });
});
