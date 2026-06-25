/** @type {Array<{file:string,label:string,marker?:string,old:string,new:string}>} */
const PATCHES = [
  {
    file: 'src/vs/workbench/contrib/chat/common/chatModes.ts',
    label: 'import product para parches EditCore',
    marker: "import product from '../../../../platform/product/common/product.js'",
    old: `import { ICustomizationHarnessService } from './customizationHarnessService.js';
import { PromptFileSource, Target } from './promptSyntax/promptTypes.js';`,
    new: `import { ICustomizationHarnessService } from './customizationHarnessService.js';
import product from '../../../../platform/product/common/product.js';
import { PromptFileSource, Target } from './promptSyntax/promptTypes.js';`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/common/participants/chatAgents.ts',
    label: 'hasToolsAgent para participantes con modo Agent',
    marker: 'EditCore: default @claude (and similar) participants expose Agent mode',
    old: `\t\t\t\tif (agent.id === 'chat.setup' || agent.id === 'github.copilot.editsAgent') {
\t\t\t\t\t// TODO@roblourens firing the event below probably isn't necessary but leave it alone for now
\t\t\t\t\ttoolsAgentRegistered = true;
\t\t\t\t} else {
\t\t\t\t\tdefaultAgentRegistered = true;
\t\t\t\t}`,
    new: `\t\t\t\tif (agent.id === 'chat.setup' || agent.id === 'github.copilot.editsAgent') {
\t\t\t\t\t// TODO@roblourens firing the event below probably isn't necessary but leave it alone for now
\t\t\t\t\ttoolsAgentRegistered = true;
\t\t\t\t} else if (agent.modes.includes(ChatModeKind.Agent)) {
\t\t\t\t\t// EditCore: default @claude (and similar) participants expose Agent mode in the picker
\t\t\t\t\ttoolsAgentRegistered = true;
\t\t\t\t} else {
\t\t\t\t\tdefaultAgentRegistered = true;
\t\t\t\t}`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/common/participants/chatAgents.ts',
    label: 'hasToolsAgent siempre true en EditCore',
    marker: 'EditCore: @claude siempre expone modo Agent',
    old: `\tpublic get hasToolsAgent(): boolean {
\t\treturn !!this.configurationService.getValue(ChatConfiguration.AgentEnabled);
\t}`,
    new: `\tpublic get hasToolsAgent(): boolean {
\t\t// EditCore: @claude siempre expone modo Agent (UI estilo Cursor).
\t\tif (product.applicationName === 'editcore') {
\t\t\treturn true;
\t\t}
\t\treturn !!this.configurationService.getValue(ChatConfiguration.AgentEnabled);
\t}`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/common/chatModes.ts',
    label: 'ocultar modo Edit',
    marker: 'EditCore: UI estilo Cursor — solo Agent + Ask',
    old: `\t\tif (this.chatAgentService.hasToolsAgent || this.isAgentModeDisabledByPolicy()) {
\t\t\tbuiltinModes.unshift(ChatMode.Agent);
\t\t}
\t\tbuiltinModes.push(ChatMode.Edit);
\t\treturn builtinModes;`,
    new: `\t\tif (this.chatAgentService.hasToolsAgent || this.isAgentModeDisabledByPolicy()) {
\t\t\tbuiltinModes.unshift(ChatMode.Agent);
\t\t}
\t\t// EditCore: UI estilo Cursor — solo Agent + Ask, sin modo Edit.
\t\tif (product.applicationName !== 'editcore') {
\t\t\tbuiltinModes.push(ChatMode.Edit);
\t\t}
\t\treturn builtinModes;`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/common/chatModes.ts',
    label: 'sin agentes custom en picker',
    marker: 'EditCore: sin agentes custom en el picker',
    old: `\tprivate getCustomModes(): IChatMode[] {
\t\t// Show custom modes when agent mode is enabled OR when disabled by policy (to show them in the policy-managed group)
\t\treturn this.chatAgentService.hasToolsAgent || this.isAgentModeDisabledByPolicy() ? Array.from(this._customModeInstances.values()) : [];
\t}`,
    new: `\tprivate getCustomModes(): IChatMode[] {
\t\t// EditCore: sin agentes custom en el picker (evita menús Copilot).
\t\tif (product.applicationName === 'editcore') {
\t\t\treturn [];
\t\t}
\t\t// Show custom modes when agent mode is enabled OR when disabled by policy (to show them in the policy-managed group)
\t\treturn this.chatAgentService.hasToolsAgent || this.isAgentModeDisabledByPolicy() ? Array.from(this._customModeInstances.values()) : [];
\t}`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/promptSyntax/chatModeActions.ts',
    label: 'ocultar Configure Custom Agents',
    marker: 'EditCore: hide Copilot-style custom agent configuration',
    old: `export function registerAgentActions(): void {
\tregisterAction2(ManageAgentsAction);
\tregisterAction2(ManageAgentsActionDisabled);
\tregisterAction2(PickerConfigAgentAction);
\tregisterAction2(PickerConfigAgentActionDisabled);
}`,
    new: `export function registerAgentActions(): void {
\t// EditCore: hide Copilot-style custom agent configuration from the mode picker.
\tif (product.applicationName === 'editcore') {
\t\treturn;
\t}
\tregisterAction2(ManageAgentsAction);
\tregisterAction2(ManageAgentsActionDisabled);
\tregisterAction2(PickerConfigAgentAction);
\tregisterAction2(PickerConfigAgentActionDisabled);
}`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/actions/chatToolActions.ts',
    label: 'ocultar Configure Tools',
    marker: "product.applicationName !== 'editcore'",
    old: `\tstore.add(registerAction2(AcceptToolConfirmation));
\tstore.add(registerAction2(SkipToolConfirmation));
\tstore.add(registerAction2(ConfigureToolsAction));
\treturn store;`,
    new: `\tstore.add(registerAction2(AcceptToolConfirmation));
\tstore.add(registerAction2(SkipToolConfirmation));
\tif (product.applicationName !== 'editcore') {
\t\tstore.add(registerAction2(ConfigureToolsAction));
\t}
\treturn store;`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/input/modePickerActionItem.ts',
    label: 'picker minimal Agent+Ask',
    marker: 'EditCore: picker minimal estilo Cursor',
    old: `\t\t\tgetActions: () => {
\t\t\t\tconst modes = delegate.currentChatModes.get();
\t\t\t\tconst currentMode = delegate.currentMode.get();
\t\t\t\tconst agentMode = modes.builtin.find(mode => mode.id === ChatMode.Agent.id);

\t\t\t\tconst otherBuiltinModes = modes.builtin.filter(mode => {`,
    new: `\t\t\tgetActions: () => {
\t\t\t\tconst modes = delegate.currentChatModes.get();
\t\t\t\tconst currentMode = delegate.currentMode.get();
\t\t\t\tconst agentMode = modes.builtin.find(mode => mode.id === ChatMode.Agent.id);

\t\t\t\t// EditCore: picker minimal estilo Cursor → Agent + Ask solamente.
\t\t\t\tif (product.applicationName === 'editcore') {
\t\t\t\t\tconst askMode = modes.builtin.find(mode =>
\t\t\t\t\t\tmode.id === ChatMode.Ask.id || mode.name.get().toLowerCase() === 'ask');
\t\t\t\t\treturn coalesce([
\t\t\t\t\t\tagentMode && makeAction(agentMode, currentMode),
\t\t\t\t\t\taskMode && makeAction(askMode, currentMode),
\t\t\t\t\t]);
\t\t\t\t}

\t\t\t\tconst otherBuiltinModes = modes.builtin.filter(mode => {`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/input/modePickerActionItem.ts',
    label: 'sin action bar del mode picker',
    marker: 'EditCore: sin action bar del mode picker',
    old: `\tprivate getModePickerActionBarActions(): IAction[] {
\t\tconst menuActions = this.menuService.createMenu(MenuId.ChatModePicker, this.contextKeyService);`,
    new: `\tprivate getModePickerActionBarActions(): IAction[] {
\t\t// EditCore: sin action bar del mode picker
\t\tif (product.applicationName === 'editcore') {
\t\t\treturn [];
\t\t}
\t\tconst menuActions = this.menuService.createMenu(MenuId.ChatModePicker, this.contextKeyService);`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/input/modePickerActionItem.ts',
    label: 'label Agent en picker',
    marker: "localize('editcoreAgentPicker', \"Agent\")",
    old: `\t\tconst currentMode = this.delegate.currentMode.get();
\t\tlet state = currentMode.label.get();
\t\tlet icon = currentMode.icon.get();

\t\t// Every built-in mode should have an icon.`,
    new: `\t\tconst currentMode = this.delegate.currentMode.get();
\t\tlet state = currentMode.label.get();
\t\tlet icon = currentMode.icon.get();

\t\tif (product.applicationName === 'editcore' && currentMode.kind === ChatModeKind.Agent) {
\t\t\tstate = localize('editcoreAgentPicker', "Agent");
\t\t\ticon = Codicon.agent;
\t\t}

\t\t// Every built-in mode should have an icon.`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/input/modePickerActionItem.ts',
    label: 'ocultar Ask viejo con ?',
    marker: 'EditCore: nunca mostrar el Ask viejo',
    old: `function shouldShowBuiltInMode(mode: IChatMode, assignments: { showOldAskMode: boolean }, agentModeDisabledViaPolicy: boolean): boolean {
\t// The built-in "Edit" mode is deprecated`,
    new: `function shouldShowBuiltInMode(mode: IChatMode, assignments: { showOldAskMode: boolean }, agentModeDisabledViaPolicy: boolean): boolean {
\t// EditCore: nunca mostrar el Ask viejo con icono "?" — solo el Ask nuevo o Agent.
\tif (product.applicationName === 'editcore' && mode.id === ChatMode.Ask.id) {
\t\treturn false;
\t}

\t// The built-in "Edit" mode is deprecated`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts',
    label: 'modo Agent por defecto',
    marker: 'EditCore: modo Agent por defecto',
    old: `\t\tif (currentLevel === undefined || !isChatPermissionLevel(currentLevel)) {
\t\t\tthis.setPermissionLevel(this.getDefaultPermissionLevel());
\t\t}

\t\tif (this.entitlementService.anonymous) {`,
    new: `\t\tif (currentLevel === undefined || !isChatPermissionLevel(currentLevel)) {
\t\t\tthis.setPermissionLevel(this.getDefaultPermissionLevel());
\t\t}

\t\t// EditCore: modo Agent por defecto (UI estilo Cursor).
\t\tif (product.applicationName === 'editcore') {
\t\t\tthis.setChatMode(ChatModeKind.Agent, false);
\t\t\tthis.checkModelSupported();
\t\t\treturn;
\t\t}

\t\tif (this.entitlementService.anonymous) {`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts',
    label: 'no forzar Ask si Agent deshabilitado',
    marker: "product.applicationName !== 'editcore'",
    old: `\t\tif (currentMode.kind === ChatModeKind.Agent && !isAgentModeEnabled) {
\t\t\tthis.setChatMode(ChatModeKind.Ask);
\t\t\treturn;
\t\t}`,
    new: `\t\tif (currentMode.kind === ChatModeKind.Agent && !isAgentModeEnabled) {
\t\t\tif (product.applicationName !== 'editcore') {
\t\t\t\tthis.setChatMode(ChatModeKind.Ask);
\t\t\t}
\t\t\treturn;
\t\t}`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts',
    label: 'ocultar secondary toolbar',
    marker: "product.applicationName === 'editcore') {\n\t\t\tthis.secondaryToolbarContainer.style.display = 'none'",
    old: `\t\tif (this.options.renderStyle === 'compact') {
\t\t\tthis.secondaryToolbarContainer.style.display = 'none';
\t\t}`,
    new: `\t\tif (this.options.renderStyle === 'compact' || product.applicationName === 'editcore') {
\t\t\tthis.secondaryToolbarContainer.style.display = 'none';
\t\t}`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts',
    label: 'picker sin colapsar a ?',
    marker: 'EditCore: siempre mostrar texto "Agent"',
    old: `\t\tconst pickerOptions: IChatInputPickerOptions = {
\t\t\tgetOverflowAnchor: () => this.inputActionsToolbar.getElement(),
\t\t\tactionContext: { widget },
\t\t\tcompact: derived(reader => this._stableInputPartWidth.read(reader) < CHAT_INPUT_PICKER_COLLAPSE_WIDTH),
\t\t};`,
    new: `\t\tconst pickerOptions: IChatInputPickerOptions = {
\t\t\tgetOverflowAnchor: () => this.inputActionsToolbar.getElement(),
\t\t\tactionContext: { widget },
\t\t\t// EditCore: siempre mostrar texto "Agent" / "Auto" (estilo Cursor), sin colapsar a "?".
\t\t\tcompact: product.applicationName === 'editcore'
\t\t\t\t? constObservable(false)
\t\t\t\t: derived(reader => this._stableInputPartWidth.read(reader) < CHAT_INPUT_PICKER_COLLAPSE_WIDTH),
\t\t};`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts',
    label: 'toolbar minimal',
    marker: 'EditCore: barra minimal estilo Cursor',
    old: `\t\t\tactionViewItemProvider: (action, options) => {
\t\t\t\t// Phone-layout branch: when an agents-window phone presenter`,
    new: `\t\t\tactionViewItemProvider: (action, options) => {
\t\t\t\t// EditCore: barra minimal estilo Cursor (solo Agent + modelo).
\t\t\t\tif (product.applicationName === 'editcore') {
\t\t\t\t\tif (action.id === ConfigureToolsAction.ID
\t\t\t\t\t\t|| action.id === OpenSessionTargetPickerAction.ID
\t\t\t\t\t\t|| action.id === OpenDelegationPickerAction.ID
\t\t\t\t\t\t|| action.id === OpenWorkspacePickerAction.ID
\t\t\t\t\t\t|| action.id === OpenPermissionPickerAction.ID) {
\t\t\t\t\t\treturn new HiddenActionViewItem(action);
\t\t\t\t\t}
\t\t\t\t}

\t\t\t\t// Phone-layout branch: when an agents-window phone presenter`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts',
    label: 'skip generate agent instructions',
    marker: 'EditCore uses @claude — skip Copilot',
    old: `\t\t} else if (this._instructionFilesExist === false) {
\t\t\t// Show generate instructions message if no files exist
\t\t\treturn new MarkdownString(localize(`,
    new: `\t\t} else if (this._instructionFilesExist === false) {
\t\t\t// EditCore uses @claude — skip Copilot "Generate Agent Instructions" onboarding.
\t\t\tif (product.applicationName === 'editcore') {
\t\t\t\treturn new MarkdownString('');
\t\t\t}
\t\t\t// Show generate instructions message if no files exist
\t\t\treturn new MarkdownString(localize(`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts',
    label: 'welcome vacío estilo Cursor',
    marker: 'Pantalla vacía estilo Cursor',
    old: `\t\tlet title: string;
\t\tif (this.input.currentModeKind === ChatModeKind.Ask) {
\t\t\ttitle = localize('chatDescription', "Ask about your code");`,
    new: `\t\tlet title: string;
\t\tif (product.applicationName === 'editcore') {
\t\t\t// Pantalla vacía estilo Cursor: sin icono ni título "Ask" en el centro.
\t\t\treturn {
\t\t\t\ttitle: '',
\t\t\t\tmessage: new MarkdownString(''),
\t\t\t\tadditionalMessage,
\t\t\t};
\t\t} else if (this.input.currentModeKind === ChatModeKind.Ask) {
\t\t\ttitle = localize('chatDescription', "Ask about your code");`,
  },
  {
    file: 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts',
    label: 'icono agent en welcome',
    marker: "product.applicationName === 'editcore' && this.input.currentModeKind",
    old: `\t\treturn {
\t\t\ttitle,
\t\t\tmessage: new MarkdownString(DISCLAIMER),
\t\t\ticon: Codicon.chatSparkle,
\t\t\tadditionalMessage,
\t\t};`,
    new: `\t\treturn {
\t\t\ttitle,
\t\t\tmessage: product.applicationName === 'editcore' ? new MarkdownString('') : new MarkdownString(DISCLAIMER),
\t\t\ticon: product.applicationName === 'editcore' && this.input.currentModeKind === ChatModeKind.Agent ? Codicon.agent : Codicon.chatSparkle,
\t\t\tadditionalMessage,
\t\t};`,
  },
  {
    file: 'build/gulpfile.vscode.ts',
    label: 'win32ContextMenu opcional en empaquetado OSS',
    marker: 'EditCore: win32ContextMenu opcional',
    old: `\t\t\t\t.pipe(replace('@@FileExplorerContextMenuCLSID@@', (product as { win32ContextMenu?: Record<string, { clsid: string }> }).win32ContextMenu![arch].clsid))`,
    new: `\t\t\t\t.pipe(replace('@@FileExplorerContextMenuCLSID@@', (product as { win32ContextMenu?: Record<string, { clsid: string }> }).win32ContextMenu?.[arch]?.clsid ?? ''))`,
  },
  {
    file: 'build/win32/code.iss',
    label: 'branding instalador Windows EditCore',
    marker: 'EditCore: OutputBaseFilename',
    old: `AppPublisher=Microsoft Corporation
AppPublisherURL=https://code.visualstudio.com/
AppSupportURL=https://code.visualstudio.com/
AppUpdatesURL=https://code.visualstudio.com/
DefaultGroupName={#NameLong}
AllowNoIcons=yes
OutputDir={#OutputDir}
OutputBaseFilename=VSCodeSetup`,
    new: `AppPublisher=EditCore
AppPublisherURL=https://github.com/editcore/editcore
AppSupportURL=https://github.com/editcore/editcore/issues/new
AppUpdatesURL=https://github.com/editcore/editcore
DefaultGroupName={#NameLong}
AllowNoIcons=yes
OutputDir={#OutputDir}
#if "user" == InstallTarget
OutputBaseFilename=EditCoreUserSetup
#else
OutputBaseFilename=EditCoreSetup
#endif`,
  },
  {
    file: 'build/gulpfile.vscode.win32.ts',
    label: 'sin AppX en instalador EditCore OSS',
    marker: 'EditCore: sin AppX en setup',
    old: `\t\tif (quality === 'stable' || quality === 'insider') {
\t\t\tdefinitions['AppxPackage'] = \`\${quality === 'stable' ? 'code' : 'code_insider'}_\${arch}.appx\`;
\t\t\tdefinitions['AppxPackageDll'] = \`\${quality === 'stable' ? 'code' : 'code_insider'}_explorer_command_\${arch}.dll\`;
\t\t\tdefinitions['AppxPackageName'] = \`\${product.win32AppUserModelId}\`;
\t\t\tconst ctxMenu = (product as { win32ContextMenu?: Record<string, { clsid: string }> }).win32ContextMenu;
\t\t\tif (ctxMenu && ctxMenu[arch]) {
\t\t\t\tdefinitions['FileExplorerContextMenuCLSID'] = ctxMenu[arch].clsid;
\t\t\t}
\t\t}`,
    new: `\t\tif (quality === 'stable' || quality === 'insider') {
\t\t\t// EditCore OSS: sin paquetes AppX de Microsoft; instalador sin menú contextual Win11.
\t\t\tif (product.applicationName !== 'editcore') {
\t\t\t\tdefinitions['AppxPackage'] = \`\${quality === 'stable' ? 'code' : 'code_insider'}_\${arch}.appx\`;
\t\t\t\tdefinitions['AppxPackageDll'] = \`\${quality === 'stable' ? 'code' : 'code_insider'}_explorer_command_\${arch}.dll\`;
\t\t\t\tdefinitions['AppxPackageName'] = \`\${product.win32AppUserModelId}\`;
\t\t\t}
\t\t\tconst ctxMenu = (product as { win32ContextMenu?: Record<string, { clsid: string }> }).win32ContextMenu;
\t\t\tif (ctxMenu && ctxMenu[arch]) {
\t\t\t\tdefinitions['FileExplorerContextMenuCLSID'] = ctxMenu[arch].clsid;
\t\t\t}
\t\t}`,
  },
  {
    file: 'src/vs/workbench/workbench.common.main.ts',
    label: 'registrar onboardingService al arrancar',
    marker: 'EditCore: welcomeOnboarding habilitado',
    old: `// Welcome Onboarding
// import './contrib/welcomeOnboarding/browser/welcomeOnboarding.contribution.js';`,
    new: `// Welcome Onboarding
// EditCore: welcomeOnboarding habilitado — StartupPageRunner requiere IOnboardingService.
import './contrib/welcomeOnboarding/browser/welcomeOnboarding.contribution.js';`,
  },
  {
    file: 'build/gulpfile.vscode.win32.ts',
    label: 'inno-updater obligatorio antes del instalador',
    marker: 'EditCore: inno-updater antes de setup',
    old: `function defineWin32SetupTasks(arch: string, target: string) {
	const cleanTask = util.rimraf(setupDir(arch, target));
	task.task(task.define(\`vscode-win32-\${arch}-\${target}-setup\`, task.series(cleanTask, buildWin32Setup(arch, target))));
}`,
    new: `function ensureInnoUpdater(arch: string) {
	return task.series(copyInnoUpdater(arch), updateIcon(path.join(buildPath(arch), 'tools', 'inno_updater.exe')));
}

function defineWin32SetupTasks(arch: string, target: string) {
	const cleanTask = util.rimraf(setupDir(arch, target));
	// EditCore: code.iss exige VSCode-win32-*\\tools\\*; copiar inno_updater antes de compilar.
	task.task(task.define(\`vscode-win32-\${arch}-\${target}-setup\`, task.series(ensureInnoUpdater(arch), cleanTask, buildWin32Setup(arch, target))));
}`,
  },
  {
    file: 'src/vs/editor/contrib/multicursor/browser/multicursor.ts',
    label: 'multicursor UI sin palabra Cursor',
    marker: 'Add Caret Above',
    old: `\t\tlabel: nls.localize2('mutlicursor.insertAbove', "Add Cursor Above"),`,
    new: `\t\tlabel: nls.localize2('mutlicursor.insertAbove', "Add Caret Above"),`,
  },
  {
    file: 'src/vs/editor/contrib/multicursor/browser/multicursor.ts',
    label: 'menu Add Caret Above',
    old: `\t\t\t\ttitle: nls.localize({ key: 'miInsertCursorAbove', comment: ['&& denotes a mnemonic'] }, "&&Add Cursor Above"),`,
    new: `\t\t\t\ttitle: nls.localize({ key: 'miInsertCursorAbove', comment: ['&& denotes a mnemonic'] }, "&&Add Caret Above"),`,
  },
  {
    file: 'src/vs/editor/contrib/multicursor/browser/multicursor.ts',
    label: 'Add Caret Below label',
    old: `\t\tlabel: nls.localize2('mutlicursor.insertBelow', "Add Cursor Below"),`,
    new: `\t\tlabel: nls.localize2('mutlicursor.insertBelow', "Add Caret Below"),`,
  },
  {
    file: 'src/vs/editor/contrib/multicursor/browser/multicursor.ts',
    label: 'menu Add Caret Below',
    old: `\t\t\t\ttitle: nls.localize({ key: 'miInsertCursorBelow', comment: ['&& denotes a mnemonic'] }, "A&&dd Cursor Below"),`,
    new: `\t\t\t\ttitle: nls.localize({ key: 'miInsertCursorBelow', comment: ['&& denotes a mnemonic'] }, "A&&dd Caret Below"),`,
  },
  {
    file: 'src/vs/editor/contrib/multicursor/browser/multicursor.ts',
    label: 'Add Carets to Line Ends',
    old: `\t\tlabel: nls.localize2('mutlicursor.insertAtEndOfEachLineSelected', "Add Cursors to Line Ends"),`,
    new: `\t\tlabel: nls.localize2('mutlicursor.insertAtEndOfEachLineSelected', "Add Carets to Line Ends"),`,
  },
  {
    file: 'src/vs/editor/contrib/multicursor/browser/multicursor.ts',
    label: 'menu Add Carets to Line Ends',
    old: `\t\t\t\ttitle: nls.localize({ key: 'miInsertCursorAtEndOfEachLineSelected', comment: ['&& denotes a mnemonic'] }, "Add C&&ursors to Line Ends"),`,
    new: `\t\t\t\ttitle: nls.localize({ key: 'miInsertCursorAtEndOfEachLineSelected', comment: ['&& denotes a mnemonic'] }, "Add C&&arets to Line Ends"),`,
  },
  {
    file: 'src/vs/editor/contrib/multicursor/browser/multicursor.ts',
    label: 'announce Caret added',
    old: `\t\tconst msg = cursorDiff.length === 1 ? nls.localize('cursorAdded', "Cursor added: {0}", cursorPositions) : nls.localize('cursorsAdded', "Cursors added: {0}", cursorPositions);`,
    new: `\t\tconst msg = cursorDiff.length === 1 ? nls.localize('cursorAdded', "Caret added: {0}", cursorPositions) : nls.localize('cursorsAdded', "Carets added: {0}", cursorPositions);`,
  },
  {
    file: 'src/vs/workbench/contrib/codeEditor/browser/toggleMultiCursorModifier.ts',
    label: 'Toggle Multi-Caret Modifier',
    marker: 'Toggle Multi-Caret Modifier',
    old: `\t\t\ttitle: localize2('toggleLocation', 'Toggle Multi-Cursor Modifier'),`,
    new: `\t\t\ttitle: localize2('toggleLocation', 'Toggle Multi-Caret Modifier'),`,
  },
  {
    file: 'src/vs/workbench/contrib/codeEditor/browser/toggleMultiCursorModifier.ts',
    label: 'Switch Alt+Click Multi-Caret',
    old: `\t\ttitle: localize('miMultiCursorAlt', "Switch to Alt+Click for Multi-Cursor")`,
    new: `\t\ttitle: localize('miMultiCursorAlt', "Switch to Alt+Click for Multi-Caret")`,
  },
  {
    file: 'src/vs/workbench/contrib/codeEditor/browser/toggleMultiCursorModifier.ts',
    label: 'Switch Ctrl+Click Multi-Caret',
    old: `\t\t\t\t? localize('miMultiCursorCmd', "Switch to Cmd+Click for Multi-Cursor")
\t\t\t\t: localize('miMultiCursorCtrl', "Switch to Ctrl+Click for Multi-Cursor")`,
    new: `\t\t\t\t? localize('miMultiCursorCmd', "Switch to Cmd+Click for Multi-Caret")
\t\t\t\t: localize('miMultiCursorCtrl', "Switch to Ctrl+Click for Multi-Caret")`,
  },
  {
    file: 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts',
    label: 'no deshabilitar editcore-claude por chat setup',
    marker: 'EditCore: el chat con @claude es el núcleo del IDE',
    old: `\tprivate ensureChatExtensionInitialDisabledState(): void {
\t\tif (!this._chatExtensionId || this.environmentService.isSessionsWindow || this.environmentService.skipBuiltinExtensions?.some(id => id.toLowerCase() === this._chatExtensionId)) {
\t\t\treturn;
\t\t}

\t\tconst builtinChatExtensionEnablementMigrationKey = 'builtinChatExtensionEnablementMigration';`,
    new: `\tprivate ensureChatExtensionInitialDisabledState(): void {
\t\tif (!this._chatExtensionId || this.environmentService.isSessionsWindow || this.environmentService.skipBuiltinExtensions?.some(id => id.toLowerCase() === this._chatExtensionId)) {
\t\t\treturn;
\t\t}

\t\t// EditCore: el chat con @claude es el núcleo del IDE; no deshabilitar por "chat setup" de Copilot.
\t\tif (this._chatExtensionId === 'editcore.editcore-claude') {
\t\t\treturn;
\t\t}

\t\tconst builtinChatExtensionEnablementMigrationKey = 'builtinChatExtensionEnablementMigration';`,
  },
];

module.exports = { PATCHES };
