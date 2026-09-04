// Strips the Natural Earth country GeoJSON down to what three-globe's
// hexPolygonsData actually reads: geometry only. The upstream file carries
// ~50 metadata fields per country (scalerank, postal codes, GDP estimates…)
// that would otherwise ship to every visitor for nothing.
import { readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync(process.argv[2], "utf8"));

const slim = {
  type: "FeatureCollection",
  features: src.features.map((f) => ({
    type: "Feature",
    // ISO code kept so individual countries can be highlighted later.
    properties: { iso: f.properties?.ISO_A3 ?? f.properties?.ADM0_A3 ?? null },
    geometry: f.geometry,
  })),
};

writeFileSync(process.argv[3], JSON.stringify(slim));
console.log(`features: ${slim.features.length}`);
