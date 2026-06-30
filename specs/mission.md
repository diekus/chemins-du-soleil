# Mission

## What We Are Building

**Chemins du Soleil** is a ski route-finding progressive web application for the Portes du Soleil resort area. It answers one question: _"How do I get from here to there on skis?"_

The user provides a start location and a destination (both expressed as lifts or named points), optionally sets a maximum slope difficulty, and the app returns the best route — or clearly states that no route exists under those constraints.

## Why We Are Building It

The Portes du Soleil is one of the largest linked ski areas in the world, spanning two countries (France and Switzerland) and multiple sub-resorts: Avoriaz, Les Gets, Morzine, Châtel, Champéry, Morgins, Roc d'Enfer, and others. Navigating it is genuinely complex:

- Piste maps are large, paper-based, and difficult to read in cold conditions with gloves on.
- No simple digital tool exists that lets a skier say "I'm at Avoriaz and want to reach Champéry — and I don't want to ski any black runs" and get a clear, step-by-step answer.
- Ability levels vary widely. A route that is trivial for an expert skier may be inaccessible to an intermediate. Filtering by difficulty is not a nice-to-have; it is core to safety and enjoyment.

The app is designed to be used **on the mountain**, in cold conditions, likely with gloves. The UX must be minimal, fast, and usable at a glance.

## Goals

1. **Route finding**: Find the optimal path between any two points in the resort using lifts and slopes.
2. **Difficulty filtering**: Respect a user-defined maximum slope colour (green → blue → red → black). If no valid route exists, say so clearly.
3. **Cross-border awareness**: Surface country context (🇫🇷 / 🇨🇭) so users know where they are in the mountain.
4. **Offline-capable**: Work without a data connection once installed, since mobile coverage on-piste is unreliable.
5. **Installable**: Deliver a native-app experience via PWA install, without requiring an app store.

## Non-Goals (for now)

- Real-time lift status / closures.
- Ticket purchasing or resort integration.
- Social or sharing features.

## Stakeholders

| Role | Description |
|---|---|
| Primary user | Skier of any level navigating Portes du Soleil on the mountain |
| Secondary user | Ski instructor or guide planning routes for groups |
| Maintainer | Developer keeping the lift/slope data JSON up to date each season |
