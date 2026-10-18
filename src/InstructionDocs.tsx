export default function InstructionDocs() {
  return (
    <article className="instruction-docs">
      <section aria-labelledby="writing-programs">
        <h2 id="writing-programs">Writing a program</h2>
        <p>Write one instruction per line. Instructions and register names are case-insensitive, spacing is flexible, and blank lines are ignored. Separate two operands with a comma. Comments and labels are not supported.</p>
        <p>Use registers <code>R0</code>, <code>R1</code>, <code>R2</code>, and <code>R3</code>. Each holds one unsigned byte, from 0 to 255. Write values and memory addresses as decimal integers from 0 to 255; hexadecimal literals such as <code>0x41</code> are not accepted in source.</p>
        <p>Source errors show their line numbers and block the whole program. Step executes the next highlighted instruction. Editing resets execution and clears the machine. Reset clears the machine while keeping your source; Restore sample replaces your source and resets execution.</p>
      </section>

      <section aria-labelledby="machine-state">
        <h2 id="machine-state">Machine state</h2>
        <p>The machine starts with four zeroed registers, 256 zeroed memory bytes, PC = 0, SP = 256, and ZF = 0.</p>
        <dl>
          <dt>PC — program counter</dt>
          <dd>The zero-based index of the next instruction, excluding blank lines. Every supported instruction advances PC by one, including HALT. Source line numbers are shown separately.</dd>
          <dt>SP — stack pointer</dt>
          <dd>The address of the top stack byte. An empty stack has SP = 256, just beyond memory. PUSH grows the stack toward lower addresses.</dd>
          <dt>ZF — zero flag</dt>
          <dd>ADD sets this to 1 when its stored result is zero, otherwise 0. All other supported instructions preserve it.</dd>
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
          <h3>STORE — write a register to memory</h3>
          <p><code>STORE register, address</code></p>
          <p>Copy the register byte into the specified decimal memory address, replacing the previous byte. Registers, SP, and ZF stay unchanged. Every address from 0 to 255 is writable, including occupied stack bytes.</p>
          <pre><code>{'MOV R2, 65\nSTORE R2, 0'}</code></pre>
          <p>Address 0 (0x00) holds decimal 65. The first cell in the memory grid shows hex 41, and the ASCII column shows A. R2 still holds 65.</p>
        </section>
        <section>
          <h3>PUSH — copy a register onto the stack</h3>
          <p><code>PUSH register</code></p>
          <p>Decrease SP by one, then write the register byte at the new SP address. Registers and ZF stay unchanged. A push with SP = 0 is rejected as a stack overflow.</p>
          <pre><code>{'MOV R0, 12\nPUSH R0'}</code></pre>
          <p>Starting with an empty stack, SP becomes 255 (0xFF) and memory at that address becomes 12 (hex 0C). The next push writes at 254 (0xFE). Stack writes can overwrite bytes previously written by STORE.</p>
        </section>
        <section>
          <h3>HALT — stop execution</h3>
          <p><code>HALT</code></p>
          <p>Takes no operands. Advance PC and mark the machine halted. Registers, memory, SP, and ZF stay unchanged. Step is disabled until the machine is reset. If a program reaches its final instruction without HALT, the interface instead reports Program complete.</p>
        </section>
      </section>

      <section aria-labelledby="sample-walkthrough">
        <h2 id="sample-walkthrough">Sample walkthrough</h2>
        <pre><code>{'MOV R0, 5\nMOV R1, 7\nADD R0, R1\nPUSH R0\nMOV R2, 65\nSTORE R2, 0\nHALT'}</code></pre>
        <p>The first two instructions set R0 to 5 and R1 to 7. ADD makes R0 = 12 and ZF = 0. PUSH copies 12 to address 255 and makes SP = 255. MOV sets R2 = 65, then STORE copies it to address 0. HALT stops with PC = 7. Look for 41 and A in the first memory row, and 0C in the stack close-up.</p>
        <p><a href="#machine">Return to the machine</a> to step through the sample. Opening this reference preserves your source and execution state.</p>
      </section>
    </article>
  )
}
