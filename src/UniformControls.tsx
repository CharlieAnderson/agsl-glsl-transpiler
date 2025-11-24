import React from 'react';
import type { UniformDef, UniformType } from './uniformParser';

interface Props {
  uniforms: UniformDef[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
}

export const UniformControls: React.FC<Props> = ({ uniforms, values, onChange }) => {
  if (uniforms.length === 0) return null;

  return (
    <div style={{ padding: '10px', background: '#222', borderTop: '1px solid #444' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>
        Detected Uniforms
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {uniforms.map((u) => (
          <ControlRow key={u.name} def={u} value={values[u.name]} onChange={onChange} />
        ))}
      </div>
    </div>
  );
};

const ControlRow = ({ def, value, onChange }: { def: UniformDef; value: any; onChange: (n: string, v: any) => void }) => {
  if (value === undefined && def.type !== 'image') return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
      <span style={{ color: '#aaa', marginRight: '10px', fontFamily: 'monospace' }}>{def.name}</span>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <InputForType type={def.type} value={value} onChange={(v) => onChange(def.name, v)} />
      </div>
    </div>
  );
};

const InputForType = ({ type, value, onChange }: { type: UniformType; value: any; onChange: (v: any) => void }) => {
  if (type === 'image') {
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          onChange(evt.target?.result);
        };
        reader.readAsDataURL(file);
      }
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
        <input 
          type="file" 
          accept="image/*"
          onChange={handleFile}
          style={{ color: '#aaa', fontSize: '0.7rem' }}
        />
        {value && (
          <img 
            src={value} 
            alt="preview" 
            style={{ width: '20px', height: '20px', objectFit: 'cover', marginLeft: '5px', borderRadius: '2px' }} 
          />
        )}
      </div>
    );
  }

  if (type === 'float') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <input
          type="range" min="0" max="2" step="0.01"
          value={value || 0.5}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ flex: 1, marginRight: '5px' }}
        />
        <span style={{ width: '30px', textAlign: 'right' }}>{Number(value).toFixed(2)}</span>
      </div>
    );
  }

  if (type === 'int') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <input
          type="range" min="0" max="10" step="1"
          value={value || 0}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          style={{ flex: 1, marginRight: '5px' }}
        />
        <span style={{ width: '30px', textAlign: 'right' }}>{value}</span>
      </div>
    );
  }

  if (type === 'color') {
    const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, '0');
    const safeVal = value || [1, 0, 0, 1];
    const hex = `#${toHex(safeVal[0])}${toHex(safeVal[1])}${toHex(safeVal[2])}`;
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const h = e.target.value;
      const r = parseInt(h.substr(1, 2), 16) / 255;
      const g = parseInt(h.substr(3, 2), 16) / 255;
      const b = parseInt(h.substr(5, 2), 16) / 255;
      onChange([r, g, b, 1.0]);
    };

    return <input type="color" value={hex} onChange={handleChange} />;
  }

  if (type === 'bool') {
    return <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />;
  }

  if (type === 'vec2') {
    const v = value || [0.5, 0.5];
    return (
      <div style={{ display: 'flex', gap: '2px' }}>
        <input type="number" step="0.1" value={v[0]} onChange={(e) => onChange([parseFloat(e.target.value), v[1]])} style={{ width: '40px' }} />
        <input type="number" step="0.1" value={v[1]} onChange={(e) => onChange([v[0], parseFloat(e.target.value)])} style={{ width: '40px' }} />
      </div>
    );
  }
  
  // FIX: Implement vec3 inputs
  if (type === 'vec3') {
    const v = value || [1.0, 1.0, 1.0];
    return (
      <div style={{ display: 'flex', gap: '2px' }}>
        <input type="number" step="0.1" value={v[0]} onChange={(e) => onChange([parseFloat(e.target.value), v[1], v[2]])} style={{ width: '35px' }} />
        <input type="number" step="0.1" value={v[1]} onChange={(e) => onChange([v[0], parseFloat(e.target.value), v[2]])} style={{ width: '35px' }} />
        <input type="number" step="0.1" value={v[2]} onChange={(e) => onChange([v[0], v[1], parseFloat(e.target.value)])} style={{ width: '35px' }} />
      </div>
    );
  }

  return null;
};