<template>
  <TresOrthographicCamera
    ref="camera"
    :left="-width / 2"
    :right="width / 2"
    :top="height / 2"
    :bottom="-height / 2"
    :position="[0, 0, 10]"
    :look-at="[0, 0, 0]"
  />
</template>

<script setup lang="ts">
import * as THREE from "three";
import { useRenderLoop, useTres } from "@tresjs/core";
import { useMultipleRenderTargets } from "../composables/useMultipleRenderTargets";
import { useInitMultipleRenderTargets } from "../composables/useInitMultipleRenderTargets";
import { useCompute } from "../composables/useCompute";
import { useWindowSize } from "@vueuse/core";
import { shallowRef, watch } from "vue";

const props = defineProps<{
  wanderStrength: number;
  sensorAngle: number;
  sensorOffset: number;
  steerAngle: number;
  diffusionStrength: number;
  speed: number;
}>();

const camera = shallowRef();
const { width, height } = useWindowSize();
const tres = useTres();
const SIZE = 500;
function generatePositionsAndVelocities(size: number) {
  const buffer = new Array(size * size * 4);
  function randomCircle() {
    const theta = Math.random() * 2 * Math.PI;
    return [Math.cos(theta), Math.sin(theta)];
  }
  for (let i = 0; i < size * size * 4; i += 4) {
    const [dirX, dirY] = randomCircle();
    buffer[i] = 0;
    buffer[i + 1] = 0;
    buffer[i + 2] = dirX;
    buffer[i + 3] = dirY;
  }
  return new Float32Array(buffer);
}
function generateColors(size: number) {
  const buffer = new Array(size * size * 4);
  for (let i = 0; i < size * size * 4; i += 4) {
    const random = Math.random();
    buffer[i] = 1; //random <= 0.3333;
    buffer[i + 1] = 1; //random > 0.3333 && random <= 0.66667;
    buffer[i + 2] = 1; //random > 0.66667;
    buffer[i + 3] = 1;
  }
  return new Float32Array(buffer);
}
function generatePointIds(size: number) {
  const buffer = new Array(size * size * 3);
  const w = size;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      buffer[(i * w + j) * 3] = j;
      buffer[(i * w + j) * 3 + 1] = i;
      buffer[(i * w + j) * 3 + 2] = 0;
    }
  }
  return new Float32Array(buffer);
}

const screenQuadCamera = new THREE.OrthographicCamera();
screenQuadCamera.translateZ(10);
screenQuadCamera.lookAt(0, 0, 0);
const screenQuad = new THREE.PlaneGeometry(2, 2);

const renderTargetOptions: THREE.RenderTargetOptions = {
  magFilter: THREE.NearestFilter,
  minFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat,
  type: THREE.FloatType,
  generateMipmaps: false,
};

const AgentsRT_A = useMultipleRenderTargets(SIZE, SIZE, 2, renderTargetOptions);
const AgentsRT_B = useMultipleRenderTargets(SIZE, SIZE, 2, renderTargetOptions);

useInitMultipleRenderTargets(tres.renderer.value, AgentsRT_A, [
  generatePositionsAndVelocities(SIZE),
  generateColors(SIZE),
]);
useInitMultipleRenderTargets(tres.renderer.value, AgentsRT_B, [
  generatePositionsAndVelocities(SIZE),
  generateColors(SIZE),
]);

const pheromoneRT_A = useMultipleRenderTargets(width.value, height.value, 1, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.FloatType,
  generateMipmaps: false,
});
const pheromoneRT_B = useMultipleRenderTargets(width.value, height.value, 1, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.FloatType,
  generateMipmaps: false,
});

const pingPongPheromones = { cur: pheromoneRT_A, next: pheromoneRT_B };

const computeAgentShader = new THREE.ShaderMaterial({
  glslVersion: "300 es",
  precision: "highp",
  uniforms: {
    uTime: { value: 0 },
    uBounds: { value: new THREE.Vector4(-700, 700, 700, -700) },
    uScreenSize: { value: new THREE.Vector2(width.value, height.value) },
    uPositionDirection: { value: AgentsRT_A.textures[0] },
    uColor: { value: AgentsRT_A.textures[1] },
    uPheromones: { value: pingPongPheromones.next.textures[0] },

    uWanderStrength: { value: props.wanderStrength },
    uSensorAngle: { value: (props.sensorAngle * Math.PI) / 180 },
    uSensorOffset: { value: props.sensorOffset },
    uSpeed: { value: props.sensorOffset },
    uSteerAngle: { value: (props.steerAngle * Math.PI) / 180 },
  },
  fragmentShader: `
    #define PI 3.14159265359

    layout(location = 0) out vec4 fPositionDirection;
    layout(location = 1) out vec4 fColor;
    uniform sampler2D uPositionDirection;
    uniform sampler2D uColor;
    uniform sampler2D uPheromones;
    uniform vec4 uBounds; // left right top bottom
    uniform float uTime;
    uniform vec2 uScreenSize;
    
    uniform float uWanderStrength;
    uniform float uSensorAngle;
    uniform float uSensorOffset;
    uniform float uSteerAngle;
    uniform float uSpeed;

    float _modf(float a, float b) {
      return a - b * floor(a / b);
    }
    float random(vec2 st) {
      return fract(sin(dot(st.xy,
        vec2(12.9898,78.233))) *
        43758.5453123);
    }

    void main() {
      ivec2 texelCoord = ivec2(gl_FragCoord.xy);
      vec4 positionDirection = texelFetch(uPositionDirection, texelCoord, 0);
      vec2 position = positionDirection.xy;
      vec2 direction = normalize(positionDirection.zw);
      
      float theta = atan(direction.y, direction.x);
      
      // Random walk
      vec4 color = texelFetch(uColor, texelCoord, 0);
      float wander = random(vec2(direction.x,uTime - position.y)) * 2.0 - 1.0;

      // Sense pheromones
      vec2 sensorLeftPosition = position + uScreenSize/2.0 + uSensorOffset*vec2(cos(theta + uSensorAngle), sin(theta + uSensorAngle));
      vec2 sensorMiddlePosition = position + uScreenSize/2.0 + uSensorOffset*vec2(cos(theta), sin(theta));
      vec2 sensorRightPosition = position + uScreenSize/2.0 + uSensorOffset*vec2(cos(theta - uSensorAngle), sin(theta - uSensorAngle));


      vec4 leftSample = texture(uPheromones, (sensorLeftPosition) / uScreenSize);
      vec4 middleSample = texture(uPheromones, (sensorMiddlePosition) / uScreenSize);
      vec4 rightSample = texture(uPheromones, (sensorRightPosition) / uScreenSize);
      
      float steer = 0.0; 
      if (length(leftSample) > length(middleSample) && length(leftSample) > length(rightSample)) {
        steer = uSteerAngle;
      }
      if (length(rightSample) > length(middleSample) && length(rightSample) > length(leftSample)) {
        steer = -uSteerAngle;
      }

      theta += uWanderStrength * wander;
      theta += steer;

      float speed = max(uSpeed, 0.001);
      vec2 velocity = vec2(speed * cos(theta), speed *sin(theta));

      // add velocity to position
      position += velocity;

      if (position.x < uBounds.x) {
        position.x = uBounds.x;
        velocity.x *= -1.0;
      } else if (position.x >= uBounds.y) {
        position.x = uBounds.y;
        velocity.x *= -1.0;
      }
      if (position.y >= uBounds.z) {
        position.y = uBounds.z;
        velocity.y *= -1.0;
      } else if (position.y < uBounds.w) {
        position.y = uBounds.w;
        velocity.y *= -1.0;
      }

      fPositionDirection = vec4(position, normalize(velocity));
      fColor = color;
    }
  `,
});
const { execute, setSource, setTarget } = useCompute(
  tres.renderer.value,
  computeAgentShader,
  ["uPositionDirection", "uColor"],
  SIZE,
  SIZE
);

const combineAgentAndPheromoneShader = new THREE.ShaderMaterial({
  glslVersion: "300 es",
  precision: "highp",
  uniforms: {
    uPositionDirection: { value: AgentsRT_A.textures[0] },
    uColor: { value: AgentsRT_A.textures[1] },
  },
  vertexShader: `
  out vec4 vColor;
  uniform sampler2D uPositionDirection;
  uniform sampler2D uColor;

  void main() {

    ivec2 texelCoord = ivec2(position.xy);
    vec4 positionDirection = texelFetch(uPositionDirection, texelCoord, 0);
    vec4 color = texelFetch(uColor, texelCoord, 0);
    vec2 agentPosition = positionDirection.xy;

    vColor = color;
    gl_PointSize = 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(agentPosition,0,1); ;
  }
  `,

  fragmentShader: `
  in vec4 vColor;
  out vec4 fColor;
  void main() {
    fColor = vColor;
  }
  `,
});

// THIS SHOULD COMBINE THE CURRENT PHEROMONE SCENE
const combinePheromoneAndAgentScene = new THREE.Scene();
const agentGeometry = new THREE.BufferGeometry();
agentGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(generatePointIds(SIZE), 3)
);
const agentPoints = new THREE.Points(
  agentGeometry,
  combineAgentAndPheromoneShader
);
combinePheromoneAndAgentScene.add(agentPoints);

const diffuseScene = new THREE.Scene();
const diffuseShader = new THREE.ShaderMaterial({
  glslVersion: "300 es",
  precision: "highp",
  uniforms: {
    uTexture: { value: pheromoneRT_A.textures[0] },
    uScreenSize: { value: new THREE.Vector2(width.value, height.value) },
    uDiffusionStrength: { value: props.diffusionStrength },
  },
  fragmentShader: `
  uniform sampler2D uTexture;
  uniform vec2 uScreenSize;
  uniform float uDiffusionStrength;

  out vec4 fColor;
  void main(){
      vec2 uv = gl_FragCoord.xy / uScreenSize;
      vec4 s1 = texelFetch(uTexture, ivec2(gl_FragCoord.xy + vec2(-1,-1)),0);
      vec4 s2 = texelFetch(uTexture, ivec2(gl_FragCoord.xy + vec2( 0,-1)),0);
      vec4 s3 = texelFetch(uTexture, ivec2(gl_FragCoord.xy + vec2( 1,-1)),0);

      vec4 s4 = texelFetch(uTexture, ivec2(gl_FragCoord.xy + vec2(-1, 0)),0);
      vec4 s5 = texelFetch(uTexture, ivec2(gl_FragCoord.xy), 0);
      vec4 s6 = texelFetch(uTexture, ivec2(gl_FragCoord.xy + vec2( 1, 0)),0);

      vec4 s7 = texelFetch(uTexture, ivec2(gl_FragCoord.xy + vec2(-1, 1)),0);
      vec4 s8 = texelFetch(uTexture, ivec2(gl_FragCoord.xy + vec2( 0, 1)),0);
      vec4 s9 = texelFetch(uTexture, ivec2(gl_FragCoord.xy + vec2( 1, 1)),0);

      vec4 blur = (s1 + 2.0 * s2 + s3 + 2.0 * s4 + 4.0 * s5 + 2.0* s6 + s7 + 2.0 * s8 + s9) / 16.0;


      float strength = length(blur.xyz);
      fColor = vec4(blur.xyz * float(strength > 0.0005),1) * (1.0-uDiffusionStrength*0.1);
      // fColor = vec4(uv,0,1);
  }
  `,
});

diffuseScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), diffuseShader));

const renderMat_A = new THREE.Mesh(
  screenQuad,
  new THREE.MeshBasicMaterial({
    map: pheromoneRT_A.textures[0],
  })
);
const renderMat_B = new THREE.Mesh(
  screenQuad,
  new THREE.MeshBasicMaterial({
    map: pheromoneRT_B.textures[0],
  })
);

const pingPongAgents = { cur: AgentsRT_A, next: AgentsRT_B };

const pingPongRenderScene = { cur: renderMat_A, next: renderMat_B };

const { onLoop, onAfterLoop, onBeforeLoop } = useRenderLoop();
onBeforeLoop(({ clock }) => {
  computeAgentShader.uniforms.uTime.value = clock.elapsedTime;
  computeAgentShader.uniforms.uBounds.value = new THREE.Vector4(
    -width.value / 2,
    width.value / 2,
    height.value / 2,
    -height.value / 2
  );
  computeAgentShader.uniforms.uScreenSize.value = new THREE.Vector2(
    width.value,
    height.value
  );
  diffuseShader.uniforms.uScreenSize.value = new THREE.Vector2(
    width.value,
    height.value
  );
  computeAgentShader.uniforms.uWanderStrength.value = props.wanderStrength;
  computeAgentShader.uniforms.uSensorAngle.value =
    (props.sensorAngle * Math.PI) / 180;
  computeAgentShader.uniforms.uSensorOffset.value = props.sensorOffset;
  computeAgentShader.uniforms.uSteerAngle.value =
    (props.steerAngle * Math.PI) / 180;
  diffuseShader.uniforms.uDiffusionStrength.value = props.diffusionStrength;

  computeAgentShader.uniforms.uSpeed.value = props.speed;
});

onLoop(() => {
  computeAgentShader.uniforms.uPheromones.value =
    pingPongPheromones.next.textures[0];
  // Update agent position
  setSource(pingPongAgents.cur);
  setTarget(pingPongAgents.next);
  execute();

  // Update pheromone map
  // @ts-ignore
  combineAgentAndPheromoneShader.uniforms.uPositionDirection.value =
    pingPongAgents.next.textures[0];
  // @ts-ignore
  combineAgentAndPheromoneShader.uniforms.uColor.value =
    pingPongAgents.next.textures[1];

  // This stage renders the current position of the agents onto the pheromone map
  tres.renderer.value.autoClear = false;
  tres.renderer.value.setRenderTarget(pingPongPheromones.cur);
  tres.renderer.value.render(combinePheromoneAndAgentScene, camera.value);
  tres.renderer.value.setRenderTarget(null);
  tres.renderer.value.autoClear = true;

  // This stage applies fading effect onto Pheromone map
  diffuseShader.uniforms.uTexture.value = pingPongPheromones.cur.textures[0];
  tres.renderer.value.setRenderTarget(pingPongPheromones.next);
  tres.renderer.value.render(diffuseScene, screenQuadCamera);
  tres.renderer.value.setRenderTarget(null);

  // Render result to screen
  tres.renderer.value.render(pingPongRenderScene.cur, screenQuadCamera);
});

onAfterLoop(() => {
  {
    const tmp = pingPongAgents.cur;
    pingPongAgents.cur = pingPongAgents.next;
    pingPongAgents.next = tmp;
  }
  {
    const tmp = pingPongPheromones.cur;
    pingPongPheromones.cur = pingPongPheromones.next;
    pingPongPheromones.next = tmp;
  }
  {
    const tmp = pingPongRenderScene.cur;
    pingPongRenderScene.cur = pingPongRenderScene.next;
    pingPongRenderScene.next = tmp;
  }
});

watch([width, height], () => {
  pheromoneRT_A.setSize(width.value, height.value);
  pheromoneRT_B.setSize(width.value, height.value);
});
</script>
