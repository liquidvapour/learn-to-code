# Tiny Machine plan

This is the living record of what exists and what comes next. The nearest steps are small enough to become individual, reviewable commits. Later milestones stay broad until we reach them; then we split them into similarly small steps. Update this file as work lands, and keep the first unchecked step current.

The product goals are in [tiny-machine-design.md](tiny-machine-design.md). The proposed behaviour and interface are in [technical-design.md](technical-design.md).

## Done

- [x] Capture the teaching goal, tiny instruction set, and prototype scope (`31f4f44`).
- [x] Record the technical design, including the hex memory explorer and editable text program (`31f4f44`).
- [x] Set the small-change and commit-as-you-go rule (`933e682`).
- [x] Update the working rule to leave each completed step staged with a suggested commit message, without creating commits.
- [x] Scaffold a runnable React and TypeScript page with Program, Machine, and Memory areas (`38f0b2d`).
- [x] Set up fnm Node 24 and npm with a lockfile (`2ead793`).
- [x] Add a deterministic machine state and the first `MOV` instruction, with tests.
- [x] Connect Step and Reset to a two-instruction `MOV` demo, with an active instruction marker and live register values.
- [x] Add 8-bit `ADD`, show the zero flag, and extend the demo through the third instruction.
- [x] Add `PUSH` and a stack view backed by machine memory.
- [x] Add `HALT` and run the five-instruction sample end to end.
- [x] Share instruction completion and register-write logic in the machine core.
- [x] Use exhaustive instruction dispatch and one register validation path.
- [x] Define the machine's 256-byte size once for the core and stack view.
- [x] Show memory as a 16-by-16 hex grid with an ASCII view (`e8c8eb3`).
- [x] Highlight occupied stack bytes and the top at `SP` in memory, show used and remaining capacity, and keep a stack close-up.
- [x] Add an editable program with whole-program validation, source line errors, reset on edits, and sample restoration.

## Next small steps

- [x] Extract per-instruction parsers and shared operand validation in `program.ts`, following the machine handler pattern while preserving parser behavior.

- [x] Combine the program editor and instruction view with Edit/Debug modes; validate before debugging, reset on Debug, and preserve source when returning to Edit.

- [x] Arrange the workspace in two columns: Program beside Machine, with four registers in one row, then Stack, then Memory; keep a single-column layout on narrow screens.
- [x] Extract the remaining instruction handlers using the MOV and ADD pattern, preserving current behavior.
- [x] Fix the existing LOAD memory-source event type mismatch by emitting the source `address` required by the memory variant of `RegisterWriteSource`.

- [x] Add a Markdown development reference for all supported and planned instructions, including open semantic decisions.
- [x] Add an in-app instruction reference page covering all supported instructions, examples, machine state, and source rules; keep README focused on project setup.
- [x] Set up VS Code Test Explorer for the built-in `node:test` suite.

- [x] **`STORE`:**
  - [x] Add a register-to-memory write with byte-address validation, execution events, and core tests.
  - [x] Parse `STORE register, address`, document its syntax, and demonstrate decimal `65` appearing as hex `41` and ASCII `A`.
- [ ] **`LOAD`:**
  - [ ] Add memory-to-register execution with byte-address validation, a source-address execution event, and core tests; preserve `SP` and `ZF`.
  - [ ] Parse `LOAD register, address`, document decimal addresses, and extend the sample to read back the stored byte.
  - [ ] Highlight the source memory cell and destination register after a load.
- [ ] **`SUB`:** add 8-bit subtraction, define its wraparound behaviour, and decide whether it updates `ZF`.
- [ ] **`CMP`:** compare two registers without changing them, then define precisely how it sets `ZF`.
- [ ] **`JMP` and `JZ`:** introduce instruction addresses and conditional control flow. Define valid jump targets and show where control moves.
- [ ] **`POP`:** remove the top byte from the downward-growing stack into a register. Define empty-stack behaviour.
- [ ] **`CALL` and `RET`:** use the stack for return addresses, define address representation and stack-overflow/underflow faults, then show calls and returns in the program view.
- [ ] **Memory map and faults:** document stack and ordinary-data regions, then give invalid addresses, unsupported instructions, and illegal stack operations clear stopped-state explanations.
- [ ] **Continuous execution:** add Run/Pause and a speed control while preserving the same step behaviour.
- [ ] **Movement cues:** use execution events to highlight reads and writes, then add optional motion that can be reduced or disabled.
- [ ] **Byte inspector:** let a learner select a memory byte and see its address, hex, unsigned decimal, binary, and ASCII interpretations.

## Later milestones

- Add short exercises and example programs that teach variables, control flow, and functions.
- Explore a more controlled instruction editor if learners need it after trying the text editor.
- Explore reverse stepping and a gradually more debugger-like interface.
- Design a memory-mapped display and revisit the memory budget before attempting Conway's Game of Life.

## Decisions so far

The current machine uses zero-based instruction indices in `PC`. `MOV` accepts an unsigned byte (`0` through `255`), advances `PC` by one, and leaves `ZF`, `SP`, and memory unchanged. The empty downward-growing stack starts with `SP` one past the final byte, at `256`; its push behaviour will be defined when `PUSH` is implemented.

`ADD` stores the low 8 bits of the sum in its destination register and sets `ZF` when the stored result is zero.

`PUSH` decrements `SP` before writing, so `SP` points at the top byte after a push. The empty stack has `SP = 256`, and a push at `SP = 0` overflows. Stack writes copy memory before changing it, leaving earlier machine states intact.

`HALT` advances `PC` past itself and sets `halted`. Further execution is rejected until reset.

`STORE` copies a register byte to an integer memory address from 0 through 255, advances `PC`, and emits a memory-write event containing the previous byte. It copies memory before writing and preserves registers, `SP`, and `ZF`. Any memory byte is addressable, including stack bytes. Source syntax is `STORE register, address`, with decimal addresses from 0 through 255. The sample writes decimal 65 to address 0, shown as hex `41` and ASCII `A`.

Program source accepts case-insensitive instructions and registers, flexible whitespace, and blank lines. `MOV` immediates are decimal integers from 0 to 255. Any parse error blocks the whole program. Source line numbers stay separate from zero-based `PC`; editing resets execution, while Reset preserves source.

## Working rule

As each small step is completed, mark it complete here alongside its changes, add any decision we learned, and split the next broad item if it is now close enough to implement. Check and stage the step, then stop with a suggested commit message for the user; do not create a commit. The plan can change as the prototype teaches us what works.
