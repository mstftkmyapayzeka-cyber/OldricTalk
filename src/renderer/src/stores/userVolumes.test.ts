import { beforeEach, describe, expect, it } from 'vitest'
import { effectiveGain, setUserVolume, useUserVolumes, userVolume } from './userVolumes'

describe('kişi başı ses düzeyi', () => {
  beforeEach(() => useUserVolumes.setState({ byUser: {} }))

  it('ayarlanmamış kişi %100 ve susturulmamış', () => {
    expect(userVolume('ayse')).toEqual({ volume: 1, muted: false })
    expect(effectiveGain('ayse')).toBe(1)
  })

  it('düzeyi %0–%200 arasına sıkıştırır', () => {
    setUserVolume('ayse', { volume: 3 })
    expect(userVolume('ayse').volume).toBe(2)
    setUserVolume('ayse', { volume: -1 })
    expect(userVolume('ayse').volume).toBe(0)
  })

  it('susturulan kişinin kazancı 0, düzey korunur', () => {
    setUserVolume('ayse', { volume: 1.5 })
    setUserVolume('ayse', { muted: true })
    expect(effectiveGain('ayse')).toBe(0)
    setUserVolume('ayse', { muted: false })
    expect(effectiveGain('ayse')).toBe(1.5)
  })

  it('varsayılana dönen kişi listeden çıkar', () => {
    setUserVolume('ayse', { volume: 0.5 })
    expect(useUserVolumes.getState().byUser).toHaveProperty('ayse')
    setUserVolume('ayse', { volume: 1 })
    expect(useUserVolumes.getState().byUser).not.toHaveProperty('ayse')
  })
})
