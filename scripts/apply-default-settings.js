/**
 * Fusiona branding/default-settings.json en el settings.json del usuario de EditCore (dev).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

function readJson(filePath) {
	if (!fs.existsSync(filePath)) {
		return {};
	}
	const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
	return raw ? JSON.parse(raw) : {};
}

const defaultsPath = process.argv[2];
const settingsPath = process.argv[3];
if (!defaultsPath || !settingsPath) {
	console.error('Uso: node apply-default-settings.js <defaults.json> <settings.json>');
	process.exit(1);
}

const defaults = readJson(path.resolve(defaultsPath));
const current = readJson(path.resolve(settingsPath));

// Claves que EditCore debe imponer (no dejar que settings viejos de Copilot las pisen).
const EDITCORE_FORCE_KEYS = [
	'workbench.startupEditor',
	'workbench.welcomePage.experimentalOnboarding',
	'chat.titleBar.signIn.enabled',
	'chat.agent.enabled',
	'chat.newSession.defaultMode',
	'chat.agentHost.enabled',
	'chat.agentsControl.enabled',
	'chat.unifiedAgentsBar.enabled',
	'chat.customizations.harnessSelector.enabled',
	'chat.extensionTools.enabled',
	'chat.generalPurposeAgent.enabled',
];

const merged = { ...defaults, ...current };
for (const key of EDITCORE_FORCE_KEYS) {
	if (key in defaults) {
		merged[key] = defaults[key];
	}
}
// Clave obsoleta que fuerza modo Ask con icono "?"
delete merged['chat.defaultNewSessionMode'];

fs.mkdirSync(path.dirname(path.resolve(settingsPath)), { recursive: true });
fs.writeFileSync(path.resolve(settingsPath), JSON.stringify(merged, null, 2) + '\n', 'utf8');
console.log(`settings fusionados -> ${settingsPath}`);
