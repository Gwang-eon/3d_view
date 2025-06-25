// js/SceneManager.js
// ConfigManager 기반 완전 개선 버전 - 모든 하드코딩 제거

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 씬 관리 클래스
 * - ConfigManager 기반 설정 관리
 * - 의존성 주입 지원
 * - 자동 리사이징 및 성능 최적화
 * - 스크린샷 및 디버그 기능
 * - 메모리 관리 및 정리
 * - 카메라 전환 시스템
 * - 환경 설정 관리
 */
export class SceneManager {
    constructor(container = null) {
        // 컨테이너 설정
        this.container = this.resolveContainer(container);
        
        // Three.js 핵심 객체들
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // 조명 시스템
        this.lights = new Map();
        this.lightHelpers = new Map();
        
        // 환경 요소들
        this.gridHelper = null;
        this.axesHelper = null;
        this.floor = null;
        this.environment = null;
        
        // 현재 모델 정보
        this.currentModel = null;
        this.currentModelInfo = null;
        this.modelBounds = null;
        
        // 카메라 시스템
        this.gltfCameras = [];
        this.defaultCameraPosition = null;
        this.cameraTransitions = new Map();
        
        // 성능 모니터링
        this.stats = {
            triangles: 0,
            vertices: 0,
            meshes: 0,
            drawCalls: 0,
            lastFrameTime: 0,
            fps: 0,
            memoryUsage: 0
        };
        
        // 렌더링 상태
        this.renderingState = {
            isRendering: false,
            needsUpdate: true,
            lastRenderTime: 0,
            frameCount: 0
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 리사이즈 옵저버
        this.resizeObserver = null;
        
        // 애니메이션 프레임 ID
        this.animationId = null;
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // 바인드된 메서드들
        this.handleResize = this.handleResize.bind(this);
        this.handleConfigChange = this.handleConfigChange.bind(this);
        this.animate = this.animate.bind(this);
        
        // 초기화
        this.init();
        
        console.log('[SceneManager] 초기화 완료');
    }
    
    /**
     * 컨테이너 해결
     */
    resolveContainer(container) {
        if (container) {
            return typeof container === 'string' ? 
                document.querySelector(container) : container;
        }
        
        // ConfigManager에서 기본 컨테이너 가져오기
        const defaultSelector = getConfig('selectors.canvasContainer', '#canvas-container');
        const element = document.querySelector(defaultSelector);
        
        if (!element) {
            throw new Error(`씬 컨테이너를 찾을 수 없습니다: ${defaultSelector}`);
        }
        
        return element;
    }
    
    /**
     * 초기화
     */
    init() {
        try {
            // 기본 위치 저장
            this.saveDefaultCameraPosition();
            
            // Three.js 객체 생성
            this.createScene();
            this.createCamera();
            this.createRenderer();
            this.createLights();
            this.createControls();
            this.createEnvironment();
            
            // 이벤트 및 옵저버 설정
            this.setupEventListeners();
            this.setupResizeObserver();
            this.setupConfigObserver();
            
            // 렌더링 루프 시작
            this.startRenderLoop();
            
            // 개발 도구 설정
            if (getConfig('app.debug')) {
                this.setupDebugTools();
            }
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('[SceneManager] 초기화 실패:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * 기본 카메라 위치 저장
     */
    saveDefaultCameraPosition() {
        const cameraConfig = getConfig('scene.camera');
        this.defaultCameraPosition = new THREE.Vector3(
            cameraConfig.position.x,
            cameraConfig.position.y,
            cameraConfig.position.z
        );
    }
    
    /**
     * 씬 생성
     */
    createScene() {
        this.scene = new THREE.Scene();
        
        // 배경 설정
        const bgConfig = getConfig('scene.background');
        if (bgConfig.type === 'color') {
            this.scene.background = new THREE.Color(bgConfig.color);
        } else if (bgConfig.type === 'skybox' && bgConfig.skyboxPath) {
            this.loadSkybox(bgConfig.skyboxPath);
        }
        
        // 안개 설정
        const fogConfig = getConfig('scene.fog');
        if (fogConfig.enabled) {
            if (fogConfig.type === 'linear') {
                this.scene.fog = new THREE.Fog(
                    fogConfig.color,
                    fogConfig.near,
                    fogConfig.far
                );
            } else if (fogConfig.type === 'exponential') {
                this.scene.fog = new THREE.FogExp2(
                    fogConfig.color,
                    fogConfig.density
                );
            }
        }
        
        console.log('[SceneManager] ✓ 씬 생성됨');
    }
    
    /**
     * 스카이박스 로드
     */
    async loadSkybox(path) {
        try {
            const loader = new THREE.CubeTextureLoader();
            const texture = await loader.loadAsync([
                `${path}/px.jpg`, `${path}/nx.jpg`,
                `${path}/py.jpg`, `${path}/ny.jpg`,
                `${path}/pz.jpg`, `${path}/nz.jpg`
            ]);
            
            this.scene.background = texture;
            this.scene.environment = texture;
            
            console.log('[SceneManager] ✓ 스카이박스 로드됨');
        } catch (error) {
            console.warn('[SceneManager] 스카이박스 로드 실패:', error);
        }
    }
    
    /**
     * 카메라 생성
     */
    createCamera() {
        const cameraConfig = getConfig('scene.camera');
        
        // 종횡비 계산
        const aspect = this.container.clientWidth / this.container.clientHeight;
        
        // PerspectiveCamera 생성
        this.camera = new THREE.PerspectiveCamera(
            cameraConfig.fov,
            aspect,
            cameraConfig.near,
            cameraConfig.far
        );
        
        // 초기 위치 설정
        const pos = cameraConfig.position;
        this.camera.position.set(pos.x, pos.y, pos.z);
        
        // 타겟 설정
        const target = cameraConfig.target;
        this.camera.lookAt(new THREE.Vector3(target.x, target.y, target.z));
        
        console.log('[SceneManager] ✓ 카메라 생성됨');
    }
    
    /**
     * 렌더러 생성
     */
    createRenderer() {
        const rendererConfig = getConfig('scene.renderer');
        
        // WebGLRenderer 생성
        this.renderer = new THREE.WebGLRenderer({
            antialias: rendererConfig.antialias,
            alpha: rendererConfig.alpha,
            powerPreference: getConfig('performance.powerPreference', 'high-performance'),
            preserveDrawingBuffer: getConfig('scene.renderer.preserveDrawingBuffer', false)
        });
        
        // 크기 설정
        this.updateRendererSize();
        
        // 픽셀 비율 설정
        this.renderer.setPixelRatio(
            Math.min(rendererConfig.pixelRatio, window.devicePixelRatio)
        );
        
        // 색상 및 톤 매핑 설정
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = this.getToneMappingType(rendererConfig.toneMapping);
        this.renderer.toneMappingExposure = rendererConfig.exposure;
        
        // 그림자 설정
        if (rendererConfig.shadowMapEnabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = this.getShadowMapType(rendererConfig.shadowMapType);
            this.renderer.shadowMap.autoUpdate = rendererConfig.shadowMapAutoUpdate;
        }
        
        // 물리적 기반 렌더링 설정
        this.renderer.physicallyCorrectLights = rendererConfig.physicallyCorrectLights;
        
        // 컨테이너에 추가
        this.container.appendChild(this.renderer.domElement);
        
        console.log('[SceneManager] ✓ 렌더러 생성됨');
    }
    
    /**
     * 톤 매핑 타입 변환
     */
    getToneMappingType(typeString) {
        const types = {
            'NoToneMapping': THREE.NoToneMapping,
            'LinearToneMapping': THREE.LinearToneMapping,
            'ReinhardToneMapping': THREE.ReinhardToneMapping,
            'CineonToneMapping': THREE.CineonToneMapping,
            'ACESFilmicToneMapping': THREE.ACESFilmicToneMapping
        };
        return types[typeString] || THREE.ACESFilmicToneMapping;
    }
    
    /**
     * 그림자 맵 타입 변환
     */
    getShadowMapType(typeString) {
        const types = {
            'BasicShadowMap': THREE.BasicShadowMap,
            'PCFShadowMap': THREE.PCFShadowMap,
            'PCFSoftShadowMap': THREE.PCFSoftShadowMap,
            'VSMShadowMap': THREE.VSMShadowMap
        };
        return types[typeString] || THREE.PCFSoftShadowMap;
    }
    
    /**
     * 조명 생성
     */
    createLights() {
        const lightingConfig = getConfig('scene.lighting');
        
        // 주변광 (Ambient Light)
        if (lightingConfig.ambient?.enabled) {
            const ambient = lightingConfig.ambient;
            const ambientLight = new THREE.AmbientLight(
                ambient.color,
                ambient.intensity
            );
            ambientLight.name = 'AmbientLight';
            
            this.scene.add(ambientLight);
            this.lights.set('ambient', ambientLight);
        }
        
        // 직사광 (Directional Light)
        if (lightingConfig.directional?.enabled) {
            const directional = lightingConfig.directional;
            const directionalLight = new THREE.DirectionalLight(
                directional.color,
                directional.intensity
            );
            
            // 위치 설정
            const pos = directional.position;
            directionalLight.position.set(pos.x, pos.y, pos.z);
            
            // 그림자 설정
            if (directional.castShadow) {
                directionalLight.castShadow = true;
                directionalLight.shadow.mapSize.width = directional.shadowMapSize;
                directionalLight.shadow.mapSize.height = directional.shadowMapSize;
                directionalLight.shadow.camera.near = directional.shadowCameraNear;
                directionalLight.shadow.camera.far = directional.shadowCameraFar;
                directionalLight.shadow.camera.left = -directional.shadowCameraSize;
                directionalLight.shadow.camera.right = directional.shadowCameraSize;
                directionalLight.shadow.camera.top = directional.shadowCameraSize;
                directionalLight.shadow.camera.bottom = -directional.shadowCameraSize;
                directionalLight.shadow.bias = directional.shadowBias;
            }
            
            directionalLight.name = 'DirectionalLight';
            this.scene.add(directionalLight);
            this.lights.set('directional', directionalLight);
            
            // 헬퍼 추가 (디버그 모드)
            if (getConfig('app.debug') && directional.showHelper) {
                const helper = new THREE.DirectionalLightHelper(directionalLight, 5);
                this.scene.add(helper);
                this.lightHelpers.set('directional', helper);
            }
        }
        
        // 반구광 (Hemisphere Light)
        if (lightingConfig.hemisphere?.enabled) {
            const hemisphere = lightingConfig.hemisphere;
            const hemisphereLight = new THREE.HemisphereLight(
                hemisphere.skyColor,
                hemisphere.groundColor,
                hemisphere.intensity
            );
            hemisphereLight.name = 'HemisphereLight';
            
            this.scene.add(hemisphereLight);
            this.lights.set('hemisphere', hemisphereLight);
        }
        
        console.log(`[SceneManager] ✓ ${this.lights.size}개 조명 생성됨`);
    }
    
    /**
     * 컨트롤 생성
     */
    createControls() {
        if (!window.THREE.OrbitControls) {
            console.warn('[SceneManager] OrbitControls를 사용할 수 없습니다.');
            return;
        }
        
        const controlsConfig = getConfig('scene.controls');
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // 기본 설정
        this.controls.enableDamping = controlsConfig.enableDamping;
        this.controls.dampingFactor = controlsConfig.dampingFactor;
        this.controls.enableZoom = controlsConfig.enableZoom;
        this.controls.enableRotate = controlsConfig.enableRotate;
        this.controls.enablePan = controlsConfig.enablePan;
        
        // 제한 설정
        this.controls.minDistance = controlsConfig.minDistance;
        this.controls.maxDistance = controlsConfig.maxDistance;
        this.controls.minPolarAngle = controlsConfig.minPolarAngle;
        this.controls.maxPolarAngle = controlsConfig.maxPolarAngle;
        
        // 속도 설정
        this.controls.rotateSpeed = controlsConfig.rotateSpeed;
        this.controls.zoomSpeed = controlsConfig.zoomSpeed;
        this.controls.panSpeed = controlsConfig.panSpeed;
        
        // 타겟 설정
        const target = controlsConfig.target;
        this.controls.target.set(target.x, target.y, target.z);
        
        // 자동 회전
        this.controls.autoRotate = controlsConfig.autoRotate;
        this.controls.autoRotateSpeed = controlsConfig.autoRotateSpeed;
        
        this.controls.update();
        
        console.log('[SceneManager] ✓ 컨트롤 생성됨');
    }
    
    /**
     * 환경 요소 생성
     */
    createEnvironment() {
        const envConfig = getConfig('scene.environment');
        
        // 그리드 헬퍼
        if (envConfig.grid?.enabled) {
            const grid = envConfig.grid;
            this.gridHelper = new THREE.GridHelper(
                grid.size,
                grid.divisions,
                grid.colorCenterLine,
                grid.colorGrid
            );
            this.gridHelper.name = 'GridHelper';
            this.scene.add(this.gridHelper);
        }
        
        // 축 헬퍼 (디버그 모드)
        if (getConfig('app.debug') && envConfig.axes?.enabled) {
            const axes = envConfig.axes;
            this.axesHelper = new THREE.AxesHelper(axes.size);
            this.axesHelper.name = 'AxesHelper';
            this.scene.add(this.axesHelper);
        }
        
        // 바닥면
        if (envConfig.floor?.enabled) {
            this.createFloor(envConfig.floor);
        }
        
        console.log('[SceneManager] ✓ 환경 요소 생성됨');
    }
    
    /**
     * 바닥면 생성
     */
    createFloor(floorConfig) {
        const geometry = new THREE.PlaneGeometry(
            floorConfig.size,
            floorConfig.size
        );
        
        let material;
        if (floorConfig.texture) {
            const textureLoader = new THREE.TextureLoader();
            const texture = textureLoader.load(floorConfig.texture);
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(floorConfig.textureRepeat, floorConfig.textureRepeat);
            
            material = new THREE.MeshLambertMaterial({
                map: texture,
                transparent: floorConfig.transparent,
                opacity: floorConfig.opacity
            });
        } else {
            material = new THREE.MeshLambertMaterial({
                color: floorConfig.color,
                transparent: floorConfig.transparent,
                opacity: floorConfig.opacity
            });
        }
        
        this.floor = new THREE.Mesh(geometry, material);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = floorConfig.y;
        this.floor.receiveShadow = floorConfig.receiveShadow;
        this.floor.name = 'Floor';
        
        this.scene.add(this.floor);
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 윈도우 리사이즈
        window.addEventListener('resize', this.handleResize);
        
        // 가시성 변경 (성능 최적화)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseRendering();
            } else {
                this.resumeRendering();
            }
        });
        
        console.log('[SceneManager] ✓ 이벤트 리스너 설정됨');
    }
    
    /**
     * 리사이즈 옵저버 설정
     */
    setupResizeObserver() {
        if (!window.ResizeObserver) return;
        
        this.resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.target === this.container) {
                    this.handleResize();
                    break;
                }
            }
        });
        
        this.resizeObserver.observe(this.container);
    }
    
    /**
     * 설정 변경 옵저버 설정
     */
    setupConfigObserver() {
        // ConfigManager의 변경 알림 구독
        if (typeof getConfig === 'function' && getConfig.addChangeListener) {
            getConfig.addChangeListener(this.handleConfigChange);
        }
    }
    
    /**
     * 디버그 도구 설정
     */
    setupDebugTools() {
        // Stats.js 통합
        if (window.Stats) {
            this.statsMonitor = new Stats();
            this.statsMonitor.showPanel(0); // FPS
            document.body.appendChild(this.statsMonitor.dom);
        }
        
        // 전역 접근 (디버깅용)
        window.sceneManager = this;
        
        // 디버그 메뉴 생성
        this.createDebugMenu();
    }
    
    /**
     * 디버그 메뉴 생성
     */
    createDebugMenu() {
        const debugMenu = document.createElement('div');
        debugMenu.id = 'scene-debug-menu';
        debugMenu.style.cssText = `
            position: fixed; top: 10px; left: 10px; z-index: 10000;
            background: rgba(0,0,0,0.8); color: white; padding: 10px;
            border-radius: 5px; font-family: monospace; font-size: 12px;
        `;
        
        debugMenu.innerHTML = `
            <div><strong>SceneManager Debug</strong></div>
            <div>FPS: <span id="debug-fps">0</span></div>
            <div>Objects: <span id="debug-objects">0</span></div>
            <div>Triangles: <span id="debug-triangles">0</span></div>
            <div>Memory: <span id="debug-memory">0</span>MB</div>
            <button onclick="sceneManager.debug()">Log Info</button>
            <button onclick="sceneManager.takeScreenshot()">Screenshot</button>
        `;
        
        document.body.appendChild(debugMenu);
    }
    
    /**
     * 렌더링 루프 시작
     */
    startRenderLoop() {
        if (this.renderingState.isRendering) return;
        
        this.renderingState.isRendering = true;
        this.animate();
        
        console.log('[SceneManager] ✓ 렌더링 루프 시작됨');
    }
    
    /**
     * 애니메이션 루프
     */
    animate() {
        if (!this.renderingState.isRendering) return;
        
        this.animationId = requestAnimationFrame(this.animate);
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.renderingState.lastRenderTime;
        
        // FPS 제한 체크
        const targetFPS = getConfig('performance.targetFPS', 60);
        const frameInterval = 1000 / targetFPS;
        
        if (deltaTime >= frameInterval) {
            // 성능 모니터링 시작
            if (this.statsMonitor) {
                this.statsMonitor.begin();
            }
            
            // 업데이트
            this.update(deltaTime);
            
            // 렌더링
            this.render();
            
            // 통계 업데이트
            this.updateStats(currentTime);
            
            this.renderingState.lastRenderTime = currentTime;
            this.renderingState.frameCount++;
            
            // 성능 모니터링 종료
            if (this.statsMonitor) {
                this.statsMonitor.end();
            }
        }
    }
    
    /**
     * 업데이트
     */
    update(deltaTime) {
        // 컨트롤 업데이트
        if (this.controls) {
            this.controls.update();
        }
        
        // 앱에서 추가 업데이트 처리
        this.emit('update', deltaTime);
    }
    
    /**
     * 렌더링
     */
    render() {
        if (!this.renderer || !this.scene || !this.camera) return;
        
        this.renderer.render(this.scene, this.camera);
        this.emit('render');
    }
    
    /**
     * 통계 업데이트
     */
    updateStats(currentTime) {
        // FPS 계산
        if (this.renderingState.frameCount % 60 === 0) {
            this.stats.fps = Math.round(1000 / (currentTime - this.stats.lastFrameTime));
            this.stats.lastFrameTime = currentTime;
        }
        
        // 렌더링 정보 업데이트
        if (this.renderer.info) {
            const info = this.renderer.info;
            this.stats.triangles = info.render.triangles;
            this.stats.drawCalls = info.render.calls;
            this.stats.memoryUsage = Math.round(info.memory.geometries + info.memory.textures);
        }
        
        // 씬 객체 수
        this.stats.meshes = this.countMeshes(this.scene);
        
        // 디버그 UI 업데이트
        this.updateDebugUI();
    }
    
    /**
     * 메시 수 계산
     */
    countMeshes(object) {
        let count = 0;
        object.traverse(child => {
            if (child.isMesh) count++;
        });
        return count;
    }
    
    /**
     * 디버그 UI 업데이트
     */
    updateDebugUI() {
        if (!getConfig('app.debug')) return;
        
        const fpsEl = document.getElementById('debug-fps');
        const objectsEl = document.getElementById('debug-objects');
        const trianglesEl = document.getElementById('debug-triangles');
        const memoryEl = document.getElementById('debug-memory');
        
        if (fpsEl) fpsEl.textContent = this.stats.fps;
        if (objectsEl) objectsEl.textContent = this.scene.children.length;
        if (trianglesEl) trianglesEl.textContent = this.stats.triangles.toLocaleString();
        if (memoryEl) memoryEl.textContent = this.stats.memoryUsage;
    }
    
    /**
     * 모델 설정
     */
    setModel(model, modelInfo = null) {
        // 기존 모델 제거
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        // 새 모델 추가
        this.currentModel = model;
        this.currentModelInfo = modelInfo;
        
        if (model) {
            this.scene.add(model);
            
            // 모델 경계 계산
            this.calculateModelBounds(model);
            
            // 카메라 조정
            this.fitCameraToModel();
            
            // GLTF 카메라 추출
            this.extractGLTFCameras(model);
        }
        
        this.emit('model:changed', { model, modelInfo });
        console.log('[SceneManager] 모델 설정됨:', modelInfo?.name || '익명');
    }
    
    /**
     * 모델 경계 계산
     */
    calculateModelBounds(model) {
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        this.modelBounds = { box, center, size };
        
        // 컨트롤 타겟 조정
        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.update();
        }
    }
    
    /**
     * 카메라를 모델에 맞게 조정
     */
    fitCameraToModel() {
        if (!this.modelBounds || !this.camera) return;
        
        const { center, size } = this.modelBounds;
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
        
        // 카메라 위치 조정
        const direction = this.camera.position.clone().sub(center).normalize();
        this.camera.position.copy(center).add(direction.multiplyScalar(distance * 1.5));
        
        // 컨트롤 거리 제한 조정
        if (this.controls) {
            this.controls.minDistance = distance * 0.1;
            this.controls.maxDistance = distance * 3;
            this.controls.update();
        }
    }
    
    /**
     * GLTF 카메라 추출
     */
    extractGLTFCameras(model) {
        this.gltfCameras = [];
        
        model.traverse(child => {
            if (child.isCamera) {
                this.gltfCameras.push({
                    name: child.name || `Camera_${this.gltfCameras.length}`,
                    camera: child,
                    position: child.position.clone(),
                    rotation: child.rotation.clone()
                });
            }
        });
        
        if (this.gltfCameras.length > 0) {
            console.log(`[SceneManager] ${this.gltfCameras.length}개 GLTF 카메라 발견됨`);
            this.emit('cameras:found', this.gltfCameras);
        }
    }
    
    /**
     * 카메라 전환
     */
    switchToCamera(cameraInfo, duration = 1000) {
        if (!cameraInfo || !this.camera) return;
        
        return new Promise((resolve) => {
            const startPos = this.camera.position.clone();
            const startRot = this.camera.rotation.clone();
            const targetPos = cameraInfo.position.clone();
            const targetRot = cameraInfo.rotation.clone();
            
            const startTime = performance.now();
            
            const animate = () => {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutQuad(progress);
                
                // 위치 보간
                this.camera.position.lerpVectors(startPos, targetPos, eased);
                
                // 회전 보간 (쿼터니언 사용)
                const startQuat = new THREE.Quaternion().setFromEuler(startRot);
                const targetQuat = new THREE.Quaternion().setFromEuler(targetRot);
                const currentQuat = new THREE.Quaternion().slerpQuaternions(startQuat, targetQuat, eased);
                this.camera.setRotationFromQuaternion(currentQuat);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.emit('camera:switched', cameraInfo);
                    resolve();
                }
            };
            
            animate();
        });
    }
    
    /**
     * 이징 함수
     */
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    /**
     * 기본 카메라로 복귀
     */
    resetCamera(duration = 1000) {
        const defaultInfo = {
            position: this.defaultCameraPosition,
            rotation: new THREE.Euler(0, 0, 0)
        };
        return this.switchToCamera(defaultInfo, duration);
    }
    
    /**
     * 스크린샷 촬영
     */
    takeScreenshot(filename = 'wall-viewer-screenshot.png') {
        if (!this.renderer) return;
        
        // 현재 프레임 렌더링
        this.render();
        
        // 이미지 데이터 추출
        const imageData = this.renderer.domElement.toDataURL('image/png');
        
        // 다운로드 링크 생성
        const link = document.createElement('a');
        link.download = filename;
        link.href = imageData;
        link.click();
        
        this.emit('screenshot:taken', filename);
        console.log('[SceneManager] 스크린샷 촬영됨:', filename);
    }
    
    /**
     * 렌더링 일시정지
     */
    pauseRendering() {
        this.renderingState.isRendering = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        console.log('[SceneManager] 렌더링 일시정지됨');
    }
    
    /**
     * 렌더링 재개
     */
    resumeRendering() {
        if (!this.renderingState.isRendering) {
            this.startRenderLoop();
            console.log('[SceneManager] 렌더링 재개됨');
        }
    }
    
    /**
     * 리사이즈 처리
     */
    handleResize() {
        if (!this.camera || !this.renderer) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        // 카메라 종횡비 업데이트
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // 렌더러 크기 업데이트
        this.renderer.setSize(width, height);
        
        this.emit('resize', { width, height });
    }
    
    /**
     * 렌더러 크기 업데이트
     */
    updateRendererSize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.renderer.setSize(width, height);
    }
    
    /**
     * 설정 변경 처리
     */
    handleConfigChange(key, value) {
        // 카메라 설정 변경
        if (key.startsWith('scene.camera.')) {
            const prop = key.split('.').pop();
            if (prop === 'fov' && this.camera) {
                this.camera.fov = value;
                this.camera.updateProjectionMatrix();
            }
        }
        
        // 렌더러 설정 변경
        if (key.startsWith('scene.renderer.')) {
            const prop = key.split('.').pop();
            if (prop === 'pixelRatio' && this.renderer) {
                this.renderer.setPixelRatio(Math.min(value, window.devicePixelRatio));
            }
        }
        
        // 조명 설정 변경
        if (key.startsWith('scene.lighting.')) {
            this.updateLightFromConfig(key, value);
        }
    }
    
    /**
     * 조명 설정 업데이트
     */
    updateLightFromConfig(key, value) {
        const parts = key.split('.');
        if (parts.length < 4) return;
        
        const lightType = parts[2]; // ambient, directional, etc.
        const property = parts[3]; // intensity, color, etc.
        
        const light = this.lights.get(lightType);
        if (!light) return;
        
        switch (property) {
            case 'intensity':
                light.intensity = value;
                break;
            case 'color':
                light.color.setHex(value);
                break;
            case 'position':
                if (light.position && typeof value === 'object') {
                    light.position.set(value.x, value.y, value.z);
                }
                break;
        }
    }
    
    /**
     * 앱 참조 설정 (의존성 주입)
     */
    setApp(app) {
        this.app = app;
    }
    
    /**
     * 정리
     */
    dispose() {
        // 렌더링 중지
        this.pauseRendering();
        
        // 이벤트 리스너 제거
        window.removeEventListener('resize', this.handleResize);
        
        // 리사이즈 옵저버 해제
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // 설정 옵저버 해제
        if (typeof getConfig === 'function' && getConfig.removeChangeListener) {
            getConfig.removeChangeListener(this.handleConfigChange);
        }
        
        // 모델 제거
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        // 조명 제거
        this.lights.forEach(light => {
            this.scene.remove(light);
        });
        this.lights.clear();
        
        // 헬퍼 제거
        this.lightHelpers.forEach(helper => {
            this.scene.remove(helper);
        });
        this.lightHelpers.clear();
        
        // 환경 요소 제거
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
        }
        if (this.axesHelper) {
            this.scene.remove(this.axesHelper);
        }
        if (this.floor) {
            this.scene.remove(this.floor);
        }
        
        // 렌더러 정리
        if (this.renderer) {
            this.renderer.dispose();
            if (this.container && this.renderer.domElement.parentNode) {
                this.container.removeChild(this.renderer.domElement);
            }
        }
        
        // 컨트롤 정리
        if (this.controls) {
            this.controls.dispose();
        }
        
        // 디버그 도구 정리
        if (this.statsMonitor && this.statsMonitor.dom.parentNode) {
            this.statsMonitor.dom.parentNode.removeChild(this.statsMonitor.dom);
        }
        
        const debugMenu = document.getElementById('scene-debug-menu');
        if (debugMenu) {
            debugMenu.remove();
        }
        
        this.emit('disposed');
        console.log('[SceneManager] 정리 완료');
    }
    
    /**
     * 이벤트 시스템
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
    }
    
    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
    }
    
    emit(event, ...args) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[SceneManager] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[SceneManager] 디버그 정보');
        console.log('컨테이너:', this.container);
        console.log('씬 객체 수:', this.scene.children.length);
        console.log('카메라 위치:', this.camera.position);
        console.log('카메라 타겟:', this.controls?.target);
        console.log('조명 수:', this.lights.size);
        console.log('현재 모델:', this.currentModelInfo?.name || '없음');
        console.log('모델 경계:', this.modelBounds);
        console.log('GLTF 카메라 수:', this.gltfCameras.length);
        console.log('통계:', this.stats);
        console.log('렌더러 정보:', {
            size: { 
                width: this.renderer.domElement.width, 
                height: this.renderer.domElement.height 
            },
            pixelRatio: this.renderer.getPixelRatio(),
            shadowMap: this.renderer.shadowMap.enabled
        });
        console.groupEnd();
    }
    
    /**
     * 통계 정보 가져오기
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * 현재 모델 정보 가져오기
     */
    getCurrentModelInfo() {
        return this.currentModelInfo;
    }
    
    /**
     * GLTF 카메라 목록 가져오기
     */
    getGLTFCameras() {
        return [...this.gltfCameras];
    }
}

export default SceneManager;