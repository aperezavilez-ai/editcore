import * as vscode from "vscode";

function actionHtml(title: string, button: string, hint: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: var(--vscode-font-family);
    background: var(--vscode-sideBar-background);
    color: var(--vscode-foreground);
    margin: 0; padding: 12px;
  }
  h2 { font-size: 13px; margin: 0 0 12px; }
  button {
    width: 100%; padding: 14px; border: none; border-radius: 6px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
  p { font-size: 11px; opacity: .7; margin-top: 10px; }
  .err { color: var(--vscode-errorForeground); font-size: 12px; margin-top: 8px; }
</style>
</head>
<body>
  <h2>${title}</h2>
  <button onclick="runAction()">${button}</button>
  <p>${hint}</p>
  <p class="err" id="err"></p>
<script>
  const vscode = acquireVsCodeApi();
  function runAction() {
    document.getElementById('err').textContent = '';
    vscode.postMessage({ type: 'run' });
  }
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'error') {
      document.getElementById('err').textContent = e.data.text;
    }
  });
</script>
</body>
</html>`;
}

export function registerSidebarActionView(
  context: vscode.ExtensionContext,
  viewId: string,
  run: () => Promise<void>,
  title: string,
  buttonLabel: string,
  hint: string,
  runOnOpen: boolean
): void {
  const invoke = async (webview?: vscode.Webview) => {
    try {
      await run();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      vscode.window.showErrorMessage(`EditCore: ${message}`);
      webview?.postMessage({ type: "error", text: message });
    }
  };

  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView(webviewView) {
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = actionHtml(title, buttonLabel, hint);

      webviewView.webview.onDidReceiveMessage((msg) => {
        if (msg.type === "run") {
          void invoke(webviewView.webview);
        }
      });

      if (runOnOpen) {
        webviewView.onDidChangeVisibility(() => {
          if (webviewView.visible) {
            void invoke(webviewView.webview);
          }
        });
      }
    },
  };

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(viewId, provider));
}
