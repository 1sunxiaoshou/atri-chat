import React from 'react';
import { cn } from '../../utils/cn';

interface VRMViewerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  subtitle: string;
}

const VRMViewer: React.FC<VRMViewerProps> = ({ canvasRef, subtitle }) => {
  return (
    <div className="absolute inset-0 z-0 bg-slate-950 flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Subtitle Overlay */}
      <div className={cn(
        "absolute bottom-28 left-0 right-0 p-4 text-center z-10 pointer-events-none transition-all duration-500",
        subtitle ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        {subtitle && (
          <div className="inline-block bg-black/60 text-white px-8 py-4 rounded-2xl text-lg md:text-xl font-medium backdrop-blur-md shadow-2xl border border-white/10 max-w-[85%] leading-relaxed animate-in fade-in zoom-in-95 duration-300">
            {subtitle}
          </div>
        )}
      </div>

      {/* Ambient Gradient for depth */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 via-transparent to-black/10" />
    </div>
  );
};

export default VRMViewer;
