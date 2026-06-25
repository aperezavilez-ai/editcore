import "vscode";

declare module "vscode" {
  export interface ChatContextItem {
    label?: string;
    resourceUri?: Uri;
    modelDescription?: string;
    tooltip?: string | MarkdownString;
    value?: string;
    icon?: ThemeIcon;
    command?: Command;
  }

  export interface ChatWorkspaceContextProvider {
    onDidChangeWorkspaceChatContext?: Event<void>;
    provideWorkspaceChatContext(
      token: CancellationToken
    ): ProviderResult<ChatContextItem[]>;
  }

  export namespace chat {
    export function registerChatWorkspaceContextProvider(
      id: string,
      provider: ChatWorkspaceContextProvider
    ): Disposable;
  }
}
