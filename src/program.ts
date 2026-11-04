import {
  REGISTER_NAMES,
  type Instruction,
  type MOVInstruction,
  type ADDInstruction,
  type SUBInstruction,
  type CMPInstruction,
  type JMPInstruction,
  type JZInstruction,
  type STOREInstruction,
  type LOADInstruction,
  type PUSHInstruction,
  type POPInstruction,
  type HALTInstruction,
  type Register,
} from './machine.ts'

export const SAMPLE_SOURCE = 'MOV R0, 5\nMOV R1, 7\nADD R0, R1\nPUSH R0\nMOV R2, 65 ; ASCII code for A\nSTORE R2, 0 ; Write A into memory\nLOAD R3, 0 ; Read A back into R3\nHALT'

type ProgramLine = { source: string; lineNumber: number; instruction: Instruction }
type ProgramError = { lineNumber: number; message: string }

function register(value: string): Register {
  if (!REGISTER_NAMES.includes(value as Register)) {
    throw new Error(`${value} is not a register. Use R0, R1, R2, or R3.`)
  }
  return value as Register
}

function operandPair(operation: string, operands: string, source: string): [string, string] {
  const parts = operands.split(',').map((part) => part.trim())
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new Error(`Use ${operation} register, ${source}.`)
  }
  return [parts[0], parts[1]]
}

function byte(value: string, label: string): number {
  if (!/^\d+$/.test(value) || Number(value) > 255) {
    throw new Error(`${label} must be a decimal integer from 0 to 255.`)
  }
  return Number(value)
}

function move(operands: string): MOVInstruction {
  const [destination, value] = operandPair('MOV', operands, 'byte')
  return { operation: 'MOV', register: register(destination), value: byte(value, 'MOV value') }
}

function add(operands: string): ADDInstruction {
  const [destination, source] = operandPair('ADD', operands, 'register')
  return { operation: 'ADD', register: register(destination), source: register(source) }
}

function subtract(operands: string): SUBInstruction {
  const [destination, source] = operandPair('SUB', operands, 'register')
  return { operation: 'SUB', register: register(destination), source: register(source) }
}

function compare(operands: string): CMPInstruction {
  const [destination, source] = operandPair('CMP', operands, 'register')
  return { operation: 'CMP', register: register(destination), source: register(source) }
}

function branchTarget(operation: string, operands: string): number {
  if (!/^\d+$/.test(operands) || !Number.isSafeInteger(Number(operands))) {
    throw new Error(`${operation} target must be an unsigned decimal safe integer.`)
  }
  return Number(operands)
}

function jump(operands: string): JMPInstruction {
  return { operation: 'JMP', target: branchTarget('JMP', operands) }
}

function jumpIfZero(operands: string): JZInstruction {
  return { operation: 'JZ', target: branchTarget('JZ', operands) }
}

function store(operands: string): STOREInstruction {
  const [destination, address] = operandPair('STORE', operands, 'address')
  return { operation: 'STORE', register: register(destination), address: byte(address, 'STORE address') }
}

function load(operands: string): LOADInstruction {
  const [destination, address] = operandPair('LOAD', operands, 'address')
  return { operation: 'LOAD', register: register(destination), address: byte(address, 'LOAD address') }
}

function push(operands: string): PUSHInstruction {
  if (!operands || /[\s,]/.test(operands)) {
    throw new Error('Use PUSH register.')
  }
  return { operation: 'PUSH', register: register(operands) }
}

function pop(operands: string): POPInstruction {
  if (!operands || /[\s,]/.test(operands)) {
    throw new Error('Use POP register.')
  }
  return { operation: 'POP', register: register(operands) }
}

function halt(operands: string): HALTInstruction {
  if (operands) {
    throw new Error('HALT takes no operands.')
  }
  return { operation: 'HALT' }
}

function parseInstruction(text: string): Instruction {
  const [operation] = text.split(/\s+/)
  const operands = text.slice(operation.length).trim()
  switch (operation) {
    case 'MOV':
      return move(operands)
    case 'ADD':
      return add(operands)
    case 'SUB':
      return subtract(operands)
    case 'CMP':
      return compare(operands)
    case 'JZ':
      return jumpIfZero(operands)
    case 'JMP':
      return jump(operands)
    case 'STORE':
      return store(operands)
    case 'LOAD':
      return load(operands)
    case 'PUSH':
      return push(operands)
    case 'POP':
      return pop(operands)
    case 'HALT':
      return halt(operands)
    default:
      throw new Error(`Unsupported instruction: ${operation}. Use MOV, ADD, SUB, CMP, JMP, JZ, STORE, LOAD, PUSH, POP, or HALT.`)
  }
}

export function parseProgram(source: string): { program: ProgramLine[]; errors: ProgramError[] } {
  const program: ProgramLine[] = []
  const errors: ProgramError[] = []
  source.split(/\r?\n/).forEach((sourceLine, index) => {
    const text = sourceLine.split(';', 1)[0].trim().toUpperCase()
    if (!text) return
    const lineNumber = index + 1
    try {
      const instruction = parseInstruction(text)
      program.push({ source: sourceLine.trim(), lineNumber, instruction })
    } catch (error) {
      errors.push({ lineNumber, message: (error as Error).message })
    }
  })
  // Bounds need the complete instruction list; syntax errors must be fixed first.
  if (errors.length === 0) {
    for (const { instruction, lineNumber } of program) {
      if ((instruction.operation === 'JMP' || instruction.operation === 'JZ') && instruction.target >= program.length) {
        errors.push({ lineNumber, message: `${instruction.operation} target must identify an instruction from 0 to ${program.length - 1}.` })
      }
    }
  }
  return { program: errors.length ? [] : program, errors }
}
