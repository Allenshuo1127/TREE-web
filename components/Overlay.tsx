import React, { useState, useRef, useEffect } from 'react';
import { TreeMorphState } from '../types';
import { Sparkles, Maximize2, Hand, Volume2, VolumeX } from 'lucide-react';

interface OverlayProps {
  currentState: TreeMorphState;
  onToggle: () => void;
}

export const Overlay: React.FC<OverlayProps> = ({ currentState, onToggle }) => {
  const isTree = currentState === TreeMorphState.TREE_SHAPE;
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Attempt autoplay on mount (often blocked, but good to try)
  useEffect(() => {
    const playAudio = async () => {
      try {
        if (audioRef.current) {
          await audioRef.current.play();
        }
      } catch (err) {
        // Autoplay blocked - waiting for user interaction
      }
    };
    playAudio();
    
    // Fallback: Enable audio on first click anywhere
    const enableAudio = () => {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', enableAudio, { once: true });
    return () => window.removeEventListener('click', enableAudio);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-10">
      <audio 
        ref={audioRef} 
        src="https://actions.google.com/sounds/v1/holidays/deck_the_halls.ogg" 
        loop 
      />

      {/* Header */}
      <div className="flex flex-col items-start pointer-events-auto animate-fade-in-down">
        <h1 className="text-4xl md:text-6xl text-white font-serif tracking-tighter drop-shadow-lg">
          MERRY <span className="text-[#D4AF37]">CHRISTMAS</span>
        </h1>
        <p className="text-emerald-100/60 mt-2 font-light tracking-widest text-sm uppercase">
          Est. December 25, 336 AD
        </p>
      </div>

      {/* Center Controls */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-4">
        
        {/* Hand Control Hint */}
        <div className="flex items-center gap-2 text-white/40 text-xs font-mono bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
          <Hand size={12} />
          <span>HAND CONTROL ACTIVE</span>
        </div>

        <button
          onClick={onToggle}
          className={`
            group relative flex items-center justify-center gap-3 px-8 py-4 
            backdrop-blur-md border border-white/20 rounded-full 
            transition-all duration-500 ease-out
            hover:border-[#D4AF37]/80 hover:bg-white/5
            ${isTree ? 'bg-emerald-900/30' : 'bg-black/30'}
          `}
        >
          {/* Animated Glow behind button */}
          <div className="absolute inset-0 rounded-full bg-[#D4AF37] opacity-0 blur-xl group-hover:opacity-20 transition-opacity duration-500" />
          
          <span className={`text-[#D4AF37] transition-transform duration-500 ${isTree ? 'rotate-180' : ''}`}>
             {isTree ? <Maximize2 size={20} /> : <Sparkles size={20} />}
          </span>
          
          <span className="text-white font-serif text-lg tracking-widest">
            {isTree ? 'DISPERSE' : 'ASSEMBLE'}
          </span>
        </button>
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-end w-full">
        {/* Audio Controls (Bottom Left) */}
        <div className="pointer-events-auto flex items-center gap-3 bg-black/30 backdrop-blur-md p-2 rounded-lg border border-white/10">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="text-white/70 hover:text-[#D4AF37] transition-colors"
          >
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (parseFloat(e.target.value) > 0) setIsMuted(false);
            }}
            className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
          />
        </div>

        {/* System Info (Bottom Right) */}
        <div className="text-right text-white/30 text-xs font-mono">
          <div>
            COORD: {isTree ? 'CONE_SPIRAL_V2' : 'SPHERICAL_CHAOS'}
          </div>
          <div>
            INTERACTIVE EXPERIENCE<br/>
            RENDER: WEBGL 2.0
          </div>
        </div>
      </div>
    </div>
  );
};