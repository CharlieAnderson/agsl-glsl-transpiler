export const AGSL_POLYFILLS = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform sampler2D uShapeMask;

#define half float
#define half2 vec2
#define half3 vec3
#define half4 vec4
#define float2 vec2
#define float3 vec3
#define float4 vec4
#define sk_FragCoord gl_FragCoord

// ALIASES: Map common resolution names to the built-in iResolution
#define resolution iResolution
#define uResolution iResolution

#define saturate(x) clamp(x, 0.0, 1.0)

vec3 toLinearSrgb(vec3 color) { return pow(color, vec3(2.2)); }
vec3 fromLinearSrgb(vec3 color) { return pow(color, vec3(1.0/2.2)); }
`;

// Return object instead of string to include metadata
export const transpileAGSL = (source: string): { glsl: string; lineOffset: number } => {
  let glsl = source;

  if (/layout\s*\(\s*color\s*\)\s*/.test(source)) console.warn("AGSL Transpiler: Stripped 'layout(color)'.");
  if (/#define\s+/.test(source)) console.warn("AGSL Warning: '#define' is not supported in AGSL.");
  if (/for\s*\(.*;\s*[a-zA-Z0-9_]+\s*[<>=]+\s*[a-zA-Z_]/.test(source)) console.warn("AGSL Warning: Dynamic loops may fail in WebGL.");

  glsl = glsl.replace(/uniform\s+(?:vec2|float2)\s+(?:resolution|uResolution)\s*;/g, '// resolution removed');
  glsl = glsl.replace(/uniform\s+(?:vec2|float2)\s+iResolution\s*;/g, '// iResolution removed');
  glsl = glsl.replace(/uniform\s+float\s+iTime\s*;/g, '// iTime removed');
  glsl = glsl.replace(/uniform\s+(?:vec2|float2|vec4|float4)\s+iMouse\s*;/g, '// iMouse removed');
  glsl = glsl.replace(/uniform\s+sampler2D\s+uShapeMask\s*;/g, '// uShapeMask removed');

  const imageUniforms: string[] = [];
  const imageDeclRegex = /uniform\s+(?:shader|sampler2D)\s+([a-zA-Z0-9_]+)\s*;/g;
  
  glsl = glsl.replace(imageDeclRegex, (_match, name) => {
      if (name === 'uShapeMask') return '// built-in mask';
      imageUniforms.push(name);
      return `// moved ${name}`;
  });

  const imageUniformDecls = imageUniforms.map(name => `uniform sampler2D ${name};`).join('\n');

  const evalHelpers = imageUniforms.map(name => `
    vec4 ${name}_eval(vec2 p) {
        return texture2D(${name}, p / iResolution.xy);
    }
  `).join('\n');

  glsl = glsl.replace(/(\w+)\.eval\s*\(/g, '$1_eval(');
  glsl = glsl.replace(/layout\s*\(\s*color\s*\)\s*/g, '');
  glsl = glsl.replace(
    /for\s*\(\s*float\s+([a-zA-Z0-9_]+)\s*=\s*([0-9]+)\.0\s*;\s*\1\s*<\s*([0-9]+)\.0\s*;\s*\1\s*\+\+\s*\)/g,
    'for (int $1 = $2; $1 < $3; $1++)'
  );

  glsl = glsl.replace(
      /(half4|vec4|float4)\s+main\s*\(\s*(?:in\s+)?(float2|vec2)\s+([a-zA-Z0-9_]+)\s*\)/,
      'vec4 userMain(vec2 $3)'
  );

  const usesMaskManual = source.includes('uShapeMask');

  const driver = `
    void main() {
      vec2 androidCoords = gl_FragCoord.xy;
      androidCoords.y = iResolution.y - gl_FragCoord.y;
      
      vec2 uv = androidCoords / iResolution.xy;
      
      float maskAlpha = texture2D(uShapeMask, uv).r; 

      if (!${usesMaskManual} && maskAlpha < 0.1) {
        discard;
      }
      
      gl_FragColor = userMain(androidCoords);
      
      if (!${usesMaskManual}) {
         gl_FragColor.a *= maskAlpha; 
      }
    }
  `;

  // Construct Preamble
  // Note: The first line of the file is line 1.
  // If we have N lines of preamble, the user's first line is at index N+1.
  // We calculate the number of newlines to determine the offset.
  const preamble = `${AGSL_POLYFILLS}\n${imageUniformDecls}\n${evalHelpers}\n`;
  
  // Split by newline to count rows. 
  // Subtract 1 because splitting a string with 1 newline gives 2 array elements.
  // The offset should bring the reported line number (e.g. 50) down to the user's line (e.g. 1).
  const lineOffset = preamble.split('\n').length - 1;

  return {
    glsl: `${preamble}${glsl}\n${driver}`,
    lineOffset
  };
};