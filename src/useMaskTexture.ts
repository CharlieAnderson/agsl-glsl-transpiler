import { useMemo } from 'react';

export const useMaskTexture = (pathData: string, width: number, height: number): HTMLCanvasElement => {
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
      ctx.fillStyle = 'white';
      ctx.fill(path);
    } catch (e) {
      console.error("Invalid SVG Path", e);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    return canvas;
  }, [pathData, width, height]);
};