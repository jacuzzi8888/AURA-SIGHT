import { useState, useEffect } from 'react'
import { Eye, Settings, Video, VideoOff } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Session } from '@supabase/supabase-js'

import { supabase } from './lib/supabase'

import { useSessionController } from './hooks/useSessionController'
import { Nexus } from './components/Nexus'
import { SettingsPanel } from './components/SettingsPanel'
import { Login } from './components/Login'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ViewMode = 'nexus' | 'settings' | 'loading'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [activeView, setActiveView] = useState<ViewMode>('nexus')

  const { state, startRecording, stopRecording, toggleCamera, cycleCamera, isEngaged } = useSessionController()
  const { status, directorMessage, videoStream, cameraEnabled } = state

  // -- Session Auto-Resume --
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoadingSession(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isLoadingSession) {
    return (
        <div className="flex h-[100dvh] w-full items-center justify-center bg-aura-dark text-aura-light">
            <p className="text-3xl font-bold animate-pulse tracking-widest text-aura-cyan">AURA</p>
        </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-aura-dark text-aura-light overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute w-[200vw] h-[200vh] -top-[50vh] -left-[50vw] bg-[radial-gradient(ellipse_at_center,rgba(19,127,236,0.03)_0%,transparent_50%)] animate-spin-slow" />
        <div className="absolute w-[150vw] h-[150vh] -top-[25vh] -left-[25vw] bg-[radial-gradient(ellipse_at_center,rgba(112,0,255,0.03)_0%,transparent_50%)] animate-spin-reverse-slow" />
      </div>

      <main className="flex-1 relative w-full h-full overflow-hidden z-10">
        {activeView === 'nexus' ? (
          <>
            <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50">
              <div className="flex items-center gap-2 text-white">
                <Eye className="w-6 h-6 text-aura-cyan" aria-hidden="true" />
                <span className="font-bold tracking-widest uppercase text-sm">Aura</span>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleCamera}
                  className="p-3 text-slate-300 hover:text-white transition-colors"
                >
                  {cameraEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6 text-red-400" />}
                </button>
                <button
                  onClick={cycleCamera}
                  className="p-3 text-aura-cyan hover:text-white transition-all active:rotate-180"
                >
                  <Eye className="w-7 h-7" />
                </button>
                <button
                  onClick={() => setActiveView('settings')}
                  className="p-3 text-slate-300 hover:text-white transition-colors"
                >
                  <Settings className="w-6 h-6" />
                </button>
              </div>
            </header>

            <Nexus
              status={status}
              directorMessage={directorMessage}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              videoStream={videoStream}
              cameraEnabled={cameraEnabled}
            />
          </>
        ) : (
          <SettingsPanel onClose={() => setActiveView('nexus')} />
        )}
      </main>

      {activeView !== 'settings' && (
        <nav className="relative z-30 flex justify-center items-center px-6 py-8 bg-aura-dark border-t border-white/10">
          <button
            onClick={() => setActiveView('nexus')}
            className={cn(
              "flex flex-col items-center gap-2 transition-all duration-500 px-10 py-2 rounded-full",
              isEngaged ? "text-aura-primary scale-110" : "text-white/40 hover:text-white/60"
            )}
          >
            <Eye className={cn("w-10 h-10 transition-transform duration-500", isEngaged && "animate-pulse")} />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] mt-1">
              {status === 'idle' ? 'Hold to Scan' : status.toUpperCase()}
            </span>
          </button>
        </nav>
      )}
    </div>
  )
}

export default App
