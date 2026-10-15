import { create } from 'zustand'

/** Krem ana temadır; koyu tema isteğe bağlı, "system" Windows ayarını izler. */
export type ThemeChoice = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const KEY = 'oldrictalk-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function load(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'system' ? v : 'light'
  } catch {
    return 'light'
  }
}

function resolve(choice: ThemeChoice): Theme {
  if (choice === 'system') return media.matches ? 'dark' : 'light'
  return choice
}

/** Belgeye data-theme yazar ve pencere çerçevesinin (başlık çubuğu düğmeleri) rengini eşler. */
function apply(choice: ThemeChoice): void {
  const theme = resolve(choice)
  document.documentElement.dataset.theme = theme
  window.oldric?.setTheme(theme)
  useTheme.setState({ theme })
}

export const useTheme = create<{ choice: ThemeChoice; theme: Theme }>(() => {
  const choice = load()
  return { choice, theme: resolve(choice) }
})

export function setTheme(choice: ThemeChoice): void {
  useTheme.setState({ choice })
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // depolama kapalıysa tema yalnızca bu oturumda geçerli
  }
  apply(choice)
}

/** İlk çizimden önce çağrılır; tema yanıp sönmez. */
export function initTheme(): void {
  apply(useTheme.getState().choice)
  media.addEventListener('change', () => {
    if (useTheme.getState().choice === 'system') apply('system')
  })
}
