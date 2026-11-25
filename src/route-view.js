import { FLAGS, COUNTRY_NAME } from './countries.js';
import { ICONS, liftIcon } from './icons.js';
import { t, getLocale } from './i18n.js';
import { dedupeSteps, verticalChange } from './steps.js';

export { dedupeSteps, verticalChange };

export const DIFFICULTY_NAME_KEY = {
  green: 'common.difficultyGreen',
  blue:  'common.difficultyBlue',
  red:   'common.difficultyRed',
  black: 'common.difficultyBlack',
};

/**
 * Shared route-rendering helpers used by both <route-result> (search results)
 * and <route-detail> (the single-route page) so a piste split into several
 * graph edges by a routing junction, or a step's icon/flag/difficulty markup,
 * only has one implementation to keep in sync.
 */

function verticalHTML(step, nodes) {
  const d = verticalChange(step, nodes);
  if (d === null) return '';
  const metres = new Intl.NumberFormat(getLocale()).format(Math.abs(d));
  const descent = d < 0;
  return `
      <span class="step-vertical" aria-label="${t(descent ? 'route.descentAria' : 'route.ascentAria', { metres })}">
        <span class="step-vertical-icon" aria-hidden="true">${descent ? ICONS.descent : ICONS.ascent}</span>
        <span aria-hidden="true">${t('route.verticalMetres', { metres })}</span>
      </span>`;
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
    ? `<span class="diff-dot" data-d="${step.difficulty}" role="img" aria-label="${t('route.slopeAriaLabel', { difficulty: t(DIFFICULTY_NAME_KEY[step.difficulty] ?? '') })}"></span>`
    : `<span class="diff-dot diff-dot--lift" aria-hidden="true"></span>`;

  const diffAttr = step.type === 'slope' ? ` data-d="${step.difficulty}"` : '';

  return `
    <li class="route-step"${diffAttr}>
      <span class="step-icon" aria-hidden="true">${icon}</span>
      <span class="step-name">${step.name}</span>${verticalHTML(step, nodes)}
      <span class="step-flag" aria-label="${flagLabel}">${flag}</span>
      ${diffDot}
    </li>
  `;
}

/** Badge showing how many displayed steps match the active preferred difficulty, or '' if none. */
export function prefBadgeHTML(preferDifficulty, count) {
  if (!preferDifficulty || count <= 0) return '';
  const difficulty = t(DIFFICULTY_NAME_KEY[preferDifficulty] ?? '');
  return `
    <span class="route-pref-badge" aria-label="${t('route.prefBadgeAria', { count, difficulty })}">
      <span class="diff-dot" data-d="${preferDifficulty}" aria-hidden="true"></span>
      ${t('route.prefBadgeText', { count, difficulty })}
    </span>
  `;
}
