// WMO weather codes as used by Open-Meteo. Reference:
// https://open-meteo.com/en/docs
// Maps to i18n key suffixes (under "weather.codes.") rather than English text
// directly, so the condition label re-translates on locale change without
// needing to re-fetch or re-cache the reading.
const WEATHER_CODE_KEYS = {
  0: 'clearSky', 1: 'mainlyClear', 2: 'partlyCloudy', 3: 'overcast',
  45: 'fog', 48: 'depositingRimeFog',
  51: 'lightDrizzle', 53: 'moderateDrizzle', 55: 'denseDrizzle',
  56: 'lightFreezingDrizzle', 57: 'denseFreezingDrizzle',
  61: 'slightRain', 63: 'moderateRain', 65: 'heavyRain',
  66: 'lightFreezingRain', 67: 'heavyFreezingRain',
  71: 'slightSnowFall', 73: 'moderateSnowFall', 75: 'heavySnowFall', 77: 'snowGrains',
  80: 'slightRainShowers', 81: 'moderateRainShowers', 82: 'violentRainShowers',
  85: 'slightSnowShowers', 86: 'heavySnowShowers',
  95: 'thunderstorm', 96: 'thunderstormSlightHail', 99: 'thunderstormHeavyHail',
};

/** Maps a WMO weather code to its i18n key (pass to t()) for the condition label. */
export function weatherConditionKey(weatherCode) {
  return `weather.codes.${WEATHER_CODE_KEYS[weatherCode] ?? 'unknown'}`;
}

// Groups WMO codes into the condition families the icon set draws — clear and
// partly-cloudy additionally split by day/night, see weatherIconKey() below.
const WEATHER_ICON_GROUPS = {
  0: 'clear', 1: 'clear',
  2: 'partlyCloudy',
  3: 'cloudy',
  45: 'fog', 48: 'fog',
  51: 'rain', 53: 'rain', 55: 'rain',
  56: 'sleet', 57: 'sleet',
  61: 'rain', 63: 'rain', 65: 'rain',
  66: 'sleet', 67: 'sleet',
  71: 'snow', 73: 'snow', 75: 'snow', 77: 'snow',
  80: 'rain', 81: 'rain', 82: 'rain',
  85: 'snow', 86: 'snow',
  95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
};

/** Maps a WMO weather code + day/night flag to a key in icons.js's WEATHER_ICONS. */
export function weatherIconKey(weatherCode, isDay) {
  const group = WEATHER_ICON_GROUPS[weatherCode] ?? 'cloudy';
  if (group === 'clear')        return isDay ? 'clearDay' : 'clearNight';
  if (group === 'partlyCloudy') return isDay ? 'partlyCloudyDay' : 'partlyCloudyNight';
  return group;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function compassDirection(deg) {
  return COMPASS[Math.round(deg / 45) % 8];
}

const CURRENT_FIELDS = 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,snow_depth,is_day';

/**
 * Fetch current conditions for a coordinate from Open-Meteo (free, no API key).
 * Throws on a network or non-OK response — the caller decides the fallback.
 */
export async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=${CURRENT_FIELDS}&daily=snowfall_sum&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo request failed: ${res.status}`);
  const json = await res.json();
  const c = json.current;

  return {
    temp:          c.temperature_2m,
    feelsLike:     c.apparent_temperature,
    weatherCode:   c.weather_code,
    isDay:         c.is_day === 1,
    freshSnow:     Math.round((json.daily?.snowfall_sum?.[0] ?? 0) * 10) / 10,
    baseDepth:     Math.round(c.snow_depth * 100), // Open-Meteo reports snow_depth in metres
    windSpeed:     Math.round(c.wind_speed_10m),
    windDirection: compassDirection(c.wind_direction_10m),
  };
}

// WMO codes that mean "storm-grade precipitation" or "fog" for the caution
// thresholds below — see WEATHER_CODES above for what each number means.
const STORM_CODES = new Set([65, 67, 75, 82, 86, 95, 96, 99]);
const FOG_CODES    = new Set([45, 48]);
const WIND_CAUTION_KMH = 40;

/**
 * Derive plain-language, on-mountain cautionary notes straight from a live
 * fetchWeather() reading — a local threshold nudge, not an official weather
 * warning (Open-Meteo has no alerts API — see the discussion in
 * https://github.com/open-meteo/open-meteo/discussions/183). Returns
 * [] when nothing crosses a threshold.
 */
export function deriveCautions(weather) {
  if (!weather) return [];
  const cautions = [];

  // Each caution carries only its `type`; the display message is looked up
  // via i18n (weather.caution{Wind,Storm,Fog} keys) at render time so it
  // re-translates on locale change without needing to re-fetch or re-cache.
  if (weather.windSpeed >= WIND_CAUTION_KMH) cautions.push({ type: 'wind' });
  if (STORM_CODES.has(weather.weatherCode))  cautions.push({ type: 'storm' });
  if (FOG_CODES.has(weather.weatherCode))    cautions.push({ type: 'fog' });

  return cautions;
}
