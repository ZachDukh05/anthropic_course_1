import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolInvocationBadge } from "../ToolInvocationBadge";

afterEach(() => {
  cleanup();
});

function makeInvocation(
  toolName: string,
  args: Record<string, unknown>,
  state: string = "result",
  result: unknown = "Success"
) {
  return { toolCallId: "test-id", toolName, args, state, result };
}

test("shows 'Creating file' for str_replace_editor create command", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/App.jsx" })}
    />
  );
  expect(screen.getByText("Creating file: App.jsx")).toBeDefined();
});

test("shows 'Editing file' for str_replace_editor str_replace command", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("str_replace_editor", { command: "str_replace", path: "/components/Button.jsx" })}
    />
  );
  expect(screen.getByText("Editing file: Button.jsx")).toBeDefined();
});

test("shows 'Editing file' for str_replace_editor insert command", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("str_replace_editor", { command: "insert", path: "/App.jsx" })}
    />
  );
  expect(screen.getByText("Editing file: App.jsx")).toBeDefined();
});

test("shows 'Reading file' for str_replace_editor view command", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("str_replace_editor", { command: "view", path: "/App.jsx" })}
    />
  );
  expect(screen.getByText("Reading file: App.jsx")).toBeDefined();
});

test("shows 'Undoing edit' for str_replace_editor undo_edit command", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("str_replace_editor", { command: "undo_edit", path: "/App.jsx" })}
    />
  );
  expect(screen.getByText("Undoing edit: App.jsx")).toBeDefined();
});

test("shows 'Deleting file' for file_manager delete command", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("file_manager", { command: "delete", path: "/App.jsx" })}
    />
  );
  expect(screen.getByText("Deleting file: App.jsx")).toBeDefined();
});

test("shows 'Renaming' for file_manager rename command", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("file_manager", { command: "rename", path: "/App.jsx", new_path: "/NewApp.jsx" })}
    />
  );
  expect(screen.getByText("Renaming: App.jsx")).toBeDefined();
});

test("shows green dot when done", () => {
  const { container } = render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/App.jsx" })}
    />
  );
  expect(container.querySelector(".bg-emerald-500")).toBeDefined();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("shows spinner when pending", () => {
  const { container } = render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("str_replace_editor", { command: "create", path: "/App.jsx" }, "call", undefined)}
    />
  );
  expect(container.querySelector(".animate-spin")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("falls back to raw toolName for unknown tool", () => {
  render(
    <ToolInvocationBadge
      toolInvocation={makeInvocation("some_unknown_tool", {})}
    />
  );
  expect(screen.getByText("some_unknown_tool")).toBeDefined();
});
