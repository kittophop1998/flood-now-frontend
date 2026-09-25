// Screen-space clustering for map markers. Points are projected to Web
// Mercator pixels at the current zoom and greedily grouped around "seed"
// points at least RADIUS_PX apart, so cluster bubbles never overlap and the
// number of DOM markers stays bounded no matter how many reports are in view.
// A grid of RADIUS_PX cells keeps each lookup to the 9 neighboring cells, so
// it's O(n). Pure and dependency-free (no supercluster needed at this scale).

export interface ClusterPoint {
  latitude: number;
  longitude: number;
}

export type Cluster<T extends ClusterPoint> =
  | { kind: "point"; key: string; item: T }
  | { kind: "cluster"; key: string; latitude: number; longitude: number; items: T[] };

// At or above this zoom every report gets its own marker.
export const CLUSTER_MAX_ZOOM = 15;
const RADIUS_PX = 56;
const TILE_PX = 512;

function project(p: ClusterPoint, zoom: number): [number, number] {
  const scale = TILE_PX * 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, p.latitude));
  const sin = Math.sin((lat * Math.PI) / 180);
  const x = ((p.longitude + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return [x, y];
}

interface Group<T> {
  x: number;
  y: number;
  items: T[];
}

export function clusterPoints<T extends ClusterPoint & { id: string }>(items: T[], zoom: number): Cluster<T>[] {
  if (zoom >= CLUSTER_MAX_ZOOM) return items.map((item) => ({ kind: "point", key: item.id, item }));

  const z = Math.floor(zoom);
  const cells = new Map<string, Group<T>[]>();
  const groups: Group<T>[] = [];

  for (const item of items) {
    const [x, y] = project(item, z);
    const cx = Math.floor(x / RADIUS_PX);
    const cy = Math.floor(y / RADIUS_PX);

    let best: Group<T> | null = null;
    let bestDist = RADIUS_PX * RADIUS_PX;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const g of cells.get(`${cx + dx}:${cy + dy}`) ?? []) {
          const d = (g.x - x) ** 2 + (g.y - y) ** 2;
          if (d < bestDist) {
            best = g;
            bestDist = d;
          }
        }
      }
    }

    if (best) {
      best.items.push(item);
    } else {
      const g = { x, y, items: [item] };
      groups.push(g);
      const key = `${cx}:${cy}`;
      const cell = cells.get(key);
      if (cell) cell.push(g);
      else cells.set(key, [g]);
    }
  }

  return groups.map((g): Cluster<T> => {
    if (g.items.length === 1) return { kind: "point", key: g.items[0].id, item: g.items[0] };
    const latitude = g.items.reduce((s, p) => s + p.latitude, 0) / g.items.length;
    const longitude = g.items.reduce((s, p) => s + p.longitude, 0) / g.items.length;
    // Keyed by its seed so the marker is stable while the set doesn't change.
    return { kind: "cluster", key: `c:${z}:${g.items[0].id}`, latitude, longitude, items: g.items };
  });
}
