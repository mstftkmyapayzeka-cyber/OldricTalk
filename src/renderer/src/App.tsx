import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FullScreenLoader } from '@/components/ui/spinner'
import { useAuth } from '@/stores/auth'
import AuthPage from '@/pages/AuthPage'
import AppShell from '@/pages/AppShell'
import HomeLayout from '@/pages/HomeLayout'
import FriendsPage from '@/pages/FriendsPage'
import DmPage from '@/pages/DmPage'
import ServerLayout, { ServerIndexRedirect } from '@/pages/ServerLayout'
import ChannelPage from '@/pages/ChannelPage'
import InvitePage from '@/pages/InvitePage'
import TitleBar from '@/components/layout/TitleBar'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 }
  }
})

function Gate(): React.JSX.Element {
  const ready = useAuth((s) => s.ready)
  const session = useAuth((s) => s.session)
  if (!ready) return <FullScreenLoader />
  if (!session) return <AuthPage />
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/channels/@me" element={<HomeLayout />}>
          <Route index element={<FriendsPage />} />
          <Route path=":conversationId" element={<DmPage />} />
        </Route>
        <Route path="/channels/:serverId" element={<ServerLayout />}>
          <Route index element={<ServerIndexRedirect />} />
          <Route path=":channelId" element={<ChannelPage />} />
        </Route>
        <Route path="/invite/:code" element={<InvitePage />} />
        <Route path="*" element={<Navigate to="/channels/@me" replace />} />
      </Route>
    </Routes>
  )
}

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <HashRouter>
          <div className="flex h-full flex-col bg-rail">
            <TitleBar />
            <div className="min-h-0 flex-1">
              <Gate />
            </div>
          </div>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
