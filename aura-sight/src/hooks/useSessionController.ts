import { useCallback, useEffect, useReducer, useRef } from 'react';
import { MediaManager } from '../lib/MediaManager';
import { AudioPlayer } from '../lib/AudioPlayer';
import { LiveAPIClient } from '../lib/LiveAPIClient';
import { MediaPipeManager } from '../lib/MediaPipeManager';
import type { HazardEvent } from '../lib/MediaPipeManager';
import { unlockAudio, playEarcon } from '../lib/Earcon';
import { supabase } from '../lib/supabase';
import type { AuraStatus } from '../lib/sessionTypes';

type CameraInfo = { id: string; label: string };

type SessionState = {
    status: AuraStatus;
    directorMessage: string | null;
    videoStream: MediaStream | null;
    cameraEnabled: boolean;
    cameras: CameraInfo[];
    currentCameraIndex: number;
};

type Action =
    | { type: 'status'; status: AuraStatus }
    | { type: 'message'; message: string | null }
    | { type: 'stream'; stream: MediaStream | null }
    | { type: 'cameraEnabled'; enabled: boolean }
    | { type: 'cameras'; cameras: CameraInfo[] }
    | { type: 'cameraIndex'; index: number };

const initialState: SessionState = {
    status: 'idle',
    directorMessage: null,
    videoStream: null,
    cameraEnabled: true,
    cameras: [],
    currentCameraIndex: 0,
};

function reducer(state: SessionState, action: Action): SessionState {
    switch (action.type) {
        case 'status':
            return { ...state, status: action.status };
        case 'message':
            return { ...state, directorMessage: action.message };
        case 'stream':
            return { ...state, videoStream: action.stream };
        case 'cameraEnabled':
            return { ...state, cameraEnabled: action.enabled };
        case 'cameras':
            return { ...state, cameras: action.cameras };
        case 'cameraIndex':
            return { ...state, currentCameraIndex: action.index };
        default:
            return state;
    }
}

export type SessionController = {
    state: SessionState;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    toggleCamera: () => void;
    cycleCamera: () => Promise<void>;
    isEngaged: boolean;
};

export function useSessionController(): SessionController {
    const [state, dispatch] = useReducer(reducer, initialState);
    const stateRef = useRef(state);
    const statusRef = useRef<AuraStatus>(initialState.status);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        statusRef.current = state.status;
    }, [state.status]);

    const mediaManager = useRef<MediaManager | null>(null);
    const mediaPipeManager = useRef<MediaPipeManager | null>(null);
    const audioPlayer = useRef<AudioPlayer | null>(null);
    const apiClient = useRef<LiveAPIClient | null>(null);
    const captureInterval = useRef<number | null>(null);
    const heartbeatInterval = useRef<number | null>(null);

    const setStatus = useCallback((status: AuraStatus) => {
        if (statusRef.current === status) return;
        statusRef.current = status;
        dispatch({ type: 'status', status });
    }, []);

    const setDirectorMessage = useCallback((message: string | null) => {
        dispatch({ type: 'message', message });
    }, []);

    const setVideoStream = useCallback((stream: MediaStream | null) => {
        dispatch({ type: 'stream', stream });
    }, []);

    const setCameraEnabled = useCallback((enabled: boolean) => {
        dispatch({ type: 'cameraEnabled', enabled });
    }, []);

    const setCameras = useCallback((cameras: CameraInfo[]) => {
        dispatch({ type: 'cameras', cameras });
    }, []);

    const setCameraIndex = useCallback((index: number) => {
        dispatch({ type: 'cameraIndex', index });
    }, []);

    const startHeartbeat = useCallback(() => {
        if (!('vibrate' in navigator)) return;
        heartbeatInterval.current = window.setInterval(() => {
            navigator.vibrate(40);
        }, 2000);
    }, []);

    const stopHeartbeat = useCallback(() => {
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
        }
    }, []);

    const clearCaptureInterval = useCallback(() => {
        if (captureInterval.current) {
            clearInterval(captureInterval.current);
            captureInterval.current = null;
        }
    }, []);

    const stopMedia = useCallback(() => {
        clearCaptureInterval();
        stopHeartbeat();
        mediaManager.current?.stop();
        setVideoStream(null);
    }, [clearCaptureInterval, setVideoStream, stopHeartbeat]);

    const ensureManagers = useCallback(() => {
        if (!mediaManager.current) mediaManager.current = new MediaManager();
        if (!mediaPipeManager.current) mediaPipeManager.current = new MediaPipeManager();
        if (!audioPlayer.current) audioPlayer.current = new AudioPlayer();
        if (!apiClient.current) apiClient.current = new LiveAPIClient();

        return {
            mediaManager: mediaManager.current,
            mediaPipeManager: mediaPipeManager.current,
            audioPlayer: audioPlayer.current,
            apiClient: apiClient.current,
        };
    }, []);

    const startRecording = useCallback(async () => {
        await unlockAudio();

        const { mediaManager: media, mediaPipeManager: mediaPipe, audioPlayer: audio, apiClient: client } = ensureManagers();
        if (!media || !mediaPipe || !audio || !client) return;

        if (statusRef.current === 'reconnecting' || statusRef.current === 'error') {
            console.log('App: Clean start from stuck state...');
            client.disconnect();
            media.stop();
            clearCaptureInterval();
        } else if (statusRef.current !== 'idle' && client.isConnected) {
            return;
        }

        try {
            if (client.isConnected) {
                client.disconnect();
            }
            media.stop();
            await media.initialize();
        } catch (err) {
            console.error('App: Failed to initialize media pipeline', err);
            setStatus('error');
            playEarcon('error');
            setDirectorMessage('Camera access denied');
            return;
        }

        setVideoStream(media.getStream());
        media.toggleVideo(stateRef.current.cameraEnabled);

        setStatus('recording');
        playEarcon('start');
        setDirectorMessage('Listening...');
        startHeartbeat();

        if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);

        mediaPipe.initialize().catch(err => {
            console.warn('MediaPipe Safety Layer failed to initialize, continuing with Cloud-only:', err);
        });

        mediaPipe.onHazard((hazard: HazardEvent) => {
            if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }

            if (hazard.label === 'person' && hazard.boundingBox) {
                media.setPrivacyMasks([hazard.boundingBox]);
            }

            if (hazard.boundingBox) {
                const spatialX = (hazard.boundingBox.x + hazard.boundingBox.w / 2) * 2 - 1;
                audio.updateSpatialPosition(spatialX, 0, -1);
            }
        });

        try {
            await audio.resume();

            client.onContent(() => {});
            client.onAudio(() => {});
            client.onTurnComplete(() => {});
            client.onDisconnect(() => {});
            client.onReconnecting(() => {});
            client.onReconnected(() => {});

            client.onContent((text) => {
                setDirectorMessage(text);
                setStatus('responding');
                stopHeartbeat();
            });

            client.onAudio((pcm16) => {
                setStatus('responding');
                stopHeartbeat();
                audio.queueAudio(pcm16);
            });

            client.onTurnComplete(() => {
                setStatus('idle');
                setDirectorMessage(null);
                stopHeartbeat();
                client.disconnect();
            });

            client.onDisconnect(() => {
                if (statusRef.current !== 'idle' && statusRef.current !== 'error' && statusRef.current !== 'reconnecting') {
                    setStatus('error');
                    playEarcon('error');
                    setDirectorMessage('Connection lost');
                    stopMedia();
                }
            });

            client.onReconnecting((attempt) => {
                setStatus('reconnecting');
                setDirectorMessage(`Reconnecting (Attempt ${attempt})...`);
            });

            client.onReconnected(() => {
                if ('vibrate' in navigator) navigator.vibrate([40, 40, 40]);
            });

            let token: string | undefined = undefined;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                token = session?.access_token;
            } catch (err) {
                console.warn('Auth failed:', err);
            }

            if (!client.isConnected) {
                await client.connect(token);
            }

            await media.startAudioCapture((pcm16) => {
                client.sendAudioChunk(pcm16);
            });

            clearCaptureInterval();
            captureInterval.current = window.setInterval(() => {
                const frame = media.captureFrame();
                if (frame) {
                    client.sendVideoFrame(frame);
                }

                const videoElement = media.getVideoElement();
                if (videoElement) {
                    media.setPrivacyMasks([]);
                    mediaPipe.detect(videoElement, performance.now());
                }
            }, 1000);
        } catch (err) {
            console.error('App: Recording session failed', err);
            setStatus('error');
            playEarcon('error');
            setDirectorMessage('Connection failed');
            stopHeartbeat();
            media.stop();
        }
    }, [clearCaptureInterval, ensureManagers, setDirectorMessage, setStatus, setVideoStream, startHeartbeat, stopHeartbeat, stopMedia]);

    const stopRecording = useCallback(() => {
        const media = mediaManager.current;
        const client = apiClient.current;
        if (!media || !client) return;

        clearCaptureInterval();

        const frame = media.captureFrame();
        if (frame) {
            client.sendVideoFrame(frame);
        }

        media.stop();
        setVideoStream(null);

        client.sendTurnComplete();
        setStatus('thinking');
        playEarcon('thinking');
        setDirectorMessage('Processing...');
        stopHeartbeat();

        if ('vibrate' in navigator) navigator.vibrate([50, 80, 50]);
    }, [clearCaptureInterval, setDirectorMessage, setStatus, setVideoStream, stopHeartbeat]);

    const toggleCamera = useCallback(() => {
        const newState = !stateRef.current.cameraEnabled;
        setCameraEnabled(newState);
        if (mediaManager.current) {
            mediaManager.current.toggleVideo(newState);
        }
    }, [setCameraEnabled]);

    const cycleCamera = useCallback(async () => {
        const { mediaManager: media, apiClient: client } = ensureManagers();
        if (!media || !client) return;

        let currentCameras = stateRef.current.cameras;
        if (currentCameras.length === 0) {
            currentCameras = await media.getAvailableCameras();
            setCameras(currentCameras);
        }

        if (currentCameras.length === 0) return;

        const nextIndex = (stateRef.current.currentCameraIndex + 1) % currentCameras.length;
        setCameraIndex(nextIndex);

        if ('vibrate' in navigator) {
            const label = currentCameras[nextIndex].label.toLowerCase();
            const isBack = label.includes('back') || label.includes('environment');
            navigator.vibrate(isBack ? [40, 40, 40] : [120]);
        }

        if (statusRef.current !== 'idle') {
            await media.initialize(currentCameras[nextIndex].id);
            setVideoStream(media.getStream());
            try {
                await media.startAudioCapture((pcm16) => {
                    client.sendAudioChunk(pcm16);
                });
            } catch (err) {
                console.error('Failed to restart audio capture after camera switch:', err);
            }
        }
    }, [ensureManagers, setCameraIndex, setCameras, setVideoStream]);

    useEffect(() => {
        return () => {
            clearCaptureInterval();
            stopHeartbeat();
            mediaManager.current?.stop();
            apiClient.current?.disconnect();
            mediaPipeManager.current?.close();
        };
    }, [clearCaptureInterval, stopHeartbeat]);

    return {
        state,
        startRecording,
        stopRecording,
        toggleCamera,
        cycleCamera,
        isEngaged: state.status !== 'idle',
    };
}
