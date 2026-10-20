import { REGISTER_NAMES, type Instruction, type Register } from './machine.ts'

export const SAMPLE_SOURCE = 'MOV R0, 5\nMOV R1, 7\nADD R0, R1\nPUSH R0\nMOV R2, 65\nSTORE R2, 0\nHALT'

type ProgramLine = { source: string; lineNumber: number; instruction: Instruction }
type ProgramError = { lineNumber: number; message: string }

export function parseProgram(source: string): { program: ProgramLine[]; errors: ProgramError[] } {
  const program: ProgramLine[] = []
  const errors: ProgramError[] = []
  source.split(/\r?\n/).forEach((sourceLine, index) => {
    const text = sourceLine.trim().toUpperCase()
    if (!text) return
    const lineNumber = index + 1
    function register(value: string): Register {
      if (!REGISTER_NAMES.includes(value as Register)) throw new Error(`${value} is not a register. Use R0, R1, R2, or R3.`)
      return value as Register
    }
    try {
      const [operation] = text.split(/\s+/)
      const operands = text.slice(operation.length).trim()
      let instruction: Instruction
      switch (operation) {
        case 'MOV':
        case 'STORE':
        case 'LOAD':
        case 'ADD': {
          const parts = operands.split(',').map((part) => part.trim())
          if (parts.length !== 2 || parts.some((part) => !part)) {
            throw new Error(`Use ${operation} register, ${operation === 'MOV' ? 'byte' : operation === 'STORE' || operation === 'LOAD' ? 'address' : 'register'}.`)
          }
          const destination = register(parts[0])
          if (operation === 'ADD') {
            instruction = { operation, register: destination, source: register(parts[1]) }
          } else {
            if (!/^\d+$/.test(parts[1]) || Number(parts[1]) > 255) {
              throw new Error(`${operation === 'STORE' ? 'STORE address' : 'MOV value'} must be a decimal integer from 0 to 255.`)
            }
            instruction = operation === 'STORE' || operation === 'LOAD'
              ? { operation, register: destination, address: Number(parts[1]) }
              : { operation, register: destination, value: Number(parts[1]) }
          }
          break
        }
        case 'PUSH':
          if (!operands || /[\s,]/.test(operands)) throw new Error('Use PUSH register.')
          instruction = { operation, register: register(operands) }
          break
        case 'HALT':
          if (operands) throw new Error('HALT takes no operands.')
          instruction = { operation }
          break
        default:
          throw new Error(`Unsupported instruction: ${operation}. Use MOV, ADD, STORE, PUSH, or HALT.`)
      }
      program.push({ source: sourceLine.trim(), lineNumber, instruction })
    } catch (error) {
      errors.push({ lineNumber, message: (error as Error).message })
    }
  })
  return { program: errors.length ? [] : program, errors }
}
