import { useState, useCallback, useRef, useEffect } from 'react'
import { Eye, ShieldAlert, Settings, Smile } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { MediaManager } from './lib/MediaManager'
import { AudioPlayer } from './lib/AudioPlayer'
import { LiveAPIClient } from './lib/LiveAPIClient'

import { Nexus } from './components/Nexus'
import { GuardianList } from './components/GuardianList'
import type { GuardianAlert } from './components/GuardianList'
import { SocialMirror } from './components/SocialMirror'
import { SettingsPanel } from './components/SettingsPanel'
import { mockGuardianAlerts, mockSocialData } from './data/mockData'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ViewMode = 'nexus' | 'guardian' | 'social' | 'settings'

function App() {
  const [activeView, setActiveView] = useState<ViewMode>('nexus')
  const [isActive, setIsActive] = useState(false)
  const [directorMessage, setDirectorMessage] = useState<string | null>(null)

  const mediaManager = useRef<MediaManager | null>(null)
  const audioPlayer = useRef<AudioPlayer | null>(null)
  const apiClient = useRef<LiveAPIClient | null>(null)
  const captureInterval = useRef<number | null>(null)

  const toggleAura = useCallback(async () => {
    console.log("toggleAura called, isActive:", isActive);
    if (!isActive) {
      // Starting Aura
      if (!mediaManager.current) mediaManager.current = new MediaManager()
      if (!audioPlayer.current) audioPlayer.current = new AudioPlayer()
      if (!apiClient.current) apiClient.current = new LiveAPIClient()

      console.log("Initializing media...");
      const success = await mediaManager.current.initialize()
      console.log("Media initialization success:", success);
      if (success) {
        setIsActive(true)
        await audioPlayer.current.resume()

        try {
          // Setup WebSocket Client listeners
          apiClient.current!.onContent((text) => {
            setDirectorMessage(text)
          })

          apiClient.current!.onAudio((pcm16) => {
            audioPlayer.current?.queueAudio(pcm16)
          })

          await apiClient.current!.connect()

          // Start Capture Loop
          captureInterval.current = window.setInterval(() => {
            const frame = mediaManager.current?.captureFrame()
            if (frame && apiClient.current) {
              apiClient.current.sendVideoFrame(frame)
            }
          }, 1000)

          mediaManager.current.startAudioCapture((pcm16) => {
            apiClient.current?.sendAudioChunk(pcm16)
          })

          setDirectorMessage("Scanning environment...")
        } catch (err) {
          console.error("Failed to start Aura session:", err)
          setIsActive(false)
          setDirectorMessage("Session Error")
          mediaManager.current?.stop()
        }
      }
    } else {
      // Stopping Aura
      setIsActive(false)
      mediaManager.current?.stop()
      audioPlayer.current?.stop()
      apiClient.current?.disconnect()
      if (captureInterval.current) clearInterval(captureInterval.current)
      setDirectorMessage(null)
    }

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(isActive ? 50 : [100, 50, 100])
    }
  }, [isActive])

  useEffect(() => {
    return () => {
      mediaManager.current?.stop()
      if (captureInterval.current) clearInterval(captureInterval.current)
    }
  }, [])

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-aura-dark text-aura-light overflow-hidden relative">
      {/* Dynamic Backgrounds */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute w-[200vw] h-[200vh] -top-[50vh] -left-[50vw] bg-[radial-gradient(ellipse_at_center,rgba(19,127,236,0.03)_0%,transparent_50%)] animate-spin-slow" />
        <div className="absolute w-[150vw] h-[150vh] -top-[25vh] -left-[25vw] bg-[radial-gradient(ellipse_at_center,rgba(112,0,255,0.03)_0%,transparent_50%)] animate-spin-reverse-slow" />
      </div>

      {/* Dynamic Main Content Area */}
      <main className="flex-1 relative w-full h-full overflow-hidden z-10">
        {activeView === 'nexus' && (
          <>
            {/* Header Layer (Only in Nexus Standby/Scanning) */}
            <header className="absolute top-0 inset-x-0 px-8 py-10 flex justify-between items-center z-30 pointer-events-none">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-4 h-4 rounded-full transition-all duration-300",
                  isActive ? "bg-aura-primary shadow-[0_0_15px_#137FEC]" : "bg-white/30"
                )} />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/80">
                  {isActive ? 'Live' : 'Ready'}
                </span>
              </div>
              <button
                onClick={() => setActiveView('settings')}
                className="pointer-events-auto p-4 rounded-full text-white/60 hover:text-white transition-colors"
              >
                <Settings className="w-8 h-8" />
              </button>
            </header>

            <Nexus
              isActive={isActive}
              directorMessage={directorMessage}
              onToggle={toggleAura}
            />
          </>
        )}

        {activeView === 'guardian' && (
          <GuardianList alerts={mockGuardianAlerts as GuardianAlert[]} />
        )}

        {activeView === 'social' && (
          <SocialMirror data={isActive || true ? mockSocialData : null} />
        )}

        {activeView === 'settings' && (
          <SettingsPanel onClose={() => setActiveView('nexus')} />
        )}
      </main>

      {/* Persistent Bottom Nav (Hidden if in settings) */}
      {activeView !== 'settings' && (
        <nav className="relative z-30 flex justify-around items-center px-6 py-8 bg-aura-dark border-t border-white/10">
          <button
            onClick={() => setActiveView('guardian')}
            className={cn("flex flex-col items-center gap-2 transition-colors", activeView === 'guardian' ? "text-white" : "text-white/40")}
          >
            <ShieldAlert className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Alerts</span>
          </button>

          <button
            onClick={() => setActiveView('nexus')}
            className={cn("flex flex-col items-center gap-2 transition-colors", activeView === 'nexus' ? "text-aura-primary" : "text-white/40")}
          >
            <Eye className="w-10 h-10" />
            <span className="text-[10px] flex items-center justify-center font-bold uppercase tracking-widest mt-1">Scan</span>
          </button>

          <button
            onClick={() => setActiveView('social')}
            className={cn("flex flex-col items-center gap-2 transition-colors", activeView === 'social' ? "text-aura-social" : "text-white/40")}
          >
            <Smile className="w-8 h-8" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Social</span>
          </button>
        </nav>
      )}
    </div>
  )
}

export default App
