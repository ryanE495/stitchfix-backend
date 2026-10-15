import type { FbGroup, FbRegion, FbRotation } from './types';

/**
 * Helpers for adding a Facebook group by hand. Pure, so they're testable.
 */

/**
 * Canonical group URL: https://www.facebook.com/groups/<id-or-slug>.
 *
 * Strips sub-pages (/about, /buy_sell_discussion), query strings
 * (?action_source=...) and trailing slashes, so the same group pasted from
 * two different pages still hits the unique constraint instead of slipping
 * in twice. Same rule the CSV import used. Returns null for anything that
 * isn't a facebook.com group link.
 */
export function canonicalGroupUrl(raw: string): string | null {
  const m = raw.trim().match(/facebook\.com\/groups\/([^/?#\s]+)/i);
  return m ? `https://www.facebook.com/groups/${m[1]}` : null;
}

/**
 * Region guess from the group's name, using the same town list the import
 * used (Delta County boards file under Ouray/Montrose/San Miguel, as in the
 * original sheet). Only a starting value -- the form lets you change it.
 */
export function guessRegion(name: string): FbRegion {
  if (/ouray|ridgway|montrose|telluride|olathe|delta|paonia|crawford|cedaredge|surface creek|silverton|san juan|norwood|naturita/i.test(name))
    return 'ouray_montrose_san_miguel';
  if (/grand junction|\bgj\b|palisade|clifton|fruita|parachute|battlement|debeque|de beque|mesa/i.test(name))
    return 'grand_junction';
  return 'other';
}

/**
 * The rotation that keeps this region evenly split between A and B, counting
 * active groups only. Ties go to A. Saves running Auto-balance after every
 * addition.
 */
export function suggestRotation(groups: FbGroup[], region: FbRegion): FbRotation {
  let a = 0;
  let b = 0;
  for (const g of groups) {
    if (g.status !== 'active' || g.region !== region) continue;
    if (g.rotation === 'A') a++;
    else b++;
  }
  return b < a ? 'B' : 'A';
}
