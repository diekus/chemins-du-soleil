# Tech Stack instructions for a PWA (Progressive Web Application)

We are building a PWA purely based on web standards. We want to maximize the reach of this app, so as much as possible stick to vanilla JavaScript, CSS and HTML. 

## Basics and non-negotiables

- app must comply with accessibility standards
- app must be responsive and optimized both for desktop and mobile devices
- app must provide at least a default 404 for offline
- app must comply with installability criteria as much as possible
- app must have a web app manifest file
- app must have icons, name and short_name in its manifest file
- app must have a service worker
- light and dark automatic support (no switch UX - just use the system's theme)

## Advanced Capabilities

Ask about the functionality of the app and add support for appropriate advanced web capabilities (FUGU) when relevant. 
Some examples of advanced capabilities are:
- protocol handling
- file handling
- web share api
- web share target api
- badging
- device posture
- shortcuts
- launch_handler
- url handling (this one is a tricky one, make sure to double check the latest support and interactions with other capabilities like launch_handler)

## Graceful degradation

The application will utilise cutting edge web features, ALWAYS providing a fallback for when a feature is not supported on a browser.
    - `grid` will be used if `grid-lanes` is not supported in the browser.
    - The `window-controls-overlay` display mode will implemented always. This will fallback to rendering the content at the top normally if the display mode is not supported.

## Offline support

The application will be an PWA capable of detecting if there is no connectivity. If a resource is not cached, it will show a default 404 page. The application MUST try to provide basic functionality whenever possible with Service Worker and caching. Please ask what is the "basic functionality" when planning the roadmap and phases to ensure the app has good offline support.

## Frameworks

Do not use any framework. No React, no Vue, no Angular. If there are repeatable elements consider seriously using Web Components.

## Testing

- Make sure that the application complies with the Web Content Accessibility Guidelines (WCAG).
- Test colors and contrast in CSS when possible.
- Every image must have an `alt` attribute
