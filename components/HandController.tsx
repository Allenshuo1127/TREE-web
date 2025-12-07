import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Camera, AlertCircle, Hand } from 'lucide-react';

interface HandControllerProps {
  onGesture: (gesture: 'OPEN' | 'CLOSED' | 'NONE') => void;
  onHandUpdate: (data: { rotation: number; x: number; y: number; isDetected: boolean }) => void;
}

export const HandController: React.FC<HandControllerProps> = ({ onGesture, onHandUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  
  // Debounce / Stability logic
  const gestureHistory = useRef<string[]>([]);
  const HISTORY_LENGTH = 15; // Require ~0.5s of consistent gesture

  useEffect(() => {
    let animationFrameId: number;

    const setupHandLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        
        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        startWebcam();
      } catch (err) {
        console.error("Error initializing hand landmarker:", err);
        setError("Failed to load AI Model. Please refresh or try a different browser.");
      }
    };

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', predictWebcam);
        }
        setIsLoaded(true);
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setError("Camera access denied. Please allow camera permissions to use Hand Control.");
      }
    };

    const predictWebcam = () => {
      if (!landmarkerRef.current || !videoRef.current) return;

      const startTimeMs = performance.now();
      
      if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
        const result = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0];
          
          // 1. Position Tracking (Normalized 0..1)
          // X: 0 (Left) -> 1 (Right) | Y: 0 (Top) -> 1 (Bottom)
          const handX = landmarks[0].x; 
          const handY = landmarks[0].y;
          
          // Map to rotation (inverted for mirror feel)
          const rotation = (handX - 0.5) * Math.PI * 2.5; 

          // Send update with normalized coordinates (-1 to 1) for camera control
          onHandUpdate({
            rotation: -rotation,
            x: (handX - 0.5) * 2,
            y: (handY - 0.5) * 2,
            isDetected: true
          });

          // 2. Gesture Detection (Stable)
          const wrist = landmarks[0];
          const tips = [4, 8, 12, 16, 20].map(i => landmarks[i]);
          
          let totalDist = 0;
          tips.forEach(tip => {
            const dx = tip.x - wrist.x;
            const dy = tip.y - wrist.y;
            const dz = tip.z - wrist.z;
            totalDist += Math.sqrt(dx*dx + dy*dy + dz*dz);
          });
          const avgDist = totalDist / 5;

          // Determine current raw gesture
          const currentGesture = avgDist < 0.25 ? 'CLOSED' : 'OPEN';
          
          // Add to history
          gestureHistory.current.push(currentGesture);
          if (gestureHistory.current.length > HISTORY_LENGTH) {
            gestureHistory.current.shift();
          }

          // Check stability: All frames in history must match
          const allMatch = gestureHistory.current.every(g => g === currentGesture);
          
          if (allMatch && gestureHistory.current.length === HISTORY_LENGTH) {
            onGesture(currentGesture);
          }

        } else {
          onGesture('NONE');
          onHandUpdate({ rotation: 0, x: 0, y: 0, isDetected: false });
          // Reset history on loss of tracking
          gestureHistory.current = [];
        }
      }
      
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupHandLandmarker();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (error) {
    return (
      <div className="absolute bottom-4 right-4 z-50 w-64 p-4 rounded-xl border border-red-500/30 bg-black/80 backdrop-blur-md text-red-200 text-xs font-mono">
        <div className="flex items-center gap-2 mb-2 text-red-400">
          <AlertCircle size={16} />
          <span className="font-bold">SYSTEM ERROR</span>
        </div>
        {error}
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-50 overflow-hidden rounded-xl border border-white/20 bg-black/50 backdrop-blur-sm transition-opacity duration-500"
         style={{ opacity: isLoaded ? 1 : 0, width: '120px', height: '90px' }}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        className="w-full h-full object-cover transform -scale-x-100 opacity-60"
      />
      <div className="absolute top-1 left-2">
         <Camera size={12} className="text-white/50 animate-pulse" />
      </div>
      <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[8px] text-white/50 font-mono">
        <Hand size={8} />
        AI TRACKING
      </div>
    </div>
  );
};