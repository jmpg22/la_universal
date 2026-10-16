import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Cliente compartido de Claude (bot de WhatsApp y traducciones).
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;

export function anthropic() {
  // Las claves que no pertenecen a un workspace necesitan indicar cuál usar.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;
  client ??= new Anthropic(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {});
  return client;
}

export function isClaudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
