import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from '../config';
import { AssetManager } from './AssetManager';
import { AudioManager } from './AudioManager';
import { InputController } from './InputController';
import { Player } from './Player';
import { WalletManager } from './WalletManager';
import { World } from './World';
export class Game {
    root;
    renderer;
    scene = new THREE.Scene();
    camera;
    playerCollisionBox = new THREE.Box3();
    clock = new THREE.Clock(false);
    assets = new AssetManager();
    input = new InputController();
    audio = new AudioManager();
    wallet = new WalletManager();
    mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
    world;
    player;
    phase = 'menu';
    activePanel = null;
    score = 0;
    distance = 0;
    coins = 0;
    energy = 100;
    multiplier = 1;
    skillMultiplierBonus = 0;
    speed = CONFIG.baseSpeed;
    bestScore = Number(localStorage.getItem('shredrunner-best') ?? 0);
    frameHandle = 0;
    cameraShake = 0;
    pixelRatio = 1;
    pixelRatioCap = 1.25;
    performanceElapsed = 0;
    performanceFrames = 0;
    lowFpsWindows = 0;
    highFpsWindows = 0;
    hudElapsed = 0;
    toastTimer = 0;
    actionFeedbackTimer = 0;
    runSlides = 0;
    runJumps = 0;
    runNearMisses = 0;
    activeOutfit = this.readOutfit();
    quality = this.readQuality();
    environmentTarget = null;
    scoreEl = this.mustGet('score');
    bestEl = this.mustGet('best-score');
    multiplierEl = this.mustGet('multiplier');
    coinEl = this.mustGet('coin-count');
    energyEl = this.mustGet('energy-level');
    missionDistanceEl = this.mustGet('mission-distance');
    missionProgressEl = this.mustGet('mission-progress');
    menuEl = this.mustGet('menu');
    pauseEl = this.mustGet('pause-screen');
    gameOverEl = this.mustGet('game-over');
    modalEl = this.mustGet('info-modal');
    modalContentEl = this.mustGet('modal-content');
    finalScoreEl = this.mustGet('final-score');
    finalCoinsEl = this.mustGet('final-coins');
    finalDistanceEl = this.mustGet('final-distance');
    finalMultiplierEl = this.mustGet('final-multiplier');
    bestResultEl = this.mustGet('best-result');
    recordCopyEl = this.mustGet('record-copy');
    summaryDistanceEl = this.mustGet('summary-distance');
    summaryCoinsEl = this.mustGet('summary-coins');
    summarySlidesEl = this.mustGet('summary-slides');
    summaryDistanceStatusEl = this.mustGet('summary-distance-status');
    summaryCoinsStatusEl = this.mustGet('summary-coins-status');
    summarySlidesStatusEl = this.mustGet('summary-slides-status');
    summaryEl = this.mustGet('run-summary');
    signatureStatusEl = this.mustGet('signature-status');
    statusEl = this.mustGet('status');
    toastEl = this.mustGet('toast');
    actionFeedbackEl = this.mustGet('action-feedback');
    gameOverReasonEl = this.mustGet('game-over-reason');
    networkStatusEl = this.mustGet('network-status-text');
    networkNameEl = this.mustGet('network-name');
    menuBalanceEl = this.mustGet('menu-balance');
    menuAddressEl = this.mustGet('menu-address');
    hudWalletStatusEl = this.mustGet('hud-wallet-status');
    hudWalletAddressEl = this.mustGet('hud-wallet-address');
    modalCoinEl = this.mustGet('modal-coin-count');
    constructor(root) {
        this.root = root;
        this.configureQualityCaps();
        this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, innerWidth / innerHeight, CONFIG.camera.near, CONFIG.camera.far);
        this.camera.position.set(CONFIG.camera.x, CONFIG.camera.y, CONFIG.camera.z);
        this.camera.lookAt(0, 1, -14);
        this.renderer = new THREE.WebGLRenderer({
            antialias: !this.mobile && this.quality !== 'performance',
            powerPreference: 'high-performance',
            alpha: false,
            stencil: false,
            depth: true,
        });
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = this.quality === 'cinematic' ? 1.2 : this.quality === 'performance' ? 1.08 : 1.15;
        this.renderer.shadowMap.enabled = this.quality !== 'performance' && !this.mobile;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.root.appendChild(this.renderer.domElement);
        this.setupScene();
        this.bindUi();
        this.input.subscribe((action) => this.handleInput(action));
        this.wallet.subscribe((state) => this.updateWalletUi(state));
        window.addEventListener('resize', this.onResize);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.phase === 'playing')
                this.pause();
        });
    }
    async init() {
        this.bestEl.textContent = this.formatScore(this.bestScore);
        this.updateHud();
        void this.wallet.restore();
        try {
            await this.assets.loadAll((loaded, total) => {
                this.statusEl.textContent = `Loading runner ${loaded}/${total}`;
            });
            this.player = new Player(this.assets.instantiate('player'));
            this.player.setOutfit(this.activeOutfit);
            this.scene.add(this.player.root);
            this.world = new World(this.scene, this.assets, this.renderer);
            await this.world.init((message) => {
                this.statusEl.textContent = message;
            });
            this.world.reset();
            this.statusEl.textContent = 'Compiling GPU shaders';
            await this.renderer.compileAsync(this.scene, this.camera);
            this.statusEl.classList.add('status--hidden');
            this.render();
        }
        catch (error) {
            console.error('Game initialization failed.', error);
            this.statusEl.textContent = 'Unable to initialize the 3D scene. Check the browser console.';
        }
    }
    start() {
        if (!this.player || !this.world)
            return;
        this.closeModal();
        this.score = 0;
        this.distance = 0;
        this.coins = 0;
        this.energy = 100;
        this.multiplier = 1;
        this.skillMultiplierBonus = 0;
        this.speed = CONFIG.baseSpeed;
        this.cameraShake = 0;
        this.performanceElapsed = 0;
        this.performanceFrames = 0;
        this.lowFpsWindows = 0;
        this.highFpsWindows = 0;
        this.hudElapsed = 0;
        this.runSlides = 0;
        this.runJumps = 0;
        this.runNearMisses = 0;
        this.signatureStatusEl.textContent = this.wallet.getState().connected
            ? 'Your connected wallet can sign this run after completion.'
            : 'Connect a wallet to sign and verify this run.';
        this.signatureStatusEl.classList.remove('success');
        const saveButton = this.mustGet('sign-score-btn');
        saveButton.disabled = false;
        saveButton.textContent = 'SAVE SCORE';
        this.player.reset();
        this.player.root.visible = true;
        this.world.reset();
        this.camera.fov = CONFIG.camera.fov;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(CONFIG.camera.x, CONFIG.camera.y, CONFIG.camera.z);
        this.camera.rotation.z = 0;
        this.camera.lookAt(0, 1, -14);
        this.setPhase('playing');
        this.updateHud();
        this.clock.start();
        cancelAnimationFrame(this.frameHandle);
        this.frameHandle = requestAnimationFrame(this.tick);
    }
    pause() {
        if (this.phase !== 'playing')
            return;
        this.clock.stop();
        cancelAnimationFrame(this.frameHandle);
        this.setPhase('paused');
        this.render();
    }
    resume() {
        if (this.phase !== 'paused')
            return;
        this.setPhase('playing');
        this.clock.start();
        this.frameHandle = requestAnimationFrame(this.tick);
    }
    returnToMenu() {
        cancelAnimationFrame(this.frameHandle);
        this.clock.stop();
        this.closeModal();
        this.player?.reset();
        this.world?.reset();
        this.camera.fov = CONFIG.camera.fov;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(CONFIG.camera.x, CONFIG.camera.y, CONFIG.camera.z);
        this.camera.rotation.z = 0;
        this.camera.lookAt(0, 1, -14);
        this.setPhase('menu');
        this.render();
    }
    setupScene() {
        this.scene.background = new THREE.Color(0x2d4351);
        this.scene.fog = new THREE.FogExp2(0x557180, this.mobile ? 0.0078 : 0.0058);
        if (this.quality !== 'performance' && !this.mobile) {
            const pmrem = new THREE.PMREMGenerator(this.renderer);
            pmrem.compileCubemapShader();
            const room = new RoomEnvironment();
            this.environmentTarget = pmrem.fromScene(room, 0.055);
            this.scene.environment = this.environmentTarget.texture;
            this.scene.environmentIntensity = this.quality === 'cinematic' ? 0.78 : 0.64;
            room.dispose();
            pmrem.dispose();
        }
        const ambient = new THREE.AmbientLight(0xdbe8eb, this.quality === 'performance' ? 0.38 : 0.44);
        this.scene.add(ambient);
        const hemisphere = new THREE.HemisphereLight(0x8fc8dc, 0x383432, this.quality === 'performance' ? 1.18 : 1.38);
        this.scene.add(hemisphere);
        const key = new THREE.DirectionalLight(0xffd19d, this.quality === 'cinematic' ? 3.3 : 2.86);
        key.name = 'PrimaryRunnerShadowLight';
        key.userData.primaryShadow = true;
        key.position.set(-9, 16, 9);
        key.castShadow = this.renderer.shadowMap.enabled;
        key.shadow.mapSize.set(this.quality === 'cinematic' ? 1536 : 1024, this.quality === 'cinematic' ? 1536 : 1024);
        key.shadow.camera.near = 1;
        key.shadow.camera.far = 62;
        key.shadow.camera.left = -11;
        key.shadow.camera.right = 11;
        key.shadow.camera.top = 16;
        key.shadow.camera.bottom = -4;
        key.shadow.bias = -0.0003;
        key.shadow.normalBias = 0.025;
        this.scene.add(key);
        const skyFill = new THREE.DirectionalLight(0x76c9e5, this.quality === 'performance' ? 0.68 : 0.9);
        skyFill.position.set(8, 11, -18);
        this.scene.add(skyFill);
        const sunsetRim = new THREE.DirectionalLight(0xffa95f, this.quality === 'performance' ? 0.62 : this.quality === 'cinematic' ? 1.42 : 1.08);
        sunsetRim.position.set(-6, 5.5, -28);
        this.scene.add(sunsetRim);
        if (this.quality !== 'performance' && !this.mobile) {
            const cyanFill = new THREE.PointLight(0x47d8ef, this.quality === 'cinematic' ? 22 : 16, 25, 2.1);
            cyanFill.position.set(-4, 3.25, -11);
            this.scene.add(cyanFill);
            const amberFill = new THREE.PointLight(0xff9c42, this.quality === 'cinematic' ? 18 : 12, 24, 2.05);
            amberFill.position.set(6, 2.8, -17);
            this.scene.add(amberFill);
            const runnerRimTarget = new THREE.Object3D();
            runnerRimTarget.position.set(0, 1.15, CONFIG.playerZ);
            this.scene.add(runnerRimTarget);
            const runnerRim = new THREE.SpotLight(0x9dddf1, this.quality === 'cinematic' ? 24 : 18, 20, Math.PI * 0.24, 0.68, 1.4);
            runnerRim.position.set(4.2, 6.8, 7.2);
            runnerRim.target = runnerRimTarget;
            runnerRim.castShadow = false;
            this.scene.add(runnerRim);
        }
    }
    bindUi() {
        this.mustGet('start-btn').addEventListener('click', () => this.start());
        this.mustGet('modal-play-btn').addEventListener('click', () => this.start());
        this.mustGet('restart-btn').addEventListener('click', () => this.start());
        this.mustGet('pause-btn').addEventListener('click', () => this.phase === 'paused' ? this.resume() : this.pause());
        this.mustGet('resume-btn').addEventListener('click', () => this.resume());
        this.mustGet('modal-close').addEventListener('click', () => this.closeModal());
        this.mustGet('sign-score-btn').addEventListener('click', () => void this.signCurrentRun());
        this.mustGet('claim-rewards-btn').addEventListener('click', () => this.prepareRewardClaim());
        document.querySelectorAll('[data-return-menu]').forEach((button) => {
            button.addEventListener('click', () => this.returnToMenu());
        });
        document.querySelectorAll('[data-open-panel]').forEach((button) => {
            button.addEventListener('click', () => this.openPanel(button.dataset.openPanel ?? 'wallet'));
        });
        this.modalEl.addEventListener('click', (event) => {
            if (event.target === this.modalEl || event.target instanceof Element && event.target.classList.contains('modal-backdrop'))
                this.closeModal();
        });
    }
    handleInput(action) {
        if (action === 'pause') {
            if (this.modalEl.classList.contains('screen--active')) {
                this.closeModal();
                return;
            }
            if (this.phase === 'playing')
                this.pause();
            else if (this.phase === 'paused')
                this.resume();
            return;
        }
        if (this.phase !== 'playing')
            return;
        if (action === 'left' && this.player.move(-1))
            this.audio.play('move');
        if (action === 'right' && this.player.move(1))
            this.audio.play('move');
        if (action === 'jump' && this.player.jump()) {
            this.runJumps += 1;
            this.audio.play('jump');
        }
        if (action === 'slide' && this.player.slide()) {
            if (this.player.grounded)
                this.runSlides += 1;
            this.audio.play('move');
        }
    }
    tick = () => {
        if (this.phase !== 'playing')
            return;
        const delta = Math.min(this.clock.getDelta(), 0.05);
        this.update(delta);
        this.render();
        this.frameHandle = requestAnimationFrame(this.tick);
    };
    update(delta) {
        this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.acceleration * delta);
        this.distance += this.speed * delta;
        this.multiplier = Math.min(12, 1 + this.distance / 360 + this.skillMultiplierBonus);
        this.energy = Math.max(0, this.energy - delta * (0.44 + this.speed * 0.008));
        this.score += this.speed * delta * CONFIG.scoreRate * this.multiplier;
        this.player.update(delta, this.speed);
        const hits = this.world.update(delta, this.speed, this.player.getBox(this.playerCollisionBox));
        for (const hit of hits) {
            if (hit.kind === 'token') {
                this.score += CONFIG.collectibleValue * this.multiplier;
                this.coins += 1;
                this.energy = Math.min(100, this.energy + 2.5);
                this.audio.play('collect');
                this.world.remove(hit.object);
            }
            else if (hit.kind === 'near-miss') {
                this.runNearMisses += 1;
                this.score += 200 * this.multiplier;
                this.skillMultiplierBonus = Math.min(2.4, this.skillMultiplierBonus + 0.18);
                this.multiplier = Math.min(12, this.multiplier + 0.18);
                this.energy = Math.min(100, this.energy + 3.5);
                this.audio.play('move');
                this.showActionFeedback(`${hit.action ?? 'NEAR MISS'}  +200`);
            }
            else {
                this.crash('OBSTACLE IMPACT');
                return;
            }
        }
        if (this.energy <= 0) {
            this.crash('ENERGY DEPLETED');
            return;
        }
        const slideAmount = this.player.getSlideAmount();
        const motion = this.player.getMotionState();
        const speedRatio = THREE.MathUtils.clamp((this.speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed), 0, 1);
        const runBob = motion.grounded && slideAmount < 0.1
            ? Math.sin(this.distance * 0.42) * (0.018 + speedRatio * 0.018)
            : 0;
        const cameraBlend = 1 - Math.exp(-4.2 * delta);
        this.camera.position.x = THREE.MathUtils.lerp(
            this.camera.position.x,
            this.player.root.position.x * 0.15 + motion.laneLean * 0.06,
            cameraBlend,
        );
        this.camera.position.y = THREE.MathUtils.lerp(
            this.camera.position.y,
            CONFIG.camera.y + runBob + motion.airborne * 0.08 - slideAmount * 0.18 - motion.landing * 0.11,
            cameraBlend,
        );
        this.camera.position.z = THREE.MathUtils.lerp(
            this.camera.position.z,
            CONFIG.camera.z + slideAmount * 0.08 + speedRatio * 0.08,
            cameraBlend,
        );
        const targetFov = CONFIG.camera.fov + speedRatio * 3.3 + motion.fastFalling * 1.1;
        const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5.5, delta);
        if (Math.abs(nextFov - this.camera.fov) > 0.002) {
            this.camera.fov = nextFov;
            this.camera.updateProjectionMatrix();
        }
        this.camera.lookAt(
            this.player.root.position.x * 0.105,
            1.03 + motion.airborne * 0.12 - slideAmount * 0.2 - motion.landing * 0.04,
            -13.4 - speedRatio * 0.8,
        );
        this.camera.rotation.z = THREE.MathUtils.damp(this.camera.rotation.z, motion.laneLean * -0.018, 7.5, delta);
        this.updateAdaptiveResolution(delta);
        this.hudElapsed += delta;
        if (this.hudElapsed >= 1 / 12) {
            this.hudElapsed %= 1 / 12;
            this.updateHud();
        }
    }
    updateAdaptiveResolution(delta) {
        this.performanceElapsed += delta;
        this.performanceFrames += 1;
        if (this.performanceElapsed < 2.5)
            return;
        const fps = this.performanceFrames / this.performanceElapsed;
        let next = this.pixelRatio;
        const lowThreshold = this.quality === 'cinematic' ? 50 : 47;
        if (fps < lowThreshold) {
            this.lowFpsWindows += 1;
            this.highFpsWindows = 0;
        }
        else if (fps > 58) {
            this.highFpsWindows += 1;
            this.lowFpsWindows = 0;
        }
        else {
            this.lowFpsWindows = 0;
            this.highFpsWindows = 0;
        }
        if (this.lowFpsWindows >= 2) {
            next = Math.max(0.65, this.pixelRatio - 0.1);
            this.lowFpsWindows = 0;
        }
        else if (this.highFpsWindows >= 4) {
            next = Math.min(this.pixelRatioCap, this.pixelRatio + 0.04);
            this.highFpsWindows = 0;
        }
        if (Math.abs(next - this.pixelRatio) > 0.001) {
            this.pixelRatio = next;
            this.renderer.setPixelRatio(this.pixelRatio);
            this.renderer.setSize(innerWidth, innerHeight, false);
        }
        this.performanceElapsed = 0;
        this.performanceFrames = 0;
    }
    crash(reason) {
        this.audio.play('crash');
        this.clock.stop();
        cancelAnimationFrame(this.frameHandle);
        this.cameraShake = 0.3;
        this.player.root.rotation.z = 1.2;
        const previousBest = this.bestScore;
        this.bestScore = Math.max(this.bestScore, Math.floor(this.score));
        localStorage.setItem('shredrunner-best', String(this.bestScore));
        this.commitCareerStats();
        this.updateHud();
        this.finalScoreEl.textContent = this.formatScore(this.score);
        this.finalCoinsEl.textContent = String(this.coins);
        this.finalDistanceEl.textContent = `${Math.floor(this.distance).toLocaleString('en-US')} m`;
        this.finalMultiplierEl.textContent = `x${this.multiplier.toFixed(1)} MULTIPLIER`;
        this.bestResultEl.textContent = this.formatScore(this.bestScore);
        this.recordCopyEl.textContent = this.bestScore > previousBest ? 'NEW RECORD!' : reason;
        this.summaryDistanceEl.textContent = String(Math.min(2500, Math.floor(this.distance)));
        this.summaryCoinsEl.textContent = String(Math.min(100, this.coins));
        this.summarySlidesEl.textContent = String(Math.min(15, this.runSlides));
        this.setMissionStatus(this.summaryDistanceStatusEl, this.distance >= 2500);
        this.setMissionStatus(this.summaryCoinsStatusEl, this.coins >= 100);
        this.setMissionStatus(this.summarySlidesStatusEl, this.runSlides >= 15);
        this.gameOverReasonEl.textContent = reason === 'ENERGY DEPLETED'
            ? 'YOU RAN OUT OF ENERGY'
            : 'YOU HIT AN OBSTACLE';
        this.summaryEl.textContent = `Distance ${Math.floor(this.distance)} m, ${this.coins} coins, ${reason}`;
        this.setPhase('game-over');
        this.render();
    }
    async signCurrentRun() {
        if (!this.wallet.getState().connected) {
            this.openPanel('wallet');
            this.showToast('Connect a wallet before signing your score.', true);
            return;
        }
        const button = this.mustGet('sign-score-btn');
        button.disabled = true;
        button.textContent = 'SIGNING...';
        try {
            const signature = await this.wallet.signRun(this.score, this.distance, this.coins);
            localStorage.setItem('shredrunner-last-run-signature', signature);
            this.signatureStatusEl.textContent = `Run verified: ${signature.slice(0, 18)}...${signature.slice(-10)}`;
            this.signatureStatusEl.classList.add('success');
            this.showToast('Run signature created successfully.');
            button.textContent = 'SIGNED ✓';
        }
        catch (error) {
            this.showToast(this.errorMessage(error), true);
            button.textContent = 'SAVE SCORE';
            button.disabled = false;
        }
    }
    prepareRewardClaim() {
        if (!this.wallet.getState().connected) {
            this.openPanel('wallet');
            this.showToast('Connect a wallet before preparing a reward claim.', true);
            return;
        }
        this.showToast('Run recorded. A verified backend receipt is required before the reward vault can release RUSH.');
    }
    setMissionStatus(element, complete) {
        element.textContent = complete ? '✓ COMPLETED' : 'IN PROGRESS';
        element.classList.toggle('complete', complete);
    }
    render() {
        if (this.cameraShake > 0) {
            const baseX = this.camera.position.x;
            const baseY = this.camera.position.y;
            const strength = this.cameraShake * 0.18;
            this.camera.position.x += (Math.random() - 0.5) * strength;
            this.camera.position.y += (Math.random() - 0.5) * strength;
            this.renderer.render(this.scene, this.camera);
            this.camera.position.x = baseX;
            this.camera.position.y = baseY;
            this.cameraShake *= 0.82;
            return;
        }
        this.renderer.render(this.scene, this.camera);
    }
    updateHud() {
        this.scoreEl.textContent = this.formatScore(this.score);
        this.bestEl.textContent = this.formatScore(this.bestScore);
        this.multiplierEl.textContent = `x${this.multiplier.toFixed(1)}`;
        this.coinEl.textContent = this.coins.toLocaleString('en-US');
        this.modalCoinEl.textContent = this.coins.toLocaleString('en-US');
        this.energyEl.style.height = `${this.energy}%`;
        const speedFx = THREE.MathUtils.clamp((this.speed - 27) / (CONFIG.maxSpeed - 27), 0, 1) * 0.28;
        document.documentElement.style.setProperty('--speed-intensity', speedFx.toFixed(3));
        const missionDistance = Math.min(2500, Math.floor(this.distance));
        this.missionDistanceEl.textContent = String(missionDistance);
        this.missionProgressEl.style.width = `${Math.min(100, (missionDistance / 2500) * 100)}%`;
    }
    openPanel(panel) {
        const renderers = {
            wallet: () => this.walletMarkup(),
            loadout: () => this.loadoutMarkup(),
            missions: () => this.missionsMarkup(),
            leaderboard: () => this.leaderboardMarkup(),
            store: () => this.storeMarkup(),
            settings: () => this.settingsMarkup(),
        };
        const resolvedPanel = panel in renderers ? panel : 'wallet';
        this.activePanel = resolvedPanel;
        const content = renderers[resolvedPanel]();
        this.modalEl.dataset.panel = resolvedPanel;
        this.modalContentEl.innerHTML = content;
        this.modalEl.classList.add('screen--active');
        this.modalEl.setAttribute('aria-hidden', 'false');
        this.modalEl.querySelectorAll('.modal-nav [data-open-panel]').forEach((button) => {
            button.classList.toggle('active', button.dataset.openPanel === resolvedPanel);
        });
        if (resolvedPanel === 'settings')
            this.bindSettingsPanel();
        if (resolvedPanel === 'wallet')
            this.bindWalletPanel();
        if (resolvedPanel === 'loadout')
            this.bindLoadoutPanel();
        if (resolvedPanel === 'store')
            this.bindStorePanel();
    }
    closeModal() {
        this.activePanel = null;
        this.modalEl.classList.remove('screen--active');
        this.modalEl.setAttribute('aria-hidden', 'true');
    }
    bindSettingsPanel() {
        this.modalContentEl.querySelectorAll('[data-quality]').forEach((button) => {
            button.addEventListener('click', () => {
                const mode = button.dataset.quality;
                if (mode)
                    this.applyQuality(mode);
                this.openPanel('settings');
            });
        });
    }
    bindWalletPanel() {
        this.modalContentEl.querySelectorAll('[data-wallet-action]').forEach((button) => {
            button.addEventListener('click', () => void this.handleWalletAction(button));
        });
    }
    bindLoadoutPanel() {
        this.modalContentEl.querySelectorAll('[data-outfit]').forEach((button) => {
            button.addEventListener('click', () => {
                const outfit = button.dataset.outfit;
                if (!['shadow', 'metro', 'ember'].includes(outfit))
                    return;
                this.activeOutfit = outfit;
                localStorage.setItem('subway-rush-outfit', outfit);
                this.player?.setOutfit(outfit);
                this.showToast(`${button.dataset.outfitName ?? 'Runner outfit'} equipped.`);
                this.openPanel('loadout');
            });
        });
    }
    bindStorePanel() {
        this.modalContentEl.querySelectorAll('[data-store-action]').forEach((button) => {
            button.addEventListener('click', () => {
                this.showToast('Marketplace preview ready. Configure checkout and deployed contract addresses before enabling purchases.');
            });
        });
    }
    async handleWalletAction(button) {
        const action = button.dataset.walletAction;
        button.disabled = true;
        try {
            if (action === 'injected')
                await this.wallet.connectInjected();
            else if (action === 'walletconnect')
                await this.wallet.connectWalletConnect();
            else if (action === 'disconnect')
                await this.wallet.disconnect();
            else if (action === 'guest')
                await this.wallet.disconnect();
            else if (action === 'switch') {
                const chain = Number(button.dataset.chain);
                if (chain === 1 || chain === 8453 || chain === 137)
                    await this.wallet.switchNetwork(chain);
            }
            this.showToast(action === 'disconnect' || action === 'guest' ? 'Wallet disconnected.' : 'Wallet updated successfully.');
            if (action === 'guest')
                this.closeModal();
        }
        catch (error) {
            this.showToast(this.errorMessage(error), true);
            button.disabled = false;
        }
    }
    updateWalletUi(state) {
        document.body.classList.toggle('wallet-connected', state.connected);
        this.networkStatusEl.innerHTML = `<i></i> ${state.connecting ? 'CONNECTING' : state.connected ? 'CONNECTED' : 'NOT CONNECTED'}`;
        this.networkNameEl.textContent = state.chainName.toUpperCase();
        this.menuBalanceEl.textContent = state.balance;
        this.menuAddressEl.textContent = state.address ? this.shortAddress(state.address) : 'CONNECT WALLET';
        this.hudWalletStatusEl.textContent = state.connected ? 'WALLET CONNECTED' : 'GUEST MODE';
        this.hudWalletAddressEl.textContent = state.address ? this.shortAddress(state.address) : 'CONNECT WALLET';
        if (this.activePanel === 'wallet' && this.modalEl.classList.contains('screen--active')) {
            this.modalContentEl.innerHTML = this.walletMarkup();
            this.bindWalletPanel();
        }
    }
    walletMarkup() {
        const state = this.wallet.getState();
        const address = state.address ?? 'No wallet connected';
        const status = state.connected ? 'Connected' : state.connecting ? 'Connecting...' : 'Disconnected';
        return `
      <div class="wallet-layout">
        <section>
          <p class="eyebrow">SUBWAY RUSH NETWORK</p>
          <h2 class="modal-title">Connect Your Wallet</h2>
          <p class="modal-subtitle">Connect through an installed EVM wallet or WalletConnect. The game requests account access only when you choose a connection method and never receives private keys.</p>
          <div class="wallet-connect-list">
            <button class="wallet-option wallet-option--recommended" data-wallet-action="injected" type="button">
              <span>◎</span><span><strong>Browser Wallet</strong><small>MetaMask, Rabby, Brave, and compatible injected wallets</small></span><em>RECOMMENDED</em>
            </button>
            <button class="wallet-option" data-wallet-action="walletconnect" type="button">
              <span>〽</span><span><strong>WalletConnect</strong><small>Scan a QR code with a compatible mobile wallet</small></span><em>PROJECT ID REQUIRED</em>
            </button>
            <button class="wallet-option" data-wallet-action="injected" type="button">
              <span>◆</span><span><strong>Coinbase Wallet</strong><small>Use the Coinbase browser extension or injected mobile browser</small></span><em>INJECTED</em>
            </button>
            <div class="wallet-divider">OR</div>
            <button class="wallet-option" data-wallet-action="guest" type="button">
              <span>◉</span><span><strong>Guest Mode</strong><small>Play locally without connecting a wallet</small></span><em>LOCAL</em>
            </button>
            ${state.connected ? `<button class="wallet-option" data-wallet-action="disconnect" type="button"><span>×</span><span><strong>Disconnect</strong><small>Clear the active wallet session from this game</small></span><em>ACCOUNT</em></button>` : ''}
          </div>
          <div class="wallet-message">${state.error ?? 'WalletConnect requires VITE_WALLETCONNECT_PROJECT_ID. Browser-wallet connection works without it.'}</div>
        </section>

        <aside class="wallet-side">
          <section class="wallet-preview">
            <small>YOUR WALLET PREVIEW</small>
            <div class="wallet-identity${state.connected ? ' connected' : ''}">
              <span class="wallet-avatar">S</span>
              <span><strong title="${address}">${state.address ? this.shortAddress(state.address, 8) : address}</strong><em><i></i>${status} · ${state.connectionType ?? 'guest'}</em><b>${state.balance}</b></span>
            </div>
          </section>
          <section class="network-panel">
            <small>NETWORK</small>
            <div class="network-row"><span>${state.chainName}</span><b>${state.connected ? '● LIVE' : '○ OFFLINE'}</b></div>
            <div class="network-actions">
              <button data-wallet-action="switch" data-chain="1" type="button">Ethereum</button>
              <button data-wallet-action="switch" data-chain="8453" type="button">Base</button>
              <button data-wallet-action="switch" data-chain="137" type="button">Polygon</button>
            </div>
          </section>
          <section class="benefit-panel">
            <small>WEB3 BENEFITS</small>
            <div class="benefit-list">
              <div><span>♙</span><p><strong>Verify Runs</strong><small>Sign your final score without sending a transaction.</small></p></div>
              <div><span>✦</span><p><strong>Claim-ready State</strong><small>Prepare score data for a future reward contract.</small></p></div>
              <div><span>♜</span><p><strong>Compete On-chain</strong><small>Use the wallet address as a stable leaderboard identity.</small></p></div>
            </div>
          </section>
        </aside>
      </div>`;
    }
    loadoutMarkup() {
        const option = (id, title, detail) => `
          <button class="outfit-option${this.activeOutfit === id ? ' active' : ''}" data-outfit="${id}" data-outfit-name="${title}" type="button">
            <span><strong>${title}</strong><small>${detail}</small></span>
          </button>`;
        const selectedTitle = this.activeOutfit === 'metro'
            ? 'METRO CURRENT JACKET'
            : this.activeOutfit === 'ember'
                ? 'EMBER LINE JACKET'
                : 'SHADOW RUNNER JACKET';
        return `
      <div class="hub-heading">
        <div><p class="eyebrow">RUNNER EQUIPMENT</p><h2 class="modal-title">Loadout</h2></div>
        <span class="hub-meta">3 / 3 OUTFITS · LOCAL COSMETICS</span>
      </div>
      <div class="loadout-layout">
        <section class="loadout-rail">
          <h3>OUTFIT</h3>
          <div class="outfit-list">
            ${option('shadow', 'Shadow Runner', 'Dark urban jacket · equipped by default')}
            ${option('metro', 'Metro Current', 'Cool rain-reflective cyan treatment')}
            ${option('ember', 'Ember Line', 'Warm signal-light accent treatment')}
          </div>
          <h3 class="loadout-subheading">SNEAKERS</h3>
          <div class="loadout-slot-grid"><span class="active">CITY GRIP</span><span>RAIN STEP</span><span class="locked">LOCKED</span></div>
          <h3 class="loadout-subheading">ACCESSORIES</h3>
          <div class="loadout-slot-grid"><span class="active">RUN BAG</span><span>VISOR</span><span class="locked">LOCKED</span></div>
        </section>
        <section class="runner-preview" data-outfit-label="${selectedTitle.replace(' JACKET', '')}" aria-label="Selected runner preview"></section>
        <aside class="gear-detail">
          <p class="eyebrow">EPIC · OWNED</p>
          <h3>${selectedTitle}</h3>
          <div class="gear-detail__art" aria-hidden="true"></div>
          <div class="gear-stats"><span><strong>+12%</strong><small>SCORE STYLE</small></span><span><strong>+8%</strong><small>COIN STYLE</small></span><span><strong>+5%</strong><small>ENERGY STYLE</small></span></div>
          <p class="modal-subtitle">Cosmetic presentation only. Collision, speed, and reward security remain identical for every outfit.</p>
          <button class="gold-btn" data-outfit="${this.activeOutfit}" data-outfit-name="Selected outfit" type="button">EQUIP</button>
        </aside>
      </div>`;
    }
    missionsMarkup() {
        const stats = this.readCareerStats();
        const level = Math.min(30, 1 + Math.floor(stats.distance / 2500));
        const xp = stats.distance % 6000;
        const progress = Math.min(100, (xp / 6000) * 100);
        const quest = (icon, label, value, target, reward) => {
            const complete = value >= target;
            return `<div class="quest-row${complete ? ' complete' : ''}"><span>${icon}</span><p><strong>${label}</strong><small>${Math.min(target, Math.floor(value)).toLocaleString('en-US')} / ${target.toLocaleString('en-US')}</small></p><em>${complete ? '✓ COMPLETE' : reward}</em></div>`;
        };
        return `
      <div class="hub-heading">
        <div><p class="eyebrow">MISSIONS · SEASON PASS · EVENTS</p><h2 class="modal-title">Urban Legends</h2></div>
        <span class="hub-meta">SEASON 1 · CAREER PROGRESS</span>
      </div>
      <div class="mission-layout">
        <section class="mission-panel season-pass">
          <small>SEASON 1</small><strong>URBAN<br />LEGENDS</strong><span class="season-badge">S1</span>
          <small>SEASON PROGRESS · LVL ${level}</small>
          <div class="progress-track"><i style="width:${progress.toFixed(1)}%"></i></div>
          <span class="hub-meta">${xp.toLocaleString('en-US')} / 6,000 XP</span>
        </section>
        <section class="mission-panel">
          <h3>DAILY QUESTS</h3>
          <div class="quest-list">
            ${quest('ϟ', 'Run 2500m in one run', stats.bestDistance, 2500, 'XP 250 · $150')}
            ${quest('$', 'Collect 100 coins', stats.coins, 100, 'XP 200 · $100')}
            ${quest('↑', 'Perform 3 jumps', stats.jumps, 3, 'XP 150 · $75')}
          </div>
          <h3 class="mission-subheading">WEEKLY CHALLENGES</h3>
          <div class="quest-list">
            ${quest('★', 'Score 100,000 points', stats.best, 100000, 'XP 1,000 · 50 RUSH')}
            ${quest('⌁', 'Slide under 15 obstacles', stats.slides, 15, 'XP 750 · 25 RUSH')}
            ${quest('◇', 'Perform 5 near misses', stats.nearMisses, 5, 'XP 500 · 20 RUSH')}
          </div>
        </section>
        <aside class="mission-panel">
          <h3>MILESTONE REWARDS</h3>
          <div class="reward-stack">
            <div class="reward-tile"><span>LVL 15 · LEGENDARY CRATE</span><strong>Exclusive Cosmetic</strong></div>
            <div class="reward-tile"><span>LVL 20 · SUBWAY TOKEN</span><strong>100 RUSH</strong></div>
            <div class="reward-tile"><span>LVL 25 · URBAN LEGEND</span><strong>Runner Skin</strong></div>
          </div>
        </aside>
      </div>`;
    }
    leaderboardMarkup() {
        return `
      <p class="eyebrow">SEASON 1 - URBAN LEGENDS</p>
      <h2 class="modal-title">Leaderboard</h2>
      <div class="leaderboard-layout">
        <section class="leaderboard-main">
          <div class="leaderboard-tabs"><button class="active">GLOBAL</button><button>FRIENDS</button><button>CLAN</button></div>
          <table class="leaderboard-table">
            <thead><tr><th>RANK</th><th>RUNNER</th><th>SCORE</th><th>COINS EARNED</th></tr></thead>
            <tbody>
              <tr><td>1</td><td>ShadowX</td><td>125,430,000</td><td>12,450</td></tr>
              <tr><td>2</td><td>NeonRunner</td><td>98,765,400</td><td>9,800</td></tr>
              <tr><td>3</td><td>MetroGhost</td><td>78,543,210</td><td>7,250</td></tr>
              <tr><td>4</td><td>ViperZ</td><td>62,345,670</td><td>6,100</td></tr>
              <tr><td>5</td><td>RailBreaker</td><td>58,765,120</td><td>5,600</td></tr>
              <tr><td>YOU</td><td>${this.wallet.getState().address ? this.shortAddress(this.wallet.getState().address ?? '') : 'Local Runner'}</td><td>${this.formatScore(this.bestScore)}</td><td>${this.coins}</td></tr>
            </tbody>
          </table>
        </section>
        <aside class="reward-panel"><small>TOURNAMENT REWARD POOL</small><span class="season-badge">S1</span><strong>250,000 RUSH</strong><small>TOTAL PRIZE POOL</small><div class="reward-list"><div><span>LEGEND</span><b>100,000 RUSH</b></div><div><span>ELITE</span><b>75,000 RUSH</b></div><div><span>PRO</span><b>50,000 RUSH</b></div><div><span>PARTICIPATION</span><b>25,000 RUSH</b></div></div></aside>
      </div>`;
    }
    storeMarkup() {
        const address = this.wallet.getState().address;
        return `
      <div class="hub-heading">
        <div><p class="eyebrow">GEAR UP · RUN HARD · OWN YOUR STYLE</p><h2 class="modal-title">Marketplace</h2></div>
        <span class="hub-meta">${address ? `WALLET ${this.shortAddress(address)}` : 'GUEST PREVIEW'}</span>
      </div>
      <div class="store-grid">
        <article class="store-card"><div class="store-card__art"></div><div class="store-card__copy"><small>BEST VALUE · 2,500 COINS</small><strong>CITY RUNNER BUNDLE</strong><p>Exclusive outfit, city-grip sneakers, and a rain-trail cosmetic.</p><button class="gold-btn" data-store-action="city-runner" type="button">VIEW BUNDLE</button></div></article>
        <article class="store-card"><div class="store-card__art"></div><div class="store-card__copy"><small>LIMITED · 1,800 COINS</small><strong>NEON VELOCITY PACK</strong><p>Metro Current outfit, luminous runner trail, and gear crate.</p><button class="gold-btn" data-store-action="neon-velocity" type="button">VIEW BUNDLE</button></div></article>
        <article class="store-card"><div class="store-card__art"></div><div class="store-card__copy"><small>ULTIMATE · 4,500 COINS</small><strong>LEGENDARY RUNNER PACK</strong><p>Ember Line outfit, premium city trail, and season cosmetics.</p><button class="gold-btn" data-store-action="legendary-runner" type="button">VIEW BUNDLE</button></div></article>
      </div>`;
    }
    settingsMarkup() {
        const active = (mode) => mode === this.quality ? ' active' : '';
        return `
      <p class="eyebrow">DISPLAY AND PERFORMANCE</p>
      <h2 class="modal-title">Settings</h2>
      <p class="modal-subtitle">The renderer adjusts resolution automatically during play. Choose a ceiling that matches the device.</p>
      <div class="quality-grid">
        <button class="quality-btn${active('performance')}" data-quality="performance"><strong>Performance</strong><small>0.65-1.0 render scale, no dynamic shadows, reduced environment density, and fastest mobile frame pacing.</small></button>
        <button class="quality-btn${active('balanced')}" data-quality="balanced"><strong>Balanced</strong><small>Adaptive resolution, desktop shadows, full obstacle telegraphing, and stable frame pacing.</small></button>
        <button class="quality-btn${active('cinematic')}" data-quality="cinematic"><strong>Cinematic</strong><small>Higher pixel ratio, richer lighting, and enhanced shadow detail for stronger hardware.</small></button>
      </div>
      <div class="settings-extra"><div class="settings-row"><span><strong>Keyboard</strong><small>A/D or arrows to move · W/Space to jump · S/Down to slide · Esc to pause</small></span><b>ACTIVE</b></div><div class="settings-row"><span><strong>Touch</strong><small>Swipe left/right/up/down or use the mobile control buttons</small></span><b>ACTIVE</b></div></div>`;
    }
    applyQuality(mode) {
        this.quality = mode;
        localStorage.setItem('shredrunner-quality', mode);
        this.configureQualityCaps();
        this.renderer.shadowMap.enabled = mode !== 'performance' && !this.mobile;
        this.scene.traverse((object) => {
            if (object instanceof THREE.DirectionalLight)
                object.castShadow = this.renderer.shadowMap.enabled && object.userData.primaryShadow === true;
        });
        this.renderer.toneMappingExposure = mode === 'cinematic' ? 1.2 : mode === 'performance' ? 1.08 : 1.15;
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(innerWidth, innerHeight, false);
        this.render();
    }
    configureQualityCaps() {
        if (this.quality === 'performance')
            this.pixelRatioCap = Math.min(devicePixelRatio, this.mobile ? 0.85 : 1);
        else if (this.quality === 'cinematic')
            this.pixelRatioCap = Math.min(devicePixelRatio, this.mobile ? 1.15 : 1.65);
        else
            this.pixelRatioCap = Math.min(devicePixelRatio, this.mobile ? 1 : 1.35);
        this.pixelRatio = Math.min(this.pixelRatioCap, this.quality === 'cinematic' ? 1.35 : this.mobile ? 0.9 : 1.15);
    }
    readQuality() {
        const stored = localStorage.getItem('shredrunner-quality');
        return stored === 'performance' || stored === 'cinematic' ? stored : 'balanced';
    }
    readOutfit() {
        const stored = localStorage.getItem('subway-rush-outfit');
        return ['shadow', 'metro', 'ember'].includes(stored) ? stored : 'shadow';
    }
    readCareerStats() {
        const defaults = {
            runs: 0,
            distance: 0,
            bestDistance: 0,
            coins: 0,
            jumps: 0,
            slides: 0,
            nearMisses: 0,
            best: this.bestScore,
        };
        try {
            const stored = JSON.parse(localStorage.getItem('subway-rush-career') ?? '{}');
            for (const key of Object.keys(defaults)) {
                const value = Number(stored[key]);
                if (Number.isFinite(value) && value >= 0)
                    defaults[key] = value;
            }
        }
        catch {
            // Invalid local progress should never stop guest play.
        }
        return defaults;
    }
    commitCareerStats() {
        const stats = this.readCareerStats();
        stats.runs += 1;
        stats.distance += Math.floor(this.distance);
        stats.bestDistance = Math.max(stats.bestDistance, Math.floor(this.distance));
        stats.coins += this.coins;
        stats.jumps += this.runJumps;
        stats.slides += this.runSlides;
        stats.nearMisses += this.runNearMisses;
        stats.best = Math.max(stats.best, Math.floor(this.score));
        localStorage.setItem('subway-rush-career', JSON.stringify(stats));
    }
    setPhase(phase) {
        this.phase = phase;
        this.menuEl.classList.toggle('screen--active', phase === 'menu');
        this.pauseEl.classList.toggle('screen--active', phase === 'paused');
        this.pauseEl.setAttribute('aria-hidden', String(phase !== 'paused'));
        this.gameOverEl.classList.toggle('screen--active', phase === 'game-over');
        this.gameOverEl.setAttribute('aria-hidden', String(phase !== 'game-over'));
        document.body.dataset.phase = phase;
        if (phase !== 'playing')
            document.documentElement.style.setProperty('--speed-intensity', '0');
    }
    showActionFeedback(message) {
        window.clearTimeout(this.actionFeedbackTimer);
        this.actionFeedbackEl.textContent = message;
        this.actionFeedbackEl.classList.add('show');
        this.actionFeedbackTimer = window.setTimeout(() => {
            this.actionFeedbackEl.classList.remove('show');
        }, 1300);
    }
    showToast(message, error = false) {
        window.clearTimeout(this.toastTimer);
        this.toastEl.textContent = message;
        this.toastEl.classList.toggle('error', error);
        this.toastEl.classList.add('show');
        this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 3600);
    }
    onResize = () => {
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(innerWidth, innerHeight);
        this.render();
    };
    formatScore(value) {
        return Math.floor(value).toLocaleString('en-US', { minimumIntegerDigits: 6, useGrouping: true });
    }
    shortAddress(address, length = 4) {
        if (address.length < length * 2 + 4)
            return address;
        return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
    }
    errorMessage(error) {
        if (error instanceof Error)
            return error.message;
        return 'The wallet request failed.';
    }
    mustGet(id) {
        const element = document.getElementById(id);
        if (!element)
            throw new Error(`Missing #${id}`);
        return element;
    }
}
