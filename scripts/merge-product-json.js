/**
 * Fusiona branding/product.json sobre el product.json de Code-OSS.
 * Los objetos se combinan en profundidad; arrays y primitivos del branding ganan.
 */
const fs = require('fs');
const path = require('path');

function readJson(filePath) {
	const raw = fs.readFileSync(path.resolve(filePath), 'utf8').replace(/^\uFEFF/, '');
	return JSON.parse(raw);
}

function mergeBuiltInExtensions(upstreamList, brandingList) {
	if (!Array.isArray(brandingList) || brandingList.length === 0) {
		return upstreamList;
	}
	const upstream = Array.isArray(upstreamList) ? [...upstreamList] : [];
	const names = new Set(upstream.map((ext) => ext.name));
	for (const ext of brandingList) {
		if (!names.has(ext.name)) {
			upstream.push(ext);
			names.add(ext.name);
		}
	}
	return upstream;
}

function mergeProduct(upstream, branding) {
	const result = { ...upstream };
	for (const key of Object.keys(branding)) {
		if (key.startsWith('_comment')) {
			result[key] = branding[key];
			continue;
		}
		const brandingValue = branding[key];
		const upstreamValue = upstream[key];
		if (key === 'builtInExtensions') {
			result[key] = mergeBuiltInExtensions(upstreamValue, brandingValue);
			continue;
		}
		if (
			brandingValue &&
			typeof brandingValue === 'object' &&
			!Array.isArray(brandingValue) &&
			upstreamValue &&
			typeof upstreamValue === 'object' &&
			!Array.isArray(upstreamValue)
		) {
			result[key] = mergeProduct(upstreamValue, brandingValue);
		} else {
			result[key] = brandingValue;
		}
	}
	return result;
}

const [upstreamPath, brandingPath, outputPath] = process.argv.slice(2);
if (!upstreamPath || !brandingPath || !outputPath) {
	console.error('Uso: node merge-product-json.js <upstream> <branding> <salida>');
	process.exit(1);
}

const upstream = readJson(upstreamPath);
const branding = readJson(brandingPath);
const merged = mergeProduct(upstream, branding);

fs.writeFileSync(path.resolve(outputPath), JSON.stringify(merged, null, '\t') + '\n', 'utf8');
console.log(`product.json fusionado -> ${outputPath}`);
