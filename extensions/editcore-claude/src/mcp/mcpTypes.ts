export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface McpToolDefinition {
  server: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpToolCallResult {
  content: string;
  isError: boolean;
}
