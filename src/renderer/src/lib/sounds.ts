// Kısa sentezlenmiş uyarı sesleri (dosya gerektirmez).
type Cue = 'join' | 'leave' | 'mute' | 'unmute'

const NOTES: Record<Cue, number[]> = {
  join: [523.25, 783.99],
  leave: [783.99, 523.25],
  mute: [440],
  unmute: [659.25]
}

let ctx: AudioContext | null = null

export function playCue(cue: Cue): void {
  try {
    ctx ??= new AudioContext()
    const start = ctx.currentTime
    NOTES[cue].forEach((freq, i) => {
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = start + i * 0.09
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(t)
      osc.stop(t + 0.18)
    })
  } catch {
    // Ses çalınamazsa sessizce geç.
  }
}
