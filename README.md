# Tiny Machine

A browser-based visual computer for learning how instructions change registers, memory, and the stack. The current page steps through a five-instruction sample with **Step** and **Reset**. See [the technical design](technical-design.md) for the planned editor and hex explorer.

## Run locally

With [fnm](https://github.com/Schniz/fnm) installed:

```text
fnm install
fnm use
npm ci
npm run dev
```

The `.node-version` file selects Node.js 24, the current LTS major when this project was started. Run `npm test` for machine tests and `npm run build` to check the production build.
