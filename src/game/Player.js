import * as THREE from 'three';
import { CONFIG } from '../config';
const IDENTITY_QUATERNION = new THREE.Quaternion();
const SLIDE_POSE = [
    { name: 'Hips', rotation: [-0.18, 0, 0] },
    { name: 'Spine', rotation: [-0.24, 0, 0] },
    { name: 'Spine01', rotation: [-0.2, 0, 0] },
    { name: 'Spine02', rotation: [-0.14, 0, 0] },
    { name: 'Neck', rotation: [0.16, 0, 0] },
    { name: 'LeftArm', rotation: [0.42, 0.08, 0.22] },
    { name: 'RightArm', rotation: [0.34, -0.08, -0.22] },
    { name: 'LeftForeArm', rotation: [-0.48, 0, -0.08] },
    { name: 'RightForeArm', rotation: [-0.42, 0, 0.08] },
    { name: 'LeftUpLeg', rotation: [0.74, 0.06, -0.04] },
    { name: 'RightUpLeg', rotation: [0.68, -0.06, 0.04] },
    { name: 'LeftLeg', rotation: [-1.04, 0, 0] },
    { name: 'RightLeg', rotation: [-0.96, 0, 0] },
    { name: 'LeftFoot', rotation: [0.32, 0, 0] },
    { name: 'RightFoot', rotation: [0.28, 0, 0] },
];
const JUMP_POSE = [
    { name: 'Hips', rotation: [-0.08, 0, 0] },
    { name: 'Spine', rotation: [0.1, 0, 0] },
    { name: 'LeftArm', rotation: [-0.34, 0.08, 0.13] },
    { name: 'RightArm', rotation: [0.27, -0.08, -0.13] },
    { name: 'LeftUpLeg', rotation: [0.42, 0.04, 0] },
    { name: 'RightUpLeg', rotation: [-0.24, -0.04, 0] },
    { name: 'LeftLeg', rotation: [-0.48, 0, 0] },
    { name: 'RightLeg', rotation: [-0.18, 0, 0] },
];
const FAST_FALL_POSE = [
    { name: 'Hips', rotation: [-0.18, 0, 0] },
    { name: 'Spine', rotation: [-0.16, 0, 0] },
    { name: 'LeftArm', rotation: [0.38, 0.06, 0.2] },
    { name: 'RightArm', rotation: [0.38, -0.06, -0.2] },
    { name: 'LeftUpLeg', rotation: [0.22, 0, 0] },
    { name: 'RightUpLeg', rotation: [0.22, 0, 0] },
    { name: 'LeftLeg', rotation: [-0.3, 0, 0] },
    { name: 'RightLeg', rotation: [-0.3, 0, 0] },
];
const LANDING_POSE = [
    { name: 'Hips', rotation: [-0.22, 0, 0] },
    { name: 'Spine', rotation: [-0.2, 0, 0] },
    { name: 'LeftUpLeg', rotation: [0.46, 0.04, 0] },
    { name: 'RightUpLeg', rotation: [0.46, -0.04, 0] },
    { name: 'LeftLeg', rotation: [-0.66, 0, 0] },
    { name: 'RightLeg', rotation: [-0.66, 0, 0] },
];
export class Player {
    root = new THREE.Group();
    visual;
    mixer;
    runAction;
    baseVisualScale = new THREE.Vector3(1, 1, 1);
    baseVisualPosition = new THREE.Vector3();
    poseBones = new Map();
    slidePoseRotations = new Map();
    jumpPoseRotations = new Map();
    fastFallPoseRotations = new Map();
    landingPoseRotations = new Map();
    poseQuaternion = new THREE.Quaternion();
    outfitMaterials = [];
    slideWakeMaterial = new THREE.MeshBasicMaterial({
        color: 0xc6dce1,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
    });
    slideWake = new THREE.Group();
    wetContactFx = new THREE.Group();
    sprayPositions = new Float32Array(48 * 3);
    sprayVelocities = Array.from({ length: 48 }, () => new THREE.Vector3());
    sprayLife = new Float32Array(48);
    sprayCursor = 0;
    sprayPoints = null;
    splashRings = [];
    stepIndex = -1;
    laneIndex = 1;
    verticalVelocity = 0;
    grounded = true;
    fastFalling = false;
    elapsed = 0;
    slideTimer = 0;
    sliding = false;
    slideWeight = 0;
    airborneWeight = 0;
    landingWeight = 0;
    fastFallWeight = 0;
    laneLean = 0;
    constructor(instance) {
        this.visual = instance.root;
        this.prepareVisual();
        this.preparePoseRig();
        this.baseVisualScale.copy(this.visual.scale);
        this.baseVisualPosition.copy(this.visual.position);
        this.createSlideWake();
        this.createWetContactFx();
        this.root.add(this.visual, this.slideWake, this.wetContactFx);
        if (instance.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.visual);
            const clip = instance.animations.find((item) => /run|sprint|jog/i.test(item.name)) ?? instance.animations[0] ?? null;
            this.runAction = clip ? this.mixer.clipAction(clip) : null;
            this.runAction?.setLoop(THREE.LoopRepeat, Infinity).play();
        }
        else {
            this.mixer = null;
            this.runAction = null;
        }
        this.root.position.set(CONFIG.lanes[this.laneIndex] ?? 0, CONFIG.playerGroundY, CONFIG.playerZ);
    }
    reset() {
        this.laneIndex = 1;
        this.verticalVelocity = 0;
        this.grounded = true;
        this.fastFalling = false;
        this.elapsed = 0;
        this.slideTimer = 0;
        this.sliding = false;
        this.slideWeight = 0;
        this.airborneWeight = 0;
        this.landingWeight = 0;
        this.fastFallWeight = 0;
        this.laneLean = 0;
        this.stepIndex = -1;
        this.root.position.set(CONFIG.lanes[this.laneIndex] ?? 0, CONFIG.playerGroundY, CONFIG.playerZ);
        this.root.rotation.set(0, 0, 0);
        this.visual.scale.copy(this.baseVisualScale);
        this.visual.position.copy(this.baseVisualPosition);
        this.visual.rotation.x = 0;
        this.slideWake.visible = false;
        this.slideWakeMaterial.opacity = 0;
        this.resetWetContactFx();
        this.runAction?.reset().play();
    }
    move(direction) {
        const next = Math.min(CONFIG.lanes.length - 1, Math.max(0, this.laneIndex + direction));
        if (next === this.laneIndex)
            return false;
        this.laneIndex = next;
        return true;
    }
    jump() {
        if (!this.grounded || this.sliding)
            return false;
        this.grounded = false;
        this.fastFalling = false;
        this.verticalVelocity = CONFIG.jumpVelocity;
        return true;
    }
    slide() {
        if (!this.grounded) {
            this.verticalVelocity = Math.min(this.verticalVelocity, -CONFIG.fastFallVelocity);
            this.fastFalling = true;
            return true;
        }
        if (this.sliding)
            return false;
        this.sliding = true;
        this.slideTimer = CONFIG.slideDuration;
        return true;
    }
    update(delta, speed) {
        this.elapsed += delta;
        const wasGrounded = this.grounded;
        if (this.slideTimer > 0) {
            this.slideTimer = Math.max(0, this.slideTimer - delta);
            this.sliding = this.slideTimer > 0;
        }
        else {
            this.sliding = false;
        }
        if (this.runAction) {
            this.runAction.paused = false;
            const runningRate = THREE.MathUtils.clamp(0.85 + speed * 0.018, 0.9, 1.85);
            const actionPose = Math.max(this.slideWeight, this.fastFallWeight * 0.72);
            this.runAction.timeScale = THREE.MathUtils.lerp(runningRate, runningRate * 0.34, actionPose);
        }
        this.mixer?.update(delta);
        const targetX = CONFIG.lanes[this.laneIndex] ?? 0;
        const blend = 1 - Math.exp(-CONFIG.laneResponsiveness * delta);
        const poseBlend = 1 - Math.exp(-22 * delta);
        const previousX = this.root.position.x;
        this.root.position.x = THREE.MathUtils.lerp(previousX, targetX, blend);
        const laneIntent = THREE.MathUtils.clamp((targetX - previousX) * -0.34, -0.38, 0.38);
        this.laneLean = THREE.MathUtils.damp(this.laneLean, laneIntent, 12, delta);
        this.root.rotation.z = THREE.MathUtils.damp(this.root.rotation.z, this.laneLean * 0.3, 13, delta);
        this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, -this.laneLean * 0.16, 12, delta);
        if (!this.grounded) {
            this.verticalVelocity -= CONFIG.gravity * delta;
            this.root.position.y += this.verticalVelocity * delta;
            if (this.root.position.y <= CONFIG.playerGroundY) {
                this.root.position.y = CONFIG.playerGroundY;
                this.verticalVelocity = 0;
                this.grounded = true;
                this.fastFalling = false;
            }
        }
        else {
            this.root.position.y = CONFIG.playerGroundY + (this.mixer || this.sliding ? 0 : Math.abs(Math.sin(this.elapsed * 11)) * 0.07);
        }
        if (!wasGrounded && this.grounded) {
            this.landingWeight = 1;
            this.emitSplash(18, speed, 1);
            this.emitSplashRing(1);
        }
        else {
            this.landingWeight = THREE.MathUtils.damp(this.landingWeight, 0, 9.5, delta);
        }
        const targetSlideWeight = this.slidePoseTarget();
        const targetFastFallWeight = this.fastFalling && !this.grounded ? 1 : 0;
        const targetAirborneWeight = this.grounded ? 0 : 1;
        this.slideWeight = THREE.MathUtils.damp(this.slideWeight, targetSlideWeight, 28, delta);
        this.airborneWeight = THREE.MathUtils.damp(this.airborneWeight, targetAirborneWeight, 12, delta);
        this.fastFallWeight = THREE.MathUtils.damp(this.fastFallWeight, targetFastFallWeight, 18, delta);
        const actionPose = Math.max(this.slideWeight, this.fastFallWeight * 0.62, this.landingWeight * 0.34);
        const targetScaleX = this.baseVisualScale.x * (1 + this.slideWeight * 0.01);
        const targetScaleY = this.baseVisualScale.y * (1 - this.slideWeight * 0.18 - this.fastFallWeight * 0.025 - this.landingWeight * 0.04);
        const targetScaleZ = this.baseVisualScale.z * (1 + this.slideWeight * 0.02);
        this.visual.scale.x = THREE.MathUtils.lerp(this.visual.scale.x, targetScaleX, poseBlend);
        this.visual.scale.y = THREE.MathUtils.lerp(this.visual.scale.y, targetScaleY, poseBlend);
        this.visual.scale.z = THREE.MathUtils.lerp(this.visual.scale.z, targetScaleZ, poseBlend);
        this.visual.position.y = THREE.MathUtils.lerp(this.visual.position.y, this.baseVisualPosition.y + actionPose * 0.02, poseBlend);
        this.visual.position.z = THREE.MathUtils.lerp(this.visual.position.z, this.baseVisualPosition.z + this.slideWeight * 0.18, poseBlend);
        this.visual.rotation.x = THREE.MathUtils.lerp(this.visual.rotation.x, -this.slideWeight * 0.22 - this.fastFallWeight * 0.18, poseBlend);
        this.applyProceduralPose(
            this.slideWeight,
            this.airborneWeight * (1 - this.fastFallWeight),
            this.fastFallWeight,
            this.landingWeight,
        );
        const nextStepIndex = Math.floor(this.elapsed * (2.8 + speed * 0.045));
        if (this.grounded && !this.sliding && nextStepIndex !== this.stepIndex) {
            this.stepIndex = nextStepIndex;
            this.emitSplash(3, speed, 0.32);
        }
        else if (this.grounded && this.slideWeight > 0.28 && nextStepIndex !== this.stepIndex) {
            this.stepIndex = nextStepIndex;
            this.emitSplash(7, speed, 0.62);
        }
        this.updateSlideWake(speed);
        this.updateWetContactFx(delta, speed);
        const runTilt = this.slideWeight > 0.01 ? -0.24 * this.slideWeight : this.grounded ? 0 : -0.16 - this.fastFallWeight * 0.12;
        this.root.rotation.x = THREE.MathUtils.lerp(this.root.rotation.x, runTilt - this.landingWeight * 0.08, blend);
    }
    getBox(target = new THREE.Box3()) {
        const position = this.root.position;
        const crouch = THREE.MathUtils.smoothstep(this.slideWeight, 0.22, 0.72);
        const maxY = position.y + THREE.MathUtils.lerp(1.95, CONFIG.slideCollisionHeight, crouch);
        target.min.set(position.x - 0.43, position.y + 0.08, position.z - 0.32);
        target.max.set(position.x + 0.43, maxY, position.z + 0.32);
        return target;
    }
    isSliding() {
        return this.slideWeight > 0.45;
    }
    getSlideAmount() {
        return this.slideWeight;
    }
    prepareVisual() {
        this.visual.name = 'DocumentMatchedRealisticRunner';
        this.visual.rotation.y = Math.PI;
        this.visual.traverse((node) => {
            if (!(node instanceof THREE.Mesh))
                return;
            node.castShadow = true;
            node.receiveShadow = true;
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
                // The source GLB used its clothing atlas as a full-strength emissive map,
                // flattening the jacket, skin and sneaker detail. Keep the authored atlas,
                // but let the scene lights and environment provide the material response.
                material.color.set(0xffffff);
                material.emissive.set(0x000000);
                material.emissiveMap = null;
                material.emissiveIntensity = 0;
                material.roughness = 0.54;
                material.metalness = 0.025;
                material.envMapIntensity = 1.08;
                material.aoMapIntensity = 0.86;
                if (material.normalScale)
                    material.normalScale.set(0.86, 0.86);
                if (material instanceof THREE.MeshPhysicalMaterial) {
                    material.clearcoat = Math.max(material.clearcoat, 0.12);
                    material.clearcoatRoughness = 0.4;
                    material.specularIntensity = 0.62;
                    material.specularColor.set(0xc9e1e7);
                    material.sheen = 0.08;
                    material.sheenColor.set(0x6a7880);
                    material.sheenRoughness = 0.86;
                }
                material.side = THREE.FrontSide;
                material.dithering = true;
                material.userData.baseColor = material.color.clone();
                this.outfitMaterials.push(material);
                material.needsUpdate = true;
                return material;
            });
            if (Array.isArray(node.material) && node.material.length === 1)
                node.material = node.material[0] ?? node.material;
        });
        this.visual.updateMatrixWorld(true);
        const initialBounds = new THREE.Box3().setFromObject(this.visual);
        const size = initialBounds.getSize(new THREE.Vector3());
        const scale = size.y > 0.01 ? CONFIG.playerVisualHeight / size.y : 1;
        this.visual.scale.multiplyScalar(scale);
        this.visual.updateMatrixWorld(true);
        const fittedBounds = new THREE.Box3().setFromObject(this.visual);
        const center = fittedBounds.getCenter(new THREE.Vector3());
        this.visual.position.x -= center.x;
        this.visual.position.z -= center.z;
        this.visual.position.y -= fittedBounds.min.y;
    }
    preparePoseRig() {
        const bonesByName = new Map();
        this.visual.traverse((object) => {
            if (object instanceof THREE.Bone)
                bonesByName.set(object.name.toLowerCase(), object);
        });
        const poses = [
            [SLIDE_POSE, this.slidePoseRotations],
            [JUMP_POSE, this.jumpPoseRotations],
            [FAST_FALL_POSE, this.fastFallPoseRotations],
            [LANDING_POSE, this.landingPoseRotations],
        ];
        for (const [definitions, targetMap] of poses) {
            for (const definition of definitions) {
                const object = this.visual.getObjectByName(definition.name)
                    ?? bonesByName.get(definition.name.toLowerCase());
                if (!(object instanceof THREE.Bone))
                    continue;
                const [x, y, z] = definition.rotation;
                this.poseBones.set(definition.name, object);
                targetMap.set(definition.name, new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ')));
            }
        }
    }
    applyProceduralPose(slideWeight, jumpWeight, fastFallWeight, landingWeight) {
        const weight = Math.max(slideWeight, jumpWeight, fastFallWeight, landingWeight);
        if (weight <= 0.001)
            return;
        this.applyPose(this.slidePoseRotations, slideWeight);
        this.applyPose(this.jumpPoseRotations, jumpWeight * 0.72);
        this.applyPose(this.fastFallPoseRotations, fastFallWeight);
        this.applyPose(this.landingPoseRotations, landingWeight * 0.72);
        const hips = this.poseBones.get('Hips');
        if (hips) {
            hips.position.y -= 0.35 * slideWeight + 0.2 * landingWeight;
            hips.position.z += 0.22 * slideWeight;
        }
    }
    applyPose(rotations, weight) {
        if (weight <= 0.001)
            return;
        for (const [name, bone] of this.poseBones) {
            const target = rotations.get(name);
            if (!target)
                continue;
            this.poseQuaternion.slerpQuaternions(IDENTITY_QUATERNION, target, weight);
            bone.quaternion.multiply(this.poseQuaternion);
        }
    }
    slidePoseTarget() {
        if (this.slideTimer <= 0)
            return 0;
        const elapsed = CONFIG.slideDuration - this.slideTimer;
        const enterDuration = 0.14;
        const exitDuration = 0.2;
        if (elapsed < enterDuration)
            return this.smootherStep(elapsed / enterDuration);
        if (this.slideTimer < exitDuration)
            return this.smootherStep(this.slideTimer / exitDuration);
        return 1;
    }
    createSlideWake() {
        const geometry = new THREE.PlaneGeometry(0.28, 1.7);
        for (const x of [-0.28, 0.28]) {
            const streak = new THREE.Mesh(geometry, this.slideWakeMaterial);
            streak.rotation.x = -Math.PI / 2;
            streak.position.set(x, 0.018, 0.72);
            this.slideWake.add(streak);
        }
        this.slideWake.visible = false;
        this.slideWake.renderOrder = 2;
    }
    updateSlideWake(speed) {
        const visible = this.slideWeight > 0.025 && this.grounded;
        this.slideWake.visible = visible;
        if (!visible) {
            this.slideWakeMaterial.opacity = 0;
            return;
        }
        this.slideWakeMaterial.opacity = this.slideWeight * THREE.MathUtils.clamp(0.12 + speed * 0.0025, 0.14, 0.23);
        this.slideWake.scale.z = 0.78 + this.slideWeight * 0.48;
        this.slideWake.position.z = 0.08 + Math.sin(this.elapsed * 19) * 0.025;
    }
    createWetContactFx() {
        this.sprayPositions.fill(-50);
        const sprayGeometry = new THREE.BufferGeometry();
        const sprayAttribute = new THREE.BufferAttribute(this.sprayPositions, 3);
        sprayAttribute.setUsage(THREE.DynamicDrawUsage);
        sprayGeometry.setAttribute('position', sprayAttribute);
        const sprayMaterial = new THREE.PointsMaterial({
            color: 0xd5edf2,
            size: 0.055,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.58,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });
        this.sprayPoints = new THREE.Points(sprayGeometry, sprayMaterial);
        this.sprayPoints.frustumCulled = false;
        this.wetContactFx.add(this.sprayPoints);
        for (let index = 0; index < 3; index += 1) {
            const material = new THREE.MeshBasicMaterial({
                color: 0xb8d8df,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.18, 20), material);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.018;
            ring.visible = false;
            ring.userData.life = 0;
            ring.userData.maxLife = 0.42;
            this.splashRings.push(ring);
            this.wetContactFx.add(ring);
        }
    }
    resetWetContactFx() {
        this.sprayLife.fill(0);
        this.sprayPositions.fill(-50);
        const attribute = this.sprayPoints?.geometry.getAttribute('position');
        if (attribute)
            attribute.needsUpdate = true;
        for (const ring of this.splashRings) {
            ring.visible = false;
            ring.userData.life = 0;
            ring.material.opacity = 0;
        }
    }
    emitSplash(count, speed, intensity) {
        for (let index = 0; index < count; index += 1) {
            const particleIndex = this.sprayCursor;
            this.sprayCursor = (this.sprayCursor + 1) % this.sprayLife.length;
            const offset = particleIndex * 3;
            const side = particleIndex % 2 === 0 ? -1 : 1;
            this.sprayPositions[offset] = side * (0.12 + Math.random() * 0.24);
            this.sprayPositions[offset + 1] = 0.035 + Math.random() * 0.045;
            this.sprayPositions[offset + 2] = 0.2 + Math.random() * 0.36;
            this.sprayVelocities[particleIndex].set(
                side * (0.18 + Math.random() * 0.65) * intensity,
                (0.34 + Math.random() * 1.05) * intensity,
                (0.3 + speed * 0.038 + Math.random() * 0.8) * intensity,
            );
            this.sprayLife[particleIndex] = 0.2 + Math.random() * 0.24 * intensity;
        }
    }
    emitSplashRing(intensity) {
        const ring = this.splashRings.find((candidate) => candidate.userData.life <= 0) ?? this.splashRings[0];
        if (!ring)
            return;
        ring.position.set(0, 0.018, 0.26);
        ring.scale.setScalar(0.72);
        ring.material.opacity = 0.24 * intensity;
        ring.userData.life = ring.userData.maxLife;
        ring.visible = true;
    }
    updateWetContactFx(delta, speed) {
        let changed = false;
        for (let index = 0; index < this.sprayLife.length; index += 1) {
            if (this.sprayLife[index] <= 0)
                continue;
            const offset = index * 3;
            const velocity = this.sprayVelocities[index];
            this.sprayLife[index] = Math.max(0, this.sprayLife[index] - delta);
            velocity.y -= 4.6 * delta;
            this.sprayPositions[offset] += velocity.x * delta;
            this.sprayPositions[offset + 1] = Math.max(0.015, this.sprayPositions[offset + 1] + velocity.y * delta);
            this.sprayPositions[offset + 2] += (velocity.z + speed * 0.14) * delta;
            if (this.sprayLife[index] <= 0)
                this.sprayPositions[offset + 1] = -50;
            changed = true;
        }
        if (changed) {
            const attribute = this.sprayPoints?.geometry.getAttribute('position');
            if (attribute)
                attribute.needsUpdate = true;
        }
        for (const ring of this.splashRings) {
            if (ring.userData.life <= 0)
                continue;
            ring.userData.life = Math.max(0, ring.userData.life - delta);
            const progress = 1 - ring.userData.life / ring.userData.maxLife;
            ring.scale.setScalar(0.72 + progress * 2.25);
            ring.position.z += speed * delta * 0.24;
            ring.material.opacity = (1 - progress) * 0.24;
            if (ring.userData.life <= 0)
                ring.visible = false;
        }
    }
    getMotionState() {
        return {
            laneLean: this.laneLean,
            sliding: this.slideWeight,
            airborne: this.airborneWeight,
            fastFalling: this.fastFallWeight,
            landing: this.landingWeight,
            grounded: this.grounded,
        };
    }
    setOutfit(name) {
        const tint = {
            shadow: new THREE.Color(0xffffff),
            metro: new THREE.Color(0xe1f5ff),
            ember: new THREE.Color(0xffead9),
        }[name] ?? new THREE.Color(0xffffff);
        for (const material of this.outfitMaterials) {
            const base = material.userData.baseColor;
            if (base instanceof THREE.Color)
                material.color.copy(base).multiply(tint);
            material.needsUpdate = true;
        }
    }
    smootherStep(value) {
        const x = THREE.MathUtils.clamp(value, 0, 1);
        return x * x * x * (x * (x * 6 - 15) + 10);
    }
}
