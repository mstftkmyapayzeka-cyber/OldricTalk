import type { OldricApi } from './index'

declare global {
  interface Window {
    oldric?: OldricApi
  }
}
