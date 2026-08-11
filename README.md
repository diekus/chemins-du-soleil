# Chemins du Soleil

A ski route-finding progressive web app for the [Portes du Soleil](https://en.portesdusoleil.com/) resort area.

Given a start lift, a destination, and an optional maximum slope difficulty, the app returns the best route — or clearly states no route exists under those constraints. It works offline once installed.

It also shows live conditions: a collapsible weather card for wherever you are (geolocated or manually picked), a live weather + avalanche-risk overview for all 13 Portes du Soleil resorts, and an alert banner when avalanche risk is elevated. All of it is real, live data or an honest "unavailable" — nothing is ever a fabricated placeholder.

## Running it locally

```bash
npx serve .
# or: python3 -m http.server 8000
```

`fetch()` requires an actual server — opening `index.html` directly from disk won't work.

See [CLAUDE.md](CLAUDE.md) for architecture details and development commands.
