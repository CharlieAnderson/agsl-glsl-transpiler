import { useMemo } from 'react';

export const useMaskTexture = (pathData: string, width: number, height: number, isAdaptive: boolean = false): HTMLCanvasElement => {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width || 1;
    canvas.height = height || 1;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    if (!pathData.trim()) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return canvas;
    }

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      const path = new Path2D(pathData);
      
      ctx.save();
      
      if (isAdaptive) {
        // ADAPTIVE ICON MODE:
        // Android Adaptive Icon layers are 108x108 dp.
        // Standard Path Data is defined on a 100x100 grid.
        // We scale the 100x100 path to fill the 108x108 viewport.
        const STANDARD_VIEWPORT = 108;
        const PATH_GRID_SIZE = 100;
        const pathScale = STANDARD_VIEWPORT / PATH_GRID_SIZE; // 1.08

        const scale = Math.min(canvas.width, canvas.height) / STANDARD_VIEWPORT;
        
        // Center the viewport
        const tx = (canvas.width - STANDARD_VIEWPORT * scale) / 2;
        const ty = (canvas.height - STANDARD_VIEWPORT * scale) / 2;
        
        ctx.translate(tx, ty);
        ctx.scale(scale * pathScale, scale * pathScale); // Apply both Viewport and Path scaling
      } 
      // else: Default mode (draws at 0,0 1:1 pixel mapping)

      ctx.fillStyle = 'white';
      ctx.fill(path);
      
      ctx.restore();
    } catch (e) {
      console.error("Invalid SVG Path", e);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    return canvas;
  }, [pathData, width, height, isAdaptive]);
};