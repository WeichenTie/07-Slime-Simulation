import { WebGLRenderer } from "three";
import * as THREE from "three";
export function useCompute(
  gl: THREE.WebGLRenderer,
  program: THREE.Material,
  textureNames: string[],
  height = window.innerHeight,
  width = window.innerWidth
) {
  let source: THREE.WebGLRenderTarget;
  let target: THREE.WebGLRenderTarget;

  let _width = width;
  let _height = height;

  const camera = new THREE.OrthographicCamera();
  camera.translateZ(10);
  camera.lookAt(0, 0, 0);
  const scene = new THREE.Scene();
  const plane = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(plane, program);
  scene.add(mesh);

  function setSource(renderBuffers: THREE.WebGLRenderTarget) {
    source = renderBuffers;
  }
  function setTarget(renderBuffers: THREE.WebGLRenderTarget) {
    target = renderBuffers;
  }
  function execute() {
    let i = 0;
    for (const textureName of textureNames) {
      // @ts-ignore
      program.uniforms[textureName].value = source.textures[i++];
    }

    const viewport = gl.getViewport(new THREE.Vector4());
    gl.setRenderTarget(target);
    gl.setViewport(0, 0, _width, _height);
    gl.render(scene, camera);
    gl.setViewport(viewport);
    gl.setRenderTarget(null);
  }

  function setSize(width: number, height: number) {
    _width = width;
    _height = height;
  }

  return { execute, setSource, setTarget, setSize };
}
