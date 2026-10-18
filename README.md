# Tiny Machine

A browser-based visual computer for learning how instructions change registers, memory, and the stack. Edit a program using `MOV`, `ADD`, `STORE`, `PUSH`, and `HALT`, then execute it with **Step**. Source errors show their line numbers and block execution. Editing resets the machine; **Reset** keeps your text, and **Restore sample** brings back the seven-instruction demo. The memory hex grid and stack close-up show the same bytes. See [the technical design](technical-design.md) for upcoming features.

Open **Instruction reference** in the app for syntax, examples, and machine behavior for every supported instruction.

## Run locally

With [fnm](https://github.com/Schniz/fnm) installed:

```text
fnm install
fnm use
npm ci
npm run dev
```

The `.node-version` file selects Node.js 24, the current LTS major when this project was started. Run `npm test` for machine tests and `npm run build` to check the production build.
