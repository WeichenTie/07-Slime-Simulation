<script setup lang="ts">
import { TresCanvas } from "@tresjs/core";
import { SRGBColorSpace } from "three";
import CanvasBody from "./components/CanvasBody.vue";
import { DatGui, DatNumber } from "@cyrilf/vue-dat-gui";
import { ref } from "vue";

const open = ref(true);
const diffusionStrength = ref(1.5);
const wanderStrength = ref(0.1);
const steerAngle = ref(5);
const sensorAngle = ref(60);
const sensorOffset = ref(15);

// const diffusionStrength = ref(0.3);
// const wanderStrength = ref(0.3);
// const sensorAngle = ref(1);
// const sensorOffset = ref(20);
// const steerAngle = ref(15);
const speed = ref(2);
</script>

<template>
  <DatGui
    :open="open"
    open-text="Open Controls"
    close-text="Close Controls"
    close-position="bottom"
  >
    <DatNumber
      v-model="diffusionStrength"
      :min="0"
      :max="5"
      :step="0.01"
      label="Diffusion Strength"
    />
    <DatNumber
      v-model="wanderStrength"
      :min="0"
      :max="5"
      :step="0.01"
      label="Wander Strength"
    />
    <DatNumber
      v-model="sensorAngle"
      :min="0"
      :max="180"
      :step="0.01"
      label="Sensor Angle"
    />
    <DatNumber
      v-model="sensorOffset"
      :min="0"
      :max="20"
      :step="0.01"
      label="Sensor Offset"
    />
    <DatNumber
      v-model="steerAngle"
      :min="0"
      :max="90"
      :step="0.01"
      label="Steer Angle"
    />
    <DatNumber v-model="speed" :min="0" :max="10" :step="0.01" label="Speed" />
  </DatGui>
  <TresCanvas :output-encoding="SRGBColorSpace" antialias>
    <CanvasBody
      :speed="speed"
      :sensor-angle="sensorAngle"
      :sensor-offset="sensorOffset"
      :steer-angle="steerAngle"
      :wander-strength="wanderStrength"
      :diffusion-strength="diffusionStrength"
    ></CanvasBody>
  </TresCanvas>
</template>

<style>
canvas {
  height: 100vh;
  width: 100%;
}
</style>
