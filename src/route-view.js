import { FLAGS, COUNTRY_NAME } from './countries.js';
import { ICONS, liftIcon } from './icons.js';

/**
 * Shared route-rendering helpers used by both <route-result> (search results)
 * and <route-detail> (the single-route page) so a piste split into several
 * graph edges by a routing junction, or a step's icon/flag/difficulty markup,
 * only has one implementation to keep in sync.
 */

/** Collapses consecutive steps that are actually the same piste split by a routing junction. */
export function dedupeSteps(steps, nodes) {
  return steps.filter((s, i, arr) => {
    if (i === 0) return true;
    const p = arr[i - 1];
    const sCountry = nodes.get(s.from)?.country ?? null;
    const pCountry = nodes.get(p.from)?.country ?? null;
    return !(s.name === p.name && sCountry === pCountry && s.difficulty === p.difficulty);
  });
}

export function stepHTML(step, nodes) {
  const country   = nodes.get(step.from)?.country ?? null;
  const flag      = country ? FLAGS[country] ?? '' : '';
  const flagLabel = country ? COUNTRY_NAME[country] ?? '' : '';
  const icon      = step.type === 'lift'
    ? liftIcon(nodes.get(step.from)?.lift_type)
    : ICONS.ski;

  // Difficulty dot only shown for slopes — lifts have no piste colour.
  const diffDot = step.type === 'slope'
    ? `<span class="diff-dot" data-d="${step.difficulty}" role="img" aria-label="${step.difficulty} slope"></span>`
    : `<span class="diff-dot diff-dot--lift" aria-hidden="true"></span>`;

  const diffAttr = step.type === 'slope' ? ` data-d="${step.difficulty}"` : '';

  return `
    <li class="route-step"${diffAttr}>
      <span class="step-icon" aria-hidden="true">${icon}</span>
      <span class="step-name">${step.name}</span>
      <span class="step-flag" aria-label="${flagLabel}">${flag}</span>
      ${diffDot}
    </li>
  `;
}

/** Badge showing how many displayed steps match the active preferred difficulty, or '' if none. */
export function prefBadgeHTML(preferDifficulty, count) {
  if (!preferDifficulty || count <= 0) return '';
  return `
    <span class="route-pref-badge" aria-label="${count} ${preferDifficulty} steps">
      <span class="diff-dot" data-d="${preferDifficulty}" aria-hidden="true"></span>
      ${count} ${preferDifficulty}
    </span>
  `;
}
