# Beetle Swarm

A mobile web game built from the owner's brief: swipe in four directions, close trails to claim 80% of a pirate map, and avoid roaming beetles. Chapter 1 has one beetle; every chapter adds one. Three lives per run. Claimed land is safe. Beetles hitting open trails, or crossing your own trail, costs a life.

The static application is in `dist/`. `engine.mjs` holds the simulation and flood-fill territory rules; `game.mjs` renders the map, connects swipe and keyboard input, and handles the game screens. The app manifest and icon support adding the game to a phone home screen. The map fills the available viewport below a compact status bar and requests browser full-screen mode when supported. Captures update the percentage without a popup; reaching 80% advances automatically after a brief 650 ms beat. Resizing preserves the current run. It requires a network connection and does not save runs between reloads.

Run the gameplay regression checks with `node --test tests/engine.test.mjs`.

Artwork was created with built-in image generation for this game: an antique maritime map icon with BEETLE above a bronze beetle and SWARM below; a subdued parchment nautical board; and an isolated transparent top-down bronze beetle. Original assets are included under `dist/assets/`. No film characters or franchise logos are used.

This repository contains the web game and native iPhone source under `ios/`, with a reproducible offline bundler and a Codemagic archive workflow. It was exported from the saved Beetle Swarm project at source commit `35b7c65a60b88b9b3433676c386fcb45d6cd20c1`. The hosted web game is managed separately.

The included GitHub Actions workflow is configured to run all 12 gameplay/package checks and compile an unsigned iPhone simulator build with Xcode 26.3. All 12 gameplay/package checks passed locally. Check the latest GitHub Actions run for the simulator compilation result. This compile check does not produce a signed installable iPhone app. The `ios-build` workflow in Codemagic builds the signed archive after the Apple connection is configured. Physical iPhone testing, signing and App Store submission remain outstanding. See `app-store/LAUNCH-STATUS.md` for the launch steps.

The interface uses locally bundled Pirata One display lettering and IM Fell English book lettering (regular and italic), with their SIL Open Font Licenses in `dist/assets/fonts/`. A generated blank maritime parchment scroll forms the menu background; its prompt specified worn vellum, rolled ends, nautical margin engravings and a clear center. The game chrome uses sepia ink, oxblood and antique brass.
