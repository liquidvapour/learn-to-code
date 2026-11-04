import assert from 'node:assert/strict'
import test from 'node:test'
import { parseProgram, SAMPLE_SOURCE } from '../src/program.ts'
import { createInitialState, executeInstruction } from '../src/machine.ts'

test('sample parses and executes to completion', () => {
  const { program, errors } = parseProgram(SAMPLE_SOURCE)
  assert.deepEqual(errors, [])
  const state = program.reduce((state, line) => executeInstruction(state, line.instruction).state, createInitialState())
  assert.equal(state.halted, true)
  assert.equal(state.pc, 8)
  assert.deepEqual(program[6].instruction, { operation: 'LOAD', register: 'R3', address: 0 })
  assert.equal(state.registers.R3, 65)
  assert.equal(state.registers.R2, 65)
  assert.equal(state.memory[255], 12)
  assert.equal(state.memory[0], 65)
  assert.equal(state.memory[0].toString(16), '41')
  assert.equal(String.fromCharCode(state.memory[0]), 'A')
  assert.equal(state.sp, 255)
})

test('comments preserve source text and line numbers without consuming execution steps', () => {
  const { program, errors } = parseProgram(' ; Heading\r\n mov r0, 65; Keep Mixed Case; anything goes\r\n\r\n; UNKNOWN R9\r\n STORE R0, 0 ; Write A\r\nHALT; stop')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map((line) => line.lineNumber), [2, 5, 6])
  assert.equal(program[0].source, 'mov r0, 65; Keep Mixed Case; anything goes')
  assert.deepEqual(program.map((line) => line.instruction), [
    { operation: 'MOV', register: 'R0', value: 65 },
    { operation: 'STORE', register: 'R0', address: 0 },
    { operation: 'HALT' },
  ])
  const state = program.reduce((state, line) => executeInstruction(state, line.instruction).state, createInitialState())
  assert.equal(state.memory[0], 65)
  assert.equal(state.pc, 3)
  assert.equal(state.halted, true)
  assert.deepEqual(parseProgram('; Only comments\n  ; HALT\n;'), { program: [], errors: [] })
})

test('comments do not hide invalid instructions or change error line numbers', () => {
  const { program, errors } = parseProgram('; Heading\nMOV R0, 1 ; Valid\n; Spacer\nMOV R1, ; Missing byte\nHALT R0 ; Extra operand')
  assert.deepEqual(program, [])
  assert.deepEqual(errors.map((error) => error.lineNumber), [4, 5])
  assert.match(errors[0].message, /Use MOV register, byte/)
  assert.match(errors[1].message, /HALT takes no operands/)
})

test('STORE parses decimal address endpoints with flexible case and spacing', () => {
  const { program, errors } = parseProgram('\n store r0 , 0\n\tSTORE R3,255 ')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map((line) => line.instruction), [
    { operation: 'STORE', register: 'R0', address: 0 },
    { operation: 'STORE', register: 'R3', address: 255 },
  ])
  assert.deepEqual(program.map((line) => line.lineNumber), [2, 3])
})



test('STORE rejects invalid operands with source line errors and blocks the whole program', () => {
  for (const operands of ['R4, 0', 'R0, -1', 'R0, 256', 'R0, 1.5', 'R0, 0x41', 'R0, NaN', 'R0, Infinity', 'R0 1', 'R0,', ', 0', 'R0, 0, 1', '']) {
    const { program, errors } = parseProgram(`MOV R0, 65\nSTORE ${operands}\nHALT`)
    assert.deepEqual(program, [], operands)
    assert.equal(errors.length, 1, operands)
    assert.equal(errors[0].lineNumber, 2, operands)
    assert.ok(errors[0].message.length > 0, operands)
  }
  assert.match(parseProgram('STORE R0, 256').errors[0].message, /STORE address must be a decimal integer from 0 to 255/)
})

test('LOAD parses decimal address endpoints with flexible case, spacing, and comments', () => {
  const { program, errors } = parseProgram('; Read bytes\n load r0 , 0 ; First byte\n\tLOAD R3,255 ')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map((line) => line.instruction), [
    { operation: 'LOAD', register: 'R0', address: 0 },
    { operation: 'LOAD', register: 'R3', address: 255 },
  ])
  assert.deepEqual(program.map((line) => line.lineNumber), [2, 3])
  assert.equal(program[0].source, 'load r0 , 0 ; First byte')
})

test('LOAD rejects invalid operands with precise source errors and blocks the whole program', () => {
  const invalid = [
    ['R4, 0', 'R4 is not a register. Use R0, R1, R2, or R3.'],
    ...['-1', '256', '1.5', '0x41', 'NaN', 'Infinity', 'R1'].map((address) => [
      `R0, ${address}`, 'LOAD address must be a decimal integer from 0 to 255.',
    ]),
    ...['R0 1', 'R0,', ', 0', 'R0, 0, 1', ''].map((operands) => [
      operands, 'Use LOAD register, address.',
    ]),
  ]
  for (const [operands, message] of invalid) {
    const result = parseProgram(`MOV R0, 65\nLOAD ${operands}\nHALT`)
    assert.deepEqual(result, { program: [], errors: [{ lineNumber: 2, message }] }, operands)
  }
})

test('unsupported-instruction help includes JMP, CMP, SUB, and LOAD', () => {
  assert.deepEqual(parseProgram('UNKNOWN').errors, [{
    lineNumber: 1,
    message: 'Unsupported instruction: UNKNOWN. Use MOV, ADD, SUB, CMP, JMP, JZ, STORE, LOAD, PUSH, POP, or HALT.',
  }])
})

test('whitespace, case, blank lines, and byte endpoints preserve source mapping', () => {
  const { program, errors } = parseProgram('\r\n mov r0 , 0\r\n\tMOV R3, 255\r\n\n add r0,r3\n push r0\n halt  ')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map((line) => line.lineNumber), [2, 3, 5, 6, 7])
  assert.deepEqual(program[1].instruction, { operation: 'MOV', register: 'R3', value: 255 })
  assert.deepEqual(parseProgram(' \n\t'), { program: [], errors: [] })
})

test('invalid programs report every source line and expose no executable partial program', () => {
  const invalid = [
    'MOV R4, 1', 
    'MOV R0, 256', 
    'MOV R0, -1', 
    'MOV R0, 1.5', 
    'MOV R0, 0x41', 
    'MOV R0 1', 
    'ADD R0, R9', 
    'PUSH R0, R1', 
    'HALT R0', 
    'UNKNOWN R0, 1', 
    'MOV R0,', 
    'ADD R0, R1, R2',
    'LOAD RO, 256'
  ]
  for (const source of invalid) {
    const result = parseProgram(`MOV R0, 1\n\n${source}\nHALT`)
    assert.deepEqual(result.program, [], source)
    assert.equal(result.errors[0].lineNumber, 3, source)
    assert.ok(result.errors[0].message.length > 0)
  }
  assert.equal(parseProgram(invalid.join('\n')).errors.length, invalid.length)
})


test('SUB parses flexible case, spacing, and comments while preserving source mapping', () => {
  const { program, errors } = parseProgram('; Subtract\n sub r0 , r1 ; Keep Case\n\tSUB R3,R3 ')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map((line) => line.instruction), [
    { operation: 'SUB', register: 'R0', source: 'R1' },
    { operation: 'SUB', register: 'R3', source: 'R3' },
  ])
  assert.deepEqual(program.map((line) => line.lineNumber), [2, 3])
  assert.equal(program[0].source, 'sub r0 , r1 ; Keep Case')
})

test('SUB rejects invalid operands and blocks the whole program with precise errors', () => {
  const invalid = [
    ['R4, R0', 'R4 is not a register. Use R0, R1, R2, or R3.'],
    ['R0, R9', 'R9 is not a register. Use R0, R1, R2, or R3.'],
    ['R0, 1', '1 is not a register. Use R0, R1, R2, or R3.'],
    ...['', 'R0', 'R0 R1', 'R0,', ', R1', 'R0, R1, R2'].map((operands) => [
      operands, 'Use SUB register, register.',
    ]),
  ]
  for (const [operands, message] of invalid) {
    assert.deepEqual(parseProgram(`MOV R0, 5\nSUB ${operands}\nHALT`), {
      program: [], errors: [{ lineNumber: 2, message }],
    }, operands)
  }
})

test('documented SUB example wraps below zero and sets ZF on self-subtraction', () => {
  const { program, errors } = parseProgram('MOV R0, 0\nMOV R1, 1\nSUB R0, R1\nSUB R0, R0\nHALT')
  assert.deepEqual(errors, [])
  let state = createInitialState()
  const steps = program.map(({ instruction }) => {
    const result = executeInstruction(state, instruction)
    state = result.state
    return result
  })
  assert.equal(steps[2].state.registers.R0, 255)
  assert.equal(steps[2].state.zf, false)
  assert.deepEqual(steps[2].events, [{
    kind: 'register-write', register: 'R0', previous: 0, value: 255,
    source: 'subtraction', sourceRegister: 'R1',
  }])
  assert.equal(steps[3].state.registers.R0, 0)
  assert.equal(steps[3].state.zf, true)
  assert.equal(state.registers.R1, 1)
  assert.equal(state.pc, 5)
  assert.equal(state.halted, true)
})

test('CMP parses flexible case, spacing, and comments while preserving source mapping', () => {
  const { program, errors } = parseProgram('; Compare\n cmp r0 , r1 ; Keep Case\n\tCMP R3,R3 ')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map((line) => line.instruction), [
    { operation: 'CMP', register: 'R0', source: 'R1' },
    { operation: 'CMP', register: 'R3', source: 'R3' },
  ])
  assert.deepEqual(program.map((line) => line.lineNumber), [2, 3])
  assert.equal(program[0].source, 'cmp r0 , r1 ; Keep Case')
})

test('CMP rejects invalid operands and blocks the whole program with precise errors', () => {
  const invalid = [
    ['R4, R0', 'R4 is not a register. Use R0, R1, R2, or R3.'],
    ['R0, R9', 'R9 is not a register. Use R0, R1, R2, or R3.'],
    ['R0, 1', '1 is not a register. Use R0, R1, R2, or R3.'],
    ...['', 'R0', 'R0 R1', 'R0,', ', R1', 'R0, R1, R2'].map((operands) => [
      operands, 'Use CMP register, register.',
    ]),
  ]
  for (const [operands, message] of invalid) {
    assert.deepEqual(parseProgram(`MOV R0, 5\nCMP ${operands}\nHALT`), {
      program: [], errors: [{ lineNumber: 2, message }],
    }, operands)
  }
})


test('documented CMP example compares equal, unequal, and identical registers', () => {
  const { program, errors } = parseProgram('MOV R0, 5\nMOV R1, 5\nCMP R0, R1\nMOV R1, 7\nCMP R0, R1\nCMP R0, R0\nHALT')
  assert.deepEqual(errors, [])
  let state = createInitialState()
  const comparisons = []
  for (const { instruction } of program) {
    const previous = state
    const result = executeInstruction(state, instruction)
    state = result.state
    if (instruction.operation === 'CMP') {
      assert.deepEqual(state.registers, previous.registers)
      assert.deepEqual(state.memory, previous.memory)
      assert.equal(state.sp, previous.sp)
      assert.equal(state.pc, previous.pc + 1)
      comparisons.push(result.events[0])
    }
  }
  assert.deepEqual(comparisons, [
    { kind: 'comparison', register: 'R0', sourceRegister: 'R1', value: 5, sourceValue: 5, equal: true },
    { kind: 'comparison', register: 'R0', sourceRegister: 'R1', value: 5, sourceValue: 7, equal: false },
    { kind: 'comparison', register: 'R0', sourceRegister: 'R0', value: 5, sourceValue: 5, equal: true },
  ])
  assert.equal(state.zf, true)
  assert.equal(state.pc, 7)
  assert.equal(state.halted, true)
})

test('JMP supports forward, backward, and self targets with source-line mapping', () => {
  const { program, errors } = parseProgram('; Heading\r\n jmp 002 ; Forward\r\n\r\nJMP 0\n; Comment\nJMP 2')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map(({ instruction }) => instruction), [
    { operation: 'JMP', target: 2 }, { operation: 'JMP', target: 0 }, { operation: 'JMP', target: 2 },
  ])
  assert.deepEqual(program.map(({ lineNumber }) => lineNumber), [2, 4, 6])
  assert.equal(program[0].source, 'jmp 002 ; Forward')
  assert.deepEqual(parseProgram('JMP 0').errors, [])
})

test('JMP rejects malformed and unsafe targets with source errors', () => {
  for (const target of ['', '-1', '+1', '1.5', '0x1', '1e0', 'NaN', 'Infinity', 'R0', 'label', '0, 1', '0 1', '9007199254740992']) {
    assert.deepEqual(parseProgram(`; Header\nJMP ${target}\nHALT`), {
      program: [], errors: [{ lineNumber: 2, message: 'JMP target must be an unsigned decimal safe integer.' }],
    }, target)
  }
})

test('JMP validates every target against the final instruction count, including unreachable branches', () => {
  assert.deepEqual(parseProgram('HALT\n; Comment\nJMP 3\n\nJMP 9007199254740991'), {
    program: [], errors: [
      { lineNumber: 3, message: 'JMP target must identify an instruction from 0 to 2.' },
      { lineNumber: 5, message: 'JMP target must identify an instruction from 0 to 2.' },
    ],
  })
  assert.deepEqual(parseProgram('JMP 1'), {
    program: [], errors: [{ lineNumber: 1, message: 'JMP target must identify an instruction from 0 to 0.' }],
  })
  // Syntax errors block execution before target bounds use an incomplete instruction list.
  assert.deepEqual(parseProgram('JMP 2\nINVALID\nHALT').errors.map(({ lineNumber }) => lineNumber), [2])
})

test('JMP accepts instruction addresses above 255 in longer programs', () => {
  const { program, errors } = parseProgram(['JMP 256', ...Array(256).fill('HALT')].join('\n'))
  assert.deepEqual(errors, [])
  const result = executeInstruction(createInitialState(), program[0].instruction, program.length)
  assert.equal(result.state.pc, 256)
})

test('documented JMP example skips a write and halts at its target', () => {
  const { program, errors } = parseProgram('MOV R0, 5\nJMP 3\nMOV R0, 99\nHALT')
  assert.deepEqual(errors, [])
  let state = createInitialState()
  const visited = []
  for (let step = 0; step < 3; step++) {
    visited.push(state.pc)
    state = executeInstruction(state, program[state.pc].instruction, program.length).state
  }
  assert.deepEqual(visited, [0, 1, 3])
  assert.equal(state.registers.R0, 5)
  assert.equal(state.pc, 4)
  assert.equal(state.halted, true)
})

test('JZ parses case, whitespace, comments, and forward/backward/self targets', () => {
  const { program, errors } = parseProgram('; Heading\r\n jz 002 ; Keep Case\r\n\r\nJZ 0\n; Spacer\nJZ 2')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map(({ instruction }) => instruction), [
    { operation: 'JZ', target: 2 }, { operation: 'JZ', target: 0 }, { operation: 'JZ', target: 2 },
  ])
  assert.deepEqual(program.map(({ lineNumber }) => lineNumber), [2, 4, 6])
  assert.equal(program[0].source, 'jz 002 ; Keep Case')
})

test('JZ rejects malformed operands and bounds even when unreachable or initially untaken', () => {
  for (const target of ['', '-1', '+1', '1.5', '0x1', '1e0', 'NaN', 'Infinity', 'R0', 'label', '0, 1', '0 1', '9007199254740992']) {
    assert.deepEqual(parseProgram(`; Header\nJZ ${target}\nHALT`), {
      program: [], errors: [{ lineNumber: 2, message: 'JZ target must be an unsigned decimal safe integer.' }],
    }, target)
  }
  assert.deepEqual(parseProgram('JZ 3\nHALT\n; Unreachable\nJZ 9007199254740991'), {
    program: [], errors: [
      { lineNumber: 1, message: 'JZ target must identify an instruction from 0 to 2.' },
      { lineNumber: 4, message: 'JZ target must identify an instruction from 0 to 2.' },
    ],
  })
  assert.deepEqual(parseProgram('JZ 2\nINVALID\nHALT').errors.map(({ lineNumber }) => lineNumber), [2])
})

test('JZ accepts targets above 255 and can fall through the program end', () => {
  const { program, errors } = parseProgram(['JZ 256', ...Array(256).fill('HALT')].join('\n'))
  assert.deepEqual(errors, [])
  assert.equal(executeInstruction({ ...createInitialState(), zf: true }, program[0].instruction, program.length).state.pc, 256)
  const single = parseProgram('JZ 0')
  assert.deepEqual(single.errors, [])
  const result = executeInstruction(createInitialState(), single.program[0].instruction, 1)
  assert.equal(result.state.pc, 1)
  assert.equal(result.state.halted, false)
})

test('documented countdown uses JZ to exit and JMP to repeat', () => {
  const { program, errors } = parseProgram('MOV R0, 3\nMOV R1, 1\nSUB R0, R1\nJZ 5\nJMP 2\nHALT')
  assert.deepEqual(errors, [])
  let state = createInitialState()
  const branches = []
  const values = []
  for (let step = 0; step < 12 && !state.halted; step++) {
    const instruction = program[state.pc].instruction
    const result = executeInstruction(state, instruction, program.length)
    state = result.state
    if (instruction.operation === 'JZ') branches.push(result.events[0].taken)
    if (instruction.operation === 'SUB') values.push(state.registers.R0)
  }
  assert.deepEqual(values, [2, 1, 0])
  assert.deepEqual(branches, [false, false, true])
  assert.equal(state.registers.R0, 0)
  assert.equal(state.registers.R1, 1)
  assert.equal(state.zf, true)
  assert.equal(state.halted, true)
  assert.equal(state.pc, 6)
})


test('POP parses and executes a stack round trip with source mapping', () => {
  const { program, errors } = parseProgram('MOV R0, 12\nPUSH R0\n; remove top\n pop r1 ; result\nHALT')
  assert.deepEqual(errors, [])
  assert.equal(program[2].lineNumber, 4)
  assert.equal(program[2].source, 'pop r1 ; result')
  assert.deepEqual(program[2].instruction, { operation: 'POP', register: 'R1' })
  const state = program.reduce((state, line) => executeInstruction(state, line.instruction).state, createInitialState())
  assert.equal(state.registers.R1, 12)
  assert.equal(state.sp, 256)
  assert.equal(state.memory[255], 12)
})

test('POP rejects invalid operands and blocks the whole program', () => {
  for (const operands of ['', 'R0, R1', 'R0 R1', 'R0,']) {
    const result = parseProgram(`PUSH R0\nPOP ${operands}`)
    assert.deepEqual(result, { program: [], errors: [{ lineNumber: 2, message: 'Use POP register.' }] })
  }
  assert.deepEqual(parseProgram('POP R4').errors, [{ lineNumber: 1, message: 'R4 is not a register. Use R0, R1, R2, or R3.' }])
})
