// SceneManager.js - 완전한 씬 관리자
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
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = CONFIG.renderer.shadowMapEnabled;
        this.renderer.shadowMap.type = CONFIG.renderer.shadowMapType;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = CONFIG.renderer.toneMappingExposure;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        
        const container = document.getElementById('canvas-container');
        if (container) {
            container.appendChild(this.renderer.domElement);
        }
    }
    
    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // CONFIG에서 컨트롤 설정 적용
        Object.assign(this.controls, CONFIG.controls);
        
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        
        // 카메라 전환 매니저 생성
        this.cameraTransition = new CameraTransitionManager(this.camera, this.controls);
        
        console.log('[SceneManager] OrbitControls 생성 완료 - Damping 활성화:', this.controls.enableDamping);
    }
    
    createLights() {
        const lights = CONFIG.lights;
        
        // 환경광
        this.lights.ambient = new THREE.AmbientLight(lights.ambient.color, lights.ambient.intensity);
        this.scene.add(this.lights.ambient);

        // 방향광
        this.lights.directional = new THREE.DirectionalLight(
            lights.directional.color, 
            lights.directional.intensity
        );
        this.lights.directional.position.set(
            lights.directional.position.x,
            lights.directional.position.y,
            lights.directional.position.z
        );
        this.lights.directional.castShadow = true;
        
        // 그림자 설정
        const shadow = lights.directional.shadow;
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
        const env = CONFIG.environment;
        
        // 그리드 생성
        this.gridHelper = new THREE.GridHelper(
            env.grid.size,
            env.grid.divisions,
            env.grid.color1,
            env.grid.color2
        );
        this.scene.add(this.gridHelper);
        
        // 바닥 생성
        const floorGeometry = new THREE.PlaneGeometry(env.floor.size, env.floor.size);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: env.floor.color,
            roughness: 0.8,
            metalness: 0.2
        });
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -0.01;
        this.floor.receiveShadow = true;
        this.floor.visible = env.floor.visible;
        this.scene.add(this.floor);
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
            this.fallbackCameraView(viewName);
            return;
        }
        
        // 프리셋 뷰 처리
        const presetViews = ['front', 'back', 'left', 'right', 'top', 'bottom', 'isometric'];
        if (presetViews.includes(viewName) && this.currentModel) {
            this.cameraTransition.setPresetView(viewName, this.currentModel, transitionOptions)
                .then(() => {
                    console.log(`[SceneManager] ${viewName} 뷰로 전환 완료`);
                    if (this.onCameraTransitionEnd) {
                        this.onCameraTransitionEnd(viewName);
                    }
                })
                .catch(error => {
                    console.error(`[SceneManager] 카메라 전환 실패:`, error);
                });
            return;
        }
        
        // 기존 뷰 처리
        switch (viewName) {
            case 'default':
                this.transitionToDefaultView(transitionOptions);
                break;
                
            case 'focus-model':
                if (this.currentModel) {
                    this.focusOnModel(transitionOptions);
                }
                break;
                
            default:
                if (viewName.startsWith('gltf_')) {
                    this.transitionToGLTFCamera(viewName, transitionOptions);
                } else if (viewName.startsWith('orbit-')) {
                    this.orbitAroundModel(viewName, transitionOptions);
                } else if (viewName.startsWith('zoom-')) {
                    this.handleZoom(viewName, transitionOptions);
                }
                break;
        }
    }
    
    // 기본 뷰로 전환
    transitionToDefaultView(options) {
        this.cameraTransition.applyProfile('default');
        this.cameraTransition.transitionTo(
            this.defaultCameraPosition,
            null,
            CONFIG.camera.fov,
            {
                ...options,
                lookAt: new THREE.Vector3(0, 0, 0),
                onComplete: () => {
                    console.log('[SceneManager] 기본 뷰로 전환 완료');
                    if (this.onCameraTransitionEnd) {
                        this.onCameraTransitionEnd('default');
                    }
                }
            }
        ).catch(error => {
            console.error('[SceneManager] 기본 뷰 전환 실패:', error);
            this.fallbackCameraView('default');
        });
    }
    
    // 모델에 포커스
    focusOnModel(options) {
        this.cameraTransition.focusOnObject(this.currentModel, {
            ...options,
            padding: 1.5,
            minDistance: 5,
            maxDistance: 50,
            onComplete: () => {
                console.log('[SceneManager] 모델 포커스 완료');
                if (this.onCameraTransitionEnd) {
                    this.onCameraTransitionEnd('focus-model');
                }
            }
        }).catch(error => {
            console.error('[SceneManager] 모델 포커스 실패:', error);
        });
    }
    
    // GLTF 카메라로 전환 - 개선된 버전
    transitionToGLTFCamera(viewName, options) {
        const cameraIndex = parseInt(viewName.replace('gltf_', ''));
        const gltfCamera = this.gltfCameras[cameraIndex];
        
        if (gltfCamera) {
            this.cameraTransition.transitionToGLTFCamera(gltfCamera, {
                ...options,
                model: this.currentModel,  // 모델 전달
                onComplete: () => {
                    console.log(`[SceneManager] GLTF 카메라 ${cameraIndex}로 전환 완료`);
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
        const zoomFactor = zoomType === 'in' ? 0.7 : 1.3;
        
        this.cameraTransition.smoothZoom(zoomFactor, {
            duration: 0.5,
            ...options
        });
    }
    
    // 카메라 속도 설정
    setCameraSpeed(rotateSpeed, zoomSpeed, panSpeed) {
        if (this.controls) {
            this.controls.rotateSpeed = rotateSpeed;
            this.controls.zoomSpeed = zoomSpeed;
            this.controls.panSpeed = panSpeed;
            
            // 원본 설정도 업데이트
            if (this.cameraTransition) {
                this.cameraTransition.originalControlsSettings.rotateSpeed = rotateSpeed;
                this.cameraTransition.originalControlsSettings.zoomSpeed = zoomSpeed;
                this.cameraTransition.originalControlsSettings.panSpeed = panSpeed;
            }
            
            console.log('[SceneManager] 카메라 속도 업데이트:', { rotateSpeed, zoomSpeed, panSpeed });
        }
    }
    
    // 카메라 전환 속도 설정
    setCameraTransitionDuration(duration) {
        this.cameraSpeedMultiplier = duration / CONFIG.cameraTransition.defaultDuration;
        console.log('[SceneManager] 카메라 전환 속도 배수:', this.cameraSpeedMultiplier);
    }
    
    // 카메라 전환 이징 설정
    setCameraTransitionEasing(easeType) {
        if (this.cameraTransition) {
            CONFIG.cameraTransition.defaultEaseType = easeType;
            console.log('[SceneManager] 카메라 전환 이징:', easeType);
        }
    }
    
    // 카메라 프로필 적용
    applyCameraProfile(profileName) {
        if (this.cameraTransition) {
            this.cameraTransition.applyProfile(profileName);
        }
    }
    
    // 현재 카메라 상태 저장
    saveCameraState(name) {
        if (this.cameraTransition) {
            return this.cameraTransition.saveState(name);
        }
    }
    
    // 저장된 카메라 상태로 복원
    restoreCameraState(name, options) {
        if (this.cameraTransition) {
            return this.cameraTransition.restoreState(name, options);
        }
    }
    
    // 특정 핫스팟으로 카메라 이동
    focusOnHotspot(hotspot, options = {}) {
        if (!this.cameraTransition || !hotspot.position) {
            console.warn('[SceneManager] 핫스팟 포커스 실패: 필수 요소 누락');
            return;
        }
        
        // 월드 좌표로 변환
        const worldPosition = new THREE.Vector3();
        
        if (hotspot.mesh) {
            // 실제 3D 오브젝트인 경우
            hotspot.mesh.getWorldPosition(worldPosition);
        } else if (this.currentModel) {
            // 로컬 좌표를 월드 좌표로 변환
            worldPosition.copy(hotspot.position);
            worldPosition.applyMatrix4(this.currentModel.matrixWorld);
        } else {
            worldPosition.copy(hotspot.position);
        }
        
        // 핫스팟에서 적절한 거리 계산
        const offset = new THREE.Vector3(3, 3, 3);
        const cameraPosition = worldPosition.clone().add(offset);
        
        return this.cameraTransition.transitionTo(
            cameraPosition,
            null,
            this.camera.fov,
            {
                duration: 1.2,
                lookAt: worldPosition,
                easeType: 'easeOutCubic',
                disableControls: true,
                ...options,
                onComplete: () => {
                    console.log('[SceneManager] 핫스팟 포커스 완료');
                    if (options.onComplete) {
                        options.onComplete();
                    }
                }
            }
        );
    }
    
    // GLTF 카메라 설정
    setGLTFCameras(cameras) {
        this.gltfCameras = cameras;
        console.log(`[SceneManager] GLTF 카메라 ${cameras.length}개 설정됨`);
    }
    
    // 폴백 카메라 뷰 (전환 실패 시)
    fallbackCameraView(viewName) {
        console.warn(`[SceneManager] 폴백 카메라 뷰 사용: ${viewName}`);
        
        if (viewName === 'default') {
            this.camera.position.copy(this.defaultCameraPosition);
            this.camera.lookAt(new THREE.Vector3(0, 0, 0));
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
        
        if (this.onCameraTransitionEnd) {
            this.onCameraTransitionEnd(viewName);
        }
    }
    
    // 조명 밝기 조절
    setLightIntensity(lightType, intensity) {
        if (lightType === 'ambient' && this.lights.ambient) {
            this.lights.ambient.intensity = intensity;
        } else if (lightType === 'directional' && this.lights.directional) {
            this.lights.directional.intensity = intensity;
        }
    }
    
    // 렌더링
    render() {
        if (this.controls && this.controls.enableDamping) {
            this.controls.update();
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    // 정리
    dispose() {
        console.log('[SceneManager] 리소스 정리 시작');
        
        if (this.cameraTransition) {
            this.cameraTransition.cancelAllTransitions();
        }
        
        if (this.controls) {
            this.controls.dispose();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        window.removeEventListener('resize', this.onWindowResize);
    }
}