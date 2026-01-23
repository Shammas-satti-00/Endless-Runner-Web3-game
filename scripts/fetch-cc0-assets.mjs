import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const kenneyModels = [
  'building-small-a.glb',
  'building-small-b.glb',
  'building-small-c.glb',
  'building-small-d.glb',
  'building-garage.glb',
  'grass-trees-tall.glb',
  'road-straight-lightposts.glb',
];

const assets = kenneyModels.map((name) => ({
  url: `https://raw.githubusercontent.com/KenneyNL/Starter-Kit-City-Builder/main/models/${name}`,
  path: `public/models/cc0/${name}`,
}));

assets.push({
  url: 'https://raw.githubusercontent.com/KenneyNL/Starter-Kit-City-Builder/main/models/Textures/colormap.png',
  path: 'public/models/cc0/Textures/colormap.png',
});

assets.push({
  url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ToyCar/glTF-Binary/ToyCar.glb',
  path: 'public/models/cc0/ToyCar.glb',
});

async function download({ url, path }) {
  const destination = resolve(path);
  await mkdir(dirname(destination), { recursive: true });
  const response = await fetch(url, { headers: { 'User-Agent': 'ShredRunner-Asset-Vendor/4.0' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(destination, bytes);
  console.log(`Downloaded ${path} (${(bytes.byteLength / 1024).toFixed(1)} KiB)`);
}

const results = await Promise.allSettled(assets.map(download));
const failed = results.filter((result) => result.status === 'rejected');
if (failed.length > 0) {
  for (const result of failed) console.warn(result.reason);
  console.warn(`${failed.length} optional assets could not be downloaded. Procedural runtime fallbacks remain available.`);
}
await writeFile(resolve('.env.local'), 'VITE_VENDOR_ASSETS=true\nVITE_REMOTE_ASSETS=false\n');
console.log('CC0 city and vehicle assets are configured.');
