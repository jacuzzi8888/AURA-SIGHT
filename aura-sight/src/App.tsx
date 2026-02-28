import { useState, useCallback, useRef, useEffect } from 'react'
import { Eye, ShieldAlert, Mic, Settings, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { MediaManager } from './lib/MediaManager'
import { AudioPlayer } from './lib/AudioPlayer'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function App() {
  const [isActive, setIsActive] = useState(false)
  const [directorMessage, setDirectorMessage] = useState<string | null>(null)

  const mediaManager = useRef<MediaManager | null>(null)
  const audioPlayer = useRef<AudioPlayer | null>(null)
  const captureInterval = useRef<number | null>(null)

  const toggleAura = useCallback(async () => {
    if (!isActive) {
      // Starting Aura
      if (!mediaManager.current) mediaManager.current = new MediaManager()
      if (!audioPlayer.current) audioPlayer.current = new AudioPlayer()

      const success = await mediaManager.current.initialize()
      if (success) {
        setIsActive(true)
        audioPlayer.current.resume()

        // Mock capture loop (sending to console for now)
        captureInterval.current = window.setInterval(() => {
          const frame = mediaManager.current?.captureFrame()
          if (frame) {
            // In the future, this goes to WebSocket
            console.log('Captured frame (base64 length):', frame.length)
          }
        }, 1000) // 1fps for desktop testing

        mediaManager.current.startAudioCapture((pcm16) => {
          // In the future, this goes to WebSocket
          console.log('Captured audio chunk samples:', pcm16.length)
        })

        setDirectorMessage("Scanning environment... Tilt up slightly.")
      }
    } else {
      // Stopping Aura
      setIsActive(false)
      mediaManager.current?.stop()
      audioPlayer.current?.stop()
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
    <div className="flex flex-col h-screen w-full bg-aura-dark text-aura-light">
      {/* Top Status Bar */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            isActive ? "bg-aura-primary shadow-[0_0_10px_#FF4D00]" : "bg-white/20"
          )} />
          <span className="text-sm font-medium tracking-widest uppercase">
            Aura {isActive ? 'Live' : 'Standby'}
          </span>
        </div>
        <button className="p-2 rounded-full hover:bg-white/5 transition-colors">
          <Settings className="w-5 h-5 opacity-60" />
        </button>
      </header>

      {/* Main Interaction Area (The One Button) */}
      <main className="flex-1 relative">
        <button
          onPointerDown={toggleAura}
          className={cn(
            "btn-aura flex-col gap-6 select-none",
            isActive
              ? "bg-aura-primary text-aura-dark shadow-[inset_0_0_100px_rgba(0,0,0,0.2)]"
              : "bg-white/5 text-aura-light hover:bg-white/10"
          )}
        >
          {isActive ? (
            <>
              <ShieldAlert className="w-24 h-24" />
              <span className="text-xl">Guardian Active</span>
            </>
          ) : (
            <>
              <Eye className="w-24 h-24" />
              <span className="text-xl">Hold to Aura</span>
            </>
          )}
        </button>

        {/* Dynamic Context Overlays & Director */}
        {isActive && (
          <div className="absolute inset-x-4 top-4 flex flex-col gap-4 pointer-events-none">
            {/* The Director (Framing Guidance) */}
            {directorMessage && (
              <div className="bg-aura-primary/95 text-aura-dark p-6 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <ArrowUp className="w-8 h-8 animate-bounce" />
                <p className="text-xl font-bold font-display">{directorMessage}</p>
              </div>
            )}

            {/* Pathfinder Feedback */}
            <div className="bg-aura-dark/80 backdrop-blur-md p-4 rounded-xl border border-white/10 border-l-4 border-l-aura-secondary">
              <p className="text-sm opacity-60 uppercase mb-1">Pathfinder</p>
              <p className="text-lg font-bold">Clear path ahead. 2.5 meters.</p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Action Bar */}
      <footer className="px-8 py-8 flex justify-around items-center bg-white/5 backdrop-blur-sm">
        <button className="flex flex-col items-center gap-2 opacity-40">
          <Mic className="w-6 h-6" />
          <span className="text-[10px] uppercase tracking-tighter">Voice</span>
        </button>
        <div className="w-[1px] h-8 bg-white/10" />
        <button className="flex flex-col items-center gap-2 text-aura-secondary">
          <ShieldAlert className="w-6 h-6" />
          <span className="text-[10px] uppercase tracking-tighter">Safety</span>
        </button>
      </footer>
    </div>
  )
}

export default App
