import { useState, useCallback, useRef, useEffect } from 'react'
import { Eye, Settings, Video, VideoOff } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Session } from '@supabase/supabase-js'

import { MediaManager } from './lib/MediaManager'
import { AudioPlayer } from './lib/AudioPlayer'
import { LiveAPIClient } from './lib/LiveAPIClient'
import { MediaPipeManager } from './lib/MediaPipeManager'
import type { HazardEvent } from './lib/MediaPipeManager'
import { unlockAudio, playEarcon } from './lib/Earcon'
import { supabase } from './lib/supabase'

import { Nexus } from './components/Nexus'
import { SettingsPanel } from './components/SettingsPanel'
import { Login } from './components/Login'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type AuraStatus = 'idle' | 'recording' | 'thinking' | 'responding' | 'error' | 'reconnecting'
type ViewMode = 'nexus' | 'settings' | 'loading'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)

  const [activeView, setActiveView] = useState<ViewMode>('nexus')
  const [status, setStatus] = useState<AuraStatus>('idle')
  const statusRef = useRef<AuraStatus>('idle')
  
  // Helper to keep ref in sync with state
  const updateStatus = (newStatus: AuraStatus) => {
    if (statusRef.current === newStatus) return
    statusRef.current = newStatus
    setStatus(newStatus)
  }
  const [directorMessage, setDirectorMessage] = useState<string | null>(null)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [cameraEnabled, setCameraEnabled] = useState<boolean>(true)
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  /* 
   * LEGACY REMOVED: 
   * isHandsFree, wasLastResponseQuestionRef, listeningTimeoutRef 
   */

  const mediaManager = useRef<MediaManager | null>(null)
  const mediaPipeManager = useRef<MediaPipeManager | null>(null)
  const audioPlayer = useRef<AudioPlayer | null>(null)
  const apiClient = useRef<LiveAPIClient | null>(null)
  const captureInterval = useRef<number | null>(null)
  const heartbeatInterval = useRef<number | null>(null)

  // ── Session Auto-Resume ──
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

  // ── Haptic Heartbeat ──
  const startHeartbeat = useCallback(() => {
    if (!('vibrate' in navigator)) return
    heartbeatInterval.current = window.setInterval(() => {
      navigator.vibrate(40)
    }, 2000)
  }, [])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current)
      heartbeatInterval.current = null
    }
  }, [])

  const isEngaged = status !== 'idle'

  // ── Start Recording ──
  const startRecording = useCallback(async () => {
    await unlockAudio()

    if (!mediaManager.current) mediaManager.current = new MediaManager()
    if (!mediaPipeManager.current) mediaPipeManager.current = new MediaPipeManager()
    if (!audioPlayer.current) audioPlayer.current = new AudioPlayer()
    if (!apiClient.current) apiClient.current = new LiveAPIClient()
    
    // 2026 Direct Intent: Force Restart from stuck reconnection/error states
    if (statusRef.current === 'reconnecting' || statusRef.current === 'error') {
      console.log("App: Clean start from stuck state...");
      apiClient.current?.disconnect();
      mediaManager.current?.stop();
    } else if (isEngaged && apiClient.current?.isConnected) {
      // Already active in a positive state, don't double-start
      return;
    }

    try {
      if (apiClient.current?.isConnected) {
        apiClient.current.disconnect();
      }
      // Guarantee sensor cleanup before re-init
      mediaManager.current?.stop();
      await mediaManager.current?.initialize();
    } catch (err) {
      console.error('App: Failed to initialize media pipeline', err)
      updateStatus('error')
      playEarcon('error')
      setDirectorMessage('Camera access denied')
      return
    }

    setVideoStream(mediaManager.current.getStream())
    mediaManager.current.toggleVideo(cameraEnabled)

    updateStatus('recording')
    playEarcon('start')
    setDirectorMessage('Listening...')
    startHeartbeat()

    if ('vibrate' in navigator) navigator.vibrate([80, 40, 80])

    // Initialize MediaPipe Safety Layer (Parallel to Cloud)
    mediaPipeManager.current.initialize().catch(err => {
      console.warn("MediaPipe Safety Layer failed to initialize, continuing with Cloud-only:", err);
    });

    mediaPipeManager.current.onHazard((hazard: HazardEvent) => {
      // 1. Immediate tactile feedback for safety
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]); 
      }
      // console.log("EDGE HAZARD DETECTED:", hazard.label);

      // 2. PRIVACY-AT-SOURCE: If it is a person, apply a privacy mask
      if (hazard.label === 'person' && hazard.boundingBox && mediaManager.current) {
        mediaManager.current.setPrivacyMasks([hazard.boundingBox]);
      }

      // 3. SPATIAL FEEDBACK: Orientation
      if (hazard.boundingBox && audioPlayer.current) {
        // Map normalized X (0 to 1) to Panner X (-1 to 1)
        const spatialX = (hazard.boundingBox.x + hazard.boundingBox.w / 2) * 2 - 1;
        audioPlayer.current.updateSpatialPosition(spatialX, 0, -1);
      }
    });

    try {
      await audioPlayer.current.resume()

      // ── Clean up previous listeners if any ──
      apiClient.current!.onContent(() => {});
      apiClient.current!.onAudio(() => {});
      apiClient.current!.onTurnComplete(() => {});
      apiClient.current!.onDisconnect(() => {});
      apiClient.current!.onReconnecting(() => {});
      apiClient.current!.onReconnected(() => {});

      apiClient.current!.onContent((text) => {
        setDirectorMessage(text)
        updateStatus('responding')
        stopHeartbeat()
      })

      apiClient.current!.onAudio((pcm16) => {
        updateStatus('responding')
        stopHeartbeat()
        audioPlayer.current?.queueAudio(pcm16)
      })

      apiClient.current!.onTurnComplete(async () => {
        // Return to idle after response (One-shot model)
        updateStatus('idle')
        setDirectorMessage(null)
        stopHeartbeat()
        
        // Final cleanup
        apiClient.current?.disconnect()
      })

      apiClient.current!.onDisconnect(() => {
        if (statusRef.current !== 'idle' && statusRef.current !== 'error' && statusRef.current !== 'reconnecting') {
           updateStatus('error');
           playEarcon('error');
           setDirectorMessage('Connection lost');
           mediaManager.current?.stop();
           setVideoStream(null);
           if (captureInterval.current) {
               clearInterval(captureInterval.current);
               captureInterval.current = null;
           }
           stopHeartbeat();
        }
      })

      apiClient.current!.onReconnecting((attempt) => {
        updateStatus('reconnecting');
        setDirectorMessage(`Reconnecting (Attempt ${attempt})...`);
      });

      apiClient.current!.onReconnected(() => {
        // Keep in recording/active state, don't transition to watching
        if ('vibrate' in navigator) navigator.vibrate([40, 40, 40]);
      });

      // Auth via Supabase
      let token: string | undefined = undefined;
      try {
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token
      } catch (err) {
        console.warn('Auth failed:', err)
      }

      if (!apiClient.current!.isConnected) {
        await apiClient.current!.connect(token)
      }

      await mediaManager.current.startAudioCapture((pcm16) => {
        apiClient.current?.sendAudioChunk(pcm16)
      })

      captureInterval.current = window.setInterval(() => {
        const frame = mediaManager.current?.captureFrame()
        if (frame && apiClient.current) {
          apiClient.current.sendVideoFrame(frame)
        }

        const videoElement = mediaManager.current?.getVideoElement();
        if (videoElement && mediaPipeManager.current) {
          mediaManager.current?.setPrivacyMasks([]);
          mediaPipeManager.current.detect(videoElement, performance.now());
        }
      }, 1000)

    } catch (err) {
      console.error('App: Recording session failed', err)
      updateStatus('error')
      playEarcon('error')
      setDirectorMessage('Connection failed')
      stopHeartbeat()
      mediaManager.current?.stop()
    }
  }, [startHeartbeat, stopHeartbeat, cameraEnabled, isEngaged])

  const stopRecording = useCallback(() => {
    // 2026 Direct Intent: Tapping commits the turn
    // IMMEDIATE SENSOR LOCKDOWN: Kill hardware as soon as user commits
    if (captureInterval.current) {
        clearInterval(captureInterval.current)
        captureInterval.current = null
    }
    
    // Capture final frame before closing stream
    const frame = mediaManager.current?.captureFrame()
    if (frame && apiClient.current) {
      apiClient.current.sendVideoFrame(frame)
    }

    mediaManager.current?.stop()
    setVideoStream(null)

    apiClient.current?.sendTurnComplete()
    updateStatus('thinking')
    playEarcon('thinking')
    setDirectorMessage('Processing...')
    stopHeartbeat()
    
    // Physical hardware lockdown
    if (mediaManager.current) {
      mediaManager.current.stop()
    }

    if ('vibrate' in navigator) navigator.vibrate([50, 80, 50])
  }, [stopHeartbeat])

  const toggleCamera = useCallback(() => {
    const newState = !cameraEnabled
    setCameraEnabled(newState)
    if (mediaManager.current) {
      mediaManager.current.toggleVideo(newState)
    }
  }, [cameraEnabled])

  const cycleCamera = useCallback(async () => {
    if (!mediaManager.current) mediaManager.current = new MediaManager()
    
    let currentCameras = cameras
    if (currentCameras.length === 0) {
      currentCameras = await mediaManager.current.getAvailableCameras()
      setCameras(currentCameras)
    }

    if (currentCameras.length === 0) return

    const nextIndex = (currentCameraIndex + 1) % currentCameras.length
    setCurrentCameraIndex(nextIndex)

    if ('vibrate' in navigator) {
      const isBack = currentCameras[nextIndex].label.toLowerCase().includes('back') || 
                     currentCameras[nextIndex].label.toLowerCase().includes('environment')
      navigator.vibrate(isBack ? [40, 40, 40] : [120])
    }

    if (isEngaged) {
      await mediaManager.current.initialize(currentCameras[nextIndex].id)
      setVideoStream(mediaManager.current.getStream())
      try {
        await mediaManager.current.startAudioCapture((pcm16) => {
          apiClient.current?.sendAudioChunk(pcm16)
        })
      } catch (err) {
        console.error('Failed to restart audio capture after camera switch:', err)
      }
    }
  }, [cameras, currentCameraIndex, isEngaged])



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
