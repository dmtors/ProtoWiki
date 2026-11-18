// Tiny Web Audio engine for the OP-1 replica: the articles' plucked synth
// (pluck), a mono-filtered poly synth,
// four synthesized drum voices, a metronome, and analysers for the screen.

export type Op1Params = {
  wave: number // 0–1 → sine / triangle / saw / square
  envelope: number // 0–1 → attack + release length
  cutoff: number // 0–1 → low-pass cutoff (exponential)
  level: number // 0–1 → synth level
  volume: number // 0–1 → master volume
}

export type Op1Audio = ReturnType<typeof createOp1Audio>

import type { Sound } from './wiki'

const WAVES: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square']
/** Square and saw are much louder than sine at the same amplitude. */
const PLUCK_LOUDNESS: Record<string, number> = { sine: 1, triangle: 0.95, square: 0.5, sawtooth: 0.55 }

export function createOp1Audio() {
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  const ctx: AudioContext = new Ctx()

  const master = ctx.createGain()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 1024
  master.connect(analyser)
  analyser.connect(ctx.destination)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.Q.value = 4
  const synthBus = ctx.createGain()
  filter.connect(synthBus)
  synthBus.connect(master)

  const drumBus = ctx.createGain()
  drumBus.gain.value = 0.9
  drumBus.connect(master)

  // Per-bus meters for the mixer screen.
  const meters = [synthBus, drumBus].map((node) => {
    const a = ctx.createAnalyser()
    a.fftSize = 256
    node.connect(a)
    return a
  })

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const nd = noise.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

  let params: Op1Params = { wave: 0.3, envelope: 0.3, cutoff: 0.7, level: 0.7, volume: 0.8 }
  const voices = new Map<number, { osc: OscillatorNode; sub: OscillatorNode; gain: GainNode }>()

  const attack = () => 0.004 + params.envelope ** 2 * 0.8
  const release = () => 0.06 + params.envelope ** 1.5 * 1.6

  function setParams(p: Op1Params) {
    params = p
    const t = ctx.currentTime
    filter.frequency.setTargetAtTime(120 * Math.pow(140, p.cutoff), t, 0.02)
    // The synth's level is fixed: the orange knob picks the effect's article now.
    synthBus.gain.setTargetAtTime(0.6, t, 0.02)
    master.gain.setTargetAtTime(p.volume * 0.7, t, 0.02)
    const type = WAVES[Math.min(3, Math.floor(p.wave * 4))]
    voices.forEach((v) => (v.osc.type = type))
  }

  function noteOn(midi: number) {
    noteOff(midi, true)
    const t = ctx.currentTime
    const f = 440 * Math.pow(2, (midi - 69) / 12)
    const osc = ctx.createOscillator()
    osc.type = WAVES[Math.min(3, Math.floor(params.wave * 4))]
    osc.frequency.value = f
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = f / 2
    const subGain = ctx.createGain()
    subGain.gain.value = 0.3
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.35, t + attack())
    osc.connect(gain)
    sub.connect(subGain).connect(gain)
    gain.connect(filter)
    osc.start(t)
    sub.start(t)
    voices.set(midi, { osc, sub, gain })
  }

  function noteOff(midi: number, immediate = false) {
    const v = voices.get(midi)
    if (!v) return
    voices.delete(midi)
    const t = ctx.currentTime
    const r = immediate ? 0.01 : release()
    v.gain.gain.cancelScheduledValues(t)
    v.gain.gain.setValueAtTime(v.gain.gain.value, t)
    v.gain.gain.linearRampToValueAtTime(0, t + r)
    v.osc.stop(t + r + 0.02)
    v.sub.stop(t + r + 0.02)
  }

  /**
   * One note in the articles' sound, as Mondrian plays it: a strike through
   * its own low-pass filter, with vibrato. Bypasses the knob filter above.
   * While the key is held the note settles to a steady ring; letting go
   * (the returned release) lets it decay as a pluck would. A quick tap
   * sounds just like the old self-decaying pluck.
   */
  function pluck(midi: number, sound: Sound) {
    const t = ctx.currentTime + 0.005
    const attack = 0.006
    const osc = ctx.createOscillator()
    osc.type = sound.waveform
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = Math.min(sound.cutoffHz, ctx.sampleRate * 0.45)
    lowpass.Q.value = 0.7071
    const env = ctx.createGain()
    const peak = 0.35 * PLUCK_LOUDNESS[sound.waveform]
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(peak, t + attack)
    // Held: ease from the strike down to a steady ring.
    env.gain.setTargetAtTime(peak * 0.6, t + attack, Math.min(0.25, sound.decaySec / 4))
    let lfo: OscillatorNode | null = null
    if (sound.vibratoCents >= 0.5) {
      lfo = ctx.createOscillator()
      lfo.frequency.value = sound.vibratoHz
      const depth = ctx.createGain()
      depth.gain.value = sound.vibratoCents
      lfo.connect(depth).connect(osc.detune)
      lfo.start(t)
    }
    osc.connect(lowpass).connect(env).connect(synthBus)
    osc.start(t)
    osc.onended = () => {
      osc.disconnect()
      lowpass.disconnect()
      env.disconnect()
      lfo?.disconnect()
    }
    let released = false
    return function release() {
      if (released) return
      released = true
      const now = Math.max(ctx.currentTime, t + attack)
      const end = now + sound.decaySec * 1.6 + 0.03
      env.gain.cancelScheduledValues(now)
      env.gain.setValueAtTime(env.gain.value || peak, now)
      env.gain.setTargetAtTime(0, now, sound.decaySec / Math.log(1000)) // −60 dB by decaySec
      osc.stop(end)
      lfo?.stop(end)
    }
  }

  function noiseHit(t: number, hp: number, decay: number, gain: number) {
    const src = ctx.createBufferSource()
    src.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = hp
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + decay)
    src.connect(f).connect(g).connect(drumBus)
    src.start(t)
    src.stop(t + decay + 0.05)
  }

  function toneHit(t: number, from: number, to: number, decay: number, gain: number) {
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(from, t)
    o.frequency.exponentialRampToValueAtTime(to, t + decay * 0.6)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + decay)
    o.connect(g).connect(drumBus)
    o.start(t)
    o.stop(t + decay + 0.05)
  }

  function drum(semi: number) {
    const t = ctx.currentTime
    const pitch = 1 + params.wave
    switch (semi % 6) {
      case 0: // kick
        toneHit(t, 160 * pitch, 42, 0.45, 1)
        break
      case 1: // snare
        toneHit(t, 220 * pitch, 160, 0.12, 0.5)
        noiseHit(t, 1500, 0.18, 0.5)
        break
      case 2: // closed hat
        noiseHit(t, 7000, 0.05 + params.envelope * 0.2, 0.35)
        break
      case 3: // clap
        ;[0, 0.012, 0.024].forEach((d) => noiseHit(t + d, 1100, 0.09, 0.35))
        break
      case 4: // tom
        toneHit(t, 260 * pitch, 110, 0.3, 0.7)
        break
      default: // open hat
        noiseHit(t, 6000, 0.35, 0.25)
    }
  }

  // Transport / metronome clock.
  let playing = false
  let click = false
  let beat = 0
  let timer: number | undefined
  function tick() {
    beat++
    if (click) {
      const t = ctx.currentTime
      toneHit(t, beat % 4 === 0 ? 1800 : 1200, 900, 0.04, 0.25)
    }
  }
  function setTransport(isPlaying: boolean, metronome: boolean) {
    click = metronome
    if (isPlaying === playing) return
    playing = isPlaying
    clearInterval(timer)
    if (playing) {
      beat = -1
      tick()
      timer = window.setInterval(tick, 500)
    }
  }

  const waveBuf = new Float32Array(analyser.fftSize)
  const meterBuf = new Float32Array(256)

  return {
    resume: () => ctx.state === 'suspended' && ctx.resume(),
    setParams,
    noteOn,
    pluck,
    noteOff: (m: number) => noteOff(m),
    drum,
    setTransport,
    beat: () => beat,
    waveform() {
      analyser.getFloatTimeDomainData(waveBuf)
      return waveBuf
    },
    levels() {
      return meters.map((m) => {
        m.getFloatTimeDomainData(meterBuf)
        let peak = 0
        for (let i = 0; i < meterBuf.length; i++) peak = Math.max(peak, Math.abs(meterBuf[i]))
        return Math.min(1, peak * 1.6)
      })
    },
    dispose() {
      clearInterval(timer)
      ctx.close()
    },
  }
}
