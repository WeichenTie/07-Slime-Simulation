import { useTres } from "@tresjs/core";
import * as THREE from "three";
import { onUnmounted, watchSyncEffect } from "vue";
type FBOSettings = {
  /** Defines the count of MSAA samples. Can only be used with WebGL 2. Default: 0 */
  samples?: number;
  /** If set, the scene depth will be rendered into buffer.depthTexture. Default: false */
  depth?: boolean;
} & THREE.RenderTargetOptions;
export function useMultipleRenderTargets(
  width: number,
  height: number,
  numTargets?: number,
  settings?: FBOSettings
) {
  const { renderer, sizes } = useTres();
  const dpr = renderer.value.getPixelRatio();
  width = typeof width === "number" ? width : sizes.width.value * dpr;
  height = typeof height === "number" ? height : sizes.height.value * dpr;
  settings =
    (typeof width === "number" ? settings : (width as FBOSettings)) || {};

  const { samples = 0, depth } = settings;

  let target = new THREE.WebGLRenderTarget(width, height, {
    count: numTargets,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: THREE.HalfFloatType,
    ...settings,
  });
  if (depth) {
    target.depthTexture = new THREE.DepthTexture(
      width,
      height,
      THREE.FloatType
    );
  }

  watchSyncEffect(() => {
    target.setSize(width, height);
    if (samples) target.samples = samples;
  });
  onUnmounted(() => target.dispose());

  return target;
}
