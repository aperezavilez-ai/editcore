#!/usr/bin/env node
/**
 * Reemplaza textos visibles de VS Code / Visual Studio por EditCore.
 * Ejecutar despues de compilar y sobre el portable empaquetado.
 */
const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
	['Visual Studio Code - Insiders', 'EditCore'],
	['Visual Studio Code', 'EditCore'],
	['Code - OSS Dev', 'EditCore'],
	['Code - OSS', 'EditCore'],
	['bundled with EditCore', 'included with EditCore'], // idempotent fix if run twice
	['bundled with Visual Studio Code', 'included with EditCore'],
	['Minimal (Visual Studio Code)', 'Minimal (EditCore)'],
	['Seti (Visual Studio Code)', 'Seti (EditCore)'],
	['Dark (Visual Studio)', 'Dark (EditCore)'],
	['Light (Visual Studio)', 'Light (EditCore)'],
	['The default Visual Studio light and dark themes', 'The default EditCore light and dark themes'],
	['theme for Visual Studio Code', 'theme for EditCore'],
	['in Visual Studio Code', 'in EditCore'],
	['Visual Studio Code\'s', 'EditCore\'s'],
	['Updating Visual Studio Code', 'Updating EditCore'],
	['Switch to Ctrl+Click for Multi-Cursor', 'Switch to Ctrl+Click for Multi-Caret'],
	['Switch to Cmd+Click for Multi-Cursor', 'Switch to Cmd+Click for Multi-Caret'],
	['Switch to Alt+Click for Multi-Cursor', 'Switch to Alt+Click for Multi-Caret'],
	['Toggle Multi-Cursor Modifier', 'Toggle Multi-Caret Modifier'],
	['Add C&&ursors to Line Ends', 'Add C&&arets to Line Ends'],
	['Add Cursors to Line Ends', 'Add Carets to Line Ends'],
	['Add Cursors to Bottom', 'Add Carets to Bottom'],
	['Add Cursors to Top', 'Add Carets to Top'],
	['A&&dd Cursor Below', 'A&&dd Caret Below'],
	['&&Add Cursor Above', '&&Add Caret Above'],
	['Add Cursor Below', 'Add Caret Below'],
	['Add Cursor Above', 'Add Caret Above'],
	['Focus Previous Cursor', 'Focus Previous Caret'],
	['Focus Next Cursor', 'Focus Next Caret'],
	['Focuses the previous cursor', 'Focuses the previous caret'],
	['Focuses the next cursor', 'Focuses the next caret'],
	['Cursors added:', 'Carets added:'],
	['Cursor added:', 'Caret added:'],
	['Multi-Cursor', 'Multi-Caret'],
].sort((a, b) => b[0].length - a[0].length);

const TEXT_EXTENSIONS = new Set([
	'.json', '.js', '.ts', '.md', '.isl', '.txt', '.html', '.xml', '.css', '.nls.json',
]);

const SKIP_DIRS = new Set([
	'node_modules', '.git', '.build', 'test', 'colorize-tests', 'colorize-fixtures',
]);

const FORBIDDEN_UI = [
	'Visual Studio Code',
	'Code - OSS',
	'Add Cursor Above',
	'Add Cursor Below',
	'Multi-Cursor',
];

function shouldProcessFile(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	const base = path.basename(filePath);
	if (base.endsWith('.map')) {
		return false;
	}
	if (TEXT_EXTENSIONS.has(ext) || base === 'package.nls.json') {
		return true;
	}
	return false;
}

function rebrandContent(content) {
	let out = content;
	for (const [from, to] of REPLACEMENTS) {
		if (out.includes(from)) {
			out = out.split(from).join(to);
		}
	}
	return out;
}

function walk(dir, onFile) {
	if (!fs.existsSync(dir)) {
		return;
	}
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (SKIP_DIRS.has(entry.name)) {
			continue;
		}
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, onFile);
		} else if (shouldProcessFile(full)) {
			onFile(full);
		}
	}
}

function rebrandFile(file) {
	if (!fs.existsSync(file) || !shouldProcessFile(file)) {
		return false;
	}
	const content = fs.readFileSync(file, 'utf8');
	const next = rebrandContent(content);
	if (next !== content) {
		fs.writeFileSync(file, next, 'utf8');
		return true;
	}
	return false;
}

function rebrandTree(root, label) {
	let changed = 0;
	walk(root, (file) => {
		const content = fs.readFileSync(file, 'utf8');
		const next = rebrandContent(content);
		if (next !== content) {
			fs.writeFileSync(file, next, 'utf8');
			changed++;
		}
	});
	console.log(`${label}: ${changed} archivos actualizados`);
	return changed;
}

function scanForbidden(filePath) {
	if (!fs.existsSync(filePath)) {
		return [];
	}
	const content = fs.readFileSync(filePath, 'utf8');
	return FORBIDDEN_UI.filter((needle) => content.includes(needle));
}

function main() {
	const projectRoot = path.resolve(process.argv[2] || path.join(__dirname, '..'));
	const checkOnly = process.argv.includes('--check');
	const repo = path.join(projectRoot, 'editcore-src');
	const portable = path.join(projectRoot, 'VSCode-win32-x64');

	const targets = [
		[path.join(repo, 'extensions'), 'extensions'],
		[path.join(repo, 'src', 'vs', 'editor', 'contrib', 'multicursor'), 'multicursor-src'],
		[path.join(repo, 'src', 'vs', 'workbench', 'contrib', 'codeEditor'), 'codeEditor-src'],
		[path.join(repo, 'build', 'win32', 'i18n'), 'inno-i18n'],
		[path.join(portable, 'resources', 'app'), 'portable-app'],
	];

	const outFiles = [
		path.join(repo, 'out', 'nls.messages.json'),
		path.join(repo, 'out', 'nls.messages.js'),
		path.join(repo, 'out', 'vs', 'workbench', 'workbench.desktop.main.js'),
		path.join(repo, 'out', 'vs', 'sessions', 'sessions.desktop.main.js'),
		path.join(portable, 'resources', 'app', 'out', 'nls.messages.json'),
		path.join(portable, 'resources', 'app', 'out', 'nls.messages.js'),
		path.join(portable, 'resources', 'app', 'out', 'vs', 'workbench', 'workbench.desktop.main.js'),
		path.join(portable, 'resources', 'app', 'out', 'vs', 'sessions', 'sessions.desktop.main.js'),
	];

	if (checkOnly) {
		const nls = path.join(portable, 'resources', 'app', 'out', 'nls.messages.json');
		const hits = scanForbidden(nls);
		if (hits.length) {
			console.error(`BRANDING FAIL: aun aparece en nls.messages.json: ${hits.join(', ')}`);
			process.exit(1);
		}
		console.log('BRANDING OK: nls.messages.json sin textos prohibidos.');
		process.exit(0);
	}

	let total = 0;
	for (const [dir, label] of targets) {
		total += rebrandTree(dir, label);
	}
	let outChanged = 0;
	for (const file of outFiles) {
		if (rebrandFile(file)) {
			outChanged++;
		}
	}
	if (outChanged) {
		console.log(`out-bundle: ${outChanged} archivos actualizados`);
		total += outChanged;
	}

	const themeDefaults = path.join(repo, 'extensions', 'theme-defaults', 'package.nls.json');
	const themeSeti = path.join(repo, 'extensions', 'theme-seti', 'package.nls.json');
	for (const file of [themeDefaults, themeSeti]) {
		if (fs.existsSync(file)) {
			const content = fs.readFileSync(file, 'utf8');
			const next = rebrandContent(content);
			if (next !== content) {
				fs.writeFileSync(file, next, 'utf8');
				total++;
			}
		}
	}

	console.log(`\nRebrand EditCore: ${total} archivos modificados en total.`);

	const checksumScript = path.join(projectRoot, 'scripts', 'update-product-checksums.js');
	if (fs.existsSync(checksumScript)) {
		require('child_process').execFileSync('node', [checksumScript, projectRoot], { stdio: 'inherit' });
	}

	const nlsPortable = path.join(portable, 'resources', 'app', 'out', 'nls.messages.json');
	const remaining = scanForbidden(nlsPortable);
	if (remaining.length) {
		console.warn(`AVISO: aun quedan en portable: ${remaining.join(', ')} (recompilar para limpiar todo).`);
	} else if (fs.existsSync(nlsPortable)) {
		console.log('Portable nls.messages.json: sin textos prohibidos.');
	}
}

main();
