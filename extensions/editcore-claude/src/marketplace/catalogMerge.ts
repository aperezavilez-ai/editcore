import type { MarketplaceCatalog, MarketplaceItem } from './marketplaceService';

const PLAN_ORDER = ['free', 'pro', 'team', 'business', 'enterprise'] as const;

export function canInstallTier(userPlan: string, itemTier: string): boolean {
  const userIdx = PLAN_ORDER.indexOf(userPlan as (typeof PLAN_ORDER)[number]);
  const itemIdx = PLAN_ORDER.indexOf(itemTier as (typeof PLAN_ORDER)[number]);
  if (userIdx < 0 || itemIdx < 0) {
    return false;
  }
  return userIdx >= itemIdx;
}

export function mergeCatalogs(bundled: MarketplaceCatalog, remote?: MarketplaceCatalog): MarketplaceCatalog {
  if (!remote?.items?.length) {
    return bundled;
  }
  const byId = new Map<string, MarketplaceItem>();
  for (const item of bundled.items) {
    byId.set(item.id, item);
  }
  for (const item of remote.items) {
    byId.set(item.id, item);
  }
  return {
    version: Math.max(bundled.version, remote.version ?? 1),
    items: [...byId.values()],
  };
}

export function parseCatalogJson(raw: string): MarketplaceCatalog {
  const parsed = JSON.parse(raw) as MarketplaceCatalog;
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error('Catálogo inválido: falta array items');
  }
  return parsed;
}
