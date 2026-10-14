import { create } from 'zustand'
import type { Channel, ChannelType, Server } from '@/lib/types'

export type ModalState =
  | { type: 'addServer' }
  | { type: 'invite'; server: Server }
  | { type: 'editServer'; server: Server }
  | { type: 'deleteServer'; server: Server }
  | { type: 'leaveServer'; server: Server }
  | { type: 'members'; server: Server }
  | { type: 'createChannel'; server: Server; channelType?: ChannelType }
  | { type: 'editChannel'; channel: Channel }
  | { type: 'deleteChannel'; channel: Channel }
  | { type: 'settings' }

type ModalStore = {
  modal: ModalState | null
  open: (m: ModalState) => void
  close: () => void
}

export const useModal = create<ModalStore>((set) => ({
  modal: null,
  open: (modal) => set({ modal }),
  close: () => set({ modal: null })
}))
