import { test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({ set: mockCookieSet })),
}));

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock-jwt-token"),
    _payload: payload,
  })),
  jwtVerify: vi.fn(),
}));

beforeEach(() => {
  mockCookieSet.mockClear();
  vi.resetModules();
});

test("createSession sets an httpOnly cookie named auth-token", async () => {
  const { createSession } = await import("@/lib/auth");
  await createSession("user-1", "test@example.com");

  expect(mockCookieSet).toHaveBeenCalledOnce();
  const [name, , options] = mockCookieSet.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
});

test("createSession passes userId and email to the JWT payload", async () => {
  const { SignJWT } = await import("jose");
  const { createSession } = await import("@/lib/auth");
  await createSession("user-1", "test@example.com");

  expect(SignJWT).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "user-1", email: "test@example.com" })
  );
});

test("createSession sets cookie with 7-day expiry", async () => {
  const before = Date.now();
  const { createSession } = await import("@/lib/auth");
  await createSession("user-1", "test@example.com");
  const after = Date.now();

  const [, , options] = mockCookieSet.mock.calls[0];
  const expiresMs = options.expires.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs);
});

test("createSession sets cookie with correct security options", async () => {
  const { createSession } = await import("@/lib/auth");
  await createSession("user-1", "test@example.com");

  const [, , options] = mockCookieSet.mock.calls[0];
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});
