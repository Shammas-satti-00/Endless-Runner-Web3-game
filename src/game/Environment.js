import * as THREE from 'three';
import { CONFIG } from '../config';
const KENNEY_RAW = 'https://raw.githubusercontent.com/KenneyNL/Starter-Kit-City-Builder/main/models/';
const LOCAL_MODEL_BASE = './models/cc0/';
const BUILDING_MODELS = [
    'building-small-a.glb',
    'building-small-b.glb',
    'building-small-c.glb',
    'building-small-d.glb',
    'building-garage.glb',
];
const TREE_MODEL = 'grass-trees-tall.glb';
const SURFACE_LENGTH = 420;
const ROAD_TEXTURE_REPEATS = 44;
const WET_FILM_TEXTURE_REPEATS = 6;
const SIDEWALK_TEXTURE_REPEATS = 36;
const ROAD_TEXTURE_WORLD_REPEAT = SURFACE_LENGTH / ROAD_TEXTURE_REPEATS;
const WET_FILM_TEXTURE_WORLD_REPEAT = SURFACE_LENGTH / WET_FILM_TEXTURE_REPEATS;
const SIDEWALK_TEXTURE_WORLD_REPEAT = SURFACE_LENGTH / SIDEWALK_TEXTURE_REPEATS;
const ROAD_MARKER_SPACING = 9;
const FURNITURE_SPACING = 24;
const TRACK_SLEEPER_SPACING = 9.2;
const CHUNK_CONTENT_HALF_DEPTH = 21;
const CHUNK_RECYCLE_MARGIN = 5;
const CHUNK_RECYCLE_Z = CONFIG.camera.z + CHUNK_CONTENT_HALF_DEPTH + CHUNK_RECYCLE_MARGIN;
export class Environment {
    scene;
    renderer;
    assets;
    root = new THREE.Group();
    scenery = new THREE.Group();
    chunks = [];
    buildingTemplates = [];
    treeTemplate = null;
    mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
    quality = this.readQuality();
    chunkLength = 32;
    chunkCount = this.mobile ? 8 : this.quality === 'cinematic' ? 12 : 10;
    unitBox = new THREE.BoxGeometry(1, 1, 1);
    unitCylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    treeCrownGeometry = new THREE.IcosahedronGeometry(1, 1);
    beaconGeometry = new THREE.SphereGeometry(0.5, 8, 6);
    roadFurniture = new THREE.Group();
    facadeMaterials = [];
    podiumMaterials = [];
    billboardMaterials = new Map();
    markerGroup = new THREE.Group();
    trackDetailGroup = new THREE.Group();
    asphaltColor = null;
    asphaltNormal = null;
    asphaltRoughness = null;
    asphaltClearcoat = null;
    concreteColor = null;
    cityGroundTexture = null;
    podiumTexture = null;
    surfaceTravel = 0;
    effectElapsed = 0;
    steamWisps = [];
    steamTexture = null;
    subwayWallMaterial = null;
    drainGeometry = new THREE.BoxGeometry(1, 1, 1);
    drainMaterial = new THREE.MeshStandardMaterial({ color: 0x323a3e, roughness: 0.5, metalness: 0.72 });
    mat = {
        darkMetal: new THREE.MeshStandardMaterial({ color: 0x30383e, metalness: 0.78, roughness: 0.3, envMapIntensity: 1.08 }),
        steel: new THREE.MeshStandardMaterial({ color: 0x7b858a, metalness: 0.76, roughness: 0.3, envMapIntensity: 1.05 }),
        concrete: new THREE.MeshStandardMaterial({ color: 0x969b9b, roughness: 0.9, metalness: 0.018, envMapIntensity: 0.5 }),
        concreteDark: new THREE.MeshStandardMaterial({ color: 0x51595d, roughness: 0.93, metalness: 0.01, envMapIntensity: 0.42 }),
        stoneBase: new THREE.MeshStandardMaterial({ color: 0xaaa9a3, roughness: 0.9, metalness: 0.012, envMapIntensity: 0.46 }),
        window: new THREE.MeshPhysicalMaterial({ color: 0x526d78, emissive: 0x132f3b, emissiveIntensity: 0.28, roughness: 0.24, metalness: 0.08, clearcoat: 0.42, clearcoatRoughness: 0.24, envMapIntensity: 1.18 }),
        warmWindow: new THREE.MeshPhysicalMaterial({ color: 0xc19b68, emissive: 0x8b4e20, emissiveIntensity: 0.72, roughness: 0.28, metalness: 0.02, clearcoat: 0.34, clearcoatRoughness: 0.28 }),
        cyanLight: new THREE.MeshStandardMaterial({ color: 0xc9fbff, emissive: 0x17c9dd, emissiveIntensity: 2.7, roughness: 0.16 }),
        amberLight: new THREE.MeshStandardMaterial({ color: 0xffe7bb, emissive: 0xffa63b, emissiveIntensity: 2.9, roughness: 0.16 }),
        redLight: new THREE.MeshStandardMaterial({ color: 0xff8379, emissive: 0xff3426, emissiveIntensity: 3.1, roughness: 0.18 }),
        rail: new THREE.MeshPhysicalMaterial({ color: 0xb8c0c4, metalness: 0.94, roughness: 0.16, clearcoat: 0.48, clearcoatRoughness: 0.12 }),
        rubber: new THREE.MeshStandardMaterial({ color: 0x1c2023, roughness: 0.9 }),
        bark: new THREE.MeshStandardMaterial({ color: 0x72523b, roughness: 0.95 }),
        trainBody: new THREE.MeshPhysicalMaterial({ color: 0x7f8b91, metalness: 0.74, roughness: 0.22, clearcoat: 0.38, clearcoatRoughness: 0.2, envMapIntensity: 1.14 }),
        trainAccent: new THREE.MeshPhysicalMaterial({ color: 0x265f77, metalness: 0.38, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.24 }),
        warning: new THREE.MeshStandardMaterial({ color: 0xb77b28, emissive: 0x613000, emissiveIntensity: 0.22, roughness: 0.62 }),
        foliage: new THREE.MeshStandardMaterial({ color: 0x365e43, roughness: 0.9, side: THREE.DoubleSide }),
    };
    constructor(scene, renderer, assets) {
        this.scene = scene;
        this.renderer = renderer;
        this.assets = assets;
        this.root.name = 'SubwayRushCinematicEnvironmentV10';
        this.scenery.name = 'PooledUrbanChunks';
        this.root.add(this.scenery, this.roadFurniture);
        this.scene.add(this.root);
    }
    async init(onStatus) {
        onStatus?.('Loading cinematic PBR surface materials');
        await this.loadSurfaceTextures();
        this.createGround();
        onStatus?.('Building optimized city and metro sections');
        await Promise.all([this.loadCityTemplates(), this.loadStreetAssets()]);
        this.createRoadFurniture();
        this.createSceneryChunks();
        onStatus?.('Loading cinematic skyline');
        await this.loadBackground();
    }
    reset() {
        this.chunks.forEach((chunk, index) => {
            chunk.position.z = -28 - index * this.chunkLength;
        });
        this.markerGroup.position.z = 0;
        this.trackDetailGroup.position.z = 0;
        this.roadFurniture.position.z = 0;
        this.surfaceTravel = 0;
        this.effectElapsed = 0;
        this.syncSurfaceMotion();
        this.updateSteamWisps();
    }
    update(delta, speed) {
        const movement = speed * delta;
        this.surfaceTravel = THREE.MathUtils.euclideanModulo(this.surfaceTravel + movement, SURFACE_LENGTH);
        this.effectElapsed += delta;
        this.syncSurfaceMotion();
        const loopDistance = this.chunkLength * this.chunkCount;
        for (const chunk of this.chunks) {
            chunk.position.z += movement;
            // A chunk is recycled only after its rearmost building has cleared
            // the camera. The old center-based -24 cutoff removed visible towers.
            if (chunk.position.z > CHUNK_RECYCLE_Z)
                chunk.position.z -= loopDistance;
        }
        this.updateSteamWisps();
    }
    updateSteamWisps() {
        for (const wisp of this.steamWisps) {
            const progress = THREE.MathUtils.euclideanModulo(this.effectElapsed * wisp.userData.speed + wisp.userData.phase, 1);
            wisp.position.y = wisp.userData.baseY + progress * 1.35;
            const width = wisp.userData.baseScaleX * (0.82 + progress * 0.6);
            const height = wisp.userData.baseScaleY * (0.8 + progress * 0.8);
            wisp.scale.set(width, height, 1);
            wisp.material.opacity = Math.sin(progress * Math.PI) * wisp.userData.maxOpacity;
            wisp.updateMatrix();
        }
    }
    syncSurfaceMotion() {
        // One UV cycle represents the same physical distance as the texture repeat
        // on the 420-unit surface. Positive offset moves the road toward the camera.
        const roadOffset = THREE.MathUtils.euclideanModulo(this.surfaceTravel / ROAD_TEXTURE_WORLD_REPEAT, 1);
        const wetFilmOffset = THREE.MathUtils.euclideanModulo(this.surfaceTravel / WET_FILM_TEXTURE_WORLD_REPEAT, 1);
        const sidewalkOffset = THREE.MathUtils.euclideanModulo(this.surfaceTravel / SIDEWALK_TEXTURE_WORLD_REPEAT, 1);
        for (const texture of [this.asphaltColor, this.asphaltNormal]) {
            if (texture)
                texture.offset.y = roadOffset;
        }
        for (const texture of [this.asphaltRoughness, this.asphaltClearcoat]) {
            if (texture)
                texture.offset.y = wetFilmOffset;
        }
        if (this.concreteColor)
            this.concreteColor.offset.y = sidewalkOffset;
        if (this.cityGroundTexture)
            this.cityGroundTexture.offset.y = sidewalkOffset;
        this.markerGroup.position.z = THREE.MathUtils.euclideanModulo(this.surfaceTravel, ROAD_MARKER_SPACING);
        this.trackDetailGroup.position.z = THREE.MathUtils.euclideanModulo(this.surfaceTravel, TRACK_SLEEPER_SPACING);
        this.roadFurniture.position.z = THREE.MathUtils.euclideanModulo(this.surfaceTravel, FURNITURE_SPACING);
    }
    async loadSurfaceTextures() {
        const loader = new THREE.TextureLoader();
        const detailedWalls = !this.mobile && this.quality !== 'performance';
        const [[color, normal, wetRoughness, wetClearcoat, concrete, wallColor], [wallHeight, wallRoughness]] = await Promise.all([
            Promise.all([
                loader.loadAsync('./textures/asphalt-color.webp'),
                loader.loadAsync('./textures/asphalt-normal.webp'),
                loader.loadAsync('./textures/asphalt-wet-roughness-v13.webp'),
                loader.loadAsync('./textures/asphalt-wet-clearcoat-v13.webp'),
                loader.loadAsync('./textures/concrete-color.webp'),
                loader.loadAsync('./textures/retaining-wall-after-rain.webp'),
            ]),
            detailedWalls
                ? Promise.all([
                    loader.loadAsync('./textures/subway-wall-height.webp'),
                    loader.loadAsync('./textures/subway-wall-roughness.webp'),
                ])
                : Promise.resolve([null, null]),
        ]);
        const anisotropy = Math.min(this.mobile ? 2 : 6, this.renderer.capabilities.getMaxAnisotropy());
        for (const texture of [color, normal]) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2.2, ROAD_TEXTURE_REPEATS);
            texture.anisotropy = anisotropy;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
        }
        for (const texture of [wetRoughness, wetClearcoat]) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, WET_FILM_TEXTURE_REPEATS);
            texture.anisotropy = anisotropy;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
        }
        color.colorSpace = THREE.SRGBColorSpace;
        concrete.colorSpace = THREE.SRGBColorSpace;
        concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
        concrete.repeat.set(2, SIDEWALK_TEXTURE_REPEATS);
        concrete.anisotropy = anisotropy;
        const podiumTexture = concrete.clone();
        podiumTexture.name = 'StaticBuildingPodiumMasonry';
        podiumTexture.wrapS = THREE.MirroredRepeatWrapping;
        podiumTexture.wrapT = THREE.RepeatWrapping;
        podiumTexture.repeat.set(2.6, 1.35);
        podiumTexture.offset.set(0, 0);
        podiumTexture.anisotropy = anisotropy;
        podiumTexture.minFilter = THREE.LinearMipmapLinearFilter;
        podiumTexture.magFilter = THREE.LinearFilter;
        podiumTexture.needsUpdate = true;
        wallColor.colorSpace = THREE.SRGBColorSpace;
        wallColor.wrapS = wallColor.wrapT = THREE.MirroredRepeatWrapping;
        wallColor.repeat.set(2.35, 1.15);
        wallColor.anisotropy = anisotropy;
        for (const texture of [wallHeight, wallRoughness]) {
            if (!texture)
                continue;
            texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
            texture.repeat.copy(wallColor.repeat);
            texture.anisotropy = anisotropy;
        }
        this.asphaltColor = color;
        this.asphaltNormal = normal;
        this.asphaltRoughness = wetRoughness;
        this.asphaltClearcoat = wetClearcoat;
        this.concreteColor = concrete;
        const cityGroundTexture = concrete.clone();
        cityGroundTexture.name = 'MovingAfterRainFoundation';
        cityGroundTexture.wrapS = cityGroundTexture.wrapT = THREE.RepeatWrapping;
        cityGroundTexture.repeat.set(14, SIDEWALK_TEXTURE_REPEATS);
        cityGroundTexture.anisotropy = anisotropy;
        cityGroundTexture.minFilter = THREE.LinearMipmapLinearFilter;
        cityGroundTexture.magFilter = THREE.LinearFilter;
        cityGroundTexture.needsUpdate = true;
        this.cityGroundTexture = cityGroundTexture;
        this.podiumTexture = podiumTexture;
        this.mat.stoneBase.map = podiumTexture;
        this.mat.stoneBase.needsUpdate = true;
        this.subwayWallMaterial = new THREE.MeshStandardMaterial({
            map: wallColor,
            bumpMap: wallHeight,
            bumpScale: wallHeight ? 0.036 : 0,
            roughnessMap: wallRoughness,
            roughness: 0.86,
            metalness: 0.015,
            color: 0xc4c9ca,
            envMapIntensity: 0.78,
        });
        const roadMaterial = new THREE.MeshPhysicalMaterial({
            name: 'ContinuousWetAsphaltFilm',
            map: color,
            normalMap: normal,
            normalScale: new THREE.Vector2(0.42, 0.42),
            roughnessMap: wetRoughness,
            roughness: this.mobile ? 0.82 : 0.88,
            metalness: 0.02,
            clearcoatMap: wetClearcoat,
            clearcoat: this.mobile ? 0.48 : 0.82,
            clearcoatRoughnessMap: wetRoughness,
            clearcoatRoughness: this.mobile ? 0.5 : 0.58,
            color: 0xb4bec2,
            envMapIntensity: 1.2,
        });
        const cityGroundMaterial = new THREE.MeshStandardMaterial({
            map: cityGroundTexture,
            color: 0x5d6466,
            roughness: 0.93,
            metalness: 0.01,
            envMapIntensity: 0.5,
        });
        const cityGround = new THREE.Mesh(new THREE.PlaneGeometry(110, SURFACE_LENGTH), cityGroundMaterial);
        cityGround.name = 'ContinuousCityFoundation';
        cityGround.rotation.x = -Math.PI / 2;
        cityGround.position.set(0, -0.075, -170);
        cityGround.receiveShadow = true;
        this.root.add(cityGround);
        const road = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.worldWidth, SURFACE_LENGTH), roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0, -170);
        road.receiveShadow = true;
        this.root.add(road);
        const sidewalkMaterial = new THREE.MeshPhysicalMaterial({
            map: concrete,
            roughness: 0.69,
            metalness: 0.025,
            clearcoat: this.mobile ? 0.06 : 0.18,
            clearcoatRoughness: 0.4,
            color: 0xaaaead,
            envMapIntensity: 0.72,
        });
        for (const x of [-10.55, 10.55]) {
            const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.24, SURFACE_LENGTH), sidewalkMaterial);
            sidewalk.position.set(x, 0.08, -170);
            sidewalk.receiveShadow = true;
            this.root.add(sidewalk);
            const curb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, SURFACE_LENGTH), this.mat.concrete);
            curb.position.set(x - Math.sign(x) * 1.55, 0.15, -170);
            curb.receiveShadow = true;
            this.root.add(curb);
        }
        const facadeTexturePaths = [
            './textures/facade-real-concrete-v9.webp',
            './textures/facade-real-brick-v9.webp',
            './textures/facade-real-glass-v9.webp',
        ];
        const facadeProfiles = [
            { color: 0xc3c5c1, roughness: 0.78, metalness: 0.015, envMapIntensity: 0.66 },
            { color: 0xb9aaa0, roughness: 0.83, metalness: 0.01, envMapIntensity: 0.6 },
            { color: 0xa9bdc5, roughness: 0.23, metalness: 0.1, envMapIntensity: 1.34, clearcoat: 0.46 },
        ];
        const facadeTextures = await Promise.all(facadeTexturePaths.map((path) => loader.loadAsync(path)));
        facadeTextures.forEach((texture, index) => {
            const profile = facadeProfiles[index] ?? facadeProfiles[0];
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.repeat.set(1, 1);
            texture.anisotropy = anisotropy;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            const materialOptions = {
                map: texture,
                color: profile.color,
                roughness: profile.roughness,
                metalness: profile.metalness,
                envMapIntensity: profile.envMapIntensity,
            };
            const material = profile.clearcoat
                ? new THREE.MeshPhysicalMaterial({
                    ...materialOptions,
                    clearcoat: this.mobile ? 0.08 : profile.clearcoat,
                    clearcoatRoughness: 0.32,
                })
                : new THREE.MeshStandardMaterial(materialOptions);
            this.facadeMaterials.push(material);
        });
        this.podiumMaterials = facadeTextures.map((_, index) => {
            const sourceIndex = index === 2 ? 0 : index;
            return new THREE.MeshStandardMaterial({
                map: facadeTextures[sourceIndex],
                color: index === 1 ? 0xb4a59b : 0xb5b9b7,
                roughness: index === 1 ? 0.88 : 0.81,
                metalness: 0.012,
                envMapIntensity: 0.62,
            });
        });
    }
    createGround() {
        this.markerGroup = new THREE.Group();
        this.trackDetailGroup = new THREE.Group();
        const markerGeometry = new THREE.BoxGeometry(0.13, 0.022, 3.7);
        const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1c7, emissive: 0x9b7c38, emissiveIntensity: 0.22, roughness: 0.5 });
        const zValues = [];
        for (let z = -390; z < 42; z += ROAD_MARKER_SPACING)
            zValues.push(z);
        const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, zValues.length * 2);
        const matrix = new THREE.Matrix4();
        let count = 0;
        for (const x of [-1.4, 1.4]) {
            for (const z of zValues) {
                matrix.makeTranslation(x, 0.024, z);
                markers.setMatrixAt(count++, matrix);
            }
        }
        markers.instanceMatrix.needsUpdate = true;
        this.markerGroup.add(markers);
        // Wetness is handled by the asphalt clearcoat. Extra puddle planes were removed
        // because transparent instances could enter the foreground and obscure the runner.
        this.root.add(this.markerGroup);
        for (const x of [-6.65, -6.1, 6.1, 6.65]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, SURFACE_LENGTH), this.mat.rail);
            rail.position.set(x, 0.12, -170);
            this.root.add(rail);
        }
        const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.1, 0.2), this.mat.darkMetal, 92);
        for (let index = 0; index < 92; index += 1) {
            const side = index % 2 === 0 ? -1 : 1;
            const z = -386 + Math.floor(index / 2) * TRACK_SLEEPER_SPACING;
            matrix.makeTranslation(side * 6.38, 0.055, z);
            sleepers.setMatrixAt(index, matrix);
        }
        sleepers.instanceMatrix.needsUpdate = true;
        this.trackDetailGroup.add(sleepers);
        this.root.add(this.trackDetailGroup);
    }
    async loadCityTemplates() {
        const models = await Promise.all(BUILDING_MODELS.map((name) => this.loadNamedModel(name)));
        for (const model of models) {
            if (!model)
                continue;
            const template = this.normalizeTemplate(this.assets.cloneLoaded(model));
            this.enhanceImportedModel(template, 'building');
            this.buildingTemplates.push(template);
        }
    }
    async loadStreetAssets() {
        const trees = await this.loadNamedModel(TREE_MODEL);
        if (trees) {
            this.treeTemplate = this.normalizeTemplate(this.assets.cloneLoaded(trees));
            this.enhanceImportedModel(this.treeTemplate, 'foliage');
        }
    }
    async loadNamedModel(name) {
        const localEnabled = import.meta.env.VITE_VENDOR_ASSETS === 'true';
        if (localEnabled) {
            const local = await this.loadExternalWithTimeout(`${LOCAL_MODEL_BASE}${name}`, 1800);
            if (local)
                return local;
        }
        // Remote models are opt-in. The procedural city is available immediately,
        // avoiding several startup requests and timeout stalls on first play.
        if (import.meta.env.VITE_REMOTE_ASSETS !== 'true')
            return null;
        return this.loadExternalWithTimeout(`${KENNEY_RAW}${name}`, 4200);
    }
    createRoadFurniture() {
        const positions = [];
        for (let z = -390; z <= -30; z += FURNITURE_SPACING)
            for (const x of [-9.25, 9.25])
                positions.push({ x, z });
        const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 5.1, 8), this.mat.darkMetal, positions.length);
        const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.09, 0.09), this.mat.darkMetal, positions.length);
        const lamps = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.13, 0.18, 3, 6), this.mat.amberLight, positions.length);
        const matrix = new THREE.Matrix4();
        positions.forEach(({ x, z }, index) => {
            matrix.makeTranslation(x, 2.55, z);
            poles.setMatrixAt(index, matrix);
            matrix.makeTranslation(x - Math.sign(x) * 0.42, 4.96, z);
            arms.setMatrixAt(index, matrix);
            matrix.makeTranslation(x - Math.sign(x) * 0.88, 4.84, z);
            lamps.setMatrixAt(index, matrix);
        });
        poles.instanceMatrix.needsUpdate = true;
        arms.instanceMatrix.needsUpdate = true;
        lamps.instanceMatrix.needsUpdate = true;
        this.roadFurniture.add(poles, arms, lamps);
    }
    createSceneryChunks() {
        const random = this.seededRandom(27072026);
        for (let index = 0; index < this.chunkCount; index += 1) {
            const chunk = new THREE.Group();
            chunk.position.z = -28 - index * this.chunkLength;
            chunk.name = `UrbanChunk-${index}`;
            this.addSkyline(chunk, index, random);
            this.addStreetLevel(chunk, index, random);
            const mode = index % 8;
            if (mode === 2)
                this.addStationSection(chunk, index, random);
            else if ((mode === 5 || mode === 7 && this.quality === 'cinematic') && !this.mobile)
                this.addBrightTunnelSection(chunk, index);
            else if (mode === 4)
                this.addElevatedSection(chunk, index, random);
            else
                this.addSurfaceSection(chunk, index, random);
            this.addAfterRainDetails(chunk, index, random);
            this.freezeStaticChildren(chunk);
            this.chunks.push(chunk);
            this.scenery.add(chunk);
        }
    }
    addSkyline(chunk, index, random) {
        const density = this.mobile || this.quality === 'performance'
            ? 3
            : this.quality === 'cinematic' ? 6 : 5;
        const buildings = [];
        for (const side of [-1, 1]) {
            for (let layer = 0; layer < density; layer += 1) {
                const depthRatio = density > 1 ? layer / (density - 1) : 0;
                const seed = index * 37 + layer * 11 + (side > 0 ? 7 : 19);
                const height = 16 + depthRatio * 22 + random() * (12 + depthRatio * 8);
                buildings.push({
                    side,
                    seed,
                    x: side * (13.35 + layer * 4.4 + random() * 1.4),
                    z: -this.chunkLength * 0.36 + depthRatio * this.chunkLength * 0.72 + (random() - 0.5) * 3.5,
                    width: 6 + random() * 4.2 + depthRatio * 1.8,
                    height,
                    depth: 7.2 + random() * 4.5,
                    streetFacing: layer === 0,
                    tiered: height > 23 && (seed + index) % 4 !== 1,
                    materialIndex: seed % Math.max(1, this.facadeMaterials.length),
                });
            }
            if (this.buildingTemplates.length > 0 && !this.mobile && index % 3 === (side > 0 ? 0 : 2)) {
                const imported = this.buildingTemplates[(index + (side > 0 ? 1 : 0)) % this.buildingTemplates.length];
                const hero = imported.clone(true);
                const targetHeight = 18 + random() * 12;
                hero.scale.setScalar(targetHeight);
                hero.position.set(side * (38 + random() * 5), 0, -10 + random() * 20);
                hero.rotation.y = random() * Math.PI * 2;
                chunk.add(hero);
            }
        }
        this.addInstancedBuildingDistrict(chunk, buildings, index);
    }
    addInstancedBuildingDistrict(chunk, buildings, chunkIndex) {
        const facadeBuckets = Array.from(
            { length: Math.max(1, this.facadeMaterials.length) },
            () => [],
        );
        const podiumBuckets = Array.from(
            { length: Math.max(1, this.podiumMaterials.length) },
            () => [],
        );
        const roofBlocks = [];
        const corniceBlocks = [];
        const trimBlocks = [];
        const floorBands = [];
        const canopyBlocks = [];
        const coolStorefronts = [];
        const warmStorefronts = [];
        const coolWindows = [];
        const warmWindows = [];
        const fireEscapeDecks = [];
        const fireEscapeRails = [];
        const servicePipes = [];
        const waterTanks = [];
        const aerials = [];
        const beacons = [];
        for (const building of buildings) {
            const facadeParts = facadeBuckets[building.materialIndex] ?? facadeBuckets[0];
            const podiumHeight = THREE.MathUtils.clamp(building.height * 0.12, 2.5, 4.25);
            const towerHeight = building.height - podiumHeight;
            const lowerRatio = building.tiered ? 0.64 + (building.seed % 4) * 0.055 : 1;
            const lowerHeight = towerHeight * lowerRatio;
            const tintValue = 0.82 + (building.seed % 6) * 0.024;
            const tint = new THREE.Color(tintValue * 0.98, tintValue, tintValue * 1.015);
            const podiumTintValue = 0.78 + (building.seed % 5) * 0.025;
            const podiumTint = new THREE.Color(podiumTintValue, podiumTintValue * 0.99, podiumTintValue * 0.965);
            const podiumParts = podiumBuckets[building.materialIndex % podiumBuckets.length] ?? podiumBuckets[0];
            podiumParts.push({
                position: [building.x, podiumHeight * 0.5, building.z],
                scale: [building.width * 1.06, podiumHeight, building.depth * 1.06],
                color: podiumTint,
            });
            facadeParts.push({
                position: [building.x, podiumHeight + lowerHeight * 0.5, building.z],
                scale: [building.width, lowerHeight, building.depth],
                color: tint,
            });
            let roofWidth = building.width;
            let roofDepth = building.depth;
            if (building.tiered) {
                const upperHeight = towerHeight - lowerHeight;
                roofWidth *= 0.76 + (building.seed % 3) * 0.045;
                roofDepth *= 0.75 + (building.seed % 2) * 0.08;
                facadeParts.push({
                    position: [building.x, podiumHeight + lowerHeight + upperHeight * 0.5, building.z],
                    scale: [roofWidth, upperHeight, roofDepth],
                    color: tint,
                });
                corniceBlocks.push({
                    position: [building.x, podiumHeight + lowerHeight, building.z],
                    scale: [building.width * 1.045, 0.28, building.depth * 1.045],
                });
            }
            corniceBlocks.push({
                position: [building.x, building.height + 0.18, building.z],
                scale: [roofWidth * 1.035, 0.36, roofDepth * 1.035],
            });
            const equipmentHeight = 0.65 + (building.seed % 4) * 0.16;
            roofBlocks.push({
                position: [
                    building.x + ((building.seed % 3) - 1) * roofWidth * 0.18,
                    building.height + 0.36 + equipmentHeight * 0.5,
                    building.z + ((building.seed % 5) - 2) * roofDepth * 0.08,
                ],
                scale: [roofWidth * 0.28, equipmentHeight, roofDepth * 0.25],
            });
            if (building.streetFacing) {
                const detailedStreetFacade = !this.mobile && this.quality !== 'performance';
                const roadFace = building.x - building.side * building.width * 0.5;
                const storefronts = (building.seed + chunkIndex) % 3 === 0 ? warmStorefronts : coolStorefronts;
                storefronts.push({
                    position: [roadFace - building.side * 0.055, 1.42, building.z],
                    scale: [0.11, 2.16, building.depth * 0.76],
                });
                canopyBlocks.push({
                    position: [roadFace - building.side * 0.58, 2.78, building.z],
                    scale: [1.26, 0.14, building.depth * 0.84],
                });
                const pierPositions = detailedStreetFacade ? [-1, -0.33, 0.33, 1] : [-1, 1];
                for (const edge of pierPositions) {
                    trimBlocks.push({
                        position: [roadFace - building.side * 0.065, podiumHeight + towerHeight * 0.48, building.z + edge * building.depth * 0.43],
                        scale: [0.17, towerHeight * 0.92, 0.14],
                    });
                }
                const bandCount = detailedStreetFacade ? 5 : 0;
                for (let band = 1; band <= bandCount; band += 1) {
                    floorBands.push({
                        position: [
                            roadFace - building.side * 0.07,
                            podiumHeight + towerHeight * (band / (bandCount + 1)),
                            building.z,
                        ],
                        scale: [0.18, 0.12, building.depth * 0.9],
                    });
                }
                const litLevels = detailedStreetFacade ? 4 : 0;
                for (let level = 0; level < litLevels; level += 1) {
                    for (const cell of [-1, 0, 1]) {
                        if ((building.seed + level * 7 + cell * 3) % 5 > 1)
                            continue;
                        const windows = (building.seed + level + cell + chunkIndex) % 3 === 0 ? warmWindows : coolWindows;
                        windows.push({
                            position: [
                                roadFace - building.side * 0.09,
                                podiumHeight + 1.35 + level * Math.max(2.8, towerHeight / (litLevels + 1)),
                                building.z + cell * building.depth * 0.26,
                            ],
                            scale: [0.09, 0.72, building.depth * 0.16],
                        });
                    }
                }
                if (detailedStreetFacade) {
                    servicePipes.push({
                        position: [
                            roadFace - building.side * 0.15,
                            podiumHeight + towerHeight * 0.46,
                            building.z + (building.seed % 2 === 0 ? -1 : 1) * building.depth * 0.4,
                        ],
                        scale: [0.09, towerHeight * 0.88, 0.09],
                    });
                }
                if (detailedStreetFacade && building.seed % 5 === 0) {
                    const escapeZ = building.z + (building.seed % 2 === 0 ? -0.18 : 0.18) * building.depth;
                    const deckCount = Math.min(4, Math.max(2, Math.floor((building.height - 4) / 5.4)));
                    for (let deck = 0; deck < deckCount; deck += 1) {
                        const deckY = 4.9 + deck * 3.45;
                        fireEscapeDecks.push({
                            position: [roadFace - building.side * 0.48, deckY, escapeZ],
                            scale: [0.96, 0.1, 1.45],
                        });
                        fireEscapeRails.push(
                            {
                                position: [roadFace - building.side * 0.94, deckY + 0.38, escapeZ],
                                scale: [0.08, 0.72, 1.45],
                            },
                            {
                                position: [roadFace - building.side * 0.48, deckY + 0.38, escapeZ - 0.69],
                                scale: [0.96, 0.72, 0.07],
                            },
                            {
                                position: [roadFace - building.side * 0.48, deckY + 0.38, escapeZ + 0.69],
                                scale: [0.96, 0.72, 0.07],
                            },
                        );
                    }
                }
            }
            if (!this.mobile && building.seed % 4 === 0) {
                waterTanks.push({
                    position: [building.x, building.height + 1.2, building.z],
                    scale: [1.05, 1.75, 1.05],
                });
            }
            else if (building.seed % 3 === 0) {
                aerials.push({
                    position: [building.x, building.height + 1.45, building.z],
                    scale: [0.16, 2.55, 0.16],
                });
            }
            if (!this.mobile && building.height > 31 && building.seed % 2 === 0) {
                beacons.push({
                    position: [building.x, building.height + 2.75, building.z],
                    scale: [0.2, 0.2, 0.2],
                });
            }
        }
        facadeBuckets.forEach((parts, materialIndex) => {
            const material = this.facadeMaterials[materialIndex] ?? this.mat.concreteDark;
            const mesh = this.createStaticInstances(this.unitBox, material, parts, `FacadeBatch-${chunkIndex}-${materialIndex}`);
            if (mesh)
                chunk.add(mesh);
        });
        podiumBuckets.forEach((parts, materialIndex) => {
            const material = this.podiumMaterials[materialIndex] ?? this.mat.stoneBase;
            const mesh = this.createStaticInstances(this.unitBox, material, parts, `TexturedPodiumBatch-${chunkIndex}-${materialIndex}`);
            if (mesh)
                chunk.add(mesh);
        });
        const details = [
            [this.unitBox, this.mat.concreteDark, roofBlocks, `RoofBatch-${chunkIndex}`],
            [this.unitBox, this.mat.stoneBase, corniceBlocks, `CorniceBatch-${chunkIndex}`],
            [this.unitBox, this.mat.darkMetal, trimBlocks, `FacadeTrimBatch-${chunkIndex}`],
            [this.unitBox, this.mat.concreteDark, floorBands, `FloorBandBatch-${chunkIndex}`],
            [this.unitBox, this.mat.darkMetal, canopyBlocks, `CanopyBatch-${chunkIndex}`],
            [this.unitBox, this.mat.window, coolStorefronts, `CoolStorefrontBatch-${chunkIndex}`],
            [this.unitBox, this.mat.warmWindow, warmStorefronts, `WarmStorefrontBatch-${chunkIndex}`],
            [this.unitBox, this.mat.window, coolWindows, `CoolWindowDepthBatch-${chunkIndex}`],
            [this.unitBox, this.mat.warmWindow, warmWindows, `WarmWindowDepthBatch-${chunkIndex}`],
            [this.unitBox, this.mat.darkMetal, fireEscapeDecks, `FireEscapeDeckBatch-${chunkIndex}`],
            [this.unitBox, this.mat.darkMetal, fireEscapeRails, `FireEscapeRailBatch-${chunkIndex}`],
            [this.unitCylinder, this.mat.steel, servicePipes, `FacadePipeBatch-${chunkIndex}`],
            [this.unitCylinder, this.mat.steel, waterTanks, `WaterTankBatch-${chunkIndex}`],
            [this.unitCylinder, this.mat.steel, aerials, `AerialBatch-${chunkIndex}`],
            [this.beaconGeometry, this.mat.redLight, beacons, `BeaconBatch-${chunkIndex}`],
        ];
        for (const [geometry, material, parts, name] of details) {
            const mesh = this.createStaticInstances(geometry, material, parts, name);
            if (mesh)
                chunk.add(mesh);
        }
    }
    createStaticInstances(geometry, material, parts, name) {
        if (parts.length === 0)
            return null;
        const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        parts.forEach((part, index) => {
            position.fromArray(part.position);
            scale.fromArray(part.scale);
            quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, part.rotationY ?? 0);
            matrix.compose(position, quaternion, scale);
            mesh.setMatrixAt(index, matrix);
            if (part.color)
                mesh.setColorAt(index, part.color);
        });
        mesh.name = name;
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor)
            mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        return mesh;
    }
    addStreetLevel(chunk, index, random) {
        const bollards = [];
        const bollardCaps = [];
        const cabinets = [];
        const cabinetDoors = [];
        const hydrantBodies = [];
        const hydrantCaps = [];
        for (const side of [-1, 1]) {
            for (let slot = 0; slot < 2; slot += 1) {
                const z = -9 + slot * 17 + (random() - 0.5) * 1.8;
                bollards.push({
                    position: [side * 9.38, 0.46, z],
                    scale: [0.18, 0.92, 0.18],
                });
                bollardCaps.push({
                    position: [side * 9.38, 0.94, z],
                    scale: [0.2, 0.14, 0.2],
                });
            }
            const cabinetZ = (side > 0 ? -6 : 7) + (random() - 0.5) * 4;
            cabinets.push({
                position: [side * 11.35, 0.76, cabinetZ],
                scale: [0.72, 1.52, 0.62],
            });
            cabinetDoors.push({
                position: [side * 10.975, 0.78, cabinetZ],
                scale: [0.045, 1.17, 0.48],
            });
            if (index % 3 === (side > 0 ? 0 : 1)) {
                const hydrantZ = side > 0 ? 9.8 : -9.8;
                hydrantBodies.push({
                    position: [side * 10.05, 0.38, hydrantZ],
                    scale: [0.34, 0.76, 0.34],
                });
                hydrantCaps.push({
                    position: [side * 10.05, 0.82, hydrantZ],
                    scale: [0.42, 0.22, 0.42],
                });
            }
            if (this.treeTemplate && this.quality === 'cinematic' && !this.mobile && index % 4 === (side > 0 ? 0 : 2)) {
                const tree = this.treeTemplate.clone(true);
                tree.scale.setScalar(3.4 + random() * 1.1);
                tree.position.set(side * 11.7, 0.2, side > 0 ? 11 : -11);
                tree.rotation.y = random() * Math.PI * 2;
                chunk.add(tree);
            }
        }
        const fixtures = [
            [this.unitCylinder, this.mat.darkMetal, bollards, `StreetBollardBatch-${index}`],
            [this.beaconGeometry, this.mat.steel, bollardCaps, `StreetBollardCapBatch-${index}`],
            [this.unitBox, this.mat.steel, cabinets, `UtilityCabinetBatch-${index}`],
            [this.unitBox, this.mat.darkMetal, cabinetDoors, `UtilityCabinetDoorBatch-${index}`],
            [this.unitCylinder, this.mat.warning, hydrantBodies, `HydrantBodyBatch-${index}`],
            [this.unitCylinder, this.mat.darkMetal, hydrantCaps, `HydrantCapBatch-${index}`],
        ];
        for (const [geometry, material, parts, name] of fixtures) {
            const mesh = this.createStaticInstances(geometry, material, parts, name);
            if (mesh)
                chunk.add(mesh);
        }
    }
    addAfterRainDetails(chunk, index, random) {
        // Road moisture is a broad, continuous PBR film. Keeping it in the
        // roughness and clearcoat maps prevents puddle-shaped overlay stamps.
        const drains = [];
        const drainSlots = [];
        for (const side of [-1, 1]) {
            const z = -9 + random() * 18;
            drains.push({
                position: [side * 8.22, 0.028, z],
                scale: [0.7, 0.045, 1.18],
            });
            for (let slot = -3; slot <= 3; slot += 1) {
                drainSlots.push({
                    position: [side * 8.22, 0.054, z + slot * 0.14],
                    scale: [0.58, 0.018, 0.035],
                });
            }
        }
        const drainBodies = this.createStaticInstances(this.drainGeometry, this.drainMaterial, drains, `DrainBodies-${index}`);
        const slots = this.createStaticInstances(this.drainGeometry, this.mat.rubber, drainSlots, `DrainSlots-${index}`);
        if (drainBodies)
            chunk.add(drainBodies);
        if (slots)
            chunk.add(slots);
    }
    addSurfaceSection(chunk, index, random) {
        const wallSide = index % 2 === 0 ? 1 : -1;
        chunk.add(this.createRetainingWall(wallSide, index));
        chunk.add(this.createGantry(index));
        if (index % 3 === 0) {
            const trainSide = -wallSide;
            const train = this.createTrainCar(trainSide, index);
            train.position.set(trainSide * 6.38, 0.12, -4 + random() * 8);
            chunk.add(train);
        }
        if (index % 2 === 0)
            chunk.add(this.createBillboard(index, 'FUTURE IS YOURS'));
    }
    createRetainingWall(side, index) {
        const group = new THREE.Group();
        group.name = `RainDarkenedRetainingWall-${index}`;
        const wall = new THREE.Mesh(this.unitBox, this.subwayWallMaterial ?? this.mat.concrete);
        wall.scale.set(0.62, 5.35, 30.5);
        wall.position.set(side * 12.45, 2.66, 0);
        wall.receiveShadow = true;
        group.add(wall);
        const base = new THREE.Mesh(this.unitBox, this.mat.stoneBase);
        base.scale.set(0.82, 0.92, 30.8);
        base.position.set(side * 12.35, 0.45, 0);
        base.receiveShadow = true;
        group.add(base);
        const coping = new THREE.Mesh(this.unitBox, this.mat.concreteDark);
        coping.scale.set(0.86, 0.22, 30.8);
        coping.position.set(side * 12.35, 5.43, 0);
        group.add(coping);
        const innerX = side * 12.09;
        const cableRuns = [1.22, 2.25, 3.52].map((y) => ({
            position: [innerX, y, 0],
            scale: [0.12, 0.1, 28.9],
        }));
        const cableRisers = [-10.2, 0, 10.2].map((z) => ({
            position: [innerX, 2.43, z],
            scale: [0.13, 3.75, 0.13],
        }));
        const boxes = [-7.2, 7.2].map((z) => ({
            position: [side * 11.78, 1.2, z],
            scale: [0.52, 1.45, 1.05],
        }));
        const lamps = [-10.2, 0, 10.2].map((z) => ({
            position: [side * 11.73, 4.32, z],
            scale: [0.16, 0.16, 0.16],
        }));
        const details = [
            [this.unitBox, this.mat.darkMetal, cableRuns, `WallCableRunBatch-${index}`],
            [this.unitBox, this.mat.darkMetal, cableRisers, `WallCableRiserBatch-${index}`],
            [this.unitBox, this.mat.steel, boxes, `WallUtilityBoxBatch-${index}`],
            [this.beaconGeometry, this.mat.amberLight, lamps, `WallPracticalLightBatch-${index}`],
        ];
        for (const [geometry, material, parts, name] of details) {
            const mesh = this.createStaticInstances(geometry, material, parts, name);
            if (mesh)
                group.add(mesh);
        }
        return group;
    }
    addBrightTunnelSection(chunk, index) {
        const wallLength = this.chunkLength * 0.96;
        const wallMaterial = this.subwayWallMaterial ?? this.mat.concrete;
        for (const side of [-1, 1]) {
            const wall = new THREE.Mesh(this.unitBox, wallMaterial);
            wall.scale.set(0.72, 5.6, wallLength);
            wall.position.set(side * 9.55, 2.8, 0);
            chunk.add(wall);
            const serviceWalk = new THREE.Mesh(this.unitBox, this.mat.concreteDark);
            serviceWalk.scale.set(1.3, 0.35, wallLength);
            serviceWalk.position.set(side * 8.4, 0.12, 0);
            chunk.add(serviceWalk);
            const cableTray = new THREE.Mesh(this.unitBox, this.mat.darkMetal);
            cableTray.scale.set(0.24, 0.22, wallLength * 0.98);
            cableTray.position.set(side * 9.04, 4.35, 0);
            chunk.add(cableTray);
            const pipe = new THREE.Mesh(this.unitCylinder, this.mat.steel);
            pipe.scale.set(0.16, wallLength, 0.16);
            pipe.rotation.x = Math.PI / 2;
            pipe.position.set(side * 8.96, 5.25, 0);
            chunk.add(pipe);
        }
        const ceiling = new THREE.Mesh(this.unitBox, this.mat.concreteDark);
        ceiling.scale.set(19.7, 0.34, wallLength);
        ceiling.position.set(0, 7.15, 0);
        chunk.add(ceiling);
        const ribZ = [-12, -6, 0, 6, 12];
        const ribPosts = new THREE.InstancedMesh(this.unitBox, this.mat.darkMetal, ribZ.length * 2);
        const ribBeams = new THREE.InstancedMesh(this.unitBox, this.mat.darkMetal, ribZ.length);
        const tubeLights = new THREE.InstancedMesh(new THREE.BoxGeometry(5.4, 0.11, 0.22), index % 2 === 0 ? this.mat.warmWindow : this.mat.cyanLight, ribZ.length);
        const matrix = new THREE.Matrix4();
        let postIndex = 0;
        ribZ.forEach((z, ribIndex) => {
            for (const side of [-1, 1]) {
                matrix.compose(new THREE.Vector3(side * 9.05, 3.55, z), new THREE.Quaternion(), new THREE.Vector3(0.24, 7, 0.24));
                ribPosts.setMatrixAt(postIndex++, matrix);
            }
            matrix.compose(new THREE.Vector3(0, 6.86, z), new THREE.Quaternion(), new THREE.Vector3(18.4, 0.25, 0.25));
            ribBeams.setMatrixAt(ribIndex, matrix);
            matrix.makeTranslation(0, 6.66, z);
            tubeLights.setMatrixAt(ribIndex, matrix);
        });
        ribPosts.instanceMatrix.needsUpdate = true;
        ribBeams.instanceMatrix.needsUpdate = true;
        tubeLights.instanceMatrix.needsUpdate = true;
        chunk.add(ribPosts, ribBeams, tubeLights);
        if (!this.mobile && this.quality !== 'performance') {
            chunk.add(
                this.createSteamWisp(-1, -8.5, index * 0.17),
                this.createSteamWisp(1, 7.5, index * 0.17 + 0.44),
            );
        }
    }
    createSteamWisp(side, z, phase) {
        if (!this.steamTexture)
            this.steamTexture = this.createSteamTexture();
        const material = new THREE.SpriteMaterial({
            map: this.steamTexture,
            color: 0xc5d4d8,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.NormalBlending,
            fog: true,
        });
        const sprite = new THREE.Sprite(material);
        sprite.name = 'PooledTunnelSteam';
        sprite.position.set(side * 7.35, 0.72, z);
        sprite.scale.set(1.4, 1.05, 1);
        sprite.userData.dynamicEnvironment = true;
        sprite.userData.baseY = 0.72;
        sprite.userData.baseScaleX = 1.4;
        sprite.userData.baseScaleY = 1.05;
        sprite.userData.speed = 0.1 + (phase % 0.3) * 0.08;
        sprite.userData.phase = THREE.MathUtils.euclideanModulo(phase, 1);
        sprite.userData.maxOpacity = 0.16;
        this.steamWisps.push(sprite);
        return sprite;
    }
    createSteamTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');
        if (context) {
            const gradient = context.createRadialGradient(64, 72, 6, 64, 64, 60);
            gradient.addColorStop(0, 'rgba(255,255,255,.8)');
            gradient.addColorStop(0.32, 'rgba(235,244,246,.42)');
            gradient.addColorStop(0.68, 'rgba(210,224,228,.13)');
            gradient.addColorStop(1, 'rgba(196,214,219,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 128, 128);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        return texture;
    }
    addStationSection(chunk, index, random) {
        const columnPositions = [];
        for (const side of [-1, 1]) {
            const platform = new THREE.Mesh(this.unitBox, this.mat.concrete);
            platform.scale.set(2.6, 0.42, 28.8);
            platform.position.set(side * 8.15, 0.2, 0);
            chunk.add(platform);
            const edge = new THREE.Mesh(this.unitBox, this.mat.warning);
            edge.scale.set(0.22, 0.035, 28.4);
            edge.position.set(side * 6.82, 0.44, 0);
            chunk.add(edge);
            const wall = new THREE.Mesh(this.unitBox, this.subwayWallMaterial ?? this.mat.concreteDark);
            wall.scale.set(0.34, 5.2, 29.6);
            wall.position.set(side * 10.15, 2.6, 0);
            chunk.add(wall);
            for (const z of [-11, -4, 4, 11])
                columnPositions.push({ x: side * 9, z });
        }
        const columns = new THREE.InstancedMesh(this.unitBox, this.mat.steel, columnPositions.length);
        const matrix = new THREE.Matrix4();
        columnPositions.forEach(({ x, z }, columnIndex) => {
            matrix.compose(new THREE.Vector3(x, 2.3, z), new THREE.Quaternion(), new THREE.Vector3(0.32, 4.6, 0.32));
            columns.setMatrixAt(columnIndex, matrix);
        });
        columns.instanceMatrix.needsUpdate = true;
        chunk.add(columns);
        const sign = this.createBillboard(index, 'CENTRAL STATION  •  A  C  E  7');
        sign.position.set(0, 0, -2);
        sign.rotation.y = 0;
        chunk.add(sign);
        if (random() > 0.35) {
            const train = this.createTrainCar(-1, index + 7);
            train.position.set(-6.38, 0.12, 5);
            chunk.add(train);
        }
    }
    addElevatedSection(chunk, index, random) {
        const lampPositions = [];
        for (const side of [-1, 1]) {
            const barrier = new THREE.Mesh(this.unitBox, this.mat.steel);
            barrier.scale.set(0.16, 1.2, 28.8);
            barrier.position.set(side * 8.6, 0.72, 0);
            chunk.add(barrier);
            for (const z of [-12, -6, 0, 6, 12])
                lampPositions.push({ x: side * 8.55, z });
        }
        const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), this.mat.redLight, lampPositions.length);
        const matrix = new THREE.Matrix4();
        lampPositions.forEach(({ x, z }, lampIndex) => {
            matrix.makeTranslation(x, 1.35, z);
            lamps.setMatrixAt(lampIndex, matrix);
        });
        lamps.instanceMatrix.needsUpdate = true;
        chunk.add(lamps);
        if (random() > 0.2)
            chunk.add(this.createBillboard(index, 'RUN HARD  •  OWN THE CITY'));
    }
    createGantry(index) {
        const group = new THREE.Group();
        // Side-mounted utility masts preserve railway detail without placing beams or
        // longitudinal wires across the camera's view of the runner.
        for (const side of [-1, 1]) {
            const post = new THREE.Mesh(this.unitBox, this.mat.darkMetal);
            post.scale.set(0.22, 6.4, 0.22);
            post.position.set(side * 8.65, 3.2, 0);
            group.add(post);
            const arm = new THREE.Mesh(this.unitBox, this.mat.darkMetal);
            arm.scale.set(1.35, 0.16, 0.16);
            arm.position.set(side * 9.15, 6.15, 0);
            group.add(arm);
            const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.42, 8), this.mat.steel);
            insulator.position.set(side * 9.72, 5.84, 0);
            group.add(insulator);
        }
        group.position.z = index % 2 === 0 ? -8 : 8;
        return group;
    }
    createTrainCar(side, variant) {
        const group = new THREE.Group();
        group.name = 'RainPolishedMetroCar';
        const undercarriage = new THREE.Mesh(this.unitBox, this.mat.darkMetal);
        undercarriage.scale.set(1.92, 0.38, 12.65);
        undercarriage.position.y = 0.38;
        group.add(undercarriage);
        const body = new THREE.Mesh(this.unitBox, this.mat.trainBody);
        body.scale.set(2.25, 2.55, 13.4);
        body.position.y = 1.65;
        body.castShadow = !this.mobile;
        group.add(body);
        const roof = new THREE.Mesh(this.unitBox, this.mat.darkMetal);
        roof.scale.set(2.15, 0.24, 12.9);
        roof.position.y = 3.02;
        group.add(roof);
        const stripe = new THREE.Mesh(this.unitBox, variant % 2 === 0 ? this.mat.trainAccent : this.mat.warning);
        stripe.scale.set(2.29, 0.18, 13.25);
        stripe.position.set(0, 1.55, 0);
        group.add(stripe);
        const windowZ = [-5.3, -3.45, -1.6, 0.25, 2.1, 3.95, 5.8];
        const windows = new THREE.InstancedMesh(this.unitBox, variant % 3 === 0 ? this.mat.warmWindow : this.mat.window, windowZ.length);
        const matrix = new THREE.Matrix4();
        windowZ.forEach((z, windowIndex) => {
            matrix.compose(new THREE.Vector3(-side * 1.145, 2.15, z), new THREE.Quaternion(), new THREE.Vector3(0.055, 0.72, 1.02));
            windows.setMatrixAt(windowIndex, matrix);
        });
        windows.instanceMatrix.needsUpdate = true;
        group.add(windows);
        const doorZ = [-4.36, -0.68, 3.02];
        const doors = new THREE.InstancedMesh(this.unitBox, this.mat.darkMetal, doorZ.length);
        doorZ.forEach((z, doorIndex) => {
            matrix.compose(new THREE.Vector3(-side * 1.145, 1.56, z), new THREE.Quaternion(), new THREE.Vector3(0.055, 1.82, 1.12));
            doors.setMatrixAt(doorIndex, matrix);
        });
        doors.instanceMatrix.needsUpdate = true;
        group.add(doors);
        for (const end of [-1, 1]) {
            const endGlass = new THREE.Mesh(this.unitBox, variant % 2 === 0 ? this.mat.window : this.mat.warmWindow);
            endGlass.scale.set(1.42, 0.72, 0.055);
            endGlass.position.set(0, 2.14, end * 6.725);
            group.add(endGlass);
            for (const x of [-0.64, 0.64]) {
                const lamp = new THREE.Mesh(this.beaconGeometry, end > 0 ? this.mat.redLight : this.mat.amberLight);
                lamp.scale.set(0.16, 0.11, 0.09);
                lamp.position.set(x, 1.35, end * 6.76);
                group.add(lamp);
            }
        }
        const roofVentZ = [-4.6, -1.55, 1.55, 4.6];
        const vents = new THREE.InstancedMesh(this.unitBox, this.mat.steel, roofVentZ.length);
        roofVentZ.forEach((z, ventIndex) => {
            matrix.compose(new THREE.Vector3(0, 3.2, z), new THREE.Quaternion(), new THREE.Vector3(1.25, 0.14, 0.72));
            vents.setMatrixAt(ventIndex, matrix);
        });
        vents.instanceMatrix.needsUpdate = true;
        group.add(vents);
        return group;
    }
    createBillboard(index, text) {
        const group = new THREE.Group();
        const side = index % 2 === 0 ? -1 : 1;
        const pole = new THREE.Mesh(this.unitBox, this.mat.darkMetal);
        pole.scale.set(0.2, 4.1, 0.2);
        pole.position.y = 2.05;
        group.add(pole);
        const accent = index % 2 === 0 ? '#28e6ef' : '#ffb536';
        const cacheKey = `${text}|${accent}`;
        let panelMat = this.billboardMaterials.get(cacheKey);
        if (!panelMat) {
            const texture = this.createTextTexture(text, accent);
            panelMat = new THREE.MeshStandardMaterial({
                map: texture,
                emissiveMap: texture,
                emissive: 0xffffff,
                emissiveIntensity: 0.85,
                roughness: 0.3,
                metalness: 0.08,
            });
            this.billboardMaterials.set(cacheKey, panelMat);
        }
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 1.65), panelMat);
        panel.position.y = 4.55;
        group.add(panel);
        group.position.set(side * 11.5, 0, 0);
        group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        return group;
    }
    createTextTexture(text, accent) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 160;
        const context = canvas.getContext('2d');
        if (!context)
            return new THREE.CanvasTexture(canvas);
        context.fillStyle = '#10252e';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = accent;
        context.lineWidth = 6;
        context.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
        const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, accent);
        gradient.addColorStop(1, '#f4fdff');
        context.fillStyle = gradient;
        context.font = 'italic 800 36px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    }
    async loadBackground() {
        try {
            const texture = await new THREE.TextureLoader().loadAsync('./textures/city-skyline-after-rain-v11.webp');
            texture.name = 'DocumentMatchedAfterRainSkyline';
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            this.scene.background = texture;
            this.scene.backgroundBlurriness = 0;
            this.scene.backgroundIntensity = this.quality === 'performance' ? 0.78 : 0.9;
        }
        catch (error) {
            console.warn('Document-matched city skyline unavailable.', error);
            try {
                const fallback = await new THREE.TextureLoader().loadAsync('./textures/foreground-sky-v9.webp');
                fallback.colorSpace = THREE.SRGBColorSpace;
                this.scene.background = fallback;
            }
            catch {
                this.scene.background = new THREE.Color(0x2d4351);
            }
        }
    }
    async loadExternalWithTimeout(url, timeoutMs) {
        return Promise.race([
            this.assets.loadExternal(url),
            new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
        ]);
    }
    normalizeTemplate(root) {
        const wrapper = new THREE.Group();
        root.updateMatrixWorld(true);
        const initial = new THREE.Box3().setFromObject(root);
        const size = initial.getSize(new THREE.Vector3());
        root.scale.multiplyScalar(size.y > 0.001 ? 1 / size.y : 1);
        root.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(root);
        const center = bounds.getCenter(new THREE.Vector3());
        root.position.x -= center.x;
        root.position.z -= center.z;
        root.position.y -= bounds.min.y;
        wrapper.add(root);
        return wrapper;
    }
    enhanceImportedModel(root, kind) {
        root.traverse((node) => {
            if (!(node instanceof THREE.Mesh))
                return;
            node.castShadow = false;
            node.receiveShadow = true;
            node.frustumCulled = true;
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            node.material = materials.map((source) => {
                if (!(source instanceof THREE.MeshStandardMaterial))
                    return source;
                const material = source.clone();
                if (material.map) {
                    material.map.colorSpace = THREE.SRGBColorSpace;
                    material.map.minFilter = THREE.LinearMipmapLinearFilter;
                    material.map.magFilter = THREE.LinearFilter;
                }
                material.envMapIntensity = kind === 'building' ? 0.95 : 0.72;
                material.roughness = Math.max(kind === 'foliage' ? 0.78 : 0.42, material.roughness);
                if (kind === 'building')
                    material.color.lerp(new THREE.Color(0xd6dde0), 0.16);
                if (kind === 'foliage')
                    material.color.lerp(new THREE.Color(0x3e8050), 0.28);
                material.needsUpdate = true;
                return material;
            });
            if (node.material instanceof Array && node.material.length === 1)
                node.material = node.material[0] ?? node.material;
        });
    }
    freezeStaticChildren(root) {
        root.traverse((node) => {
            if (node === root)
                return;
            if (node.userData.dynamicEnvironment)
                return;
            node.updateMatrix();
            node.matrixAutoUpdate = false;
        });
    }
    readQuality() {
        const value = localStorage.getItem('shredrunner-quality');
        return value === 'performance' || value === 'cinematic' ? value : 'balanced';
    }
    seededRandom(seed) {
        let value = seed >>> 0;
        return () => {
            value += 0x6D2B79F5;
            let t = value;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
}
