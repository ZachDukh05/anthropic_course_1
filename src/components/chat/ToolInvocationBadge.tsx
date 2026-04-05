import { Loader2 } from "lucide-react";

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: string;
  result?: unknown;
}

interface ToolInvocationBadgeProps {
  toolInvocation: ToolInvocation;
}

function getLabel(toolName: string, args: Record<string, unknown>): string {
  const command = args.command as string | undefined;
  const path = args.path as string | undefined;
  const filename = path ? path.split("/").pop() ?? path : undefined;

  if (toolName === "str_replace_editor" && filename) {
    switch (command) {
      case "create":
        return `Creating file: ${filename}`;
      case "str_replace":
      case "insert":
        return `Editing file: ${filename}`;
      case "view":
        return `Reading file: ${filename}`;
      case "undo_edit":
        return `Undoing edit: ${filename}`;
    }
  }

  if (toolName === "file_manager" && filename) {
    switch (command) {
      case "rename":
        return `Renaming: ${filename}`;
      case "delete":
        return `Deleting file: ${filename}`;
    }
  }

  return toolName;
}

export function ToolInvocationBadge({ toolInvocation }: ToolInvocationBadgeProps) {
  const { toolName, args, state, result } = toolInvocation;
  const isDone = state === "result" && result != null;
  const label = getLabel(toolName, args);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
