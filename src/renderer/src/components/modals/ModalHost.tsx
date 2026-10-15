import { useModal } from '@/stores/modal'
import {
  AddServerModal,
  DeleteServerModal,
  EditServerModal,
  InviteModal,
  LeaveServerModal
} from './ServerModals'
import { CreateChannelModal, DeleteChannelModal, EditChannelModal } from './ChannelModals'
import MembersModal from './MembersModal'
import SettingsModal from './SettingsModal'
import VoiceSettingsModal from './VoiceSettingsModal'

export default function ModalHost(): React.JSX.Element | null {
  const modal = useModal((s) => s.modal)
  const close = useModal((s) => s.close)
  if (!modal) return null

  switch (modal.type) {
    case 'addServer':
      return <AddServerModal onClose={close} />
    case 'invite':
      return <InviteModal server={modal.server} onClose={close} />
    case 'editServer':
      return <EditServerModal server={modal.server} onClose={close} />
    case 'deleteServer':
      return <DeleteServerModal server={modal.server} onClose={close} />
    case 'leaveServer':
      return <LeaveServerModal server={modal.server} onClose={close} />
    case 'members':
      return <MembersModal server={modal.server} onClose={close} />
    case 'createChannel':
      return <CreateChannelModal server={modal.server} channelType={modal.channelType} onClose={close} />
    case 'editChannel':
      return <EditChannelModal channel={modal.channel} onClose={close} />
    case 'deleteChannel':
      return <DeleteChannelModal channel={modal.channel} onClose={close} />
    case 'settings':
      return <SettingsModal onClose={close} />
    case 'voiceSettings':
      return <VoiceSettingsModal onClose={close} />
  }
}
