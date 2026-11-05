export const REGISTER_NAMES = ['R0', 'R1', 'R2', 'R3'] as const
export const MEMORY_SIZE = 256
export const OUTPUT_CAPACITY = 64
export const MAX_PROGRAM_LENGTH = 0xffff
const MAX_BYTE = 0xff

export type Register = (typeof REGISTER_NAMES)[number]

const InstrictionMOV = 'MOV'
const InstrictionADD = 'ADD'
const InstrictionSUB = 'SUB'
const InstrictionCMP = 'CMP'
const InstrictionJMP = 'JMP'
const InstrictionJZ = 'JZ'
const InstrictionCALL = 'CALL'
const InstrictionRET = 'RET'
const InstrictionSTORE = 'STORE'
const InstrictionLOAD = 'LOAD'
const InstrictionPUSH = 'PUSH'
const InstrictionPOP = 'POP'
const InstrictionOUT = 'OUT'
const InstrictionHALT = 'HALT'

export type MOVInstruction =  Readonly<{
  operation: 'MOV'
  register: Register
  value: number
}>

export type ADDInstruction = Readonly<{
  operation: 'ADD'
  register: Register
  source: Register
}>

export type SUBInstruction = Readonly<{
  operation: 'SUB'
  register: Register
  source: Register
}>

export type CMPInstruction = Readonly<{
  operation: 'CMP'
  register: Register
  source: Register
}>

export type JMPInstruction = Readonly<{
  operation: 'JMP'
  target: number
}>

export type JZInstruction = Readonly<{
  operation: 'JZ'
  target: number
}>

export type CALLInstruction = Readonly<{ operation: 'CALL'; target: number }>
export type RETInstruction = Readonly<{ operation: 'RET' }>

export type STOREInstruction = Readonly<{
  operation: 'STORE'
  register: Register
  address: number
}> 


export type LOADInstruction = Readonly<{
  operation: 'LOAD'
  register: Register
  address: number
}>

export type PUSHInstruction = Readonly<{
  operation: 'PUSH'
  register: Register
}>

export type POPInstruction = Readonly<{
  operation: 'POP'
  register: Register
}>

export type OUTInstruction = Readonly<{ operation: 'OUT'; register: Register }>

export type HALTInstruction = Readonly<{
  operation: 'HALT'
}>



export type Instruction = 
  | MOVInstruction 
  | ADDInstruction
  | SUBInstruction
  | CMPInstruction
  | JMPInstruction
  | JZInstruction
  | CALLInstruction
  | RETInstruction
  | STOREInstruction
  | LOADInstruction 
  | PUSHInstruction 
  | POPInstruction
  | OUTInstruction
  | HALTInstruction

export type MachineState = Readonly<{
  registers: Readonly<Record<Register, number>>
  memory: Uint8Array
  output: readonly number[]
  pc: number
  sp: number
  zf: boolean
  halted: boolean
}>

type RegisterWriteSource = Readonly<{
  source: 'immediate'
}> | Readonly<{
  source: 'addition' | 'subtraction'
  sourceRegister: Register
}> | Readonly<{
  source: 'memory'
  address: number
}> | Readonly<{
  source: 'stack'
  address: number
}>

export type MachineEvent = Readonly<({
  kind: 'register-write'
  register: Register
  previous: number
  value: number
} & RegisterWriteSource)> | Readonly<{
  kind: 'memory-write'
  address: number
  previous: number
  value: number
  sourceRegister: Register
}> | Readonly<{
  kind: 'comparison'
  register: Register
  sourceRegister: Register
  value: number
  sourceValue: number
  equal: boolean
}> | Readonly<{
  kind: 'branch'
  operation: 'JMP' | 'JZ'
  previousPc: number
  target: number
  nextPc: number
  taken: boolean
}> | Readonly<{
  kind: 'stack-branch'
  operation: 'CALL' | 'RET'
  previousPc: number
  nextPc: number
  returnAddress: number
  stackBytes: readonly Readonly<{ address: number; value: number }>[]
}> | Readonly<{
  kind: 'output'
  sourceRegister: Register
  value: number
}> | Readonly<{
  kind: 'halt'
}>

export type StepResult = Readonly<{
  state: MachineState
  events: readonly MachineEvent[]
}>

function completeStep(state: MachineState, changes: Partial<MachineState>, event: MachineEvent): StepResult {
  return {
    state: { ...state, ...changes, pc: state.pc + 1 },
    events: [event],
  }
}

function readRegister(state: MachineState, register: Register): number {
  if (!REGISTER_NAMES.includes(register)) {
    throw new RangeError(`Unknown register: ${register}`)
  }
  return state.registers[register]
}

function writeRegister(
  state: MachineState,
  register: Register,
  value: number,
  source: RegisterWriteSource,
  changes: Partial<MachineState> = {},
): StepResult {
  return completeStep(
    state,
    { ...changes, registers: { ...state.registers, [register]: value } },
    { kind: 'register-write', register, previous: readRegister(state, register), value, ...source },
  )
}

function unsupportedInstruction(instruction: never): never {
  throw new Error(`Unsupported instruction: ${(instruction as { operation: string }).operation}`)
}

export function createInitialState(): MachineState {
  return {
    registers: { R0: 0, R1: 0, R2: 0, R3: 0 },
    memory: new Uint8Array(MEMORY_SIZE),
    output: [],
    pc: 0,
    sp: MEMORY_SIZE,
    zf: false,
    halted: false,
  }
}


function move(
  state: MachineState, 
  instruction: MOVInstruction
) {
  if (
    !Number.isInteger(instruction.value) || 
    instruction.value < 0 || 
    instruction.value > MAX_BYTE
  ) {
    throw new RangeError('MOV value must be an integer from 0 to 255')
  }
  return writeRegister(
    state, 
    instruction.register, 
    instruction.value, 
    { source: 'immediate' }
  )
}

function add(state: MachineState, instruction: ADDInstruction) {
  const value = (readRegister(state, instruction.register) + readRegister(state, instruction.source)) & MAX_BYTE
  return writeRegister(
    state,
    instruction.register,
    value,
    { source: 'addition', sourceRegister: instruction.source },
    { zf: value === 0 },
  )
}

function subtract(state: MachineState, instruction: SUBInstruction) {
  const value = (readRegister(state, instruction.register) - readRegister(state, instruction.source)) & MAX_BYTE
  return writeRegister(
    state,
    instruction.register,
    value,
    { source: 'subtraction', sourceRegister: instruction.source },
    { zf: value === 0 },
  )
}

function compare(state: MachineState, instruction: CMPInstruction) {
  const value = readRegister(state, instruction.register)
  const sourceValue = readRegister(state, instruction.source)
  const equal = value === sourceValue
  return completeStep(state, { zf: equal }, {
    kind: 'comparison',
    register: instruction.register,
    sourceRegister: instruction.source,
    value,
    sourceValue,
    equal,
  })
}

function store(state: MachineState, instruction: STOREInstruction) {
  const { address } = instruction
  if (!Number.isInteger(address) || address < 0 || address >= MEMORY_SIZE) {
    throw new RangeError('STORE address must be an integer from 0 to 255')
  }
  const value = readRegister(state, instruction.register)
  const memory = state.memory.slice()
  const previous = memory[address]
  memory[address] = value

  return completeStep(state, { memory }, {
    kind: 'memory-write',
    address,
    previous,
    value,
    sourceRegister: instruction.register,
  })
}

function load(state: MachineState, instruction: LOADInstruction) {
  const { register, address } = instruction
  if (!Number.isInteger(address) || address < 0 || address >= MEMORY_SIZE) {
    throw new RangeError('LOAD address must be an integer from 0 to 255')
  }
  const memory = state.memory.slice()
  const value = memory[address]
  return writeRegister(state, register, value, { source: 'memory', address })
}

function push(state: MachineState, instruction: PUSHInstruction) {
  const value = readRegister(state, instruction.register)
  if (state.sp === 0) {
    throw new RangeError('Stack overflow: no memory remains for PUSH')
  }

  const address = state.sp - 1
  const memory = state.memory.slice()
  const previous = memory[address]
  memory[address] = value

  return completeStep(state, { memory, sp: address }, {
    kind: 'memory-write',
    address,
    previous,
    value,
    sourceRegister: instruction.register,
  })
}

function pop(state: MachineState, instruction: POPInstruction) {
  readRegister(state, instruction.register)
  if (state.sp === MEMORY_SIZE) {
    throw new RangeError('Stack underflow: no byte available for POP')
  }
  return writeRegister(state, instruction.register, state.memory[state.sp],
    { source: 'stack', address: state.sp }, { sp: state.sp + 1 })
}

function output(state: MachineState, instruction: OUTInstruction) {
  const value = readRegister(state, instruction.register)
  const output = [...state.output.slice(-(OUTPUT_CAPACITY - 1)), value]
  return completeStep(state, { output }, { kind: 'output', sourceRegister: instruction.register, value })
}

function validateProgramLength(operation: string, programLength?: number): asserts programLength is number {
  if (programLength === undefined || !Number.isSafeInteger(programLength) || programLength < 0 || programLength > MAX_PROGRAM_LENGTH) {
    throw new RangeError(`${operation} requires a program length from 0 to 65535`)
  }
}

function validateTarget(operation: string, target: number, programLength: number) {
  if (!Number.isSafeInteger(target) || target < 0 || target >= programLength) {
    throw new RangeError(`${operation} target must be a safe integer identifying an instruction in the program`)
  }
}

function jump(state: MachineState, instruction: JMPInstruction | JZInstruction, programLength?: number): StepResult {
  validateProgramLength(instruction.operation, programLength)
  const { target } = instruction
  validateTarget(instruction.operation, target, programLength)

  const taken = instruction.operation === 'JMP' || state.zf
  const nextPc = taken ? target : state.pc + 1
  return {
    state: { ...state, pc: nextPc },
    events: [{ kind: 'branch', operation: instruction.operation, previousPc: state.pc, target, nextPc, taken }],
  }
}

const RETURN_ADDRESS_BYTES = 2

function call(state: MachineState, instruction: CALLInstruction, programLength?: number): StepResult {
  validateProgramLength('CALL', programLength)
  validateTarget('CALL', instruction.target, programLength)
  if (!Number.isSafeInteger(state.pc) || state.pc < 0 || state.pc >= programLength) {
    throw new RangeError('CALL PC must identify an instruction in the program')
  }
  if (state.sp < RETURN_ADDRESS_BYTES) throw new RangeError('CALL stack overflow')
  const returnAddress = state.pc + 1
  const sp = state.sp - RETURN_ADDRESS_BYTES
  const memory = state.memory.slice()
  let remaining = returnAddress
  const stackBytes = Array.from({ length: RETURN_ADDRESS_BYTES }, (_, offset) => {
    const value = remaining % 256
    remaining = Math.floor(remaining / 256)
    const address = sp + offset
    memory[address] = value
    return { address, value }
  })
  return { state: { ...state, memory, sp, pc: instruction.target }, events: [{
    kind: 'stack-branch', operation: 'CALL', previousPc: state.pc, nextPc: instruction.target, returnAddress, stackBytes,
  }] }
}

function ret(state: MachineState, programLength?: number): StepResult {
  validateProgramLength('RET', programLength)
  if (state.sp > MEMORY_SIZE - RETURN_ADDRESS_BYTES) throw new RangeError('RET stack underflow')
  const stackBytes = Array.from({ length: RETURN_ADDRESS_BYTES }, (_, offset) => ({
    address: state.sp + offset, value: state.memory[state.sp + offset],
  }))
  const returnAddress = stackBytes.reduceRight((value, byte) => value * 256 + byte.value, 0)
  if (!Number.isSafeInteger(returnAddress) || returnAddress > programLength) {
    throw new RangeError('RET return address must be a safe integer from 0 through the program length')
  }
  return { state: { ...state, sp: state.sp + RETURN_ADDRESS_BYTES, pc: returnAddress }, events: [{
    kind: 'stack-branch', operation: 'RET', previousPc: state.pc, nextPc: returnAddress, returnAddress, stackBytes,
  }] }
}

function halt(state: MachineState) {
  return completeStep(state, { halted: true }, { kind: 'halt' })
}

// Program length is required for branches; non-branch instructions remain context-free.
export function executeInstruction(
  state: MachineState,
  instruction: Instruction,
  programLength?: number,
): StepResult {
  if (state.halted) {
    throw new Error('Machine is halted; reset before stepping again')
  }

  switch (instruction.operation) {
    case InstrictionMOV: 
      return move(state, instruction)
    case InstrictionADD: 
      return add(state, instruction)
    case InstrictionSUB:
      return subtract(state, instruction)
    case InstrictionCMP:
      return compare(state, instruction)
    case InstrictionJMP:
    case InstrictionJZ:
      return jump(state, instruction, programLength)
    case InstrictionCALL:
      return call(state, instruction, programLength)
    case InstrictionRET:
      return ret(state, programLength)
    case InstrictionSTORE:
      return store(state, instruction)
    case InstrictionLOAD:
      return load(state, instruction)
    case InstrictionPUSH:
      return push(state, instruction)
    case InstrictionPOP:
      return pop(state, instruction)
    case InstrictionOUT:
      return output(state, instruction)
    case InstrictionHALT:
      return halt(state)
    default:
      return unsupportedInstruction(instruction)
  }
}
