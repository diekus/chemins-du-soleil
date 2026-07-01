# BRAND / DESIGN

Ensure that there is a consistent theme and excellent polish in animations, interactions and UX.

## DESCRIPTION

Chemins du Soleil is a practical tool, but it should feel polished and purposeful — like a well-designed mountain companion. The tone is clean, confident, and direct. No clutter. UI elements appear when needed and get out of the way.

## COLOURS

Clean and light as the default. Whites and light blue accents. Dark mode is an inversion of the light theme.

### Slope difficulty colours

These colours are **semantic only** and must not be reused for general UI purposes, to avoid confusing users about route difficulty:

| Slope | Light mode | Dark mode |
|---|---|---|
| Green | `#33C800` | `#33C800` |
| Blue | `#0056C8` | `#4D8FE0` (lightened for contrast) |
| Red | `#E90C00` | `#FF3D33` (lightened for contrast) |
| Black | `#000000` | `#000000` (same color, might need a white border) |

### UI colour tokens

| Token | Light mode | Dark mode |
|---|---|---|
| `--color-background` | `#FFFFFF` | `#2E2E2E` |
| `--color-surface` | `#F7F7F7` | `#3A3A3A` |
| `--color-primary` | `#2E2E2E` (charcoal) | `#FFFFFF` |
| `--color-on-primary` | `#FFFFFF` | `#2E2E2E` |
| `--color-accent` | `#BAF0FF` | `#BAF0FF` at 60% opacity |
| `--color-text` | `#2E2E2E` | `#FFFFFF` |
| `--color-text-secondary` | `#6B6B6B` | `#AAAAAA` |
| `--color-border` | `#E0E0E0` | `#4A4A4A` |

Primary action buttons use `--color-primary` (charcoal in light, white in dark) with `--color-on-primary` for their label. Dark mode is a strict inversion — no new hues introduced.

> Note: the charcoal value `#2E2E2E` is derived visually from the logo. Confirm against the FS Alvar source file if an exact match is needed.

## TYPOGRAPHY

The logo and wordmark use **FS Alvar** (licensed typeface). For all UI copy, use **Nunito** — a Google Font that shares FS Alvar's rounded terminals and humanist warmth, making them a natural pair without competing.

```css
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap');
```

| Role | Weight | Usage |
|---|---|---|
| Headings | 700 (Bold) | App title, section headers |
| Buttons / labels | 600 (SemiBold) | CTAs, lift names, difficulty labels |
| Body / secondary | 400 (Regular) | Descriptions, step instructions |

Fallback stack: `'Nunito', system-ui, -apple-system, sans-serif`

## VISUALS

- **App icon**: `images/icon.png` — rounded-square with the S-curve motif and four slope dots
- **Logo / wordmark**: `images/logo.png` — "Chemins du Soleil" with the S-curve replacing the S in "Soleil"
- **Central motif**: the S-curve with arrows evokes a ski run. It may appear in loading states, empty states, and decorative contexts.
- **Country indicators**: emoji flags 🇫🇷 🇨🇭 appear alongside every lift or station name in the UI.
- **Slope dots**: the four coloured dots (green / blue / red / black) from the icon are a recurring UI pattern for displaying or selecting difficulty.

## BACKGROUND

The page background is an animated canvas of soft, diffuse colour blobs — rendered via `src/blob-bg.js` on a `<canvas id="blob-bg">` element (CSS `filter: blur(72px)`, `opacity: 0.65` in light mode, `0.35` in dark mode). The effect reads as ambient light rather than graphic decoration, keeping focus on the form.

### Behaviour
- **Mouse / touch follower**: one blob (radius 320 px, colour `#BAF0FF` — the accent colour) drifts toward the pointer using spring physics (`k = 0.0004`, damping `0.97`). It trails slowly rather than snapping.
- **Ambient blobs**: three additional blobs float independently on slow Lissajous paths (period ~21–28 s per axis) so the background is never static even when the user is not interacting.

### Colour palette
| Mode | Follower | Ambient blobs |
|---|---|---|
| Light | `rgb(186, 240, 255)` — accent | Variations in the `#A8D4FF`–`#C8E8FF` range |
| Dark | `rgb(70, 175, 230)` | Deeper blues / indigo / teal |

### Implementation notes
- The canvas is `position: fixed; inset: 0; z-index: -1; pointer-events: none` — it never captures input.
- On resize the canvas pixel dimensions are updated in JS (`canvas.width/height = innerWidth/height`) to avoid scaling artefacts.
- Dark-mode colour selection happens once at script load via `matchMedia('(prefers-color-scheme: dark)')`.
- The blob colours are intentionally restricted to the existing `--color-accent` hue family. No new hues are introduced, keeping the palette rule intact.
