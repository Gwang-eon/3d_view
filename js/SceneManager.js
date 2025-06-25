// SceneManager.js - 수정된 createEnvironment 메서드

import { CONFIG } from './config.js';
import { CameraTransitionManager } from './CameraTransitionManager.js';

export class SceneManager {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.gridHelper = null;
        this.floor = null;
        this.currentModel = null;
        this.lights = {};
        this.gltfCameras = [];
        this.cameraTransition = null;
        
        // 기본 카메라 위치
        this.defaultCameraPosition = new THREE.Vector3(
            CONFIG.camera.position.x,
            CONFIG.camera.position.y,
            CONFIG.camera.position.z
        );
        
        // 카메라 전환 콜백
        this.onCameraTransitionStart = null;
        this.onCameraTransitionEnd = null;
        
        // 카메라 속도 설정
        this.cameraSpeedMultiplier = 1.0;
        
        this.init();
    }
    
    init() {
        console.log('[SceneManager] 초기화 시작');
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createControls();
        this.createLights();
        this.createEnvironment();
        this.setupEventListeners();
        this.setupAdaptiveSpeed();
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.scene.backgroundColor);
        this.scene.fog = new THREE.Fog(
            CONFIG.scene.fogColor,
            CONFIG.scene.fogNear,
            CONFIG.scene.fogFar
        );
    }
    
    createCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.camera.fov,
            aspect,
            CONFIG.camera.near,
            CONFIG.camera.far
        );
        this.camera.position.set(
            CONFIG.camera.position.x,
            CONFIG.camera.position.y,
            CONFIG.camera.position.z
        );
        this.camera.lookAt(0, 0, 0);
    }
    
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: CONFIG.renderer.antialias,
            alpha: true,
            powerPreference: CONFIG.renderer.powerPreference || "high-performance"
        });
        
        const container = document.getElementById('canvas-container');
        container.appendChild(this.renderer.domElement);
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // 그림자 설정
        this.renderer.shadowMap.enabled = CONFIG.renderer.shadowMapEnabled;
        this.renderer.shadowMap.type = CONFIG.renderer.shadowMapType || THREE.PCFSoftShadowMap;
        
        // 톤매핑 설정
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = CONFIG.renderer.toneMappingExposure || 1.0;
    }
    
    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = CONFIG.controls.enableDamping;
        this.controls.dampingFactor = CONFIG.controls.dampingFactor;
        this.controls.rotateSpeed = CONFIG.controls.rotateSpeed;
        this.controls.zoomSpeed = CONFIG.controls.zoomSpeed;
        this.controls.panSpeed = CONFIG.controls.panSpeed;
        this.controls.minDistance = CONFIG.controls.minDistance;
        this.controls.maxDistance = CONFIG.controls.maxDistance;
        this.controls.minPolarAngle = CONFIG.controls.minPolarAngle;
        this.controls.maxPolarAngle = CONFIG.controls.maxPolarAngle;
        this.controls.enableZoom = CONFIG.controls.enableZoom;
        this.controls.enableRotate = CONFIG.controls.enableRotate;
        this.controls.enablePan = CONFIG.controls.enablePan;
        this.controls.autoRotate = CONFIG.controls.autoRotate;
        this.controls.autoRotateSpeed = CONFIG.controls.autoRotateSpeed;
        
        // CameraTransitionManager 초기화
        this.cameraTransition = new CameraTransitionManager(this.camera, this.controls);
    }
    
    createLights() {
        // 앰비언트 라이트
        const ambientLight = CONFIG.lights.ambient;
        this.lights.ambient = new THREE.AmbientLight(ambientLight.color, ambientLight.intensity);
        this.scene.add(this.lights.ambient);
        
        // 디렉셔널 라이트
        const directionalLight = CONFIG.lights.directional;
        this.lights.directional = new THREE.DirectionalLight(
            directionalLight.color,
            directionalLight.intensity
        );
        this.lights.directional.position.set(
            directionalLight.position.x,
            directionalLight.position.y,
            directionalLight.position.z
        );
        this.lights.directional.castShadow = directionalLight.castShadow;
        
        // 그림자 설정
        const shadow = directionalLight.shadow;
        this.lights.directional.shadow.mapSize.width = shadow.mapSize;
        this.lights.directional.shadow.mapSize.height = shadow.mapSize;
        this.lights.directional.shadow.camera.near = shadow.camera.near;
        this.lights.directional.shadow.camera.far = shadow.camera.far;
        this.lights.directional.shadow.camera.left = shadow.camera.left;
        this.lights.directional.shadow.camera.right = shadow.camera.right;
        this.lights.directional.shadow.camera.top = shadow.camera.top;
        this.lights.directional.shadow.camera.bottom = shadow.camera.bottom;
        
        this.scene.add(this.lights.directional);
    }
    
    createEnvironment() {
        console.log('[SceneManager] 환경 요소 생성 시작');
        
        // CONFIG.scene.grid 설정 사용 (config.js의 구조에 맞게)
        const gridConfig = CONFIG.scene.grid;
        if (gridConfig && gridConfig.visible !== false) {
            this.gridHelper = new THREE.GridHelper(
                gridConfig.size || 50,
                gridConfig.divisions || 50,
                gridConfig.centerLineColor || 0x444444,
                gridConfig.gridColor || 0x222222
            );
            this.scene.add(this.gridHelper);
            console.log('[SceneManager] 그리드 생성 완료');
        }
        
        // 바닥 생성 - scene.environment.floor가 있으면 사용, 없으면 기본값
        const floorConfig = CONFIG.scene.environment?.floor || {
            enabled: true,
            size: 100,
            color: 0x202020,
            y: -0.01,
            receiveShadow: true,
            transparent: false,
            opacity: 1.0
        };
        
        if (floorConfig.enabled !== false) {
            const floorGeometry = new THREE.PlaneGeometry(
                floorConfig.size || 100,
                floorConfig.size || 100
            );
            const floorMaterial = new THREE.MeshStandardMaterial({
                color: floorConfig.color || 0x202020,
                roughness: 0.8,
                metalness: 0.2,
                transparent: floorConfig.transparent || false,
                opacity: floorConfig.opacity || 1.0
            });
            
            this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
            this.floor.rotation.x = -Math.PI / 2;
            this.floor.position.y = floorConfig.y || -0.01;
            this.floor.receiveShadow = floorConfig.receiveShadow !== false;
            this.floor.visible = true; // 초기에는 보이도록 설정
            this.scene.add(this.floor);
            console.log('[SceneManager] 바닥 생성 완료');
        }
        
        // 축 헬퍼 (디버그 모드에서만)
        if (CONFIG.app?.debug && CONFIG.scene.axes?.visible) {
            const axesHelper = new THREE.AxesHelper(CONFIG.scene.axes.size || 10);
            this.scene.add(axesHelper);
            console.log('[SceneManager] 축 헬퍼 생성 완료');
        }
        
        console.log('[SceneManager] 환경 요소 생성 완료');
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }
    
    setupAdaptiveSpeed() {
        // 컨트롤 변경 시 적응형 속도 업데이트
        if (this.controls) {
            const originalUpdate = this.controls.update.bind(this.controls);
            this.controls.update = () => {
                originalUpdate();
                if (this.cameraTransition) {
                    this.cameraTransition.calculateAdaptiveSpeed();
                }
            };
        }
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // 모델 관리
    addModel(model) {
        if (this.currentModel) {
            this.removeModel(this.currentModel);
        }
        this.currentModel = model;
        this.scene.add(model);
        this.setEnvironmentVisible(false); // 모델 로드 시 그리드/바닥 자동 숨김
    }
    
    removeModel(model) {
        if (!model) return;
        this.scene.remove(model);
        model.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
    
    // 모델 설정 (개선된 버전)
    setModel(model, gltfCameras = []) {
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        this.currentModel = model;
        this.gltfCameras = gltfCameras;
        this.scene.add(model);
        
        console.log(`[SceneManager] 모델 설정 완료, GLTF 카메라: ${gltfCameras.length}개`);
        
        // 모델 중심으로 컨트롤 타겟 설정
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        this.controls.target.copy(center);
        this.controls.update();
        
        // 그리드/바닥 자동 숨김
        this.setEnvironmentVisible(false);
    }
    
    setEnvironmentVisible(visible) {
        if (this.gridHelper) this.gridHelper.visible = visible;
        if (this.floor) this.floor.visible = visible;
    }
    
    toggleGrid() {
        this.setEnvironmentVisible(!this.gridHelper.visible);
    }
    
    // 카메라 뷰 설정 - 개선된 버전
    setCameraView(viewName, options = {}) {
        console.log(`[SceneManager] 카메라 뷰 변경: ${viewName}`);
        
        // 전환 시작 콜백
        if (this.onCameraTransitionStart) {
            this.onCameraTransitionStart(viewName);
        }
        
        // 옵션에 속도 배수 적용
        const transitionOptions = {
            ...options,
            duration: (options.duration || CONFIG.cameraTransition.defaultDuration) * this.cameraSpeedMultiplier
        };
        
        // 전환 유형별 처리
        if (!this.cameraTransition) {
            console.error('[SceneManager] CameraTransitionManager가 초기화되지 않았습니다.');
            return;
        }
        
        switch (viewName) {
            case 'default':
                this.resetToDefaultView(transitionOptions);
                break;
            case 'top':
                this.setOrthogonalView('top', transitionOptions);
                break;
            case 'front':
                this.setOrthogonalView('front', transitionOptions);
                break;
            case 'left':
                this.setOrthogonalView('left', transitionOptions);
                break;
            case 'right':
                this.setOrthogonalView('right', transitionOptions);
                break;
            case 'iso':
                this.setIsometricView(transitionOptions);
                break;
            default:
                // GLTF 카메라 또는 커스텀 뷰 처리
                if (viewName.startsWith('gltf-')) {
                    this.switchToGLTFCamera(viewName, transitionOptions);
                } else if (viewName.startsWith('orbit-')) {
                    this.orbitAroundModel(viewName, transitionOptions);
                } else if (viewName.startsWith('zoom-')) {
                    this.handleZoom(viewName, transitionOptions);
                } else {
                    this.fallbackCameraView(viewName);
                }
        }
    }
    
    // 기본 뷰로 리셋
    resetToDefaultView(options) {
        this.cameraTransition.transitionTo(
            this.defaultCameraPosition.clone(),
            null,
            CONFIG.camera.fov,
            {
                ...options,
                onComplete: () => {
                    console.log('[SceneManager] 기본 뷰로 리셋 완료');
                    if (this.onCameraTransitionEnd) {
                        this.onCameraTransitionEnd('default');
                    }
                }
            }
        ).catch(error => {
            console.error('[SceneManager] 기본 뷰 전환 실패:', error);
        });
    }
    
    // 직교 뷰 설정
    setOrthogonalView(direction, options) {
        let position;
        const distance = 20;
        const target = this.controls.target.clone();
        
        switch (direction) {
            case 'top':
                position = new THREE.Vector3(target.x, target.y + distance, target.z);
                break;
            case 'front':
                position = new THREE.Vector3(target.x, target.y, target.z + distance);
                break;
            case 'left':
                position = new THREE.Vector3(target.x - distance, target.y, target.z);
                break;
            case 'right':
                position = new THREE.Vector3(target.x + distance, target.y, target.z);
                break;
        }
        
        this.cameraTransition.transitionTo(position, null, this.camera.fov, {
            ...options,
            lookAt: target,
            onComplete: () => {
                console.log(`[SceneManager] ${direction} 뷰 전환 완료`);
                if (this.onCameraTransitionEnd) {
                    this.onCameraTransitionEnd(direction);
                }
            }
        }).catch(error => {
            console.error(`[SceneManager] ${direction} 뷰 전환 실패:`, error);
            this.fallbackCameraView(direction);
        });
    }
    
    // 아이소메트릭 뷰
    setIsometricView(options) {
        const distance = 20;
        const target = this.controls.target.clone();
        const position = new THREE.Vector3(
            target.x + distance,
            target.y + distance,
            target.z + distance
        );
        
        this.cameraTransition.transitionTo(position, null, this.camera.fov, {
            ...options,
            lookAt: target,
            onComplete: () => {
                console.log('[SceneManager] 아이소메트릭 뷰 전환 완료');
                if (this.onCameraTransitionEnd) {
                    this.onCameraTransitionEnd('iso');
                }
            }
        }).catch(error => {
            console.error('[SceneManager] 아이소메트릭 뷰 전환 실패:', error);
            this.fallbackCameraView('iso');
        });
    }
    
    // GLTF 카메라로 전환
    switchToGLTFCamera(viewName, options) {
        const cameraIndex = parseInt(viewName.replace('gltf-', ''));
        const gltfCamera = this.gltfCameras[cameraIndex];
        
        if (gltfCamera) {
            console.log(`[SceneManager] GLTF 카메라 ${cameraIndex}로 전환`);
            
            this.cameraTransition.switchToGLTFCamera(gltfCamera, {
                ...options,
                onComplete: () => {
                    console.log(`[SceneManager] GLTF 카메라 ${cameraIndex} 전환 완료`);
                    if (this.onCameraTransitionEnd) {
                        this.onCameraTransitionEnd(viewName);
                    }
                }
            }).catch(error => {
                console.error('[SceneManager] GLTF 카메라 전환 실패:', error);
                this.fallbackCameraView(viewName);
            });
        }
    }
    
    // 모델 주위 회전
    orbitAroundModel(viewName, options) {
        const angle = parseInt(viewName.replace('orbit-', '')) * (Math.PI / 180);
        
        if (this.currentModel) {
            const box = new THREE.Box3().setFromObject(this.currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const distance = maxDim * 2;
            
            const targetPosition = new THREE.Vector3(
                center.x + distance * Math.cos(angle),
                center.y + distance * 0.5,
                center.z + distance * Math.sin(angle)
            );
            
            this.cameraTransition.transitionTo(targetPosition, null, this.camera.fov, {
                ...options,
                lookAt: center,
                onComplete: () => {
                    console.log(`[SceneManager] ${angle}도 궤도 뷰 완료`);
                    if (this.onCameraTransitionEnd) {
                        this.onCameraTransitionEnd(viewName);
                    }
                }
            }).catch(error => {
                console.error('[SceneManager] 궤도 뷰 전환 실패:', error);
            });
        }
    }
    
    // 줌 처리
    handleZoom(viewName, options) {
        const zoomType = viewName.replace('zoom-', '');
        const zoomFactor = zoomType === 'in' ? 0.5 : 2.0;
        
        const currentDistance = this.camera.position.distanceTo(this.controls.target);
        const newDistance = currentDistance * zoomFactor;
        
        const direction = this.camera.position.clone()
            .sub(this.controls.target)
            .normalize();
        const newPosition = this.controls.target.clone()
            .add(direction.multiplyScalar(newDistance));
        
        this.cameraTransition.transitionTo(newPosition, null, this.camera.fov, {
            ...options,
            onComplete: () => {
                console.log(`[SceneManager] 줌 ${zoomType} 완료`);
                if (this.onCameraTransitionEnd) {
                    this.onCameraTransitionEnd(viewName);
                }
            }
        }).catch(error => {
            console.error('[SceneManager] 줌 전환 실패:', error);
        });
    }
    
    // 폴백 카메라 뷰
    fallbackCameraView(viewName) {
        console.warn(`[SceneManager] 알 수 없는 카메라 뷰: ${viewName}, 기본 뷰로 전환`);
        this.resetToDefaultView({ duration: 0.5 });
    }
    
    // 애니메이션 루프
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    // 시작
    start() {
        console.log('[SceneManager] 렌더링 시작');
        this.animate();
    }
    
    // 카메라 속도 설정
    setCameraSpeed(multiplier) {
        this.cameraSpeedMultiplier = Math.max(0.1, Math.min(5.0, multiplier));
        console.log(`[SceneManager] 카메라 속도 배수: ${this.cameraSpeedMultiplier}`);
    }
}

export default SceneManager;