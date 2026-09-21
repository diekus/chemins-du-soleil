/**
 * Device-orientation compass heading helpers for the route-detail map's
 * opt-in "rotate with heading" mode (mobile only, permission-gated).
 */

/** True if this browser exposes the DeviceOrientationEvent API at all. */
export function isOrientationSupported() {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

/**
 * iOS 13+ requires an explicit permission prompt, triggered directly by a
 * user gesture (call this synchronously from a click handler, not after an
 * earlier await). Every other browser has no such API and allows access
 * unconditionally. Resolves true if orientation events can be listened for.
 */
export async function requestOrientationPermission() {
  const OrientationEvent = window.DeviceOrientationEvent;
  if (OrientationEvent && typeof OrientationEvent.requestPermission === 'function') {
    try {
      return (await OrientationEvent.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Extracts a true compass heading (0-360, 0 = north, increasing clockwise)
 * from a DeviceOrientationEvent, or null if this particular event doesn't
 * carry a trustworthy north-referenced reading.
 *
 * iOS Safari's non-standard `webkitCompassHeading` is already north-
 * referenced and clockwise — used as-is. Everywhere else, `alpha` only
 * means "compass heading" when the event is `absolute`, and even then it
 * increases counter-clockwise per spec (the opposite of compass
 * convention), hence the `360 - alpha`. A non-absolute `alpha` (relative to
 * wherever the device happened to be pointing at page load, not north) is
 * not usable as a heading and is deliberately ignored rather than shown as
 * a confidently-wrong direction.
 */
export function getCompassHeading(event) {
  if (typeof event.webkitCompassHeading === 'number') return event.webkitCompassHeading;
  if (event.absolute && typeof event.alpha === 'number') return (360 - event.alpha) % 360;
  return null;
}
