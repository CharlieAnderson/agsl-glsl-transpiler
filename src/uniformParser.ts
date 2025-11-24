export type UniformType = 'float' | 'int' | 'vec2' | 'vec3' | 'color' | 'bool' | 'image';

export interface UniformDef {
  name: string;
  type: UniformType;
}

export const parseUniforms = (source: string): UniformDef[] => {
  const definitions: UniformDef[] = [];
  const seenNames = new Set<string>(); 
  const lines = source.split('\n');

  const IGNORED_UNIFORMS = new Set([
      'iResolution', 'iTime', 'uShapeMask', 
      'resolution', 'uResolution'
  ]);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) continue;

    const isLayoutColor = /layout\s*\(\s*color\s*\)/.test(trimmed);

    const match = trimmed.match(/uniform\s+(float|half|int|bool|vec2|half2|vec3|half3|vec4|half4|shader|sampler2D)\s+([a-zA-Z0-9_]+)\s*;/);

    if (match) {
      const [, rawType, name] = match;
      
      if (IGNORED_UNIFORMS.has(name) || seenNames.has(name)) continue;

      let type: UniformType = 'float';

      if (['shader', 'sampler2D'].includes(rawType)) {
        type = 'image';
      } else if (isLayoutColor) {
        type = 'color';
      } else if (['bool'].includes(rawType)) {
        type = 'bool';
      } else if (['int'].includes(rawType)) { // FIX: Detect int explicitly
        type = 'int';
      } else if (['vec2', 'half2'].includes(rawType)) {
        type = 'vec2';
      } else if (['vec3', 'half3'].includes(rawType)) {
        type = 'vec3';
      } else if (['vec4', 'half4'].includes(rawType)) {
        type = 'color'; 
      }

      seenNames.add(name);
      definitions.push({ name, type });
    }
  }
  return definitions;
};

export const getDefaultValue = (type: UniformType) => {
  switch (type) {
    case 'float': return 0.5;
    case 'int': return 1; // Integer default
    case 'vec2': return [0.5, 0.5];
    case 'vec3': return [1.0, 1.0, 1.0];
    case 'color': return [1.0, 0.0, 0.0, 1.0]; 
    case 'bool': return false;
    case 'image': return null; 
  }
};