import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mock: next/navigation ────────────────────────────────────────────────────
// We capture the mock push function so individual tests can assert on it.
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── Mock: @/actions (signIn / signUp server actions) ─────────────────────────
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

// ── Mock: @/lib/anon-work-tracker ─────────────────────────────────────────────
vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

// ── Mock: @/actions/get-projects ─────────────────────────────────────────────
vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

// ── Mock: @/actions/create-project ───────────────────────────────────────────
vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

// ── Imports (after mocks are registered) ─────────────────────────────────────
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Reset every mock before each test so state never leaks between cases. */
beforeEach(() => {
  vi.clearAllMocks();
});

/** Convenience factory: a minimal project stub returned by createProject. */
const makeProject = (id = "proj-123") => ({
  id,
  name: "Test Project",
  createdAt: new Date(),
  updatedAt: new Date(),
  userId: "user-1",
  messages: "[]",
  data: "{}",
});

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe("useAuth", () => {
  // ── Initial state ──────────────────────────────────────────────────────────

  describe("initial state", () => {
    test("isLoading starts as false", () => {
      // The hook should not report loading until an async action is triggered
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  // ── signIn: happy paths ────────────────────────────────────────────────────

  describe("signIn", () => {
    test("returns the result from the server action on success", async () => {
      // signInAction resolves successfully; no anon work, no existing projects
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue(makeProject("new-proj"));

      const { result } = renderHook(() => useAuth());

      let returnValue: { success: boolean; error?: string } | undefined;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });

    test("calls signInAction with the provided email and password", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue(makeProject());

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("test@test.com", "mypassword");
      });

      expect(signInAction).toHaveBeenCalledOnce();
      expect(signInAction).toHaveBeenCalledWith("test@test.com", "mypassword");
    });

    test("isLoading is true while sign-in is in-flight", async () => {
      // Delay the server action so we can observe the loading state mid-flight
      let resolveSignIn!: (v: { success: boolean }) => void;
      const pendingSignIn = new Promise<{ success: boolean }>((res) => {
        resolveSignIn = res;
      });
      (signInAction as ReturnType<typeof vi.fn>).mockReturnValue(pendingSignIn);
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue(makeProject());

      const { result } = renderHook(() => useAuth());

      // Start the sign-in but do NOT await it yet
      let signInPromise: Promise<unknown>;
      act(() => {
        signInPromise = result.current.signIn("u@e.com", "pass1234");
      });

      // isLoading should be true right now
      expect(result.current.isLoading).toBe(true);

      // Resolve the server action and let the hook finish
      await act(async () => {
        resolveSignIn({ success: true });
        await signInPromise;
      });

      // After completion, isLoading must return to false
      expect(result.current.isLoading).toBe(false);
    });

    test("isLoading resets to false even when signInAction throws", async () => {
      // Simulate a network/server failure
      (signInAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        // The hook itself does not catch — the error should propagate
        await result.current.signIn("u@e.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when signInAction returns success:false", async () => {
      // A failed credential check must not redirect the user
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      let returnValue: { success: boolean; error?: string } | undefined;
      await act(async () => {
        returnValue = await result.current.signIn("bad@user.com", "wrongpass");
      });

      expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // ── signUp: happy paths ────────────────────────────────────────────────────

  describe("signUp", () => {
    test("returns the result from the server action on success", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue(makeProject("new-proj"));

      const { result } = renderHook(() => useAuth());

      let returnValue: { success: boolean; error?: string } | undefined;
      await act(async () => {
        returnValue = await result.current.signUp("new@user.com", "securepass");
      });

      expect(returnValue).toEqual({ success: true });
    });

    test("calls signUpAction with the provided email and password", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue(makeProject());

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("signup@test.com", "newpassword");
      });

      expect(signUpAction).toHaveBeenCalledOnce();
      expect(signUpAction).toHaveBeenCalledWith("signup@test.com", "newpassword");
    });

    test("isLoading resets to false even when signUpAction throws", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("u@e.com", "pass").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when signUpAction returns success:false", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@user.com", "pass1234");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  // ── Post sign-in navigation: anonymous work ────────────────────────────────

  describe("post sign-in: anonymous work exists", () => {
    const anonWork = {
      messages: [{ role: "user", content: "Make a button" }],
      fileSystemData: { "/App.jsx": { type: "file", content: "export default () => <div/>" } },
    };

    beforeEach(() => {
      // Both signIn and signUp succeed, and there is unsaved anonymous work
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(anonWork);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue(makeProject("anon-proj"));
    });

    test("creates a project with the anonymous work after signIn", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      // The anonymous content should be passed into createProject
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
    });

    test("navigates to the new project route after signIn", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      expect(mockPush).toHaveBeenCalledWith("/anon-proj");
    });

    test("clears the anonymous work from session storage after signIn", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      expect(clearAnonWork).toHaveBeenCalledOnce();
    });

    test("does NOT call getProjects when anonymous work is present", async () => {
      // getProjects is skipped entirely — the anon branch returns early
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      expect(getProjects).not.toHaveBeenCalled();
    });

    test("same behaviour (create project + navigate) triggered via signUp", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("u@e.com", "pass1234");
      });

      expect(createProject).toHaveBeenCalled();
      expect(clearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/anon-proj");
    });
  });

  // ── Post sign-in navigation: no anonymous work, existing projects ──────────

  describe("post sign-in: no anonymous work, user has existing projects", () => {
    beforeEach(() => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      // No anonymous work
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      // User already has two projects; the first (most recent) should be opened
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "recent-proj", name: "Recent" },
        { id: "old-proj", name: "Old" },
      ]);
    });

    test("navigates to the most-recent existing project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      expect(mockPush).toHaveBeenCalledWith("/recent-proj");
    });

    test("does not create a new project when existing projects exist", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      expect(createProject).not.toHaveBeenCalled();
    });
  });

  // ── Post sign-in navigation: no anonymous work, no existing projects ────────

  describe("post sign-in: no anonymous work, no existing projects", () => {
    beforeEach(() => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      // Empty project list — hook must create a brand-new project
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (createProject as ReturnType<typeof vi.fn>).mockResolvedValue(makeProject("fresh-proj"));
    });

    test("creates a new project with an empty messages and data payload", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      // The newly-created project should have no messages and an empty data object
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [],
          data: {},
        })
      );
    });

    test("navigates to the newly created project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      expect(mockPush).toHaveBeenCalledWith("/fresh-proj");
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    test("anonymous work with zero messages is treated as 'no anon work'", async () => {
      // The hook guards on anonWork.messages.length > 0; empty array must fall through
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
        messages: [],           // <-- zero messages
        fileSystemData: {},
      });
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "existing-proj", name: "Existing" },
      ]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      // Should fall through to the getProjects branch, not createProject
      expect(createProject).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-proj");
    });

    test("getAnonWorkData returning null is treated as 'no anon work'", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null); // explicit null
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "existing-proj", name: "Existing" },
      ]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("u@e.com", "pass1234");
      });

      expect(getProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-proj");
    });

    test("signIn and signUp operate independently — calling one does not affect the other", async () => {
      // Verify both functions can be called in sequence without cross-contamination
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Email exists" });
      (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
      (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "proj-1" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("a@a.com", "pass1234");
      });

      // Only signIn should have routed
      expect(mockPush).toHaveBeenCalledTimes(1);

      // signUp with a failure should not route
      await act(async () => {
        await result.current.signUp("b@b.com", "pass1234");
      });

      expect(mockPush).toHaveBeenCalledTimes(1); // unchanged
    });
  });
});
