import { describe, expect, it } from 'vitest'
import { displayStatus, ONLINE_WINDOW_MS } from './presence'

describe('displayStatus', () => {
  const now = Date.parse('2026-10-14T12:00:00Z')
  const recent = new Date(now - 10_000).toISOString()
  const stale = new Date(now - ONLINE_WINDOW_MS - 1).toISOString()

  it('yakın zamanda görülen kullanıcının seçtiği durumu gösterir', () => {
    expect(displayStatus({ status: 'dnd', last_seen_at: recent }, now)).toBe('dnd')
  })

  it('heartbeat’i eskiyen kullanıcıyı çevrimdışı gösterir', () => {
    expect(displayStatus({ status: 'online', last_seen_at: stale }, now)).toBe('offline')
  })

  it('görünmez kullanıcıyı çevrimdışı gösterir', () => {
    expect(displayStatus({ status: 'invisible', last_seen_at: recent }, now)).toBe('offline')
  })
})
