import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };
type CookieHandlers = { getAll: () => unknown[]; setAll: (cookies: CookieToSet[]) => void };

const getClaims = vi.fn();
let capturedCookies: CookieHandlers | null = null;

// Capture the real `cookies` config passed to createServerClient, instead of
// discarding it, so tests can simulate the library invoking setAll() the way
// it does when it refreshes an expired token.
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, config: { cookies: CookieHandlers }) => {
    capturedCookies = config.cookies;
    return { auth: { getClaims } };
  },
}));

import { updateSession } from "@/lib/supabase/proxy";

describe("updateSession", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    getClaims.mockReset();
    capturedCookies = null;
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  });

  it("passes the request through untouched when Supabase isn't configured yet", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const request = new NextRequest("https://example.com/dashboard");
    const response = await updateSession(request);

    expect(getClaims).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("refreshes the session by calling getClaims when Supabase is configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    const request = new NextRequest("https://example.com/dashboard");
    const response = await updateSession(request);

    expect(getClaims).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });

  it("forwards a refreshed session cookie into the response", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    // Simulate what the real @supabase/ssr client does internally when a
    // token is refreshed: it calls the `setAll` cookie handler we passed in.
    getClaims.mockImplementation(async () => {
      capturedCookies!.setAll([{ name: "sb-access-token", value: "refreshed-token", options: { httpOnly: true, path: "/" } }]);
      return { data: { claims: null }, error: null };
    });

    const request = new NextRequest("https://example.com/dashboard");
    const response = await updateSession(request);

    expect(response.cookies.get("sb-access-token")?.value).toBe("refreshed-token");
  });
});
