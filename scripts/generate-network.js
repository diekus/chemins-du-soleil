#!/usr/bin/env node
/**
 * Generates data/network.json (schema v2) from compact sector definitions.
 * Run: node scripts/generate-network.js
 *
 * Model:
 *   - Every named lift produces two nodes: {slug}-base and {slug}-top
 *   - lift-base → lift-top  : type "lift",  difficulty "green"
 *   - lift-top  → junction  : type "slope", difficulty per lift's descentDiff
 *   - junction  → lift-base : type "slope", difficulty "green"
 *   - Village nodes connect to their sector junction
 *   - Cross-sector edges are declared explicitly
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── helpers ───────────────────────────────────────────────────────────────────
function liftTypeCode(t) {
  switch (t) {
    case 'TC':  return 'telecabin';
    case 'TPH': return 'gondola';
    case 'TSD': return 'chairlift';
    case 'TSF': return 'chairlift';
    case 'TK':  return 'surface';
    default:    return 'chairlift';
  }
}

// ── sector definitions ────────────────────────────────────────────────────────
// Each lift: { slug, name, typeCode, junction, descentDiff }
//   slug        — kebab ID prefix (base = slug+"-base", top = slug+"-top")
//   name        — display name
//   typeCode    — TC | TPH | TSD | TSF | TK
//   junction    — ID of the junction/village this lift connects to at the top
//   descentDiff — difficulty of the slope from top back to junction ("green"|"blue"|"red"|"black")
//   baseFrom    — ID of node the base is reached from (default: sector village)
//   baseFromDiff— slope difficulty from that node to this lift's base (default "green")

const sectors = [

  // ── MORZINE ──────────────────────────────────────────────────────────────
  {
    id: 'morzine',
    country: 'FR',
    village: 'morzine-village',
    villageLabel: 'Morzine',
    junction: 'morzine-pleney-junction',
    junctionLabel: 'Morzine – Pleney area',
    lifts: [
      { slug: 'tc-pleney',         name: 'TC Pleney',         typeCode: 'TC',  junction: 'morzine-pleney-junction', descentDiff: 'blue'  },
      { slug: 'tc-super-morzine',  name: 'TC Super Morzine',  typeCode: 'TC',  junction: 'super-morzine-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-nyon',          name: 'TSF Nyon',          typeCode: 'TSF', junction: 'ranfoilly-junction',      descentDiff: 'red',   baseFrom: 'morzine-pleney-junction', baseFromDiff: 'green' },
      { slug: 'tsd-ranfoilly-express', name: 'TSD Ranfoilly Express', typeCode: 'TSD', junction: 'ranfoilly-junction', descentDiff: 'blue', baseFrom: 'morzine-pleney-junction', baseFromDiff: 'green' },
      { slug: 'tsf-troncs-express', name: 'TSF Troncs Express', typeCode: 'TSF', junction: 'super-morzine-junction', descentDiff: 'blue', baseFrom: 'super-morzine-junction', baseFromDiff: 'green' },
    ],
  },

  // ── LES GETS ─────────────────────────────────────────────────────────────
  {
    id: 'les-gets',
    country: 'FR',
    village: 'les-gets-village',
    villageLabel: 'Les Gets',
    junction: 'les-gets-chavannes-junction',
    junctionLabel: 'Les Gets – Chavannes',
    lifts: [
      { slug: 'tsf-chavannes',      name: 'TSF Chavannes',      typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-grand-cry',      name: 'TSF Grand Cry',      typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-tete-des-crets', name: 'TSF Tête des Crêts', typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-grains-dor',     name: "TSF Grains d'Or",    typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-mouilles',       name: 'TSF Mouilles',       typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-bouchet',        name: 'TSF Bouchet',        typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-mas-verjus',     name: 'TSF Mas Verjus',     typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-pre-favre',      name: 'TSF Pré-Favre',      typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-la-rosta',       name: 'TSF La Rosta',       typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-perrieres',      name: 'TSF Pérrières',      typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-turche',         name: 'TSF Turche',         typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-les-planeys',    name: 'TSF Les Planeys',    typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'blue'  },
      { slug: 'tsf-pointe',         name: 'TSF Pointe',         typeCode: 'TSF', junction: 'les-gets-chavannes-junction', descentDiff: 'red'   },
      // Mont Chéry — separate mountain, own junction
      { slug: 'tsf-mont-chery',     name: 'TSF Mont Chéry',     typeCode: 'TSF', junction: 'mont-chery-junction',        descentDiff: 'red'   },
    ],
  },

  // ── AVORIAZ ───────────────────────────────────────────────────────────────
  {
    id: 'avoriaz',
    country: 'FR',
    village: 'avoriaz-village',
    villageLabel: 'Avoriaz',
    junction: 'avoriaz-junction',
    junctionLabel: 'Avoriaz upper area',
    lifts: [
      { slug: 'tc-prodains-express',   name: 'TC Prodains Express',   typeCode: 'TC',  junction: 'avoriaz-village',          descentDiff: 'blue',  baseFrom: 'les-prodains-village', baseFromDiff: 'green' },
      { slug: 'tsd-chamossiere-express', name: 'TSD Chamossière Express', typeCode: 'TSD', junction: 'avoriaz-junction',     descentDiff: 'red'   },
      { slug: 'tsd-charniaz-express',  name: 'TSD Charniaz Express',  typeCode: 'TSD', junction: 'avoriaz-junction',          descentDiff: 'blue'  },
      { slug: 'tsf-chaux-fleurie',     name: 'TSF Chaux Fleurie',     typeCode: 'TSF', junction: 'avoriaz-junction',          descentDiff: 'blue'  },
      { slug: 'tsf-seraussaix',        name: 'TSF Séraussaix',        typeCode: 'TSF', junction: 'avoriaz-junction',          descentDiff: 'blue'  },
    ],
  },

  // ── LES LINDARETS ─────────────────────────────────────────────────────────
  {
    id: 'les-lindarets',
    country: 'FR',
    village: 'les-lindarets-village',
    villageLabel: 'Les Lindarets',
    junction: 'les-lindarets-junction',
    junctionLabel: 'Les Lindarets',
    lifts: [
      { slug: 'tc-lindarets',          name: 'TC Lindarets',          typeCode: 'TC',  junction: 'avoriaz-village',          descentDiff: 'green', baseFrom: 'les-lindarets-junction', baseFromDiff: 'green' },
      { slug: 'tsd-mossettes-express', name: 'TSD Mossettes Express', typeCode: 'TSD', junction: 'pointe-de-mossettes-junction', descentDiff: 'blue', baseFrom: 'les-lindarets-junction', baseFromDiff: 'green' },
      { slug: 'tsd-chavannes-express', name: 'TSD Chavannes Express', typeCode: 'TSD', junction: 'les-gets-chavannes-junction', descentDiff: 'blue', baseFrom: 'les-lindarets-junction', baseFromDiff: 'green' },
      { slug: 'tsf-arare',             name: 'TSF Arare',             typeCode: 'TSF', junction: 'avoriaz-village',          descentDiff: 'blue',  baseFrom: 'les-lindarets-junction', baseFromDiff: 'green' },
      { slug: 'tsf-hauts-forts',       name: 'TSF Hauts-Forts',       typeCode: 'TSF', junction: 'les-lindarets-junction',   descentDiff: 'black', baseFrom: 'les-lindarets-junction', baseFromDiff: 'green' },
      { slug: 'tsf-grandes-combes',    name: 'TSF Grandes Combes',    typeCode: 'TSF', junction: 'les-lindarets-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-lechere',           name: 'TSF Léchère',           typeCode: 'TSF', junction: 'les-lindarets-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-crusaz',            name: 'TSF Crusaz',            typeCode: 'TSF', junction: 'les-lindarets-junction',   descentDiff: 'blue'  },
    ],
  },

  // ── ARDENT / MONTRIOND ───────────────────────────────────────────────────
  {
    id: 'ardent',
    country: 'FR',
    village: 'ardent-village',
    villageLabel: 'Ardent',
    junction: 'les-lindarets-junction',
    junctionLabel: 'Les Lindarets',
    lifts: [
      { slug: 'tc-ardent', name: 'TC Ardent', typeCode: 'TC', junction: 'les-lindarets-junction', descentDiff: 'green', baseFrom: 'ardent-village', baseFromDiff: 'green' },
    ],
  },

  // ── SWISS: CHAMPÉRY / LES CROSETS / CHAMPOUSSIN / MORGINS ─────────────
  {
    id: 'rddm',
    country: 'CH',
    village: 'les-crosets-junction',
    villageLabel: 'Les Crosets',
    junction: 'les-crosets-junction',
    junctionLabel: 'Les Crosets',
    lifts: [
      { slug: 'tph-champery',          name: 'TPH Champéry',          typeCode: 'TPH', junction: 'les-crosets-junction',  descentDiff: 'blue',  baseFrom: 'champery', baseFromDiff: 'green' },
      { slug: 'tsd-grand-paradis',     name: 'TSD Grand Paradis',     typeCode: 'TSD', junction: 'les-crosets-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-croix-de-culet',    name: 'TSF Croix de Culet',    typeCode: 'TSF', junction: 'les-crosets-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-foilleuse',         name: 'TSF Foilleuse',         typeCode: 'TSF', junction: 'morgins-junction',      descentDiff: 'blue',  baseFrom: 'les-crosets-junction', baseFromDiff: 'green' },
      { slug: 'tsf-pointe-de-lau',     name: "TSF Pointe de l'Au",    typeCode: 'TSF', junction: 'champoussin-junction',  descentDiff: 'blue',  baseFrom: 'les-crosets-junction', baseFromDiff: 'green' },
      { slug: 'tsf-mossettes-suisse',  name: 'TSF Mossettes Suisse',  typeCode: 'TSF', junction: 'pointe-de-mossettes-junction', descentDiff: 'red', baseFrom: 'les-crosets-junction', baseFromDiff: 'green' },
      { slug: 'tsf-prolays',           name: 'TSF Prolays',           typeCode: 'TSF', junction: 'les-crosets-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-proclou',           name: 'TSF Proclou',           typeCode: 'TSF', junction: 'les-crosets-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-cubore',            name: 'TSF Cuboré',            typeCode: 'TSF', junction: 'les-crosets-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-marcheuson',        name: 'TSF Marcheuson',        typeCode: 'TSF', junction: 'les-crosets-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-chavanette',        name: 'TSF Chavanette',        typeCode: 'TSF', junction: 'les-crosets-junction',  descentDiff: 'black' },
    ],
  },

  // ── MORGINS ───────────────────────────────────────────────────────────────
  {
    id: 'morgins',
    country: 'CH',
    village: 'morgins-village',
    villageLabel: 'Morgins',
    junction: 'morgins-junction',
    junctionLabel: 'Morgins ski area',
    lifts: [],
  },

  // ── CHAMPOUSSIN ───────────────────────────────────────────────────────────
  {
    id: 'champoussin',
    country: 'CH',
    village: 'champoussin-village',
    villageLabel: 'Champoussin',
    junction: 'champoussin-junction',
    junctionLabel: 'Champoussin ski area',
    lifts: [],
  },

  // ── CHÂTEL ────────────────────────────────────────────────────────────────
  {
    id: 'chatel',
    country: 'FR',
    village: 'chatel-village',
    villageLabel: 'Châtel',
    junction: 'super-chatel-junction',
    junctionLabel: 'Super-Châtel',
    lifts: [
      { slug: 'tc-super-chatel',        name: 'TC Super Châtel',        typeCode: 'TC',  junction: 'super-chatel-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-morclan',            name: 'TSF Morclan',            typeCode: 'TSF', junction: 'pre-la-joux-junction',   descentDiff: 'red',   baseFrom: 'super-chatel-junction', baseFromDiff: 'green' },
      { slug: 'tsf-pierre-longue',      name: 'TSF Pierre Longue',      typeCode: 'TSF', junction: 'super-chatel-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-portes-du-soleil-chatel', name: 'TSF Portes du Soleil', typeCode: 'TSF', junction: 'pre-la-joux-junction', descentDiff: 'blue', baseFrom: 'pre-la-joux-junction', baseFromDiff: 'green' },
      { slug: 'tsf-linga',              name: 'TSF Linga',              typeCode: 'TSF', junction: 'linga-junction',         descentDiff: 'red',   baseFrom: 'pre-la-joux-junction', baseFromDiff: 'green' },
      { slug: 'tsf-echo-alpin',         name: "TSF L'Écho Alpin",       typeCode: 'TSF', junction: 'pre-la-joux-junction',   descentDiff: 'blue',  baseFrom: 'pre-la-joux-junction', baseFromDiff: 'green' },
      { slug: 'tsf-cornebois',          name: 'TSF Cornebois',          typeCode: 'TSF', junction: 'linga-junction',         descentDiff: 'red',   baseFrom: 'pre-la-joux-junction', baseFromDiff: 'green' },
      { slug: 'tsf-rochassons',         name: 'TSF Rochassons',         typeCode: 'TSF', junction: 'super-chatel-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-coqs',               name: 'TSF Les Coqs',           typeCode: 'TSF', junction: 'super-chatel-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-pre-la-vieille',     name: 'TSF Pré la Vieille',     typeCode: 'TSF', junction: 'super-chatel-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-chalet-neuf',        name: 'TSF Chalet Neuf',        typeCode: 'TSF', junction: 'super-chatel-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-culet',              name: 'TSF Culet',              typeCode: 'TSF', junction: 'linga-junction',         descentDiff: 'blue',  baseFrom: 'pre-la-joux-junction', baseFromDiff: 'green' },
      { slug: 'tsf-ecottis',            name: 'TSF Ecottis',            typeCode: 'TSF', junction: 'super-chatel-junction',  descentDiff: 'blue'  },
      { slug: 'tsf-corbeau',            name: 'TSF Corbeau',            typeCode: 'TSF', junction: 'pre-la-joux-junction',   descentDiff: 'blue',  baseFrom: 'super-chatel-junction', baseFromDiff: 'green' },
      { slug: 'tsf-stade',              name: 'TSF Stade',              typeCode: 'TSF', junction: 'super-chatel-junction',  descentDiff: 'green' },
      { slug: 'tsf-gabelou',            name: 'TSF Gabelou',            typeCode: 'TSF', junction: 'super-chatel-junction',  descentDiff: 'green' },
      { slug: 'tsf-combes-chatel',      name: 'TSF Combes',             typeCode: 'TSF', junction: 'pre-la-joux-junction',   descentDiff: 'blue',  baseFrom: 'super-chatel-junction', baseFromDiff: 'green' },
      { slug: 'tsf-queyset',            name: 'TSF Queyset',            typeCode: 'TSF', junction: 'pre-la-joux-junction',   descentDiff: 'blue',  baseFrom: 'super-chatel-junction', baseFromDiff: 'green' },
      { slug: 'tsf-la-chaux-des-rosees', name: 'TSF La Chaux des Rosées', typeCode: 'TSF', junction: 'pre-la-joux-junction', descentDiff: 'blue', baseFrom: 'super-chatel-junction', baseFromDiff: 'green' },
      { slug: 'tsf-tour-de-don',        name: 'TSF Tour de Don',        typeCode: 'TSF', junction: 'pre-la-joux-junction',   descentDiff: 'blue',  baseFrom: 'super-chatel-junction', baseFromDiff: 'green' },
      { slug: 'tk-barbossine',          name: 'TK Barbossine',          typeCode: 'TK',  junction: 'super-chatel-junction',  descentDiff: 'green' },
      { slug: 'tk-conche-chatel',       name: 'TK Conche',              typeCode: 'TK',  junction: 'super-chatel-junction',  descentDiff: 'green' },
      { slug: 'tk-chermeu',             name: 'TK Chermeu',             typeCode: 'TK',  junction: 'super-chatel-junction',  descentDiff: 'green' },
      { slug: 'tk-chaux-longe',         name: 'TK Chaux Longe',         typeCode: 'TK',  junction: 'super-chatel-junction',  descentDiff: 'green' },
      { slug: 'tk-debutant-chatel',     name: 'TK Débutant',            typeCode: 'TK',  junction: 'super-chatel-junction',  descentDiff: 'green' },
      { slug: 'tk-poussin',             name: 'TK Poussin',             typeCode: 'TK',  junction: 'super-chatel-junction',  descentDiff: 'green' },
    ],
  },

  // ── LA CHAPELLE D'ABONDANCE ───────────────────────────────────────────────
  {
    id: 'la-chapelle',
    country: 'FR',
    village: 'la-chapelle-village',
    villageLabel: "La Chapelle d'Abondance",
    junction: 'la-chapelle-junction',
    junctionLabel: "La Chapelle – upper area",
    lifts: [
      { slug: 'tc-la-panthiaz', name: 'TC La Panthiaz', typeCode: 'TC',  junction: 'la-chapelle-junction', descentDiff: 'blue' },
      { slug: 'tsf-cret-beni',  name: 'TSF Crêt Béni',  typeCode: 'TSF', junction: 'la-chapelle-junction', descentDiff: 'blue', baseFrom: 'la-chapelle-junction', baseFromDiff: 'green' },
      { slug: 'tsf-onnaz',      name: 'TSF Onnaz',      typeCode: 'TSF', junction: 'la-chapelle-junction', descentDiff: 'blue' },
      { slug: 'tk-dahu',        name: 'TK Dahu',        typeCode: 'TK',  junction: 'la-chapelle-junction', descentDiff: 'green' },
      { slug: 'tk-bambi',       name: 'TK Bambi',       typeCode: 'TK',  junction: 'la-chapelle-junction', descentDiff: 'green' },
      { slug: 'tk-fontaines',   name: 'TK Fontaines',   typeCode: 'TK',  junction: 'la-chapelle-junction', descentDiff: 'green' },
      { slug: 'tk-pre-chapelle', name: 'TK Pré',        typeCode: 'TK',  junction: 'la-chapelle-junction', descentDiff: 'green' },
    ],
  },

  // ── TORGON ────────────────────────────────────────────────────────────────
  {
    id: 'torgon',
    country: 'CH',
    village: 'torgon-village',
    villageLabel: 'Torgon',
    junction: 'torgon-junction',
    junctionLabel: 'Torgon upper area',
    lifts: [
      { slug: 'tsf-tronchey',     name: 'TSF Tronchey',     typeCode: 'TSF', junction: 'torgon-junction',      descentDiff: 'blue'  },
      { slug: 'tsf-conche-2000',  name: 'TSF Conche 2000',  typeCode: 'TSF', junction: 'torgon-junction',      descentDiff: 'blue'  },
      { slug: 'tsf-braitaz',      name: 'TSF Braitaz',      typeCode: 'TSF', junction: 'torgon-junction',      descentDiff: 'blue'  },
      { slug: 'tk-djeu-des-tetes', name: 'TK Djeu des Têtes', typeCode: 'TK', junction: 'torgon-junction',    descentDiff: 'green' },
    ],
  },

  // ── SAINT-JEAN-D'AULPS ───────────────────────────────────────────────────
  {
    id: 'saint-jean',
    country: 'FR',
    village: 'saint-jean-village',
    villageLabel: "Saint-Jean-d'Aulps",
    junction: 'saint-jean-junction',
    junctionLabel: "Saint-Jean – Le Plateau",
    lifts: [
      { slug: 'tsf-chargeau',        name: 'TSF Chargeau',        typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-grande-terche',   name: 'TSF Grande Terche',   typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'red'   },
      { slug: 'tsf-les-tetes',       name: 'TSF Les Têtes',       typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-la-bray',         name: 'TSF La Bray',         typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-terchette',       name: 'TSF Terchette',       typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-les-lanches',     name: 'TSF Les Lanches',     typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-graydon',         name: 'TSF Graydon',         typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-graydon-bis',     name: 'TSF Graydon Bis',     typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-le-lac-sja',      name: 'TSF Le Lac',          typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-laigle',          name: "TSF L'Aigle",         typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-la-terche',       name: 'TSF La Terche',       typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-eterlou',         name: 'TSF Éterlou',         typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      { slug: 'tsf-chanterelle',     name: 'TSF Chanterelle',     typeCode: 'TSF', junction: 'saint-jean-junction',   descentDiff: 'blue'  },
      // La Chèvrerie sub-area
      { slug: 'tsf-le-chal',         name: 'TSF Le Châl',         typeCode: 'TSF', junction: 'chevrerie-junction',    descentDiff: 'blue'  },
      { slug: 'tsf-les-alpages',     name: 'TSF Les Alpages',     typeCode: 'TSF', junction: 'chevrerie-junction',    descentDiff: 'blue'  },
      { slug: 'tsf-la-savine',       name: 'TSF La Savine',       typeCode: 'TSF', junction: 'chevrerie-junction',    descentDiff: 'blue'  },
      { slug: 'tsf-les-favieres',    name: 'TSF Les Favières',    typeCode: 'TSF', junction: 'chevrerie-junction',    descentDiff: 'blue'  },
      { slug: 'tsf-le-grand-souvroz', name: 'TSF Le Grand Souvroz', typeCode: 'TSF', junction: 'chevrerie-junction', descentDiff: 'blue'  },
      { slug: 'tsf-les-vous',        name: 'TSF Les Vous',        typeCode: 'TSF', junction: 'chevrerie-junction',    descentDiff: 'blue'  },
      { slug: 'tsf-follys-sja',      name: 'TSF Follys',          typeCode: 'TSF', junction: 'chevrerie-junction',    descentDiff: 'blue'  },
      { slug: 'tsf-le-mur',          name: 'TSF Le Mur',          typeCode: 'TSF', junction: 'chevrerie-junction',    descentDiff: 'blue'  },
      { slug: 'tsf-les-sapins',      name: 'TSF Les Sapins',      typeCode: 'TSF', junction: 'chevrerie-junction',    descentDiff: 'blue'  },
      { slug: 'tsf-les-sapins-bis',  name: 'TSF Les Sapins Bis',  typeCode: 'TSF', junction: 'chevrerie-junction',    descentDiff: 'blue'  },
      { slug: 'tk-ecole-1-sja',      name: 'TK École 1',          typeCode: 'TK',  junction: 'chevrerie-junction',    descentDiff: 'green' },
      { slug: 'tk-ecole-2-sja',      name: 'TK École 2',          typeCode: 'TK',  junction: 'chevrerie-junction',    descentDiff: 'green' },
      { slug: 'tk-etangs-sja',       name: 'TK Étangs',           typeCode: 'TK',  junction: 'chevrerie-junction',    descentDiff: 'green' },
    ],
  },

  // ── ABONDANCE ─────────────────────────────────────────────────────────────
  {
    id: 'abondance',
    country: 'FR',
    village: 'abondance-village',
    villageLabel: 'Abondance',
    junction: 'abondance-junction',
    junctionLabel: 'Abondance – Les Follys',
    lifts: [
      { slug: 'tc-lessert',          name: "TC L'Essert",         typeCode: 'TC',  junction: 'abondance-junction', descentDiff: 'blue'  },
      { slug: 'tk-lac-abondance',    name: 'TK Lac',              typeCode: 'TK',  junction: 'abondance-junction', descentDiff: 'green' },
      { slug: 'tk-corne',            name: 'TK Corne',            typeCode: 'TK',  junction: 'abondance-junction', descentDiff: 'green' },
      { slug: 'tk-follys-abondance', name: 'TK Follys',           typeCode: 'TK',  junction: 'abondance-junction', descentDiff: 'green' },
      { slug: 'tk-petit-fremoux',    name: 'TK Petit Frémoux',    typeCode: 'TK',  junction: 'abondance-junction', descentDiff: 'green' },
      { slug: 'tk-grand-fremoux',    name: 'TK Grand Frémoux',    typeCode: 'TK',  junction: 'abondance-junction', descentDiff: 'green' },
      { slug: 'tk-covagny',          name: 'TK Covagny',          typeCode: 'TK',  junction: 'abondance-junction', descentDiff: 'green' },
    ],
  },

];

// ── extra village/junction nodes not covered by sector definitions ────────────
const extraNodes = [
  { id: 'les-prodains-village',         name: 'Les Prodains',          country: 'FR', station_type: 'village',  lift_type: null, connections: [] },
  { id: 'montriond-village',            name: 'Montriond',             country: 'FR', station_type: 'village',  lift_type: null, connections: [] },
  { id: 'morzine-pleney-junction',      name: 'Morzine – Pleney',      country: 'FR', station_type: 'junction', lift_type: null, connections: [] },
  { id: 'super-morzine-junction',       name: 'Super Morzine',         country: 'FR', station_type: 'junction', lift_type: null, connections: [] },
  { id: 'ranfoilly-junction',           name: 'Ranfoilly area',        country: 'FR', station_type: 'junction', lift_type: null, connections: [] },
  { id: 'avoriaz-junction',             name: 'Avoriaz upper',         country: 'FR', station_type: 'junction', lift_type: null, connections: [] },
  { id: 'les-gets-chavannes-junction',  name: 'Les Gets – Chavannes',  country: 'FR', station_type: 'junction', lift_type: null, connections: [] },
  { id: 'mont-chery-junction',          name: 'Mont Chéry',            country: 'FR', station_type: 'junction', lift_type: null, connections: [] },
  { id: 'pointe-de-mossettes-junction', name: 'Pointe de Mossettes',   country: 'CH', station_type: 'junction', lift_type: null, connections: [] },
  { id: 'linga-junction',               name: 'Linga / Cornebois',     country: 'FR', station_type: 'junction', lift_type: null, connections: [] },
  { id: 'pre-la-joux-junction',         name: 'Pré-la-Joux',           country: 'FR', station_type: 'junction', lift_type: null, connections: [] },
  { id: 'chevrerie-junction',           name: "La Chèvrerie",          country: 'FR', station_type: 'junction', lift_type: null, connections: [] },
];

// ── cross-sector edges (explicit, bidirectional pairs handled manually) ───────
// Format: { from, to, name, type, difficulty, bidirectional? }
const crossEdges = [
  // Morzine village ↔ Les Prodains (road transfer, green transfer piste)
  { from: 'morzine-village',            to: 'les-prodains-village',         name: 'Transfer Prodains',       type: 'slope', difficulty: 'green', bidirectional: true },
  // Morzine village → Pleney junction (ski-out)
  { from: 'morzine-village',            to: 'morzine-pleney-junction',       name: 'Morzine centre',          type: 'slope', difficulty: 'green' },
  { from: 'morzine-pleney-junction',    to: 'morzine-village',               name: 'Pleney descent',          type: 'slope', difficulty: 'blue'  },
  // Morzine village ↔ Super Morzine junction
  { from: 'morzine-village',            to: 'super-morzine-junction',        name: 'Morzine – Super Morzine', type: 'slope', difficulty: 'green' },
  { from: 'super-morzine-junction',     to: 'morzine-village',               name: 'Zore',                    type: 'slope', difficulty: 'blue'  },
  // Les Prodains ↔ Avoriaz village (Prodains Express top = Avoriaz)
  { from: 'avoriaz-village',            to: 'les-prodains-village',          name: 'Prodains descent',        type: 'slope', difficulty: 'blue'  },
  // Avoriaz village → Avoriaz junction (internal, ski to upper lifts)
  { from: 'avoriaz-village',            to: 'avoriaz-junction',              name: 'Avoriaz upper access',    type: 'slope', difficulty: 'green' },
  { from: 'avoriaz-junction',           to: 'avoriaz-village',               name: 'Avoriaz return',          type: 'slope', difficulty: 'blue'  },
  // Avoriaz ↔ Les Lindarets (gondola in both directions + ski route)
  { from: 'avoriaz-village',            to: 'les-lindarets-junction',        name: 'TC Lindarets descent',    type: 'lift',  difficulty: 'green' },
  { from: 'les-lindarets-junction',     to: 'avoriaz-village',               name: 'Avoriaz piste',           type: 'slope', difficulty: 'blue'  },
  // Les Lindarets ↔ Les Gets Chavannes
  { from: 'les-lindarets-junction',     to: 'les-gets-chavannes-junction',   name: 'Lindarets – Chavannes',   type: 'slope', difficulty: 'blue'  },
  { from: 'les-gets-chavannes-junction', to: 'les-lindarets-junction',       name: 'Chavannes – Lindarets',   type: 'slope', difficulty: 'blue'  },
  // Les Gets Chavannes ↔ Les Gets village
  { from: 'les-gets-chavannes-junction', to: 'les-gets-village',             name: 'Chavannes descent',       type: 'slope', difficulty: 'blue'  },
  { from: 'les-gets-village',           to: 'les-gets-chavannes-junction',   name: 'Les Gets approach',       type: 'slope', difficulty: 'green' },
  // Pleney junction ↔ Les Gets Chavannes
  { from: 'morzine-pleney-junction',    to: 'les-gets-chavannes-junction',   name: 'Nantaux',                 type: 'slope', difficulty: 'blue'  },
  { from: 'les-gets-chavannes-junction', to: 'morzine-pleney-junction',      name: 'Chavannes – Pleney',      type: 'slope', difficulty: 'blue'  },
  // Les Gets village ↔ Mont Chéry junction
  { from: 'les-gets-village',           to: 'mont-chery-junction',           name: 'Mont Chéry access',       type: 'slope', difficulty: 'green' },
  { from: 'mont-chery-junction',        to: 'les-gets-village',              name: 'Mont Chéry descent',      type: 'slope', difficulty: 'red'   },
  // Ranfoilly junction → Saint-Jean village (TSD Ranfoilly Express top → SJA)
  { from: 'ranfoilly-junction',         to: 'saint-jean-village',            name: 'Nauchets',                type: 'slope', difficulty: 'blue'  },
  { from: 'saint-jean-village',         to: 'ranfoilly-junction',            name: 'Saint-Jean – Ranfoilly',  type: 'slope', difficulty: 'green' },
  // Super Morzine junction ↔ Avoriaz village
  { from: 'super-morzine-junction',     to: 'avoriaz-village',               name: 'Zore – Avoriaz',          type: 'slope', difficulty: 'blue'  },
  { from: 'avoriaz-village',            to: 'super-morzine-junction',        name: 'Super Morzine access',    type: 'slope', difficulty: 'green' },
  // Pointe de Mossettes ↔ Les Crosets
  { from: 'pointe-de-mossettes-junction', to: 'les-crosets-junction',        name: 'Grand Conche',            type: 'slope', difficulty: 'blue'  },
  { from: 'les-crosets-junction',       to: 'pointe-de-mossettes-junction',  name: 'Mossettes Suisse access', type: 'slope', difficulty: 'green' },
  // Les Crosets ↔ Morgins junction
  { from: 'les-crosets-junction',       to: 'morgins-junction',              name: 'Ripaille',                type: 'slope', difficulty: 'blue'  },
  { from: 'morgins-junction',           to: 'les-crosets-junction',          name: 'Morgins – Crosets',       type: 'slope', difficulty: 'green' },
  // Morgins junction ↔ Morgins village
  { from: 'morgins-junction',           to: 'morgins-village',               name: 'Morgins piste',           type: 'slope', difficulty: 'blue'  },
  { from: 'morgins-village',            to: 'morgins-junction',              name: 'Morgins lift access',     type: 'slope', difficulty: 'green' },
  // Champoussin junction ↔ Champoussin village
  { from: 'champoussin-junction',       to: 'champoussin-village',           name: 'Champoussin descent',     type: 'slope', difficulty: 'blue'  },
  { from: 'champoussin-village',        to: 'champoussin-junction',          name: 'Champoussin access',      type: 'slope', difficulty: 'green' },
  // Les Crosets ↔ Champoussin junction
  { from: 'les-crosets-junction',       to: 'champoussin-junction',          name: 'Pointe de l\'Au slope',   type: 'slope', difficulty: 'blue'  },
  { from: 'champoussin-junction',       to: 'les-crosets-junction',          name: 'Champoussin – Crosets',   type: 'slope', difficulty: 'blue'  },
  // Champéry village ↔ Les Crosets (TPH top = Les Crosets area)
  { from: 'les-crosets-junction',       to: 'champery',              name: 'Chavanette slope',        type: 'slope', difficulty: 'blue'  },
  // Morgins ↔ Châtel (TSF Portes du Soleil cross-border)
  { from: 'morgins-junction',           to: 'pre-la-joux-junction',          name: 'Brochaux',                type: 'slope', difficulty: 'red'   },
  { from: 'pre-la-joux-junction',       to: 'morgins-junction',              name: 'Portes du Soleil – Morgins', type: 'slope', difficulty: 'blue' },
  // Linga junction → Les Crosets (Linga/Culet top ~1932m → Swiss side)
  { from: 'linga-junction',             to: 'les-crosets-junction',          name: 'Culet – Crosets',         type: 'slope', difficulty: 'blue'  },
  { from: 'les-crosets-junction',       to: 'linga-junction',                name: 'Crosets – Linga',         type: 'slope', difficulty: 'blue'  },
  // Pré-la-Joux ↔ Super-Châtel
  { from: 'pre-la-joux-junction',       to: 'super-chatel-junction',         name: 'Linga descent',           type: 'slope', difficulty: 'blue'  },
  { from: 'super-chatel-junction',      to: 'pre-la-joux-junction',          name: 'Super-Châtel – Pré-la-Joux', type: 'slope', difficulty: 'green' },
  // Super-Châtel junction ↔ Châtel village
  { from: 'super-chatel-junction',      to: 'chatel-village',                name: 'Super-Châtel descent',    type: 'slope', difficulty: 'blue'  },
  { from: 'chatel-village',             to: 'super-chatel-junction',         name: 'Super-Châtel access',     type: 'slope', difficulty: 'green' },
  // Pré-la-Joux ↔ La Chapelle (Châtel ↔ La Chapelle border)
  { from: 'pre-la-joux-junction',       to: 'la-chapelle-junction',          name: 'Crêt Béni descent',       type: 'slope', difficulty: 'blue'  },
  { from: 'la-chapelle-junction',       to: 'pre-la-joux-junction',          name: 'La Panthiaz ridge',       type: 'slope', difficulty: 'green' },
  // La Chapelle village ↔ La Chapelle junction
  { from: 'la-chapelle-village',        to: 'la-chapelle-junction',          name: 'La Panthiaz access',      type: 'slope', difficulty: 'green' },
  { from: 'la-chapelle-junction',       to: 'la-chapelle-village',           name: 'La Chapelle descent',     type: 'slope', difficulty: 'blue'  },
  // Torgon junction ↔ La Chapelle junction (Tronchey cross-border)
  { from: 'torgon-junction',            to: 'la-chapelle-junction',          name: 'Tronchey – Chapelle',     type: 'slope', difficulty: 'blue'  },
  { from: 'la-chapelle-junction',       to: 'torgon-junction',               name: 'Plan de Croix – Torgon',  type: 'slope', difficulty: 'blue'  },
  // Torgon village ↔ Torgon junction
  { from: 'torgon-village',             to: 'torgon-junction',               name: 'Torgon access',           type: 'slope', difficulty: 'green' },
  { from: 'torgon-junction',            to: 'torgon-village',                name: 'Torgon descent',          type: 'slope', difficulty: 'blue'  },
  // Saint-Jean village ↔ Saint-Jean junction
  { from: 'saint-jean-village',         to: 'saint-jean-junction',           name: 'Saint-Jean access',       type: 'slope', difficulty: 'green' },
  { from: 'saint-jean-junction',        to: 'saint-jean-village',            name: 'Chargeau descent',        type: 'slope', difficulty: 'blue'  },
  // Saint-Jean junction ↔ Chèvrerie junction
  { from: 'saint-jean-junction',        to: 'chevrerie-junction',            name: 'La Chèvrerie link',       type: 'slope', difficulty: 'blue'  },
  { from: 'chevrerie-junction',         to: 'saint-jean-junction',           name: 'Chèvrerie – Plateau',     type: 'slope', difficulty: 'blue'  },
  // Chèvrerie junction ↔ Abondance junction (Col des Follys)
  { from: 'chevrerie-junction',         to: 'abondance-junction',            name: 'Col des Follys',          type: 'slope', difficulty: 'blue'  },
  { from: 'abondance-junction',         to: 'chevrerie-junction',            name: 'Col des Follys – SJA',    type: 'slope', difficulty: 'blue'  },
  // Abondance village ↔ Abondance junction
  { from: 'abondance-village',          to: 'abondance-junction',            name: 'L\'Essert access',        type: 'slope', difficulty: 'green' },
  { from: 'abondance-junction',         to: 'abondance-village',             name: 'L\'Essert descent',       type: 'slope', difficulty: 'blue'  },
  // Ardent village ↔ Les Lindarets junction (TC Ardent)
  { from: 'ardent-village',             to: 'les-lindarets-junction',        name: 'Ardent access',           type: 'slope', difficulty: 'green' },
  { from: 'les-lindarets-junction',     to: 'ardent-village',                name: 'Ardent descent',          type: 'slope', difficulty: 'green' },
  // Ardent village ↔ Montriond village
  { from: 'ardent-village',             to: 'montriond-village',             name: 'Ardent – Montriond',      type: 'slope', difficulty: 'green', bidirectional: true },
  // Champéry village → Champéry junction (TPH Champéry base = village)
  { from: 'champery',           to: 'les-crosets-junction',          name: 'Champéry – Planachaux',   type: 'slope', difficulty: 'green' },
];

// ── build node map ────────────────────────────────────────────────────────────
const nodeMap = new Map(); // id → { ...node with connections array }

function ensureNode(id, name, country, station_type, lift_type) {
  if (!nodeMap.has(id)) {
    nodeMap.set(id, { id, name, country, station_type, lift_type, connections: [] });
  }
}

function addEdge(fromId, toId, name, type, difficulty, bidirectional) {
  const node = nodeMap.get(fromId);
  if (!node) throw new Error(`Unknown node: ${fromId}`);
  const conn = { to: toId, name, type, difficulty };
  if (bidirectional) conn.bidirectional = true;
  node.connections.push(conn);
}

// 1. Add extra nodes
for (const n of extraNodes) {
  ensureNode(n.id, n.name, n.country, n.station_type, n.lift_type);
}

// 2. Process sectors — create village, junction, and lift nodes
for (const sector of sectors) {
  // Village node
  ensureNode(sector.village, sector.villageLabel, sector.country, 'village', null);
  // Junction node (may be same as village for some sectors)
  if (sector.junction !== sector.village) {
    ensureNode(sector.junction, sector.junctionLabel, sector.country, 'junction', null);
  }

  for (const lift of sector.lifts) {
    const baseId = `${lift.slug}-base`;
    const topId  = `${lift.slug}-top`;
    const liftType = liftTypeCode(lift.typeCode);
    const junctionId = lift.junction;
    const baseFrom   = lift.baseFrom || sector.village;
    const baseFromDiff = lift.baseFromDiff || 'green';

    // Ensure junction exists (it may be in another sector)
    // (junctions from other sectors should already exist or be extra nodes)

    ensureNode(baseId, `${lift.name} (base)`, sector.country, 'lift-base', liftType);
    ensureNode(topId,  `${lift.name} (summit)`, sector.country, 'lift-top',  liftType);

    // base → top  (lift, green)
    addEdge(baseId, topId, lift.name, 'lift', 'green');
    // top → junction  (slope, descentDiff)
    addEdge(topId, junctionId, `${lift.name} descent`, 'slope', lift.descentDiff);
    // junction → base  (slope, green/baseFromDiff — this is not from junction but from baseFrom)
    // baseFrom → base  (slope, baseFromDiff)
    if (!nodeMap.has(baseFrom)) {
      // baseFrom may not exist yet; ensure it as junction placeholder
      ensureNode(baseFrom, baseFrom, sector.country, 'junction', null);
    }
    addEdge(baseFrom, baseId, `${lift.name} approach`, 'slope', baseFromDiff);
  }
}

// 3. Add cross-sector edges
for (const e of crossEdges) {
  if (!nodeMap.has(e.from)) throw new Error(`cross-edge from unknown node: ${e.from}`);
  if (!nodeMap.has(e.to))   throw new Error(`cross-edge to unknown node: ${e.to}`);
  addEdge(e.from, e.to, e.name, e.type, e.difficulty, e.bidirectional);
  if (e.bidirectional) {
    // Add the reverse — only if not already added by a symmetric pair
    const rev = nodeMap.get(e.to);
    const alreadyHas = rev.connections.some(c => c.to === e.from && c.bidirectional);
    if (!alreadyHas) {
      addEdge(e.to, e.from, e.name, e.type, e.difficulty, true);
    }
  }
}

// 4. Ensure champery exists (needed by cross-edges & smoke test)
ensureNode('champery', 'Champéry', 'CH', 'village', null);

// 5. Build output
const nodes = [...nodeMap.values()];

// Validate: every connection target exists
for (const node of nodes) {
  for (const conn of node.connections) {
    if (!nodeMap.has(conn.to)) {
      process.stderr.write(`ERROR: ${node.id} → "${conn.to}" — target not found\n`);
      process.exit(1);
    }
  }
}

// Validate: bidirectional reverse consistency
for (const node of nodes) {
  for (const conn of node.connections) {
    if (!conn.bidirectional) continue;
    const target = nodeMap.get(conn.to);
    const reverseExists = target.connections.some(c => c.to === node.id && c.bidirectional);
    if (!reverseExists) {
      process.stderr.write(`ERROR: bidi edge ${node.id} → ${conn.to} ("${conn.name}") has no reverse\n`);
      process.exit(1);
    }
  }
}

const network = {
  _meta: {
    season: '2024/25',
    scope: 'Portes du Soleil — full lift-by-lift network, all 13 named sub-resorts, all lift types (TC, TPH, TSD, TSF, TK). Each named lift has a base and summit node. Slopes connect lift summits to neighbouring lift bases. Schema v2.',
    schema_version: '2',
  },
  nodes,
};

const outPath = resolve(__dirname, '..', 'data', 'network.json');
writeFileSync(outPath, JSON.stringify(network, null, 2), 'utf8');

const edgeCount = nodes.reduce((n, nd) => n + nd.connections.length, 0);
process.stdout.write(`✓ Wrote ${nodes.length} nodes, ${edgeCount} edges → ${outPath}\n`);
