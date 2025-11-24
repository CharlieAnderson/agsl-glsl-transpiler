import React, { useEffect, useRef, useState } from 'react';
import * as twgl from 'twgl.js';
import { transpileAGSL } from './transpiler';
import { useMaskTexture } from './useMaskTexture';

const vs = `
  attribute vec4 position;
  void main() { gl_Position = position; }
`;

interface PreviewProps {
  agslCode: string;
  svgPath: string;
  resolutionScale?: number;
  customUniforms?: Record<string, any>;
  isAdaptiveMode?: boolean;
  showGrid?: boolean;
}

export const Preview: React.FC<PreviewProps> = ({ 
  agslCode, 
  svgPath, 
  resolutionScale = 1.0, 
  customUniforms = {}, 
  isAdaptiveMode = false,
  showGrid = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const [error, setError] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 1, h: 1 });

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const maskCanvas = useMaskTexture(svgPath, dims.w * resolutionScale, dims.h * resolutionScale, isAdaptiveMode);
  const maskTextureRef = useRef<WebGLTexture | null>(null);
  
  const dynamicTextureCache = useRef<Record<string, { src: string; tex: WebGLTexture }>>({});

  const GRID_CSS_SIZE = 50; 
  const gridShaderSize = Math.round(GRID_CSS_SIZE * resolutionScale); 
  const bufferW = Math.floor(dims.w * resolutionScale);
  const bufferH = Math.floor(dims.h * resolutionScale);

  // Adaptive Guide Calculations
  const minDim = Math.min(dims.w, dims.h);
  // 108dp is the standard viewport.
  // 72dp is the Safe Zone (Layer bounds) -> 72/108 = 0.6666
  // 66dp is the Mask (Safe content) -> 66/108 = 0.6111
  const size72 = minDim * (72 / 108);
  const size66 = minDim * (66 / 108);

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const gl = canvasRef.current?.getContext('webgl');
    if (!gl) return;

    const newTexture = twgl.createTexture(gl, {
      src: maskCanvas,
      wrap: gl.CLAMP_TO_EDGE, 
      min: gl.LINEAR,
      mag: gl.LINEAR, 
      premultiplyAlpha: true,
    });

    const oldTex = maskTextureRef.current;
    maskTextureRef.current = newTexture;

    return () => {
      if (oldTex) gl.deleteTexture(oldTex);
    };
  }, [maskCanvas]); 

  useEffect(() => {
    const gl = canvasRef.current?.getContext('webgl');
    if (!gl) return;

    if (!maskTextureRef.current) {
        maskTextureRef.current = twgl.createTexture(gl, {
            src: [255, 255, 255, 255], 
            format: gl.RGBA,
            min: gl.NEAREST,
            mag: gl.NEAREST,
            width: 1,
            height: 1,
        });
    }

    const { glsl: glslFragment, lineOffset } = transpileAGSL(agslCode);

    const programInfo = twgl.createProgramInfo(gl, [vs, glslFragment], (err) => {
        const correctedError = err.replace(/ERROR:\s+\d+:(\d+):/g, (match, lineStr) => {
            const line = parseInt(lineStr, 10);
            const userLine = line - lineOffset;
            return `ERROR: Line ${userLine}:`;
        });
        setError(correctedError); 
    });

    if (!programInfo) return; 
    setError(null);

    const bufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: [-1, -1, 0, 1, -1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1, 1, 0],
    });

    const render = (time: number) => {
      twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement, resolutionScale);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      const activeTextures: Record<string, WebGLTexture> = {};
      
      Object.entries(customUniforms).forEach(([name, value]) => {
          if (typeof value === 'string' && value.startsWith('data:image')) {
             const cached = dynamicTextureCache.current[name];
             if (cached && cached.src === value) {
                 activeTextures[name] = cached.tex;
             } else {
                 if (cached) gl.deleteTexture(cached.tex);
                 const tex = twgl.createTexture(gl, {
                     src: value,
                     wrap: gl.CLAMP_TO_EDGE,
                     min: gl.LINEAR,
                     mag: gl.LINEAR,
                 });
                 dynamicTextureCache.current[name] = { src: value, tex };
                 activeTextures[name] = tex;
             }
          }
      });

      const uniforms = {
        iTime: time * 0.001,
        iResolution: [gl.canvas.width, gl.canvas.height],
        uShapeMask: maskTextureRef.current!,
        ...customUniforms,
        ...activeTextures,
      };

      gl.useProgram(programInfo.program);
      twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
      twgl.setUniforms(programInfo, uniforms);
      twgl.drawBufferInfo(gl, bufferInfo);

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [agslCode, maskCanvas, resolutionScale, customUniforms]); 

  const getLocalCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);
    const clampedX = Math.max(0, Math.min(x, Math.floor(rect.width)));
    const clampedY = Math.max(0, Math.min(y, Math.floor(rect.height)));
    return { x: clampedX, y: clampedY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const coords = getLocalCoords(e);
    setDragStart(coords);
  };

  const handleMouseUp = () => {
    setDragStart(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const coords = getLocalCoords(e);
    setMousePos(coords);
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    setDragStart(null);
  };

  let selectionRect = null;
  if (dragStart && mousePos) {
      const x = Math.min(dragStart.x, mousePos.x);
      const y = Math.min(dragStart.y, mousePos.y);
      const w = Math.abs(mousePos.x - dragStart.x);
      const h = Math.abs(mousePos.y - dragStart.y);
      selectionRect = { x, y, w, h };
  }

  return (
    <div 
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor: 'crosshair' }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
        {error && (
            <div style={{ 
                position: 'absolute', top: 0, left: 0, right: 0, 
                background: 'rgba(255, 0, 0, 0.8)', color: 'white', 
                padding: '10px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px',
                zIndex: 20 
            }}>
                {error}
            </div>
        )}

        {selectionRect && (
            <div style={{
                position: 'absolute',
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.w,
                height: selectionRect.h,
                border: '1px solid rgba(255, 255, 255, 0.9)',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                zIndex: 10,
                pointerEvents: 'none'
            }} />
        )}

        {/* Adaptive Icon Guides */}
        {isAdaptiveMode && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 6 }}>
                {/* 72dp Safe Zone */}
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: size72, height: size72,
                    border: '2px solid rgba(255, 235, 59, 0.8)', 
                    boxSizing: 'border-box',
                }} />
                {/* 66dp Mask */}
                <div style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: size66, height: size66,
                    borderRadius: '50%',
                    border: '2px solid rgba(244, 67, 54, 0.8)',
                    boxSizing: 'border-box',
                }} />
                {/* Center Crosshair */}
                <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: 10, height: 10, transform: 'translate(-50%, -50%)',
                    borderLeft: '1px solid rgba(255,255,255,0.5)', borderTop: '1px solid rgba(255,255,255,0.5)'
                }} />
            </div>
        )}

        {showGrid && (
            <>
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    pointerEvents: 'none', zIndex: 5,
                    backgroundImage: `
                        linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)
                    `,
                    backgroundSize: `${GRID_CSS_SIZE}px ${GRID_CSS_SIZE}px`
                }} />
                
                <div style={{
                    position: 'absolute', top: 38, right: 10, zIndex: 15,
                    color: '#aaa', fontSize: '10px', fontFamily: 'monospace', textAlign: 'right',
                    background: 'rgba(0,0,0,0.8)', padding: '6px', borderRadius: '4px',
                    pointerEvents: 'none', lineHeight: '1.4'
                }}>
                    Grid: {GRID_CSS_SIZE}px (Screen)<br/>
                    ≈ {gridShaderSize}px (Buffer)<br/>
                    <div style={{ borderTop: '1px solid #555', marginTop: '4px', paddingTop: '4px', color: '#888' }}>
                        Canvas: {bufferW}x{bufferH}
                    </div>
                </div>
            </>
        )}

        {mousePos && (
            <div style={{
                position: 'absolute', 
                top: mousePos.y + 15, 
                left: mousePos.x + 15, 
                zIndex: 15,
                background: 'rgba(0, 0, 0, 0.9)', color: '#0f0',
                padding: '6px', borderRadius: '4px',
                fontSize: '11px', fontFamily: 'monospace',
                pointerEvents: 'none', userSelect: 'none',
                whiteSpace: 'nowrap',
                border: selectionRect ? '1px solid #fff' : 'none',
                textAlign: 'left',
                lineHeight: '1.4'
            }}>
                <div style={{ color: '#fff' }}>Pos: {mousePos.x}, {mousePos.y}</div>
                {selectionRect && (
                    <>
                        <div style={{ marginTop: '4px', borderTop: '1px solid #555', paddingTop: '2px' }}>
                            Screen: {selectionRect.w} x {selectionRect.h}
                        </div>
                        <div style={{ color: '#aaa' }}>
                            Buffer: {Math.round(selectionRect.w * resolutionScale)} x {Math.round(selectionRect.h * resolutionScale)}
                        </div>
                    </>
                )}
            </div>
        )}

        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }} />
    </div>
  );
};