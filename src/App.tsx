import { useEffect, useRef, useState } from 'react'
import InstructionDocs from './InstructionDocs'
import {
  createInitialState,
  executeInstruction,
  MEMORY_SIZE,
  REGISTER_NAMES,
  type MachineEvent,
  type MachineState,
} from './machine'

import { parseProgram, SAMPLE_SOURCE } from './program'

const BYTES_PER_ROW = 16
const memoryRows = Array.from({ length: MEMORY_SIZE / BYTES_PER_ROW }, (_, row) => row * BYTES_PER_ROW)

type ExecutionView = {
  machine: MachineState
  lastEvent: MachineEvent | null
}

function hex(value: number, width = 2) {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
}

function asciiCharacter(value: number) {
  return value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : '.'
}

function describeEvent(event: MachineEvent | null) {
  if (event === null) return 'Press Step to execute the highlighted instruction.'
  if (event.kind === 'halt') return 'HALT stopped execution. Reset to run again.'
  if (event.kind === 'memory-write') {
    return `${event.sourceRegister} → memory ${hex(event.address)}: ${event.previous} → ${event.value}`
  }
  const source = event.source === 'memory'
    ? `Memory ${hex(event.address)}`
    : event.source === 'addition'
      ? `${event.register} + ${event.sourceRegister}`
      : event.source === 'subtraction'
        ? `${event.register} − ${event.sourceRegister}`
        : 'Immediate'
  return `${source} → ${event.register}: ${event.previous} → ${event.value}`
}

function App() {
  const [showDocs, setShowDocs] = useState(() => window.location.hash === '#instructions')
  useEffect(() => {
    function navigate() {
      setShowDocs(window.location.hash === '#instructions')
    }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])
  useEffect(() => {
    document.title = showDocs ? 'Instruction reference · Tiny Machine' : 'Tiny Machine'
  }, [showDocs])
  const [source, setSource] = useState(SAMPLE_SOURCE)
  const [programMode, setProgramMode] = useState<'edit' | 'debug'>('edit')
  const { program, errors } = parseProgram(source)
  const lineNumberWidth = `${String(program.at(-1)?.lineNumber ?? 1).length}ch`
  const [execution, setExecution] = useState<ExecutionView>(() => ({
    machine: createInitialState(),
    lastEvent: null,
  }))

  const { machine, lastEvent } = execution
  const activeLine = useRef<HTMLLIElement>(null)
  useEffect(() => {
    activeLine.current?.scrollIntoView({ block: 'nearest' })
  }, [machine.pc, programMode])
  const readRegister = lastEvent?.kind === 'memory-write' ? lastEvent.sourceRegister
    : lastEvent?.kind === 'register-write' && (lastEvent.source === 'addition' || lastEvent.source === 'subtraction') ? lastEvent.sourceRegister : null
  const writtenRegister = lastEvent?.kind === 'register-write' ? lastEvent.register : null
  const readAddress = lastEvent?.kind === 'register-write' && lastEvent.source === 'memory' ? lastEvent.address : null
  const writtenAddress = lastEvent?.kind === 'memory-write' ? lastEvent.address : null
  const hasNextInstruction = errors.length === 0 && !machine.halted && machine.pc < program.length
  const stackAddresses = Array.from({ length: MEMORY_SIZE - machine.sp }, (_, offset) => machine.sp + offset)

  function step() {
    setExecution((previous) => {
      if (errors.length || previous.machine.halted) return previous
      const next = program[previous.machine.pc]
      if (!next) return previous

      const result = executeInstruction(previous.machine, next.instruction)
      return { machine: result.state, lastEvent: result.events[0] ?? null }
    })
  }

  function reset() {
    setExecution({ machine: createInitialState(), lastEvent: null })
  }

  function editSource(value: string) {
    setSource(value)
    reset()
  }

  function debug() {
    if (errors.length > 0 || program.length === 0) return
    reset()
    setProgramMode('debug')
  }

  return (
    <main className={`page${showDocs ? ' docs-page' : ''}`}>
      <header className="page-header">
        <span className="eyebrow">TM–01 / Programmable learning instrument</span>
        <h1>{showDocs ? 'Instruction reference' : 'Tiny Machine'}</h1>
        <p>{showDocs ? 'Syntax, examples, and effects for every supported instruction.' : '8-bit computer · 4 registers · 256 bytes · one instruction at a time'}</p>
        <nav className="page-nav" aria-label="Main navigation">
          <a href="#machine" aria-current={!showDocs ? 'page' : undefined}>Machine</a>
          <a href="#instructions" aria-current={showDocs ? 'page' : undefined}>Instruction reference</a>
        </nav>
      </header>

      {showDocs && <InstructionDocs />}
      <div className="workspace" aria-label="Tiny Machine workspace" hidden={showDocs}>
        <section className="panel program-panel" aria-labelledby="program-title">
          <div className="module-heading"><h2 id="program-title"><span>01</span> Program</h2><span className="module-label">{programMode === 'edit' ? 'SOURCE / EDIT' : 'SEQUENCER / DEBUG'}</span></div>
          {programMode === 'edit' ? (
            <>
              <p className="panel-note" id="editor-help">One instruction per line. Debug prepares your program for stepping.</p>
              <label className="editor-label" htmlFor="program-source">Program source</label>
              <textarea
                autoFocus
                id="program-source"
                className="program-editor"
                value={source}
                onChange={(event) => editSource(event.target.value)}
                rows={8}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-describedby="editor-help syntax-help program-errors"
                aria-invalid={errors.length > 0}
              />
              <p className="syntax-help" id="syntax-help">
                Syntax: <code>MOV R0, 5</code> · <code>ADD R0, R1</code> · <code>SUB R0, R1</code> · <code>STORE R2, 0</code> · <code>LOAD R3, 0</code> · <code>PUSH R0</code> · <code>HALT</code>.
                {' '}Registers: R0–R3. MOV values and STORE/LOAD addresses: decimal 0–255. Case and spacing are flexible; blank lines are skipped. Use ; for comments through the end of a line.
                {' '}<a href="#instructions">Full instruction reference</a>.
              </p>
              <div id="program-errors" className="program-errors" aria-live="polite">
                {errors.length > 0 && <ul>{errors.map((error) => (
                  <li key={error.lineNumber}>Line {error.lineNumber}: {error.message}</li>
                ))}</ul>}
              </div>
              <div className="controls">
                <button type="button" onClick={debug} disabled={errors.length > 0 || program.length === 0}>Debug</button>
                <button type="button" className="secondary" onClick={() => editSource(SAMPLE_SOURCE)}>Restore sample</button>
              </div>
              <p className="execution-status" aria-live="polite">
                {errors.length > 0 ? 'Fix the source errors before debugging.' : program.length === 0 ? 'Enter an instruction to begin.' : 'Ready to debug. Use Step to execute one instruction at a time.'}
              </p>
            </>
          ) : (
            <>
              <ol className="program-list" aria-label="Parsed instructions with source line numbers">
                {program.map((line, index) => (
                  <li
                    key={index}
                    ref={hasNextInstruction && index === machine.pc ? activeLine : undefined}
                    className={hasNextInstruction && index === machine.pc ? 'program-line active' : 'program-line'}
                    aria-current={hasNextInstruction && index === machine.pc ? 'step' : undefined}
                  >
                    <span className="line-number" style={{ width: lineNumberWidth }}>{line.lineNumber}</span>
                    <code>{line.source}</code>
                    {hasNextInstruction && index === machine.pc && <span className="next-marker">Next</span>}
                  </li>
                ))}
              </ol>
              <div className="controls">
                <button autoFocus type="button" onClick={step} disabled={!hasNextInstruction}>Step ▷</button>
                <button type="button" className="secondary" onClick={reset}>Reset</button>
                <button type="button" className="secondary" onClick={() => setProgramMode('edit')}>Edit</button>
              </div>
              <p className="execution-status" aria-live="polite">
                {errors.length > 0 ? 'Fix the source errors before stepping.' : machine.halted
                  ? 'Machine halted.'
                  : hasNextInstruction ? `Next: line ${program[machine.pc].lineNumber} (PC ${machine.pc})` : program.length === 0 ? 'Enter an instruction to begin.' : 'Program complete.'}
              </p>
            </>
          )}
        </section>

        <div className="machine-state">
          <section className="panel registers-panel" aria-labelledby="machine-title">
            <div className="module-heading"><h2 id="machine-title"><span>02</span> Registers</h2><span className="module-label">UNSIGNED / 8 BIT</span></div>
            <dl className="register-list">
              {REGISTER_NAMES.map((register) => (
                <div className={`register${readRegister === register ? ' signal-read' : ''}${writtenRegister === register ? ' signal-write' : ''}`} key={`${register}-${machine.pc}`}>
                  <dt>{register}</dt>
                  <dd>{machine.registers[register].toString().padStart(3, '0')}<small>{hex(machine.registers[register])}</small>
                    <meter min={0} max={255} value={machine.registers[register]} aria-label={`${register} byte value`} />
                    <span className="register-role">{writtenRegister === register ? '↓ WRITE' : readRegister === register ? '↑ READ' : 'BYTE'}</span></dd>
                </div>
              ))}
            </dl>
            <div className="machine-indicators"><span>PC <strong>{machine.pc.toString().padStart(2, '0')}</strong></span><span>ZF <strong>{machine.zf ? '1' : '0'}</strong></span><span className={machine.halted ? 'halted' : ''}>{programMode === 'edit' ? '● EDITING' : machine.halted ? '■ HALTED' : hasNextInstruction ? '● READY' : '■ COMPLETE'}</span></div>
            <p className="step-explanation" aria-live="polite" aria-atomic="true">
              {describeEvent(lastEvent)}
            </p>
          </section>

          <section className="panel stack-panel" aria-labelledby="stack-title">
            <div className="module-heading"><h2 id="stack-title"><span>04</span> Stack</h2></div>
            <p className="panel-note">Grows downward: FF → FE → FD</p>
            <p className="stack-usage" aria-live="polite">
              Stack: {stackAddresses.length} {stackAddresses.length === 1 ? 'byte' : 'bytes'} used · {machine.sp} bytes remaining
            </p>
            <p className="stack-pointer">SP: {hex(machine.sp)}{machine.sp === MEMORY_SIZE ? ' (empty; just past the end of memory)' : ' (top of stack)'}</p>
            <meter className="stack-meter" min={0} max={MEMORY_SIZE} value={stackAddresses.length} aria-label="Stack bytes used" />
            <h3>Stack close-up <span>(top first)</span></h3>
            <div className="stack-content" tabIndex={0} role="region" aria-label="Stack contents">
              {stackAddresses.length === 0 ? (
                <p className="empty-stack">No values pushed yet.</p>
              ) : (
                <table className="stack-table">
                  <thead><tr><th scope="col">Address</th><th scope="col">Hex</th><th scope="col">Dec</th></tr></thead>
                  <tbody>
                    {stackAddresses.map((address) => (
                      <tr key={address}>
                        <th scope="row">{hex(address)}</th>
                        <td>{hex(machine.memory[address])}</td>
                        <td>{machine.memory[address]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="panel memory-panel" aria-labelledby="memory-title">
            <div className="module-heading"><h2 id="memory-title"><span>03</span> Memory</h2><span className="module-label">16 × 16 / HEX + ASCII</span></div>
            <p className="panel-note">256 bytes · Data and stack share this memory.</p>
            <div className="memory-legend">
              <span><span className="legend-swatch stack-used" aria-hidden="true" /> Occupied stack</span>
              <span><span className="legend-swatch stack-top" aria-hidden="true" /> SP: top of stack</span>
            </div>
            <div className="memory-grid" role="region" aria-label="Memory hex grid" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Address</th>
                    {Array.from({ length: BYTES_PER_ROW }, (_, offset) => (
                      <th scope="col" key={offset}>+{offset.toString(16).toUpperCase()}</th>
                    ))}
                    <th scope="col">ASCII</th>
                  </tr>
                </thead>
                <tbody>
                  {memoryRows.map((startAddress) => (
                    <tr key={startAddress}>
                      <th scope="row">{hex(startAddress)}</th>
                      {Array.from({ length: BYTES_PER_ROW }, (_, offset) => {
                        const address = startAddress + offset
                        const value = machine.memory[address]
                        const isStack = address >= machine.sp
                        const isTop = address === machine.sp
                        return (
                          <td
                            key={offset}
                            className={`${isStack ? 'stack-used' : ''}${isTop ? ' stack-top' : ''}${address === readAddress ? ' signal-read' : ''}${address === writtenAddress ? ' signal-write' : ''}`}
                            title={`${hex(address)} · decimal ${value}${address === writtenAddress ? ' · last write' : address === readAddress ? ' · last read' : ''}`}
                            aria-label={`${hex(address)}: ${hex(value)}${address === writtenAddress ? ', last write' : address === readAddress ? ', last read' : ''}${isTop ? ', SP, top of stack' : isStack ? ', occupied stack' : ''}`}
                          >
                            {value.toString(16).toUpperCase().padStart(2, '0')}
                            {isTop && <span className="stack-top-label">SP</span>}
                          </td>
                        )
                      })}
                      <td className="ascii-view">
                        {Array.from({ length: BYTES_PER_ROW }, (_, offset) => asciiCharacter(machine.memory[startAddress + offset])).join('')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <footer className="signal-legend" aria-label="Signal colour legend">
          <span><i className="cue-next" /> NEXT INSTRUCTION</span>
          <span><i className="cue-read" /> READ / SOURCE</span>
          <span><i className="cue-write" /> WRITE / DESTINATION</span>
          <span className="legend-note">Signals hold until the next step.</span>
        </footer>
      </div>
    </main>
  )
}

export default App
