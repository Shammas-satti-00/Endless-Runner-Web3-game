import * as THREE from 'three';
const TOY_CAR_REMOTE = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ToyCar/glTF-Binary/ToyCar.glb';
const TOY_CAR_LOCAL = './models/cc0/ToyCar.glb';
export class ObstacleFactory {
    templates = new Map();
    textureLoader = new THREE.TextureLoader();
    concreteMap = this.textureLoader.load('./textures/weathered-concrete.webp');
    stripeMap = this.textureLoader.load('./textures/roadwork-stripes-weathered-v11.webp');
    constructor() {
        this.concreteMap.colorSpace = THREE.SRGBColorSpace;
        this.stripeMap.colorSpace = THREE.SRGBColorSpace;
        this.concreteMap.wrapS = this.concreteMap.wrapT = THREE.MirroredRepeatWrapping;
        this.stripeMap.wrapS = this.stripeMap.wrapT = THREE.MirroredRepeatWrapping;
        this.stripeMap.repeat.set(2.4, 1);
        this.concreteMap.anisotropy = 4;
        this.stripeMap.anisotropy = 4;
        this.concreteMap.minFilter = THREE.LinearMipmapLinearFilter;
        this.stripeMap.minFilter = THREE.LinearMipmapLinearFilter;
        this.templates.set('barrier', this.buildBarrier());
        this.templates.set('blocker', this.buildBlocker());
        this.templates.set('gate', this.buildGate());
        this.templates.set('vehicle', this.buildVehicleFallback());
        this.templates.set('overhead', this.buildOverheadBarrier());
    }
    async init(assets) {
        if (matchMedia('(pointer: coarse)').matches || innerWidth < 720)
            return;
        const localEnabled = import.meta.env.VITE_VENDOR_ASSETS === 'true';
        let model = null;
        if (localEnabled)
            model = await this.withTimeout(assets.loadExternal(TOY_CAR_LOCAL), 1800);
        if (!model && import.meta.env.VITE_REMOTE_ASSETS === 'true') {
            model = await this.withTimeout(assets.loadExternal(TOY_CAR_REMOTE), 5200);
        }
        if (model)
            this.templates.set('vehicle', this.buildVehicleFromModel(assets.cloneLoaded(model)));
    }
    create(kind) {
        const template = this.templates.get(kind);
        if (!template)
            throw new Error(`Unknown obstacle kind: ${kind}`);
        return { root: template.root.clone(true), halfSize: template.halfSize.clone(), collisionCenterY: template.collisionCenterY, kind };
    }
    buildBarrier() {
        const root = new THREE.Group();
        root.name = 'RealisticRoadworkBarrier';
        const steel = new THREE.MeshPhysicalMaterial({ color: 0x353e43, metalness: 0.82, roughness: 0.32, clearcoat: 0.34, clearcoatRoughness: 0.28, envMapIntensity: 1.18 });
        const concrete = new THREE.MeshStandardMaterial({ map: this.concreteMap, color: 0xaaa9a4, roughness: 0.92, metalness: 0.015 });
        const stripe = new THREE.MeshPhysicalMaterial({ map: this.stripeMap, color: 0xd7d0c4, roughness: 0.47, metalness: 0.06, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 1.06 });
        const amber = new THREE.MeshStandardMaterial({ color: 0xffc04a, emissive: 0xff6800, emissiveIntensity: 3.1, roughness: 0.23 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x171b1d, roughness: 0.9, metalness: 0.08 });
        const rust = new THREE.MeshStandardMaterial({ color: 0x6c3928, metalness: 0.45, roughness: 0.72 });
        for (const x of [-0.76, 0.76]) {
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.76), concrete);
            foot.position.set(x, 0.09, 0);
            root.add(foot);
            const rubberPad = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.055, 0.82), dark);
            rubberPad.position.set(x, 0.028, 0);
            root.add(rubberPad);
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), steel);
            post.position.set(x, 0.7, 0);
            root.add(post);
            const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), rust);
            brace.position.set(x - Math.sign(x) * 0.19, 0.5, 0.12);
            brace.rotation.z = Math.sign(x) * 0.48;
            root.add(brace);
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.46, 0.17), stripe);
        beam.position.y = 0.82;
        root.add(beam);
        for (const x of [-0.93, 0.93]) {
            const edgeCap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.21), steel);
            edgeCap.position.set(x, 0.82, 0);
            root.add(edgeCap);
        }
        for (const x of [-0.68, -0.23, 0.23, 0.68]) {
            const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.035, 8), rust);
            bolt.rotation.x = Math.PI / 2;
            bolt.position.set(x, 0.82, 0.105);
            root.add(bolt);
        }
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.1), steel);
        topRail.position.y = 1.16;
        root.add(topRail);
        for (const x of [-0.62, 0.62]) {
            const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 12), dark);
            housing.rotation.x = Math.PI / 2;
            housing.position.set(x, 1.28, 0.04);
            root.add(housing);
            const light = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8), amber);
            light.position.set(x, 1.28, 0.12);
            root.add(light);
        }
        this.prepare(root);
        return { root, halfSize: new THREE.Vector3(0.98, 0.68, 0.42), collisionCenterY: 0.68, kind: 'barrier' };
    }
    buildBlocker() {
        const root = new THREE.Group();
        root.name = 'WeatheredJerseyBarrierAndConeCluster';
        const concrete = new THREE.MeshStandardMaterial({ map: this.concreteMap, color: 0xa9aaa6, roughness: 0.94, metalness: 0.01, envMapIntensity: 0.52 });
        const orange = new THREE.MeshPhysicalMaterial({ color: 0xce531f, roughness: 0.5, clearcoat: 0.24, clearcoatRoughness: 0.36 });
        const white = new THREE.MeshPhysicalMaterial({ color: 0xd8d1c4, roughness: 0.57, clearcoat: 0.18, clearcoatRoughness: 0.4 });
        const rubber = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.98 });
        const stripe = new THREE.MeshPhysicalMaterial({ map: this.stripeMap, color: 0xd2c8bb, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.36 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.22, 0.74), concrete);
        base.position.y = 0.11;
        root.add(base);
        const lower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 0.58), concrete);
        lower.position.y = 0.4;
        root.add(lower);
        const upper = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.62, 0.34), concrete);
        upper.position.y = 0.9;
        root.add(upper);
        const warningPanel = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.25, 0.035), stripe);
        warningPanel.position.set(0, 0.92, 0.188);
        root.add(warningPanel);
        for (const x of [-0.57, 0.57]) {
            const cone = new THREE.Group();
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.48), rubber);
            base.position.y = 0.035;
            cone.add(base);
            const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.23, 0.66, 14), orange);
            lower.position.y = 0.39;
            cone.add(lower);
            const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.17, 0.14, 14), white);
            band.position.y = 0.45;
            cone.add(band);
            cone.position.set(x, 0, 0.55);
            cone.rotation.z = x < 0 ? -0.04 : 0.05;
            root.add(cone);
        }
        const reflectorMaterial = new THREE.MeshStandardMaterial({ color: 0xffefb1, emissive: 0xff8a00, emissiveIntensity: 1.8, roughness: 0.22 });
        for (const x of [-0.34, 0.34]) {
            const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.025), reflectorMaterial);
            reflector.position.set(x, 1.18, 0.185);
            root.add(reflector);
        }
        this.prepare(root);
        return { root, halfSize: new THREE.Vector3(0.82, 0.71, 0.67), collisionCenterY: 0.71, kind: 'blocker' };
    }
    buildGate() {
        const root = new THREE.Group();
        root.name = 'WeatheredMaintenanceGate';
        const yellow = new THREE.MeshPhysicalMaterial({ color: 0xb97822, metalness: 0.36, roughness: 0.46, clearcoat: 0.27, clearcoatRoughness: 0.34 });
        const steel = new THREE.MeshPhysicalMaterial({ color: 0x30383d, metalness: 0.82, roughness: 0.31, clearcoat: 0.24, clearcoatRoughness: 0.32, envMapIntensity: 1.16 });
        const stripe = new THREE.MeshPhysicalMaterial({ map: this.stripeMap, roughness: 0.49, color: 0xd5cec1, clearcoat: 0.24, clearcoatRoughness: 0.34 });
        const amber = new THREE.MeshStandardMaterial({ color: 0xffd176, emissive: 0xff7b00, emissiveIntensity: 2.8, roughness: 0.2 });
        for (const x of [-0.8, 0.8]) {
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.7), steel);
            base.position.set(x, 0.08, 0);
            root.add(base);
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.58, 0.15), yellow);
            post.position.set(x, 0.87, 0);
            root.add(post);
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 7), amber);
            lamp.position.set(x, 1.7, 0.1);
            root.add(lamp);
        }
        const lowBar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.2), stripe);
        lowBar.position.y = 0.72;
        root.add(lowBar);
        const meshPanel = new THREE.Mesh(
            new THREE.PlaneGeometry(1.45, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x354147, transparent: true, opacity: 0.2, metalness: 0.74, roughness: 0.42, side: THREE.DoubleSide }),
        );
        meshPanel.position.set(0, 1.22, 0.025);
        root.add(meshPanel);
        for (const x of [-0.58, -0.29, 0, 0.29, 0.58]) {
            const rod = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.52, 0.035), steel);
            rod.position.set(x, 1.22, 0.045);
            root.add(rod);
        }
        for (const y of [1.04, 1.22, 1.4]) {
            const rod = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.025, 0.035), steel);
            rod.position.set(0, y, 0.048);
            root.add(rod);
        }
        this.prepare(root);
        return { root, halfSize: new THREE.Vector3(0.97, 0.82, 0.4), collisionCenterY: 0.82, kind: 'gate' };
    }
    buildOverheadBarrier() {
        const root = new THREE.Group();
        root.name = 'SlideUnderMaintenanceBeam';
        const steel = new THREE.MeshPhysicalMaterial({ color: 0x343d42, metalness: 0.84, roughness: 0.32, clearcoat: 0.28, clearcoatRoughness: 0.3, envMapIntensity: 1.18 });
        const yellow = new THREE.MeshPhysicalMaterial({ color: 0xb87922, metalness: 0.28, roughness: 0.47, clearcoat: 0.23, clearcoatRoughness: 0.35 });
        const stripe = new THREE.MeshPhysicalMaterial({ map: this.stripeMap, color: 0xd5cec1, roughness: 0.48, metalness: 0.05, clearcoat: 0.27, clearcoatRoughness: 0.34 });
        const red = new THREE.MeshStandardMaterial({ color: 0xff7064, emissive: 0xff271d, emissiveIntensity: 3.1, roughness: 0.19 });
        for (const x of [-1.08, 1.08]) {
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.68), steel);
            foot.position.set(x, 0.065, 0);
            root.add(foot);
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 2.76, 0.13), yellow);
            post.position.set(x, 1.38, 0);
            root.add(post);
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), red);
            lamp.position.set(x, 2.76, 0.1);
            root.add(lamp);
            const brace = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.88, 0.09), steel);
            brace.position.set(x - Math.sign(x) * 0.24, 2.25, 0.02);
            brace.rotation.z = Math.sign(x) * 0.62;
            root.add(brace);
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.42, 0.24), stripe);
        beam.position.y = 2.07;
        root.add(beam);
        for (const x of [-0.72, 0, 0.72]) {
            const reflector = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.028, 10), red);
            reflector.rotation.x = Math.PI / 2;
            reflector.position.set(x, 2.07, 0.145);
            root.add(reflector);
        }
        const upperRail = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.1, 0.12), steel);
        upperRail.position.y = 2.38;
        root.add(upperRail);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.3, 0.08), yellow);
        sign.position.set(0, 2.5, 0.08);
        root.add(sign);
        this.prepare(root);
        // Only the suspended beam is collidable. A standing runner hits it; a sliding runner fits underneath.
        return { root, halfSize: new THREE.Vector3(1.11, 0.31, 0.34), collisionCenterY: 2.07, kind: 'overhead' };
    }
    buildVehicleFromModel(modelRoot) {
        const root = new THREE.Group();
        modelRoot.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(modelRoot);
        const size = bounds.getSize(new THREE.Vector3());
        const target = new THREE.Vector3(1.62, 1.18, 2.75);
        modelRoot.scale.set(size.x > 0 ? target.x / size.x : 1, size.y > 0 ? target.y / size.y : 1, size.z > 0 ? target.z / size.z : 1);
        modelRoot.updateMatrixWorld(true);
        const fitted = new THREE.Box3().setFromObject(modelRoot);
        const center = fitted.getCenter(new THREE.Vector3());
        modelRoot.position.set(-center.x, -fitted.min.y, -center.z);
        modelRoot.rotation.y = Math.PI;
        modelRoot.traverse((node) => {
            if (!(node instanceof THREE.Mesh))
                return;
            node.castShadow = true;
            node.receiveShadow = true;
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            for (const material of materials) {
                if (!(material instanceof THREE.MeshStandardMaterial))
                    continue;
                material.envMapIntensity = 1.3;
                material.needsUpdate = true;
            }
        });
        root.add(modelRoot);
        this.addVehicleLights(root);
        this.prepare(root);
        return { root, halfSize: new THREE.Vector3(0.84, 0.64, 1.42), collisionCenterY: 0.64, kind: 'vehicle' };
    }
    buildVehicleFallback() {
        const root = new THREE.Group();
        root.name = 'WetPBRMaintenanceVehicle';
        const paint = new THREE.MeshPhysicalMaterial({ color: 0x2c5969, metalness: 0.58, roughness: 0.24, clearcoat: 0.82, clearcoatRoughness: 0.16, envMapIntensity: 1.28 });
        const glass = new THREE.MeshPhysicalMaterial({ color: 0x608798, metalness: 0.04, roughness: 0.08, transmission: 0.12, transparent: true, opacity: 0.88, clearcoat: 0.82, clearcoatRoughness: 0.12 });
        const rubber = new THREE.MeshStandardMaterial({ color: 0x111416, roughness: 0.95 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xb8c0c3, metalness: 0.94, roughness: 0.2, envMapIntensity: 1.24 });
        const amber = new THREE.MeshStandardMaterial({ color: 0xffb847, emissive: 0xff6200, emissiveIntensity: 2.9, roughness: 0.22 });
        const lower = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.45, 2.45), paint);
        lower.position.y = 0.48;
        root.add(lower);
        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.28, 0.75), paint);
        hood.position.set(0, 0.79, -0.78);
        hood.rotation.x = -0.05;
        root.add(hood);
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.58, 1.02), glass);
        cabin.position.set(0, 1.03, 0.18);
        root.add(cabin);
        const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.09, 1.12), paint);
        cabinRoof.position.set(0, 1.37, 0.18);
        root.add(cabinRoof);
        const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), chrome);
        bumper.position.set(0, 0.32, -1.27);
        root.add(bumper);
        const rearBumper = bumper.clone();
        rearBumper.position.z = 1.27;
        root.add(rearBumper);
        for (const x of [-0.74, 0.74]) {
            const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.035), chrome);
            mirrorArm.position.set(x, 1.16, -0.26);
            root.add(mirrorArm);
            const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.06), rubber);
            mirror.position.set(x + Math.sign(x) * 0.08, 1.16, -0.26);
            root.add(mirror);
        }
        for (const z of [-0.18, 0.5]) {
            const rack = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.06, 0.06), chrome);
            rack.position.set(0, 1.47, z);
            root.add(rack);
        }
        const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.08, 12), rubber);
        beaconBase.position.set(0, 1.49, 0.16);
        root.add(beaconBase);
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.15, 12), amber);
        beacon.position.set(0, 1.6, 0.16);
        root.add(beacon);
        for (const x of [-0.77, 0.77])
            for (const z of [-0.77, 0.75]) {
                const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 16), rubber);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(x, 0.32, z);
                root.add(wheel);
                const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.205, 12), chrome);
                hub.rotation.z = Math.PI / 2;
                hub.position.set(x, 0.32, z);
                root.add(hub);
            }
        this.addVehicleLights(root);
        this.prepare(root);
        return { root, halfSize: new THREE.Vector3(0.82, 0.72, 1.3), collisionCenterY: 0.72, kind: 'vehicle' };
    }
    addVehicleLights(root) {
        const white = new THREE.MeshStandardMaterial({ color: 0xfff5cf, emissive: 0xffd36a, emissiveIntensity: 2.15, roughness: 0.18 });
        const red = new THREE.MeshStandardMaterial({ color: 0xff6b5d, emissive: 0xff1e16, emissiveIntensity: 1.8 });
        for (const x of [-0.46, 0.46]) {
            const front = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 0.04), white);
            front.position.set(x, 0.62, -1.39);
            root.add(front);
            const rear = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.04), red);
            rear.position.set(x, 0.62, 1.39);
            root.add(rear);
        }
    }
    prepare(root) {
        root.traverse((node) => {
            if (!(node instanceof THREE.Mesh))
                return;
            node.geometry.computeBoundingBox();
            const bounds = node.geometry.boundingBox;
            const size = bounds?.getSize(new THREE.Vector3());
            node.castShadow = !!size && Math.max(size.x, size.y, size.z) >= 0.24;
            node.receiveShadow = true;
            node.frustumCulled = true;
        });
    }
    async withTimeout(request, timeoutMs) {
        return Promise.race([request, new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
    }
}
