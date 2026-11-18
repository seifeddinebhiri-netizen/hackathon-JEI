import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Retouche de l'image par logiciel (WebGL) : marche sur tous les téléphones, même quand la
 * caméra n'expose aucun réglage matériel. La caméra est dessinée dans un canvas avec un petit
 * programme (shader) ; l'aperçu ET la vidéo enregistrée sont ceux du canvas.
 * Les calculs se font dans l'espace de couleur de l'image (sRGB), sans passer par le linéaire :
 * c'est simple et suffisant pour dépanner une prise, pas un étalonnage de cinéma.
 */
export type Adjust = {
  exposure: number;
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
};

export const NEUTRAL: Adjust = { exposure: 0, brightness: 0, contrast: 1, saturation: 1, temperature: 0 };

export const ADJUST_FIELDS: { key: keyof Adjust; label: string; min: number; max: number; step: number }[] = [
  { key: 'exposure', label: 'Exposition (IL)', min: -2, max: 2, step: 0.1 },
  { key: 'brightness', label: 'Luminosité', min: -0.3, max: 0.3, step: 0.01 },
  { key: 'contrast', label: 'Contraste', min: 0.5, max: 1.5, step: 0.01 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 2, step: 0.05 },
  { key: 'temperature', label: 'Chaleur', min: -1, max: 1, step: 0.05 },
];

export const isNeutral = (a: Adjust): boolean =>
  (Object.keys(NEUTRAL) as (keyof Adjust)[]).every((k) => a[k] === NEUTRAL[k]);

/**
 * Applique à des pixels RGBA (0..255) la MÊME formule que le programme WebGL ci-dessous. Sert à
 * mesurer l'image telle qu'elle est retouchée : quand l'utilisateur règle le contraste, la mesure
 * suit et la consigne disparaît. Modifie `data` sur place.
 */
export function applyAdjustRgba(data: Uint8ClampedArray, a: Adjust): void {
  const gain = 2 ** a.exposure;
  const warm = 1 + a.temperature * 0.15;
  const cool = 1 - a.temperature * 0.15;
  for (let i = 0; i < data.length; i += 4) {
    let r = (data[i] / 255) * gain + a.brightness;
    let g = (data[i + 1] / 255) * gain + a.brightness;
    let b = (data[i + 2] / 255) * gain + a.brightness;
    r = (r - 0.5) * a.contrast + 0.5;
    g = (g - 0.5) * a.contrast + 0.5;
    b = (b - 0.5) * a.contrast + 0.5;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = (l + (r - l) * a.saturation) * warm;
    g = l + (g - l) * a.saturation;
    b = (l + (b - l) * a.saturation) * cool;
    data[i] = Math.min(1, Math.max(0, r)) * 255;
    data[i + 1] = Math.min(1, Math.max(0, g)) * 255;
    data[i + 2] = Math.min(1, Math.max(0, b)) * 255;
  }
}

const VERTEX = `
attribute vec2 p;
varying vec2 v;
void main() {
  v = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAGMENT = `
precision mediump float;
varying vec2 v;
uniform sampler2D tex;
uniform float exposure;
uniform float brightness;
uniform float contrast;
uniform float saturation;
uniform float temperature;
void main() {
  vec3 c = texture2D(tex, v).rgb;
  c *= exp2(exposure);
  c += brightness;
  c = (c - 0.5) * contrast + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c.r *= 1.0 + temperature * 0.15;
  c.b *= 1.0 - temperature * 0.15;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export type Pipeline = { stop: () => void; captureStream: (fps: number) => MediaStream };

export function isWebGLAvailable(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl') !== null;
  } catch {
    return false;
  }
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  return shader;
}

/** Dessine `video` dans `canvas` avec les réglages renvoyés par `getAdjust`. Retourne null si WebGL échoue. */
export function createFilterPipeline(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  getAdjust: () => Adjust,
): Pipeline | null {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
  if (!gl) return null;
  let program: WebGLProgram;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  } catch {
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uniforms = (Object.keys(NEUTRAL) as (keyof Adjust)[]).map(
    (k) => [k, gl.getUniformLocation(program, k)] as const,
  );

  let stopped = false;
  let handle = 0;
  const useFrameCallback = 'requestVideoFrameCallback' in video;
  const schedule = () => {
    handle = useFrameCallback ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
  };
  function draw() {
    if (stopped) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      // Le canvas garde la résolution native de la caméra : pas de perte de définition.
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        gl!.viewport(0, 0, canvas.width, canvas.height);
      }
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, video);
      const a = getAdjust();
      for (const [k, loc] of uniforms) gl!.uniform1f(loc, a[k]);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    }
    schedule();
  }
  schedule();

  return {
    captureStream: (fps) => canvas.captureStream(fps),
    stop: () => {
      stopped = true;
      if (useFrameCallback) video.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

/**
 * Branche la retouche sur la caméra quand `enabled`. `canvasRef` doit être posé sur un <canvas>
 * affiché à la place de la vidéo ; `getStream()` donne le flux retouché à enregistrer.
 */
export function useImagePipeline(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  adjust: Adjust,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const adjustRef = useRef(adjust);
  const pipelineRef = useRef<Pipeline | null>(null);

  useEffect(() => {
    adjustRef.current = adjust;
  }, [adjust]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!enabled || !video || !canvas) return;
    const pipeline = createFilterPipeline(video, canvas, () => adjustRef.current);
    pipelineRef.current = pipeline;
    return () => {
      pipeline?.stop();
      pipelineRef.current = null;
    };
  }, [enabled, videoRef]);

  const getStream = useCallback(() => pipelineRef.current?.captureStream(30) ?? null, []);
  return { canvasRef, getStream };
}
