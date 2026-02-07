export function pointInPolygon(x: number, y: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

export function stripClosingPoint(ring: number[][]): number[][] {
  if (ring.length < 2) return ring.slice();
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return ring.slice();
}

export function closeRing(vertices: number[][]): number[][] {
  if (vertices.length === 0) return [];
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return vertices.slice();
  }
  return [...vertices, [first[0], first[1]]];
}

export function getVerticesCentroid(vertices: number[][]): [number, number] {
  if (vertices.length === 0) return [0, 0];
  const sum = vertices.reduce(
    (acc, v) => {
      acc[0] += v[0];
      acc[1] += v[1];
      return acc;
    },
    [0, 0]
  );
  return [sum[0] / vertices.length, sum[1] / vertices.length];
}

export function getRingCentroid(ring: number[][]): [number, number] {
  const vertices = stripClosingPoint(ring);
  return getVerticesCentroid(vertices);
}

export function getPolygonCentroid(polygon: number[][][]): [number, number] {
  const ring = polygon[0] || [];
  return getRingCentroid(ring);
}
