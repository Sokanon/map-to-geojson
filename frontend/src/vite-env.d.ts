/// <reference types="vite/client" />

declare module 'topojson-server' {
  export function topology(
    objects: { [key: string]: GeoJSON.FeatureCollection },
    quantization?: number
  ): TopoJSON.Topology;
}
