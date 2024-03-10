import { DataTexture, TypedArray, WebGLRenderTarget } from "three";
import * as THREE from "three";

function layout(location: number) {
  return `layout(location = ${location}) out vec4 o${location};`;
}

function uniform(location: number) {
  return `uniform sampler2D uT${location};`;
}

function output(location: number) {
  return `o${location} = texture(uT${location}, uv);`;
}

export function useInitMultipleRenderTargets(
  gl: THREE.WebGLRenderer,
  renderTargets: WebGLRenderTarget,
  dataArray: TypedArray[]
) {
  const numTargets = renderTargets.textures.length;
  if (numTargets != dataArray.length) {
    console.error("Number of render targets must match number of data inputs");
  }
  const dataTextures: DataTexture[] = [];

  const layoutsStr: string[] = [];
  const uniformsStr: string[] = [];
  const outputsStr: string[] = [];

  const uniforms: any = {};

  for (let i = 0; i < dataArray.length; i++) {
    const data = dataArray[i];

    if (data.length != renderTargets.width * renderTargets.height * 4)
      console.warn(`Data to render buffer size mismatch`);
    layoutsStr.push(layout(i));
    uniformsStr.push(uniform(i));
    outputsStr.push(output(i));

    const texture = new DataTexture(
      data,
      renderTargets.width,
      renderTargets.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texture.needsUpdate = true;
    dataTextures.push(texture);

    uniforms[`uT${i}`] = { value: texture };
  }
  const frag = /*glsl*/ `
  ${layoutsStr.join("\n")}
  ${uniformsStr.join("\n")}

  void main() {
    vec2 uv = gl_FragCoord.xy / vec2(${renderTargets.width},${
    renderTargets.height
  });
    ${outputsStr.join("\n")}
  }
  `;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.ShaderMaterial({
      toneMapped: false,
      uniforms: uniforms,
      glslVersion: "300 es",
      fragmentShader: frag,
    })
  );
  mesh.position.set(0, 0, -10);

  const camera = new THREE.OrthographicCamera();
  const scene = new THREE.Scene();
  scene.add(mesh);

  gl.setRenderTarget(renderTargets);
  gl.render(scene, camera);
  gl.setRenderTarget(null);
}
