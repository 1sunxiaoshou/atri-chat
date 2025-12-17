import React from 'react';

interface VRMViewerProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  subtitle: string;
}

const VRMViewer: React.FC<VRMViewerProps> = ({ canvasRef, subtitle }) => {
  return (
    <div className="absolute inset-0 z-0 bg-gray-900 flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* Subtitle Overlay */}
      {subtitle && (
        <div className="absolute bottom-20 left-0 right-0 p-4 text-center z-10 pointer-events-none">
          <div className="inline-block bg-black/60 text-white px-6 py-3 rounded-xl text-lg backdrop-blur-sm max-w-[80%]">
            {subtitle}
          </div>
        </div>
      )}
    </div>
  );
};

export default VRMViewer;
