import * as vscode from "vscode";
import {
  deployToVercel,
  getVercelProjectState,
  listVercelDomains,
  openIntegratedBrowser,
  storeLastDeployUrl,
} from "./vercelService";

export async function runVercelLink(
  context: vscode.ExtensionContext,
  cwd: string,
  token: string
): Promise<void> {
  const terminal = vscode.window.createTerminal({
    name: "EditCore — Vercel Link",
    cwd,
    env: { VERCEL_TOKEN: token },
  });
  terminal.show();
  terminal.sendText("vercel link");
  vscode.window.showInformationMessage(
    "EditCore: sigue los pasos en la terminal para vincular el proyecto a Vercel."
  );
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((t) => {
      if (t.name === "EditCore — Vercel Link") {
        void vscode.commands.executeCommand("editcoreConnect.refreshVercelStatus");
      }
    })
  );
}

export async function runVercelDeploy(
  context: vscode.ExtensionContext,
  cwd: string,
  token: string,
  panel?: { refreshVercel?: () => void }
): Promise<void> {
  const state = await getVercelProjectState(cwd, context);
  if (!state.linked) {
    const link = await vscode.window.showWarningMessage(
      "Este proyecto no está vinculado a Vercel (.vercel/ no existe). ¿Vincular primero?",
      "Vincular",
      "Deploy igual"
    );
    if (link === "Vincular") {
      await runVercelLink(context, cwd, token);
      return;
    }
  }

  const production = await vscode.window.showQuickPick(
    [
      { label: "Preview (deployment de prueba)", prod: false },
      { label: "Producción (--prod)", prod: true },
    ],
    { placeHolder: "Tipo de deploy en Vercel" }
  );
  if (!production) {
    return;
  }

  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Desplegando en Vercel...",
        cancellable: false,
      },
      () => deployToVercel(cwd, token, production.prod)
    );

    const deployUrl = result.urls[0];
    if (!deployUrl) {
      const showLog = await vscode.window.showWarningMessage(
        "Deploy terminado pero no se detectó URL en la salida. Revisa la terminal.",
        "Abrir Vercel Dashboard"
      );
      if (showLog === "Abrir Vercel Dashboard") {
        void vscode.env.openExternal(vscode.Uri.parse("https://vercel.com/dashboard"));
      }
      return;
    }

    await storeLastDeployUrl(context, cwd, deployUrl);
    panel?.refreshVercel?.();

    const action = await vscode.window.showInformationMessage(
      `EditCore: deploy listo — ${deployUrl}`,
      "Abrir en browser",
      "Copiar URL"
    );
    if (action === "Abrir en browser") {
      await openIntegratedBrowser(deployUrl);
    } else if (action === "Copiar URL") {
      await vscode.env.clipboard.writeText(deployUrl);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`Deploy Vercel falló: ${msg}`);
  }
}

export async function openLastVercelDeploy(
  context: vscode.ExtensionContext,
  cwd: string
): Promise<void> {
  const state = await getVercelProjectState(cwd, context);
  if (state.lastDeployUrl) {
    await openIntegratedBrowser(state.lastDeployUrl);
    return;
  }
  vscode.window.showWarningMessage(
    "No hay URL de deploy guardada. Haz un deploy primero desde EditCore Connect."
  );
}

export async function showVercelDomainsGuide(
  context: vscode.ExtensionContext,
  cwd: string,
  token: string
): Promise<void> {
  const state = await getVercelProjectState(cwd, context);
  const domains = state.linked ? await listVercelDomains(cwd, token) : [];

  const lines = [
    "## Dominio propio en Vercel",
    "",
    state.linked
      ? `Proyecto vinculado: **${state.projectName ?? state.projectId ?? "sí"}**`
      : "**Proyecto no vinculado** — usa «Vincular proyecto» antes.",
    "",
    "### Pasos",
    "1. Haz deploy a producción (--prod).",
    "2. En [Vercel → Settings → Domains](https://vercel.com/dashboard) añade tu dominio.",
    "3. En tu registrador (Cloudflare, GoDaddy, etc.) configura el DNS que indique Vercel:",
    "   - **CNAME** `www` → `cname.vercel-dns.com`",
    "   - **A** raíz `@` → IP que muestre Vercel (o usa nameservers de Vercel)",
    "4. Espera propagación DNS (minutos a 48 h).",
    "",
  ];

  if (domains.length > 0) {
    lines.push("### Dominios detectados en este proyecto", "", ...domains.map((d) => `- ${d}`));
  } else if (state.lastDeployUrl) {
    lines.push(`### URL actual`, "", state.lastDeployUrl);
  }

  const doc = await vscode.workspace.openTextDocument({
    content: lines.join("\n"),
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}
