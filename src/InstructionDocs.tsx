export default function InstructionDocs() {
  return (
    <article className="instruction-docs">
      <section aria-labelledby="writing-programs">
        <h2 id="writing-programs">Writing a program</h2>
        <p>Write one instruction per line. Instructions and register names are case-insensitive, spacing is flexible, and blank lines are ignored. Separate two operands with a comma. A semicolon (<code>;</code>) starts a comment through the end of the line, either after an instruction or on its own line. For example: <code>MOV R2, 65 ; ASCII code for A</code>. Labels are not supported.</p>
        <p>Use registers <code>R0</code>, <code>R1</code>, <code>R2</code>, and <code>R3</code>. Each holds one unsigned byte, from 0 to 255. Write values and memory addresses as decimal integers from 0 to 255; hexadecimal literals such as <code>0x41</code> are not accepted in source.</p>
        <p>Source errors show their line numbers and block the whole program. Step executes the next highlighted instruction. Editing resets execution and clears the machine. Reset clears the machine while keeping your source; Restore sample replaces your source and resets execution.</p>
      </section>

      <section aria-labelledby="machine-state">
        <h2 id="machine-state">Machine state</h2>
        <p>The machine starts with four zeroed registers, 256 zeroed memory bytes, PC = 0, SP = 256, and ZF = 0.</p>
        <dl>
          <dt>PC — program counter</dt>
          <dd>The zero-based index of the next instruction, excluding blank and comment-only lines. JMP replaces PC with its target; JZ does so when ZF is 1 and otherwise advances by one. CALL jumps after saving the next address; RET restores a saved address. Other supported instructions advance PC by one, including HALT. Debug shows source lines labelled Line and instruction addresses labelled PC.</dd>
          <dt>SP — stack pointer</dt>
          <dd>The address of the top stack byte. An empty stack has SP = 256, just beyond memory. PUSH grows the stack toward lower addresses.</dd>
          <dt>ZF — zero flag</dt>
          <dd>ADD and SUB set this to 1 when their stored result is zero, otherwise 0. CMP sets it to 1 when its two register values are equal, otherwise 0. All other supported instructions preserve it.</dd>
        </dl>
        <p>Memory addresses run from decimal 0 to 255 (hex 0x00–0xFF). The hex grid and stack close-up show the same memory. Printable ASCII bytes (32–126) appear as characters; other bytes appear as dots.</p>
      </section>

      <section aria-labelledby="supported-instructions">
        <h2 id="supported-instructions">Supported instructions</h2>
        <section>
          <h3>MOV — set a register</h3>
          <p><code>MOV register, value</code></p>
          <p>Copy a decimal byte value into the destination register, replacing its previous value. Other registers, memory, SP, and ZF stay unchanged.</p>
          <pre><code>MOV R0, 65</code></pre>
          <p>R0 becomes 65. Values below 0, above 255, or with a fractional part are rejected.</p>
        </section>
        <section>
          <h3>ADD — add two registers</h3>
          <p><code>ADD destination, source</code></p>
          <p>Add the two register values and store the low 8 bits in the destination. Results wrap around at 256: 255 + 1 becomes 0. ZF reflects the stored result. Memory and SP stay unchanged; the source register stays unchanged unless it is also the destination.</p>
          <pre><code>{'MOV R0, 255\nMOV R1, 1\nADD R0, R1'}</code></pre>
          <p>R0 becomes 0, R1 remains 1, and ZF becomes 1. Using the same register twice, such as <code>ADD R0, R0</code>, doubles its value with the same wraparound rule.</p>
        </section>
        <section>
          <h3>SUB — subtract two registers</h3>
          <p><code>SUB destination, source</code></p>
          <p>Subtract the source register from the destination and store the result modulo 256: 0 − 1 becomes 255. ZF is 1 exactly when the stored result is zero. Memory, SP, and other registers stay unchanged.</p>
          <pre><code>{'MOV R0, 0\nMOV R1, 1\nSUB R0, R1\nSUB R0, R0\nHALT'}</code></pre>
          <p>The first SUB makes R0 = 255 and ZF = 0, while R1 remains 1. Subtracting R0 from itself then makes R0 = 0 and ZF = 1. The source register is highlighted as a read and the destination as a write.</p>
        </section>
        <section>
          <h3>CMP — compare two registers</h3>
          <p><code>CMP destination, source</code></p>
          <p>Compare two register values: set ZF to 1 when equal, otherwise 0. Registers, memory, and SP stay unchanged; PC advances by one. Both operands must be registers.</p>
          <pre><code>{'MOV R0, 5\nMOV R1, 5\nCMP R0, R1\nMOV R1, 7\nCMP R0, R1\nCMP R0, R0\nHALT'}</code></pre>
          <p>The comparisons set ZF to 1, then 0, then 1 for self-comparison. R0 stays 5 and R1 ends at 7. Both compared registers are highlighted as reads, and the explanation shows their values and equality result.</p>
        </section>
        <section>
          <h3>JMP — jump to an instruction</h3>
          <p><code>JMP target</code></p>
          <p>Set PC to the target instruction address. Use an unsigned decimal integer from 0 through the last instruction index. Blank and comment-only lines do not count. Targets may exceed 255 in longer programs; labels and hexadecimal literals are not supported.</p>
          <pre><code>{'MOV R0, 5\nJMP 3\nMOV R0, 99\nHALT'}</code></pre>
          <p>JMP skips the write of 99 and selects HALT at address 3, leaving R0 = 5. Registers, memory, SP, and ZF stay unchanged. The explanation shows the old and new PC, and Next marks the target.</p>
          <p>Backward and self-jumps are valid. <code>JMP 0</code> alone repeats the same instruction on each Step. Every target must exist, even in unreachable code; invalid targets block the whole program. Jumping just past the last instruction is invalid. Use HALT to stop explicitly.</p>
        </section>
        <section>
          <h3>JZ — jump if the zero flag is set</h3>
          <p><code>JZ target</code></p>
          <p>Read ZF: when it is 1, jump to the target instruction; when it is 0, continue to the next instruction. Registers, memory, SP, and ZF stay unchanged. Targets follow the same rules as JMP and must exist even when the jump would not be taken.</p>
          <pre><code>{'MOV R0, 3\nMOV R1, 1\nSUB R0, R1\nJZ 5\nJMP 2\nHALT'}</code></pre>
          <p>R0 counts down through 2, 1, and 0. SUB sets ZF when R0 reaches zero, so JZ jumps to HALT at address 5. Otherwise JMP returns to SUB at address 2. The explanation reports whether JZ was taken and ZF is marked READ.</p>
          <p>JZ also works after CMP: load the value to compare into another register, then use <code>CMP R0, R2</code>. CMP sets ZF when those registers are equal. An untaken final JZ completes the program without setting the halted state.</p>
        </section>
        <section>
          <h3>CALL and RET — call a subroutine</h3>
          <p><code>CALL target</code> saves the next instruction address as two little-endian bytes on the stack and jumps to an existing instruction. <code>RET</code> reads those bytes, removes them from the stack, and returns to the saved address. Both preserve registers and ZF. RET leaves the bytes in memory.</p>
          <pre><code>{'MOV R0, 1\nCALL 3\nHALT\nCALL 5\nRET\nADD R0, R0\nRET'}</code></pre>
          <p>The call at PC 1 enters PC 3, which calls PC 5. The inner return goes to PC 4; the outer return goes to HALT at PC 2. R0 ends at 2 and SP returns to 256. CALL highlights both stack bytes written; RET highlights both bytes read. Insufficient stack space or bytes, and invalid return addresses, stop execution without changing state.</p>
        </section>
        <section>
          <h3>STORE — write a register to memory</h3>
          <p><code>STORE register, address</code></p>
          <p>Copy the register byte into the specified decimal memory address, replacing the previous byte. Registers, SP, and ZF stay unchanged. Every address from 0 to 255 is writable, including occupied stack bytes.</p>
          <pre><code>{'MOV R2, 65\nSTORE R2, 0'}</code></pre>
          <p>Address 0 (0x00) holds decimal 65. The first cell in the memory grid shows hex 41, and the ASCII column shows A. R2 still holds 65.</p>
        </section>
        <section>
          <h3>LOAD — read memory into a register</h3>
          <p><code>LOAD register, address</code></p>
          <p>Copy the byte at the specified decimal memory address into the destination register, replacing its previous value. Memory, other registers, SP, and ZF stay unchanged. Every address from 0 to 255 is readable, including occupied stack bytes.</p>
          <pre><code>{'MOV R2, 65\nSTORE R2, 0\nLOAD R3, 0'}</code></pre>
          <p>R3 becomes 65, while address 0 and R2 still hold 65. The source memory cell is highlighted as a read and R3 as a write. Addresses below 0, above 255, or with a fractional part are rejected.</p>
        </section>
        <section>
          <h3>PUSH — copy a register onto the stack</h3>
          <p><code>PUSH register</code></p>
          <p>Decrease SP by one, then write the register byte at the new SP address. Registers and ZF stay unchanged. A push with SP = 0 is rejected as a stack overflow.</p>
          <pre><code>{'MOV R0, 12\nPUSH R0'}</code></pre>
          <p>Starting with an empty stack, SP becomes 255 (0xFF) and memory at that address becomes 12 (hex 0C). The next push writes at 254 (0xFE). Stack writes can overwrite bytes previously written by STORE.</p>
        </section>
        <section>
          <h3>POP — remove the top stack byte</h3>
          <p><code>POP register</code></p>
          <p>Copy the byte at SP into the register, then increase SP by one. The byte remains in memory, but is no longer on the stack. Other registers, memory, and ZF stay unchanged. A pop from an empty stack is rejected as a stack underflow.</p>
          <pre><code>{'MOV R0, 12\nPUSH R0\nPOP R1'}</code></pre>
          <p>R1 becomes 12 and SP returns to 256. The source memory cell is highlighted as a read and R1 as a write.</p>
        </section>
        <section>
          <h3>HALT — stop execution</h3>
          <p><code>HALT</code></p>
          <p>Takes no operands. Advance PC and mark the machine halted. Registers, memory, SP, and ZF stay unchanged. Step is disabled until the machine is reset. If a program advances past its final instruction without HALT, the interface instead reports Program complete.</p>
        </section>
      </section>

      <section aria-labelledby="sample-walkthrough">
        <h2 id="sample-walkthrough">Sample walkthrough</h2>
        <pre><code>{'MOV R0, 5\nMOV R1, 7\nADD R0, R1\nPUSH R0\nMOV R2, 65\nSTORE R2, 0\nLOAD R3, 0\nHALT'}</code></pre>
        <p>The first two instructions set R0 to 5 and R1 to 7. ADD makes R0 = 12 and ZF = 0. PUSH copies 12 to address 255 and makes SP = 255. MOV sets R2 = 65, then STORE copies it to address 0. LOAD reads that byte back into R3, making R3 = 65 while memory stays unchanged. HALT stops with PC = 8. Look for 41 and A in the first memory row, and 0C in the stack close-up.</p>
        <p><a href="#machine">Return to the machine</a> to step through the sample. Opening this reference preserves your source and execution state.</p>
      </section>
    </article>
  )
}
