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
})

test('whitespace, case, blank lines, and byte endpoints preserve source mapping', () => {
  const { program, errors } = parseProgram('\r\n mov r0 , 0\r\n\tMOV R3, 255\r\n\n add r0,r3\n push r0\n halt  ')
  assert.deepEqual(errors, [])
  assert.deepEqual(program.map((line) => line.lineNumber), [2, 3, 5, 6, 7])
  assert.deepEqual(program[1].instruction, { operation: 'MOV', register: 'R3', value: 255 })
  assert.deepEqual(parseProgram(' \n\t'), { program: [], errors: [] })
})

test('invalid programs report every source line and expose no executable partial program', () => {
  const invalid = ['MOV R4, 1', 'MOV R0, 256', 'MOV R0, -1', 'MOV R0, 1.5', 'MOV R0, 0x41', 'MOV R0 1', 'ADD R0, R9', 'PUSH R0, R1', 'HALT R0', 'STORE R0, 1', 'MOV R0,', 'ADD R0, R1, R2']
  for (const source of invalid) {
    const result = parseProgram(`MOV R0, 1\n\n${source}\nHALT`)
    assert.deepEqual(result.program, [], source)
    assert.equal(result.errors[0].lineNumber, 3, source)
    assert.ok(result.errors[0].message.length > 0)
  }
  assert.equal(parseProgram(invalid.join('\n')).errors.length, invalid.length)
})
