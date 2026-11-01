export const REGISTER_NAMES = ['R0', 'R1', 'R2', 'R3'] as const
export const MEMORY_SIZE = 256
const MAX_BYTE = 0xff

export type Register = (typeof REGISTER_NAMES)[number]

const InstrictionMOV = 'MOV'
const InstrictionADD = 'ADD'
const InstrictionSUB = 'SUB'
const InstrictionCMP = 'CMP'
const InstrictionJMP = 'JMP'
const InstrictionJZ = 'JZ'
const InstrictionSTORE = 'STORE'
const InstrictionLOAD = 'LOAD'
const InstrictionPUSH = 'PUSH'
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
  | STOREInstruction
  | LOADInstruction 
  | PUSHInstruction 
  | HALTInstruction

export type MachineState = Readonly<{
  registers: Readonly<Record<Register, number>>
  memory: Uint8Array
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

function jump(state: MachineState, instruction: JMPInstruction | JZInstruction, programLength?: number): StepResult {
  if (programLength === undefined || !Number.isSafeInteger(programLength) || programLength < 0) {
    throw new RangeError(`${instruction.operation} requires a non-negative safe integer program length`)
  }
  const { target } = instruction
  if (!Number.isSafeInteger(target) || target < 0 || target >= programLength) {
    throw new RangeError(`${instruction.operation} target must be a safe integer identifying an instruction in the program`)
  }

  const taken = instruction.operation === 'JMP' || state.zf
  const nextPc = taken ? target : state.pc + 1
  return {
    state: { ...state, pc: nextPc },
    events: [{ kind: 'branch', operation: instruction.operation, previousPc: state.pc, target, nextPc, taken }],
  }
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
    case InstrictionSTORE:
      return store(state, instruction)
    case InstrictionLOAD:
      return load(state, instruction)
    case InstrictionPUSH:
      return push(state, instruction)
    case InstrictionHALT:
      return halt(state)
    default:
      return unsupportedInstruction(instruction)
  }
}
