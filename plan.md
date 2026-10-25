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

- [x] Add `;` end-of-line and comment-only source comments: preserve source text and line numbers, test parsing and execution, and update the language and in-app references.

- [x] Restyle the workspace as a compact instrument rack: viewport-sized desktop layout, internally scrolling program/stack, event-driven read/write cues, and reduced-motion support. Preserve execution behavior and the instruction reference.

- [x] Give each instruction parser its specific instruction return type, following the MOV parser.

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
- [x] Add `LOAD` execution and decimal-address parsing, with basic core/parser tests and a register-write event identifying the source address.
- [x] Wire `LOAD` source-memory and destination-register highlights and the memory-read explanation into the interface; browser verification confirmed by the user.

- [x] **Finish `LOAD`:**
  - [x] Correct the core address error (`STORE` → `LOAD`), parser address error (`MOV value` → `LOAD address`), and unsupported-instruction help to include `LOAD`. Add core/parser coverage for address endpoints, invalid operands, preserved state (`SP`, `ZF`, memory, and other registers), and `PC` advancement.
  - [x] Update README, editor syntax help, the in-app reference, and `instruction-reference.md` to include implemented `LOAD` behaviour. Extend the sample and its execution test to read back the stored byte.
  - [x] Verify in the browser that stepping the sample through `LOAD` highlights memory address 0 as read and R3 as written, shows the memory-read explanation, and clears these cues on the next step or reset. Confirmed by the user.

- [x] Give debug source line numbers a shared, right-aligned, non-shrinking gutter sized for the largest source line number, keeping code aligned past lines 9 and 99. TypeScript and production build pass; browser verification remains pending.

## Next small steps

- [ ] **`SUB`:**
  - [x] Add core register subtraction modulo 256, set `ZF` from the stored result, emit a subtraction register-write event, and test wraparound, state preservation, and invalid registers.
  - [ ] Parse `SUB destination, source`, connect subtraction events to interface explanations and read highlights, and update syntax help and instruction references with an executable example.
- [ ] **`CMP`:** compare two registers without changing them, then define precisely how it sets `ZF`.
- [ ] **`JMP` and `JZ`:** introduce instruction addresses and conditional control flow. Define valid jump targets and show where control moves.
- [ ] **`POP`:** remove the top byte from the downward-growing stack into a register. Define empty-stack behaviour.
- [ ] **`CALL` and `RET`:** use the stack for return addresses, define address representation and stack-overflow/underflow faults, then show calls and returns in the program view.
- [ ] **STORE/LOAD transfer motion:** animate a byte-value badge from the source register to the destination memory cell for STORE, and in reverse for LOAD, using existing execution events. Preserve immediate machine updates and persistent highlights; skip motion with reduced-motion preferences or offscreen endpoints, and cancel stale motion on another step, reset, editing, or navigation.
- [ ] **Memory map and faults:** document stack and ordinary-data regions, then give invalid addresses, unsupported instructions, and illegal stack operations clear stopped-state explanations.
- [ ] **Continuous execution:** add Run/Pause and a speed control while preserving the same step behaviour.
- [ ] **Movement cues:** extend the persistent read/write highlights with transfer motion between panels and explicit flag/stack-pointer change cues; retain reduced-motion support.
- [ ] **Byte inspector:** let a learner select a memory byte and see its address, hex, unsigned decimal, binary, and ASCII interpretations.

## Later milestones

- Add short exercises and example programs that teach variables, control flow, and functions.
- Explore a more controlled instruction editor if learners need it after trying the text editor.
- Explore reverse stepping and a gradually more debugger-like interface.
- Design a memory-mapped display and revisit the memory budget before attempting Conway's Game of Life.

## Decisions so far

The workspace uses an instrument-rack layout on desktop (1100px and wider, with at least 600px height), with internal overflow for long content. Smaller viewports reflow to preserve readable controls. Cyan means next instruction, amber means last read, mint means last write, and violet marks stack occupancy. Event highlights persist until the next step or reset; register write pulses respect reduced-motion preferences. Build and existing tests pass; browser layout verification remains pending.

The current machine uses zero-based instruction indices in `PC`. `MOV` accepts an unsigned byte (`0` through `255`), advances `PC` by one, and leaves `ZF`, `SP`, and memory unchanged. The empty downward-growing stack starts with `SP` one past the final byte, at `256`.

`ADD` stores the low 8 bits of the sum in its destination register and sets `ZF` when the stored result is zero.

`SUB` is implemented in the machine core: it stores destination minus source modulo 256 (so `0 - 1` becomes `255`) and sets `ZF` exactly when the stored result is zero. It advances `PC`, preserves memory, `SP`, and other registers, and emits a subtraction register-write event. Subtracting a register from itself produces zero. Core tests and the production build pass; source parsing, interface event handling, and instruction references are the next step.

`PUSH` decrements `SP` before writing, so `SP` points at the top byte after a push. The empty stack has `SP = 256`, and a push at `SP = 0` overflows. Stack writes copy memory before changing it, leaving earlier machine states intact.

`HALT` advances `PC` past itself and sets `halted`. Further execution is rejected until reset.

`STORE` copies a register byte to an integer memory address from 0 through 255, advances `PC`, and emits a memory-write event containing the previous byte. It copies memory before writing and preserves registers, `SP`, and `ZF`. Any memory byte is addressable, including stack bytes. Source syntax is `STORE register, address`, with decimal addresses from 0 through 255. The sample writes decimal 65 to address 0, shown as hex `41` and ASCII `A`.

`LOAD` copies the byte at an integer memory address from 0 through 255 into a register, advances `PC`, and emits a register-write event identifying the source address. It preserves memory, other registers, `SP`, and `ZF`. Source syntax is `LOAD register, address`, with decimal addresses. Execution, parsing, UI event handling, instruction-specific errors, and core/parser coverage are complete. Tests cover address endpoints, invalid operands, state preservation, PC advancement, and memory-source events. Documentation and sample integration are complete: the eight-instruction sample reads the stored byte back into R3 before halting with PC = 8. The user confirmed browser verification of the LOAD highlights, explanation, and cue clearing.

Program source accepts case-insensitive instructions and registers, flexible whitespace, blank lines, and `;` comments through the end of a line. Comments may follow instructions or occupy whole lines; comment-only lines do not consume instruction indices. Original source text and line numbers are preserved. `MOV` immediates are decimal integers from 0 to 255. Any parse error blocks the whole program. Source line numbers stay separate from zero-based `PC`; editing resets execution, while Reset preserves source.

## Working rule

As each small step is completed, mark it complete here alongside its changes, add any decision we learned, and split the next broad item if it is now close enough to implement. Check and stage the step, then stop with a suggested commit message for the user; do not create a commit. The plan can change as the prototype teaches us what works.
