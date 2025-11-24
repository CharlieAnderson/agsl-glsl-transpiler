import { useState, useCallback, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { Preview } from './Preview';
import { parseUniforms, getDefaultValue } from './uniformParser';
import type { UniformDef } from './uniformParser';
import { UniformControls } from './UniformControls';

const DEFAULT_CODE = `
// Try adding: layout(color) uniform half4 uColor;
// Or: uniform float uRadius;

layout(color) uniform half4 uColor;
uniform float uSpeed;

half4 main(float2 coord) {
    float2 uv = coord / iResolution.xy;
    
    // Use uniforms
    float wave = sin(uv.x * 10.0 + iTime * uSpeed);
    
    // Default to red if uColor is black/unset
    half4 col = uColor + half4(wave * 0.2);
    col.a = 1.0;
    
    return col;
}
`;

function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [svgPath, setSvgPath] = useState('M140 20C73 20 20 74 20 140c0 135 136 170 228 303 88-132 229-173 229-303 0-66-54-120-120-120-48 0-90 28-109 69-19-41-60-69-108-69z');
  const [resScale, setResScale] = useState(0.5);
  
  // Feature Flags & View Options
  const [isAdaptiveMode, setIsAdaptiveMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  
  // Auto-GUI State
  const [uniformDefs, setUniformDefs] = useState<UniformDef[]>([]);
  const [uniformValues, setUniformValues] = useState<Record<string, any>>({});

  const onChange = useCallback((val: string) => {
    setCode(val);
  }, []);

  useEffect(() => {
    const defs = parseUniforms(code);
    setUniformDefs(defs);

    setUniformValues(prev => {
      const next = { ...prev };
      defs.forEach(d => {
        if (next[d.name] === undefined) {
          next[d.name] = getDefaultValue(d.type);
        }
      });
      return next;
    });
  }, [code]);

  const handleUniformChange = (name: string, value: any) => {
    setUniformValues(prev => ({ ...prev, [name]: value }));
  };

  const copyKotlin = () => {
    const uniformSetters = uniformDefs.map(def => {
       if (def.type === 'color') {
           return `shader.setColorUniform("${def.name}", /* TODO: Pass color int */)`;
       }
       return `shader.setFloatUniform("${def.name}", /* value */)`;
    }).join('\n');

    const kotlin = `
val shader = RuntimeShader("""
${code}
""".trimIndent())

shader.setFloatUniform("iResolution", canvas.width.toFloat(), canvas.height.toFloat())
shader.setFloatUniform("iTime", time)
${uniformSetters}
    `;
    navigator.clipboard.writeText(kotlin);
    alert("Kotlin boilerplate copied to clipboard!");
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #444' }}>
        <div style={{ 
            padding: '12px', background: '#1a1a1a', borderBottom: '1px solid #444', 
            fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
        }}>
          <span>AGSL Input</span>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* Grid Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.8rem', color: showGrid ? '#4CAF50' : '#aaa' }}>
              <input 
                type="checkbox" 
                checked={showGrid} 
                onChange={(e) => setShowGrid(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Grid
            </label>

            {/* Adaptive Mode Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.8rem', color: isAdaptiveMode ? '#4CAF50' : '#aaa' }}>
              <input 
                type="checkbox" 
                checked={isAdaptiveMode} 
                onChange={(e) => setIsAdaptiveMode(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Adaptive Mode
            </label>

            <button 
                onClick={copyKotlin}
                style={{ 
                    background: '#4CAF50', color: 'white', border: 'none', 
                    padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' 
                }}
            >
                Copy Kotlin
            </button>
          </div>
        </div>
        <CodeMirror
          value={code}
          height="100%"
          theme="dark"
          extensions={[cpp()]}
          onChange={onChange}
          style={{ fontSize: '14px', flex: 1, overflow: 'auto' }}
        />
        
        <UniformControls uniforms={uniformDefs} values={uniformValues} onChange={handleUniformChange} />
        
        <div style={{ padding: '10px', background: '#222', borderTop: '1px solid #444' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '5px' }}>
            Simulate path clipping (SVG Path Data 'd'):
          </label>
          <input 
            type="text" 
            value={svgPath}
            onChange={(e) => setSvgPath(e.target.value)}
            style={{ 
              width: '100%', padding: '8px', background: '#333', border: '1px solid #555', 
              color: 'white', borderRadius: '4px', fontFamily: 'monospace', marginBottom: '10px'
            }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <label style={{ fontSize: '0.8rem', color: '#aaa' }}>
                Resolution Scale: {Math.round(resScale * 100)}%
             </label>
             <input 
                type="range" 
                min="0.1" max="1.0" step="0.1"
                value={resScale}
                onChange={(e) => setResScale(parseFloat(e.target.value))}
                style={{ width: '60%' }}
             />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
         <div style={{ padding: '12px', background: '#1a1a1a', borderBottom: '1px solid #444', fontWeight: 'bold', fontSize: '0.9rem' }}>
          WebGL Preview (Simulating Android Coords)
        </div>
        <Preview 
            agslCode={code} 
            svgPath={svgPath} 
            resolutionScale={resScale} 
            customUniforms={uniformValues}
            isAdaptiveMode={isAdaptiveMode}
            showGrid={showGrid}
        />
      </div>
      
    </div>
  );
}

export default App;