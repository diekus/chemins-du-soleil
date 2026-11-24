<p align="center">
  <a href="https://chemins-du-soleil.diek.us">
    <picture>
      <source srcset="images/logo_inv.png" media="(prefers-color-scheme: dark)">
      <img src="images/logo.png" alt="Chemins du Soleil" width="360">
    </picture>
  </a>
</p>

<h3 align="center">Find your way across the Portes du Soleil ski area.</h3>

<p align="center">
  <a href="https://chemins-du-soleil.diek.us"><strong>👉 Open the app: chemins-du-soleil.diek.us</strong></a>
</p>

<p align="center">
  Free · No account · No download needed · Works offline once installed<br>
  English · Français · Español · Italiano · Nederlands
</p>

---

## What it does

**Chemins du Soleil** helps skiers and snowboarders get from one lift to another across the 13 resorts of the [Portes du Soleil](https://en.portesdusoleil.com/), straddling France 🇫🇷 and Switzerland 🇨🇭.

- 🗺️ **Route finder.** Pick where you are and where you want to go. The app shows the best lifts and slopes to get there, and you can cap the difficulty (green, blue, red or black) so you never end up on a run you don't want.
- 📍 **Meet up with friends.** Share your location as a link. Your friends open it and get a route to you. No sign-up needed, and your location is only in the link you send.
- ❄️ **Live conditions.** Current weather for every resort, plus avalanche risk where it's published. If there's no data, the app says "unavailable" instead of guessing.
- 📋 **Lifts and slopes list.** Every lift and named slope, grouped by resort.
- 📱 **Install it on your phone.** It works like a regular app, including offline on the mountain. See the [install guide](https://chemins-du-soleil.diek.us/setup.html).

<p align="center">
  <a href="https://chemins-du-soleil.diek.us"><strong>Start planning your route →</strong></a>
</p>

---

<details>
<summary><strong>For developers</strong></summary>

Vanilla JavaScript, Web Components and a service worker. No framework and no build step.

```bash
npx serve .          # or: python3 -m http.server 8000
npm test             # unit tests
npm run validate     # network data + locale checks
```

`fetch()` needs a real server, so opening `index.html` straight from disk won't work. See [CLAUDE.md](CLAUDE.md) for architecture details.

</details>
