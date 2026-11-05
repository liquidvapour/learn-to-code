import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import InstructionDocs from './InstructionDocs'
import {
  createInitialState,
  executeInstruction,
  MEMORY_SIZE,
  OUTPUT_CAPACITY,
  REGISTER_NAMES,
  type MachineEvent,
  type MachineState,
  type Register,
} from './machine'

import { parseProgram, SAMPLE_SOURCE } from './program'

const BYTES_PER_ROW = 16
const PLAY_DELAYS_MS = [500, 100, 20, 4]
const memoryRows = Array.from({ length: MEMORY_SIZE / BYTES_PER_ROW }, (_, row) => row * BYTES_PER_ROW)

type ExecutionView = {
  machine: MachineState
  lastEvent: MachineEvent | null
  error: string | null
  transfer: { operation: 'STORE' | 'LOAD'; register: Register; address: number; value: number } | null
}

function isVisible(element: Element) {
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height || rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) return false
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent)
    const bounds = parent.getBoundingClientRect()
    if (style.overflowX !== 'visible' && (rect.left < bounds.left || rect.right > bounds.right)) return false
    if (style.overflowY !== 'visible' && (rect.top < bounds.top || rect.bottom > bounds.bottom)) return false
  }
  return true
}

function hex(value: number, width = 2) {
  return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
}

function asciiCharacter(value: number) {
  return value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : '.'
}

function describeEvent(event: MachineEvent | null) {
  if (event === null) return 'Press Step or Play to execute the highlighted instruction.'
  if (event.kind === 'halt') return 'HALT stopped execution. Reset to run again.'
  if (event.kind === 'output') return `${event.sourceRegister} → output: ${event.value} (${hex(event.value)})`
  if (event.kind === 'branch') {
    if (event.operation === 'JZ') {
      return `JZ ${event.target}: ZF = ${Number(event.taken)}, ${event.taken ? 'jump taken' : 'not taken; continue'} — PC ${event.previousPc} → ${event.nextPc}`
    }
    return `${event.operation} to instruction ${event.target}: PC ${event.previousPc} → ${event.nextPc}`
  }
  if (event.kind === 'stack-branch') {
    const bytes = event.stackBytes.map(({ address, value }) => `${hex(address)} = ${hex(value)}`).join(', ')
    return event.operation === 'CALL'
      ? `CALL: save return address ${event.returnAddress} to stack (${bytes}); PC ${event.previousPc} → ${event.nextPc}`
      : `RET: read return address ${event.returnAddress} from stack (${bytes}); PC ${event.previousPc} → ${event.nextPc}`
  }
  if (event.kind === 'comparison') {
    return `${event.register} (${event.value}) ${event.equal ? '=' : '≠'} ${event.sourceRegister} (${event.sourceValue}) → ZF = ${Number(event.equal)}`
  }
  if (event.kind === 'memory-write') {
    return `${event.sourceRegister} → memory ${hex(event.address)}: ${event.previous} → ${event.value}`
  }
  const source = event.source === 'memory' || event.source === 'stack'
    ? `${event.source === 'stack' ? 'Stack' : 'Memory'} ${hex(event.address)}`
    : event.source === 'addition'
      ? `${event.register} + ${event.sourceRegister}`
      : event.source === 'subtraction'
        ? `${event.register} − ${event.sourceRegister}`
        : 'Immediate'
  return `${source} → ${event.register}: ${event.previous} → ${event.value}`
}

function App() {
  const [showDocs, setShowDocs] = useState(() => window.location.hash === '#instructions')
  const [playing, setPlaying] = useState(false)
  const [playDelay, setPlayDelay] = useState(PLAY_DELAYS_MS[0])
  useEffect(() => {
    function navigate() {
      setShowDocs(window.location.hash === '#instructions')
      setPlaying(false)
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
  const editorGutter = useRef<HTMLPreElement>(null)
  let editorPc = 0
  const editorAddresses = source.split(/\r?\n/).map((line) => (
    line.split(';', 1)[0].trim() ? String(editorPc++) : ''
  ))
  const addressWidth = `${String(Math.max(0, program.length - 1)).length + 3}ch`
  const lineNumberWidth = `${String(program.at(-1)?.lineNumber ?? 1).length + 5}ch`
  const [execution, setExecution] = useState<ExecutionView>(() => ({
    machine: createInitialState(),
    lastEvent: null,
    error: null,
    transfer: null,
  }))

  const { machine, lastEvent, error } = execution
  const workspace = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const transfer = execution.transfer
    if (!transfer || showDocs || programMode !== 'debug' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const register = workspace.current?.querySelector(`[data-register="${transfer.register}"]`)
    const memory = workspace.current?.querySelector(`[data-address="${transfer.address}"]`)
    if (!register || !memory || !isVisible(register) || !isVisible(memory)) return
    const from = (transfer.operation === 'STORE' ? register : memory).getBoundingClientRect()
    const to = (transfer.operation === 'STORE' ? memory : register).getBoundingClientRect()
    const badge = document.createElement('span')
    badge.className = 'transfer-badge'
    badge.setAttribute('aria-hidden', 'true')
    badge.textContent = hex(transfer.value)
    badge.style.left = `${from.left + from.width / 2}px`
    badge.style.top = `${from.top + from.height / 2}px`
    document.body.appendChild(badge)
    const animation = badge.animate([
      { transform: 'translate(-50%, -50%)', opacity: 1 },
      { transform: `translate(calc(-50% + ${to.left + to.width / 2 - from.left - from.width / 2}px), calc(-50% + ${to.top + to.height / 2 - from.top - from.height / 2}px))`, opacity: 1 },
    ], { duration: 400, easing: 'ease-in-out' })
    const cancel = () => { animation.cancel(); badge.remove() }
    animation.onfinish = () => badge.remove()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    motion.addEventListener('change', cancel)
    window.addEventListener('scroll', cancel, true)
    window.addEventListener('resize', cancel)
    return () => {
      cancel()
      motion.removeEventListener('change', cancel)
      window.removeEventListener('scroll', cancel, true)
      window.removeEventListener('resize', cancel)
    }
  }, [execution, showDocs, programMode])
  const outputView = useRef<HTMLDivElement>(null)
  const followOutput = useRef(true)
  useLayoutEffect(() => {
    const panel = outputView.current
    if (panel && followOutput.current) panel.scrollTop = panel.scrollHeight
  }, [machine.output])
  const activeLine = useRef<HTMLLIElement>(null)
  useEffect(() => {
    activeLine.current?.scrollIntoView({ block: 'nearest' })
  }, [machine.pc, programMode])
  const readRegisters = lastEvent?.kind === 'comparison' ? [lastEvent.register, lastEvent.sourceRegister]
    : lastEvent?.kind === 'memory-write' || lastEvent?.kind === 'output' ? [lastEvent.sourceRegister]
      : lastEvent?.kind === 'register-write' && (lastEvent.source === 'addition' || lastEvent.source === 'subtraction') ? [lastEvent.sourceRegister] : []
  const writtenRegister = lastEvent?.kind === 'register-write' ? lastEvent.register : null
  const readZeroFlag = lastEvent?.kind === 'branch' && lastEvent.operation === 'JZ'
  const wroteZeroFlag = lastEvent?.kind === 'comparison'
    || (lastEvent?.kind === 'register-write' && (lastEvent.source === 'addition' || lastEvent.source === 'subtraction'))
  const readAddresses = lastEvent?.kind === 'stack-branch' && lastEvent.operation === 'RET' ? lastEvent.stackBytes.map((byte) => byte.address)
    : lastEvent?.kind === 'register-write' && (lastEvent.source === 'memory' || lastEvent.source === 'stack') ? [lastEvent.address] : []
  const writtenAddresses = lastEvent?.kind === 'stack-branch' && lastEvent.operation === 'CALL' ? lastEvent.stackBytes.map((byte) => byte.address)
    : lastEvent?.kind === 'memory-write' ? [lastEvent.address] : []
  const hasNextInstruction = errors.length === 0 && !error && !machine.halted && machine.pc < program.length
  const isPlaying = playing && hasNextInstruction && programMode === 'debug' && !showDocs
  const stackAddresses = Array.from({ length: MEMORY_SIZE - machine.sp }, (_, offset) => machine.sp + offset)

  function step() {
    setExecution((previous) => {
      if (errors.length || previous.error || previous.machine.halted) return previous
      const next = program[previous.machine.pc]
      if (!next) return previous

      try {
        const result = executeInstruction(previous.machine, next.instruction, program.length)
        const event = result.events[0] ?? null
        const instruction = next.instruction
        const transfer = instruction.operation === 'STORE' && event?.kind === 'memory-write'
          ? { operation: instruction.operation, register: event.sourceRegister, address: event.address, value: event.value }
          : instruction.operation === 'LOAD' && event?.kind === 'register-write' && event.source === 'memory'
            ? { operation: instruction.operation, register: event.register, address: event.address, value: event.value }
            : null
        return { machine: result.state, lastEvent: event, error: null, transfer }
      } catch (cause) {
        return { ...previous, transfer: null, error: cause instanceof Error ? cause.message : 'Execution failed.' }
      }
    })
  }

  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setTimeout(step, playDelay)
    return () => window.clearTimeout(timer)
  })

  function reset() {
    followOutput.current = true
    setPlaying(false)
    setExecution({ machine: createInitialState(), lastEvent: null, error: null, transfer: null })
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
      <div ref={workspace} className="workspace" aria-label="Tiny Machine workspace" hidden={showDocs}>
        <section className="panel program-panel" aria-labelledby="program-title">
          <div className="module-heading"><h2 id="program-title"><span>01</span> Program</h2><span className="module-label">{programMode === 'edit' ? 'SOURCE / EDIT' : 'SEQUENCER / DEBUG'}</span></div>
          {programMode === 'edit' ? (
            <>
              <p className="panel-note" id="editor-help">The PC gutter shows jump targets; blank and comment-only lines have no address. Addresses are provisional until syntax errors are fixed. Debug prepares your program for stepping.</p>
              <label className="editor-label" htmlFor="program-source">Program source · PC jump targets</label>
              <div className="source-editor" data-invalid={errors.length > 0}>
                <div className="editor-gutter" aria-hidden="true" style={{ width: `${Math.max(2, String(Math.max(0, editorPc - 1)).length) + 2}ch` }}>
                  <pre ref={editorGutter}>{editorAddresses.map((address) => address || ' ').join('\n')}</pre>
                </div>
                <textarea
                  autoFocus
                  id="program-source"
                  className="program-editor"
                  value={source}
                  onChange={(event) => editSource(event.target.value)}
                  onScroll={(event) => {
                    if (editorGutter.current) editorGutter.current.style.transform = `translateY(-${event.currentTarget.scrollTop}px)`
                  }}
                  wrap="off"
                  rows={8}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  aria-describedby="editor-help syntax-help program-errors"
                  aria-invalid={errors.length > 0}
                />
              </div>
              <p className="syntax-help" id="syntax-help">
                Syntax: <code>MOV R0, 5</code> · <code>ADD R0, R1</code> · <code>SUB R0, R1</code> · <code>CMP R0, R1</code> · <code>JMP 0</code> · <code>JZ 0</code> · <code>CALL 0</code> · <code>RET</code> · <code>STORE R2, 0</code> · <code>LOAD R3, 0</code> · <code>PUSH R0</code> · <code>POP R1</code> · <code>OUT R0</code> · <code>HALT</code>.
                {' '}Registers: R0–R3. MOV values and STORE/LOAD addresses: decimal 0–255. JMP/JZ/CALL targets: decimal instruction indices starting at 0. Case and spacing are flexible; blank lines are skipped. Use ; for comments through the end of a line.
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
              <ol className="program-list" aria-label="Parsed instructions with source lines and instruction addresses">
                {program.map((line, index) => (
                  <li
                    key={index}
                    ref={hasNextInstruction && index === machine.pc ? activeLine : undefined}
                    className={hasNextInstruction && index === machine.pc ? 'program-line active' : 'program-line'}
                    aria-current={hasNextInstruction && index === machine.pc ? 'step' : undefined}
                  >
                    <span className="line-number" style={{ width: lineNumberWidth }}>Line {line.lineNumber}</span>
                    <span className="instruction-address" style={{ width: addressWidth }}>PC {index}</span>
                    <code>{line.source}</code>
                    {hasNextInstruction && index === machine.pc && <span className="next-marker">Next</span>}
                  </li>
                ))}
              </ol>
              <div className="controls">
                <button autoFocus type="button" onClick={step} disabled={!hasNextInstruction || isPlaying}>Step ▷</button>
                <button type="button" onClick={() => setPlaying(!isPlaying)} disabled={!hasNextInstruction}>{isPlaying ? 'Pause ❚❚' : 'Play ▶'}</button>
                <label className="speed-control">Speed
                  <select value={playDelay} onChange={(event) => setPlayDelay(Number(event.target.value))}>
                    {PLAY_DELAYS_MS.map((delay) => <option key={delay} value={delay}>{500 / delay}×</option>)}
                  </select>
                </label>
                <button type="button" className="secondary" onClick={reset}>Reset</button>
                <button type="button" className="secondary" onClick={() => { setPlaying(false); setProgramMode('edit') }}>Edit</button>
              </div>
              <p className="execution-status" aria-live="polite">
                {error ? `Execution stopped: ${error}` : errors.length > 0 ? 'Fix the source errors before stepping.' : machine.halted
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
                <div data-register={register} className={`register${readRegisters.includes(register) ? ' signal-read' : ''}${writtenRegister === register ? ' signal-write' : ''}`} key={`${register}-${machine.pc}`}>
                  <dt>{register}</dt>
                  <dd>{machine.registers[register].toString().padStart(3, '0')}<small>{hex(machine.registers[register])}</small>
                    <meter min={0} max={255} value={machine.registers[register]} aria-label={`${register} byte value`} />
                    <span className="register-role">{writtenRegister === register ? '↓ WRITE' : readRegisters.includes(register) ? '↑ READ' : 'BYTE'}</span></dd>
                </div>
              ))}
            </dl>
            <div className="machine-indicators">
              <span>PC <strong>{machine.pc.toString().padStart(2, '0')}</strong></span>
              <span className={`zero-flag${wroteZeroFlag ? ` flag-write flag-${Number(machine.zf)}` : readZeroFlag ? ' signal-read' : ''}`}>
                ZF <strong>{machine.zf ? '1' : '0'}</strong>{wroteZeroFlag && <span className="flag-role">↓ WRITE</span>}{readZeroFlag && <span className="flag-role">↑ READ</span>}
              </span>
              <span className={machine.halted || error ? 'halted' : ''}>{programMode === 'edit' ? '● EDITING' : error ? '■ STOPPED' : machine.halted ? '■ HALTED' : isPlaying ? '▶ PLAYING' : hasNextInstruction ? '● READY' : '■ COMPLETE'}</span>
            </div>
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
                <p className="empty-stack">Stack is empty.</p>
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

          <section className="panel output-panel" aria-labelledby="output-title">
            <div className="module-heading"><h2 id="output-title"><span>05</span> Output</h2><span className="module-label">{machine.output.length} / {OUTPUT_CAPACITY} BYTES</span></div>
            <p className="panel-note">Oldest first · printable ASCII, newline, or \xHH for other bytes.</p>
            <div className="output-content" ref={outputView} tabIndex={0} role="region" aria-label="Output bytes" onScroll={(event) => {
              const element = event.currentTarget
              followOutput.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 2
            }}>
              {machine.output.length === 0 ? <span className="output-empty">No output yet.</span> : machine.output.map((value) => value === 10 ? '\n' : value >= 32 && value <= 126 ? String.fromCharCode(value) : `\\x${value.toString(16).toUpperCase().padStart(2, '0')}`).join('')}
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
                            data-address={address}
                            className={`${isStack ? 'stack-used' : ''}${isTop ? ' stack-top' : ''}${readAddresses.includes(address) ? ' signal-read' : ''}${writtenAddresses.includes(address) ? ' signal-write' : ''}`}
                            title={`${hex(address)} · decimal ${value}${writtenAddresses.includes(address) ? ' · last write' : readAddresses.includes(address) ? ' · last read' : ''}`}
                            aria-label={`${hex(address)}: ${hex(value)}${writtenAddresses.includes(address) ? ', last write' : readAddresses.includes(address) ? ', last read' : ''}${isTop ? ', SP, top of stack' : isStack ? ', occupied stack' : ''}`}
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
