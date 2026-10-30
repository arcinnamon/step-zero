import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getClaims = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims } }),
}));

import { updateSession } from "@/lib/supabase/proxy";

describe("updateSession", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    getClaims.mockReset();
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
});
