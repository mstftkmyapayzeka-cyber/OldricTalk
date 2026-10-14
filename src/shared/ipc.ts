// Ana süreç ↔ renderer arasında paylaşılan tipler.

export type ScreenSource = {
  id: string
  name: string
  kind: 'screen' | 'window'
  thumbnail: string
  icon: string | null
}
