import * as THREE from 'three';
import { CONFIG } from '../config';
import { Environment } from './Environment';
import { ObstacleFactory } from './ObstacleFactory';
const LANE_IDS = [0, 1, 2];
export class World {
    scene;
    assets;
    environment;
    factory = new ObstacleFactory();
    freePools = new Map();
    active = [];
    hits = [];
    playerBox = new THREE.Box3();
    objectBox = new THREE.Box3();
    spawnAccumulator = 0;
    nextSpacing = 28;
    safeLane = 1;
    doubleBlockCooldown = 0;
    actionCooldown = 0;
    rowNumber = 0;
    recoveryRows = 2;
    lastPattern = 'clear';
    elapsed = 0;
    obstacleKinds = ['barrier', 'blocker', 'gate', 'vehicle', 'overhead'];
    constructor(scene, assets, renderer) {
        this.scene = scene;
        this.assets = assets;
        this.environment = new Environment(scene, renderer, assets);
        for (const key of ['token', ...this.obstacleKinds])
            this.freePools.set(key, []);
    }
    async init(onStatus) {
        await Promise.all([
            this.factory.init(this.assets),
            this.environment.init(onStatus),
        ]);
        this.prewarmPools();
    }
    reset() {
        while (this.active.length > 0) {
            const item = this.active[this.active.length - 1];
            if (item)
                this.release(item);
        }
        this.spawnAccumulator = 0;
        this.nextSpacing = 28;
        this.safeLane = 1;
        this.doubleBlockCooldown = 0;
        this.actionCooldown = 0;
        this.rowNumber = 0;
        this.recoveryRows = 2;
        this.lastPattern = 'clear';
        this.elapsed = 0;
        this.environment.reset();
        let z = -40;
        for (let index = 0; index < CONFIG.initialRows; index += 1) {
            this.spawnRow(z, index < 2 ? 0 : 0.16);
            z -= 27;
        }
    }
    update(delta, speed, playerBox) {
        this.hits.length = 0;
        this.elapsed += delta;
        this.playerBox.copy(playerBox);
        this.environment.update(delta, speed);
        for (let index = this.active.length - 1; index >= 0; index -= 1) {
            const item = this.active[index];
            if (!item)
                continue;
            const previousZ = item.root.position.z;
            item.root.position.z += speed * delta;
            if (item.spin !== 0)
                item.root.rotation.y += item.spin * delta;
            if (item.kind === 'token')
                item.root.position.y = item.baseY + Math.sin(this.elapsed * 4.8 + item.bobPhase) * 0.075;
            const z = item.root.position.z;
            let collided = false;
            if (z > -2.4 && z < 5.4) {
                const position = item.root.position;
                const half = item.halfSize;
                const centerY = item.kind === 'token' ? position.y : position.y + item.collisionCenterY;
                this.objectBox.min.set(position.x - half.x, centerY - half.y, position.z - half.z);
                this.objectBox.max.set(position.x + half.x, centerY + half.y, position.z + half.z);
                if (this.playerBox.intersectsBox(this.objectBox)) {
                    collided = true;
                    this.hits.push({ kind: item.kind, object: item });
                }
            }
            if (item.kind === 'obstacle'
                && !item.nearMissAwarded
                && previousZ < CONFIG.playerZ
                && z >= CONFIG.playerZ
                && !collided) {
                const playerX = (this.playerBox.min.x + this.playerBox.max.x) * 0.5;
                if (Math.abs(item.root.position.x - playerX) < 0.95) {
                    item.nearMissAwarded = true;
                    const action = item.obstacleKind === 'overhead'
                        ? 'PERFECT SLIDE'
                        : item.obstacleKind === 'barrier' ? 'PERFECT JUMP' : 'NEAR MISS';
                    this.hits.push({ kind: 'near-miss', object: item, action });
                }
            }
            if (item.activeIndex >= 0 && item.root.position.z > CONFIG.despawnZ)
                this.release(item);
        }
        this.spawnAccumulator += speed * delta;
        if (this.spawnAccumulator >= this.nextSpacing) {
            this.spawnAccumulator -= this.nextSpacing;
            this.nextSpacing = this.spacingForSpeed(speed);
            this.spawnRow(CONFIG.spawnZ, this.difficultyForSpeed(speed));
        }
        return this.hits;
    }
    remove(item) {
        if (item.activeIndex >= 0)
            this.release(item);
    }
    prewarmPools() {
        const counts = {
            barrier: 12,
            blocker: 10,
            gate: 8,
            vehicle: 8,
            overhead: 8,
            token: 48,
        };
        for (const kind of this.obstacleKinds) {
            for (let index = 0; index < counts[kind]; index += 1) {
                const template = this.factory.create(kind);
                this.storeFree({
                    root: template.root,
                    kind: 'obstacle',
                    obstacleKind: kind,
                    poolKey: kind,
                    activeIndex: -1,
                    spin: 0,
                    halfSize: template.halfSize,
                    collisionCenterY: template.collisionCenterY,
                    baseY: 0,
                    bobPhase: 0,
                    nearMissAwarded: false,
                });
            }
        }
        for (let index = 0; index < counts.token; index += 1) {
            this.storeFree({
                root: this.assets.instantiate('token').root,
                kind: 'token',
                obstacleKind: null,
                poolKey: 'token',
                activeIndex: -1,
                spin: 2.8,
                halfSize: new THREE.Vector3(0.44, 0.44, 0.18),
                collisionCenterY: 0,
                baseY: 1,
                bobPhase: index * 0.73,
                nearMissAwarded: false,
            });
        }
    }
    storeFree(item) {
        item.root.visible = false;
        item.root.matrixAutoUpdate = true;
        item.root.position.set(0, -50, 0);
        this.scene.add(item.root);
        this.freePools.get(item.poolKey)?.push(item);
    }
    acquire(key) {
        const pool = this.freePools.get(key);
        let item = pool?.pop();
        if (!item) {
            if (key === 'token') {
                item = {
                    root: this.assets.instantiate('token').root,
                    kind: 'token',
                    obstacleKind: null,
                    poolKey: 'token',
                    activeIndex: -1,
                    spin: 2.8,
                    halfSize: new THREE.Vector3(0.44, 0.44, 0.18),
                    collisionCenterY: 0,
                    baseY: 1,
                    bobPhase: this.rowNumber * 0.47,
                    nearMissAwarded: false,
                };
            }
            else {
                const template = this.factory.create(key);
                item = {
                    root: template.root,
                    kind: 'obstacle',
                    obstacleKind: key,
                    poolKey: key,
                    activeIndex: -1,
                    spin: 0,
                    halfSize: template.halfSize,
                    collisionCenterY: template.collisionCenterY,
                    baseY: 0,
                    bobPhase: 0,
                    nearMissAwarded: false,
                };
            }
            this.scene.add(item.root);
        }
        item.root.visible = true;
        item.root.rotation.set(0, 0, 0);
        item.root.scale.set(1, 1, 1);
        item.nearMissAwarded = false;
        item.activeIndex = this.active.length;
        this.active.push(item);
        return item;
    }
    release(item) {
        const index = item.activeIndex;
        if (index < 0)
            return;
        const last = this.active.pop();
        if (last && last !== item) {
            this.active[index] = last;
            last.activeIndex = index;
        }
        item.activeIndex = -1;
        item.root.visible = false;
        item.root.position.set(0, -50, 0);
        item.root.rotation.set(0, 0, 0);
        this.freePools.get(item.poolKey)?.push(item);
    }
    spawnRow(z, difficulty) {
        const plan = this.planRow(difficulty);
        this.safeLane = plan.safeLane;
        this.rowNumber += 1;
        this.doubleBlockCooldown = Math.max(0, this.doubleBlockCooldown - 1);
        this.actionCooldown = Math.max(0, this.actionCooldown - 1);
        for (const lane of plan.blockedLanes) {
            const kind = plan.obstacleKinds.get(lane) ?? 'blocker';
            const item = this.acquire(kind);
            item.root.position.set(CONFIG.lanes[lane] ?? 0, 0, z);
            item.root.rotation.y = kind === 'vehicle' || kind === 'overhead' ? 0 : (this.seeded(this.rowNumber * 17 + lane) - 0.5) * 0.06;
            item.spin = 0;
        }
        if (plan.forcedJumpLane !== null) {
            const barrier = this.acquire('barrier');
            barrier.root.position.set(CONFIG.lanes[plan.forcedJumpLane] ?? 0, 0, z);
            barrier.spin = 0;
        }
        if (plan.forcedSlideLane !== null) {
            const overhead = this.acquire('overhead');
            overhead.root.position.set(CONFIG.lanes[plan.forcedSlideLane] ?? 0, 0, z);
            overhead.spin = 0;
        }
        this.spawnCoinTrail(plan.safeLane, z, plan.coinTrail);
    }
    planRow(difficulty) {
        const random = this.seeded(this.rowNumber * 911 + 37);
        const canDoubleBlock = this.doubleBlockCooldown === 0 && this.recoveryRows === 0 && difficulty > 0.35 && this.lastPattern !== 'double';
        const canAction = this.actionCooldown === 0 && this.recoveryRows === 0;
        const roll = random;
        let safeLane = this.safeLane;
        let blockedLanes = [];
        let forcedJumpLane = null;
        let forcedSlideLane = null;
        const obstacleKinds = new Map();
        let pattern = 'clear';
        let coinTrail = 'ground';
        if (this.recoveryRows > 0 || roll < 0.17) {
            this.recoveryRows = Math.max(0, this.recoveryRows - 1);
            pattern = 'clear';
        }
        else if (roll < 0.45) {
            pattern = 'single';
            const candidates = LANE_IDS.filter((lane) => lane !== this.safeLane);
            const lane = candidates[Math.floor(this.seeded(this.rowNumber + 5) * candidates.length)] ?? 0;
            blockedLanes = [lane];
            obstacleKinds.set(lane, this.pickHardObstacle(difficulty, lane));
        }
        else if (canAction && roll < 0.61 && this.lastPattern !== 'jump') {
            forcedJumpLane = this.safeLane;
            pattern = 'jump';
            coinTrail = 'jump';
            this.actionCooldown = 2;
        }
        else if (canAction && difficulty > 0.08 && roll < 0.76 && this.lastPattern !== 'slide') {
            forcedSlideLane = this.safeLane;
            pattern = 'slide';
            coinTrail = 'slide';
            this.actionCooldown = 2;
            this.recoveryRows = 1;
        }
        else if (canDoubleBlock && roll < 0.88) {
            pattern = 'double';
            safeLane = this.chooseReachableLane(this.safeLane);
            blockedLanes = LANE_IDS.filter((lane) => lane !== safeLane);
            for (const lane of blockedLanes)
                obstacleKinds.set(lane, this.pickHardObstacle(difficulty, lane));
            this.doubleBlockCooldown = 3;
            this.recoveryRows = 1;
        }
        else {
            pattern = 'switch';
            const nextLane = this.chooseReachableLane(this.safeLane);
            const lane = this.safeLane;
            safeLane = nextLane;
            blockedLanes = [lane];
            obstacleKinds.set(lane, this.pickHardObstacle(difficulty, lane));
        }
        const blockedSet = new Set(blockedLanes);
        if (forcedJumpLane !== null)
            blockedSet.delete(forcedJumpLane);
        if (forcedSlideLane !== null)
            blockedSet.delete(forcedSlideLane);
        if (LANE_IDS.every((lane) => blockedSet.has(lane))) {
            blockedLanes = blockedLanes.filter((lane) => lane !== safeLane);
            obstacleKinds.delete(safeLane);
        }
        this.lastPattern = pattern;
        return { safeLane, blockedLanes, forcedJumpLane, forcedSlideLane, obstacleKinds, coinTrail };
    }
    spawnCoinTrail(lane, rowZ, mode) {
        const count = mode === 'jump' ? 4 : mode === 'slide' ? 4 : 3;
        for (let index = 0; index < count; index += 1) {
            const token = this.acquire('token');
            let y = 1.08;
            if (mode === 'jump')
                y = 1.35 + Math.sin((index / Math.max(1, count - 1)) * Math.PI) * 0.95;
            if (mode === 'slide')
                y = 0.48 + Math.sin((index / Math.max(1, count - 1)) * Math.PI) * 0.12;
            token.root.position.set(CONFIG.lanes[lane] ?? 0, y, rowZ + 7.4 - index * 2.3);
            token.baseY = y;
            token.bobPhase = this.rowNumber * 0.83 + index * 0.71;
            token.spin = 2.8;
        }
    }
    chooseReachableLane(current) {
        const candidates = LANE_IDS.filter((lane) => Math.abs(lane - current) <= 1 && lane !== current);
        if (candidates.length === 0)
            return current;
        return candidates[Math.floor(this.seeded(this.rowNumber * 43 + 11) * candidates.length)] ?? current;
    }
    pickHardObstacle(difficulty, lane) {
        const roll = this.seeded(this.rowNumber * 101 + lane * 13);
        if (difficulty < 0.2)
            return roll < 0.65 ? 'blocker' : 'barrier';
        if (difficulty < 0.55)
            return roll < 0.38 ? 'blocker' : roll < 0.7 ? 'gate' : 'barrier';
        return roll < 0.28 ? 'blocker' : roll < 0.56 ? 'gate' : roll < 0.82 ? 'vehicle' : 'barrier';
    }
    spacingForSpeed(speed) {
        const reactionDistance = speed * 1.08;
        return THREE.MathUtils.clamp(reactionDistance + 10, 29, 54);
    }
    difficultyForSpeed(speed) {
        return THREE.MathUtils.clamp((speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed), 0, 1);
    }
    seeded(seed) {
        let value = seed + 0x6D2B79F5;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
}
