import assert from 'node:assert/strict'
import test from 'node:test'
import { parseProgram, SAMPLE_SOURCE } from '../src/program.ts'
import { createInitialState, executeInstruction } from '../src/machine.ts'

test('sample parses and executes to completion', () => {
  const { program, errors } = parseProgram(SAMPLE_SOURCE)
  assert.deepEqual(errors, [])
  const state = program.reduce((state, line) => executeInstruction(state, line.instruction).state, createInitialState())
  assert.equal(state.halted, true)
  assert.equal(state.memory[255], 12)
  assert.equal(state.memory[0], 65)
  assert.equal(state.memory[0].toString(16), '41')
  assert.equal(String.fromCharCode(state.memory[0]), 'A')
  assert.equal(state.sp, 255)
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

test('whitespace, case, blank lines, and byte endpoints preserve source mapping', () => {
  const { program, errors } = parseProgram('\r\n mov r0 , 0\r\n\tMOV R3, 255\r\n\n add r0,r3\n push r0\n halt  ')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map((line) => line.lineNumber), [2, 3, 5, 6, 7])
  assert.deepEqual(program[1].instruction, { operation: 'MOV', register: 'R3', value: 255 })
  assert.deepEqual(parseProgram(' \n\t'), { program: [], errors: [] })
})

test('invalid programs report every source line and expose no executable partial program', () => {
  const invalid = ['MOV R4, 1', 'MOV R0, 256', 'MOV R0, -1', 'MOV R0, 1.5', 'MOV R0, 0x41', 'MOV R0 1', 'ADD R0, R9', 'PUSH R0, R1', 'HALT R0', 'LOAD R0, 1', 'MOV R0,', 'ADD R0, R1, R2']
  for (const source of invalid) {
    const result = parseProgram(`MOV R0, 1\n\n${source}\nHALT`)
    assert.deepEqual(result.program, [], source)
    assert.equal(result.errors[0].lineNumber, 3, source)
    assert.ok(result.errors[0].message.length > 0)
  }
  assert.equal(parseProgram(invalid.join('\n')).errors.length, invalid.length)
})
