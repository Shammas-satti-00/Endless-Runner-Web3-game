import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const PLAYER_URL = './models/athlete-run-optimized.glb';
export class AssetManager {
    loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    models = new Map();
    externalModels = new Map();
    tokenTemplate = null;
    async loadAll(onProgress) {
        const total = 2;
        let loaded = 0;
        try {
            const [player, runnerRoughness] = await Promise.all([
                this.loadUrl(PLAYER_URL, true),
                new THREE.TextureLoader().loadAsync('./textures/runner-roughness.webp').catch(() => null),
            ]);
            if (runnerRoughness) {
                runnerRoughness.flipY = false;
                runnerRoughness.minFilter = THREE.LinearMipmapLinearFilter;
                runnerRoughness.magFilter = THREE.LinearFilter;
            }
            player.root.traverse((node) => {
                if (!(node instanceof THREE.Mesh))
                    return;
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                for (const material of materials) {
                    if (!(material instanceof THREE.MeshStandardMaterial))
                        continue;
                    if (runnerRoughness)
                        material.roughnessMap = runnerRoughness;
                    material.needsUpdate = true;
                }
            });
            this.models.set('player', player);
        }
        catch (error) {
            console.warn('Player model failed to load; a lightweight fallback will be used.', error);
        }
        finally {
            onProgress?.(++loaded, total);
        }
        this.tokenTemplate = this.createRushCoin();
        onProgress?.(++loaded, total);
    }
    instantiate(key) {
        if (key === 'token') {
            return {
                root: (this.tokenTemplate ?? this.createRushCoin()).clone(true),
                animations: [],
                sourceUrl: null,
            };
        }
        const source = this.models.get(key);
        if (!source) {
            return { root: this.createFallbackPlayer(), animations: [], sourceUrl: null };
        }
        return {
            root: cloneSkeleton(source.root),
            animations: source.animations.map((clip) => clip.clone()),
            sourceUrl: source.sourceUrl,
        };
    }
    async loadExternal(url) {
        const cached = this.externalModels.get(url);
        if (cached)
            return cached;
        const request = this.loadUrl(url, false).catch((error) => {
            console.warn(`External model failed to load: ${url}`, error);
            return null;
        });
        this.externalModels.set(url, request);
        return request;
    }
    cloneLoaded(model) {
        return cloneSkeleton(model.root);
    }
    async loadUrl(url, animated) {
        const gltf = await this.loader.loadAsync(url);
        const root = gltf.scene;
        root.traverse((node) => {
            if (!(node instanceof THREE.Mesh))
                return;
            node.castShadow = animated;
            node.receiveShadow = true;
            node.frustumCulled = true;
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            for (const material of materials) {
                if (!(material instanceof THREE.MeshStandardMaterial))
                    continue;
                if (material.map)
                    material.map.colorSpace = THREE.SRGBColorSpace;
                material.envMapIntensity = animated ? 1.0 : 0.85;
                material.needsUpdate = true;
            }
        });
        return { root, animations: gltf.animations, sourceUrl: url };
    }
    createRushCoin() {
        const group = new THREE.Group();
        group.name = 'OptimizedRushCoin';
        const gold = new THREE.MeshPhysicalMaterial({
            color: 0xffc328,
            emissive: 0x8e4800,
            emissiveIntensity: 0.9,
            metalness: 0.92,
            roughness: 0.2,
            clearcoat: 0.65,
            clearcoatRoughness: 0.16,
            envMapIntensity: 1.35,
        });
        const glow = new THREE.MeshBasicMaterial({
            color: 0xffbe25,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const bodyGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20, 1, false);
        bodyGeometry.rotateX(Math.PI / 2);
        const rimGeometry = new THREE.TorusGeometry(0.39, 0.045, 7, 20);
        const innerGeometry = new THREE.TorusGeometry(0.29, 0.018, 6, 18);
        innerGeometry.translate(0, 0, 0.067);
        const solidGeometry = mergeGeometries([bodyGeometry, rimGeometry, innerGeometry], false);
        const solid = new THREE.Mesh(solidGeometry ?? bodyGeometry, gold);
        solid.castShadow = false;
        group.add(solid);
        const markTexture = this.createCoinMarkTexture();
        const markMaterial = new THREE.MeshBasicMaterial({ map: markTexture, transparent: true, depthWrite: false, toneMapped: false });
        const frontMark = new THREE.PlaneGeometry(0.5, 0.5);
        frontMark.translate(0, 0, 0.069);
        const backMark = new THREE.PlaneGeometry(0.5, 0.5);
        backMark.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.PI));
        backMark.translate(0, 0, -0.069);
        const markGeometry = mergeGeometries([frontMark, backMark], false);
        group.add(new THREE.Mesh(markGeometry ?? frontMark, markMaterial));
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.025, 6, 24), glow);
        halo.position.z = -0.01;
        group.add(halo);
        group.scale.setScalar(1.08);
        return group;
    }
    createCoinMarkTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        if (context) {
            context.clearRect(0, 0, 256, 256);
            context.fillStyle = '#fff3b0';
            context.shadowColor = '#ff8a00';
            context.shadowBlur = 18;
            context.font = '900 160px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('S', 128, 139);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        return texture;
    }
    createFallbackPlayer() {
        const group = new THREE.Group();
        const standard = (color, metalness = 0.05, roughness = 0.72) => new THREE.MeshStandardMaterial({ color, metalness, roughness, flatShading: true });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.05, 5, 10), standard(0x94fff0, 0.15, 0.4));
        body.position.y = 1.05;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), standard(0xd8fffb, 0.08, 0.35));
        head.position.set(0, 1.92, 0.02);
        group.add(head);
        return group;
    }
}
