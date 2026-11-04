# Tiny Machine plan

This is the living record of what exists and what comes next. The nearest steps are small enough to become individual, reviewable commits. Later milestones stay broad until we reach them; then we split them into similarly small steps. Update this file as work lands, and keep the first unchecked step current.

The product goals are in [tiny-machine-design.md](tiny-machine-design.md). The proposed behaviour and interface are in [technical-design.md](technical-design.md).

## Done

- [x] Add an example that reverses CAT in memory using the stack.

- [x] Add a runnable SOS beacon example that exercises every implemented instruction.

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

- [x] Add a live PC gutter to the source editor for choosing jump targets. Tests and production build pass; browser verification remains pending (no browser tool available).
  - Number instruction-bearing lines from zero, leaving blank/comment-only lines empty; keep provisional addresses visible while fixing syntax errors.
  - Keep numbers aligned during scrolling and long-line editing, explain the gutter, and verify tests/build before staging.

- [x] Highlight ZF writes from ADD, SUB, and CMP: red for 0, green for 1, with a visible write cue; clear on the next step or reset, including writes that preserve the flag value. Tests and production build pass; browser verification remains pending.

- [x] **`SUB`:**
  - [x] Add core register subtraction modulo 256, set `ZF` from the stored result, emit a subtraction register-write event, and test wraparound, state preservation, and invalid registers.
  - [x] Parse `SUB destination, source`, connect subtraction events to interface explanations and read highlights, and update syntax help and instruction references with an executable example.
    - Add typed parsing plus valid/invalid operand and executable-example coverage.
    - Handle subtraction events using the existing arithmetic highlight conventions.
    - Update editor help, README, and both instruction references; run tests and production build.
- [x] **`CMP`:** compare two registers without changing them.
  - [x] Add core comparison: set `ZF` when the register values are equal and clear it otherwise; preserve registers, memory, and `SP`, advance `PC`, and emit a comparison event. Test equal/unequal values, self-comparison, state preservation, and invalid registers.
  - [x] Parse `CMP destination, source`, show comparison explanations and register reads, and update syntax help and instruction references.
    - Add typed parsing with valid/invalid operand and executable-example coverage.
    - Highlight both compared registers as read and retain the comparison explanation; browser verification remains pending.
    - Update editor help, README, and both instruction references; run tests and production build.
- [x] **`JMP` and `JZ`:** introduce instruction addresses and conditional control flow.
  - [x] Define zero-based target bounds, program-end behaviour, invalid-target handling (including untaken branches), and flag preservation before implementing control flow. Recorded in the technical design and development instruction reference.
  - [x] Add core `JMP` execution and tests for target validation, PC replacement, and state preservation. Tests and production build pass.
    - Add a typed target operand and program-length context for branch execution; keep existing non-branch callers working.
    - Validate safe-integer targets against `0`–`N - 1`, rejecting missing/invalid context before changing state.
    - Emit a branch event with operation, previous PC, target, next PC, and taken status; add the minimal app event explanation needed to keep the build working.
    - Test first/last, forward/backward/self targets, addresses above 255, invalid targets/context, halted execution, and preservation of registers, memory, SP, and ZF; run tests and the production build.
  - [x] Add `JMP` parsing, interface feedback, and instruction documentation. Tests and production build pass; browser verification remains pending (no browser tool or local Playwright installation).
    - Parse unsigned decimal targets as safe integers; validate against the final instruction count and report original source lines, including forward references and unreachable branches.
    - Pass program length from the app to execution, display instruction addresses separately from source lines in Debug, and verify branch explanations and next-instruction highlighting.
    - Test parser bounds, comments/blank-line mapping, whole-program rejection, and an executable jump example; update editor help, README, and both instruction references; run tests and the production build.
  - [x] Add conditional `JZ` execution, parsing, interface feedback, and documentation with taken/untaken branch tests. Tests and production build pass; browser verification remains pending.
    - Share branch target validation; validate before reading ZF, replace PC when set, otherwise advance by one, preserving all data state.
    - Parse and validate all JZ targets, including untaken branches; show taken/untaken explanations and a flag-read cue.
    - Test both flag values, invalid targets/context, final-instruction fall-through, source mapping, and a runnable conditional example; update references and run tests/build.
- [x] **`POP`:** remove the top byte from the downward-growing stack into a register.
  - [x] Define empty-stack errors, whether popped memory is cleared, preserved flags, and execution-event feedback before implementation. Recorded in the technical design and development instruction reference.
  - [x] Add core execution and tests for a PUSH/POP round trip, stack boundaries, state preservation, and invalid registers.
    - Read at `SP`, increment it, preserve the memory byte and `ZF`, and emit a stack-sourced register-write event.
    - Reject empty-stack and invalid-register operations without changing state; test both boundaries and halted execution.
    - Run tests and the production build before staging.
  - [x] Add parsing, stack/memory read feedback, syntax help, and reference examples; run tests and the production build. Browser verification remains pending.
- [x] Limit programs to 65,535 instructions and store CALL return addresses in two little-endian bytes; validate the limit in parsing and control-flow execution.
- [ ] **`CALL` and `RET`:** use the stack for return addresses and show calls and returns in the program view.
  - [x] Define address representation, target and return validation, stack faults, and feedback in the technical design and instruction reference.
  - [x] Add core CALL and RET execution and tests for encoding, nesting, boundaries, validation, and atomic faults. Tests and production build pass.
  - [x] Parse CALL targets and RET; validate targets against the whole program and run the Fibonacci example. Tests and production build pass.
  - [ ] Add interface feedback, documentation, and an executable nested-call example.
    - Show stack-byte reads and writes and explain calls and returns.
    - Update editor help and references; run tests and build.
- [ ] **STORE/LOAD transfer motion:** animate a byte-value badge from the source register to the destination memory cell for STORE, and in reverse for LOAD, using existing execution events. Preserve immediate machine updates and persistent highlights; skip motion with reduced-motion preferences or offscreen endpoints, and cancel stale motion on another step, reset, editing, or navigation.
- [ ] **Memory map and faults:** document stack and ordinary-data regions, then give invalid addresses, unsupported instructions, and illegal stack operations clear stopped-state explanations.
- [ ] **Continuous execution:**
  - [x] Add Play/Pause next to Step at a fixed pace, stopping on completion, faults, reset, editing, or navigation; preserve step feedback. Tests and production build pass; browser verification remains pending.
  - [ ] Add a speed control for continuous execution.
- [ ] **Movement cues:** extend the persistent read/write highlights with transfer motion between panels and explicit flag/stack-pointer change cues; retain reduced-motion support.
- [ ] **Byte inspector:** let a learner select a memory byte and see its address, hex, unsigned decimal, binary, and ASCII interpretations.

## Later milestones

- Add short exercises and example programs that teach variables, control flow, and functions.
- Explore a more controlled instruction editor if learners need it after trying the text editor.
- Explore reverse stepping and a gradually more debugger-like interface.
- Design a memory-mapped display and revisit the memory budget before attempting Conway's Game of Life.

## Decisions so far

The planned `JMP`/`JZ` contract uses existing instruction indices `0`–`N - 1`, independent of the 256-byte data memory. Both preserve `ZF` and other data state. All targets are validated before execution, including untaken branches. Falling through to `PC = N` completes without setting `halted`; jumping to `N` is invalid. Core branches require program-length context, and Debug will show instruction addresses separately from source lines. See the [control-flow contract](technical-design.md#control-flow-contract-jmp-and-jz). Core `JMP` is now implemented with an optional third `programLength` argument to `executeInstruction`, required for branches. It validates context and targets before returning a new state and a branch event. Existing non-branch callers still work without context. Source parsing now accepts unsigned decimal JMP targets and validates bounds once syntax parsing succeeds, including unreachable branches. Debug passes program length to execution and shows separate Line and PC labels with the next-instruction marker following the target. Editor help, README, and both references include JMP. Parser/core tests and the production build pass; browser verification of address alignment, jump feedback, self-jumps, and reset remains pending. `JZ` is implemented using shared branch target validation before checking ZF. Taken branches replace PC; untaken branches advance by one, including normal program-end completion. Both preserve data state and emit a branch event. Parsing validates every target, including unreachable and untaken branches. The interface explains taken/untaken outcomes and shows a ZF READ cue, cleared on the next step or reset. References include a tested countdown example. Core/parser tests and the production build pass; browser verification of JZ feedback and flag-read cue clearing remains pending.

CALL and RET are implemented in the core with two-byte little-endian return addresses, with programs limited to 65,535 instructions. CALL validates its target and saves PC + 1; RET validates a decoded address through program end. Stack overflow, underflow, and invalid addresses fail atomically. See the [CALL and RET contract](technical-design.md#stack-contract-call-and-ret).

The workspace uses an instrument-rack layout on desktop (1100px and wider, with at least 600px height), with internal overflow for long content. Smaller viewports reflow to preserve readable controls. Cyan means next instruction, amber means last read, mint means last write, and violet marks stack occupancy. Event highlights persist until the next step or reset; register write pulses respect reduced-motion preferences. Build and existing tests pass; browser layout verification remains pending.

The current machine uses zero-based instruction indices in `PC`. `MOV` accepts an unsigned byte (`0` through `255`), advances `PC` by one, and leaves `ZF`, `SP`, and memory unchanged. The empty downward-growing stack starts with `SP` one past the final byte, at `256`.

`ADD` stores the low 8 bits of the sum in its destination register and sets `ZF` when the stored result is zero.

`SUB` is available in the machine core and source parser: it stores destination minus source modulo 256 (so `0 - 1` becomes `255`) and sets `ZF` exactly when the stored result is zero. It advances `PC`, preserves memory, `SP`, and other registers, and emits a subtraction register-write event. Subtracting a register from itself produces zero. Source syntax is `SUB destination, source`, with two register operands. The interface explains subtraction and highlights its source as read and destination as written. Editor help and instruction references include SUB, with a runnable wraparound and self-subtraction example. Core/parser tests and the production build pass; browser verification of the highlights and explanation remains pending.

`CMP` is available in the machine core: it compares two registers, sets `ZF` when equal and clears it otherwise, and advances `PC` while preserving registers, memory, and `SP`. Its comparison event records both register names, their values, and the equality result; the app can describe this event. Core tests cover equality, inequality, self-comparison, all register pairs, state preservation, invalid registers, and halted execution. Source parsing now accepts `CMP destination, source`, with case/spacing/comment support and whole-program validation. Both compared registers are highlighted as reads; the existing explanation shows their values, equality, and resulting ZF. Editor help, README, and both references include CMP and an executable equal/unequal/self-comparison example. Parser/core tests and the production build pass; browser verification of comparison explanations, read highlights, and cue clearing remains pending.

`PUSH` decrements `SP` before writing, so `SP` points at the top byte after a push. The empty stack has `SP = 256`, and a push at `SP = 0` overflows. Stack writes copy memory before changing it, leaving earlier machine states intact.

`POP` is implemented in the core: it reads the byte at `SP` into a register and increments `SP`, leaving memory and `ZF` unchanged. An empty stack rejects `POP` with an underflow error; a stack-sourced register-write event supports upcoming transfer feedback. Source parsing accepts `POP register`; the interface identifies the stack source, highlights its memory address as read and the destination register as written, and updates stack occupancy. References include a runnable round trip. Browser verification remains pending. See the [POP contract](technical-design.md#stack-contract-pop).

`HALT` advances `PC` past itself and sets `halted`. Further execution is rejected until reset.

`STORE` copies a register byte to an integer memory address from 0 through 255, advances `PC`, and emits a memory-write event containing the previous byte. It copies memory before writing and preserves registers, `SP`, and `ZF`. Any memory byte is addressable, including stack bytes. Source syntax is `STORE register, address`, with decimal addresses from 0 through 255. The sample writes decimal 65 to address 0, shown as hex `41` and ASCII `A`.

`LOAD` copies the byte at an integer memory address from 0 through 255 into a register, advances `PC`, and emits a register-write event identifying the source address. It preserves memory, other registers, `SP`, and `ZF`. Source syntax is `LOAD register, address`, with decimal addresses. Execution, parsing, UI event handling, instruction-specific errors, and core/parser coverage are complete. Tests cover address endpoints, invalid operands, state preservation, PC advancement, and memory-source events. Documentation and sample integration are complete: the eight-instruction sample reads the stored byte back into R3 before halting with PC = 8. The user confirmed browser verification of the LOAD highlights, explanation, and cue clearing.

Program source accepts case-insensitive instructions and registers, flexible whitespace, blank lines, and `;` comments through the end of a line. Comments may follow instructions or occupy whole lines; comment-only lines do not consume instruction indices. Original source text and line numbers are preserved. `MOV` immediates are decimal integers from 0 to 255. Any parse error blocks the whole program. Source line numbers stay separate from zero-based `PC`; editing resets execution, while Reset preserves source.

## Working rule

As each small step is completed, mark it complete here alongside its changes, add any decision we learned, and split the next broad item if it is now close enough to implement. Check and stage the step, then stop with a suggested commit message for the user; do not create a commit. The plan can change as the prototype teaches us what works.
