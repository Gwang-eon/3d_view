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
        this.cameraTransition = null; // 카메라 전환 매니저

        this.init();
    }
    
    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createControls();
        this.createLights();
        this.createEnvironment();
        this.setupEventListeners();
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
        this.defaultCameraPosition = this.camera.position.clone();
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
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
    }
    
    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        Object.assign(this.controls, CONFIG.controls);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        this.cameraTransition = new CameraTransitionManager(this.camera, this.controls);
    }
    
    createLights() {
        const lights = CONFIG.lights;
        this.lights.ambient = new THREE.AmbientLight(lights.ambient.color, lights.ambient.intensity);
        this.scene.add(this.lights.ambient);

        this.lights.directional = new THREE.DirectionalLight(lights.directional.color, lights.directional.intensity);
        this.lights.directional.position.set(lights.directional.position.x, lights.directional.position.y, lights.directional.position.z);
        this.lights.directional.castShadow = true;
        this.lights.directional.shadow.mapSize.width = lights.directional.shadowMapSize;
        this.lights.directional.shadow.mapSize.height = lights.directional.shadowMapSize;
        this.scene.add(this.lights.directional);

        this.lights.fill = new THREE.DirectionalLight(lights.fill.color, lights.fill.intensity);
        this.lights.fill.position.set(lights.fill.position.x, lights.fill.position.y, lights.fill.position.z);
        this.scene.add(this.lights.fill);

        this.lights.hemisphere = new THREE.HemisphereLight(lights.hemisphere.skyColor, lights.hemisphere.groundColor, lights.hemisphere.intensity);
        this.scene.add(this.lights.hemisphere);
    }
    
    createEnvironment() {
        const grid = CONFIG.grid;
        this.gridHelper = new THREE.GridHelper(grid.size, grid.divisions, grid.colorCenterLine, grid.colorGrid);
        this.scene.add(this.gridHelper);

        const floor = CONFIG.floor;
        const floorGeometry = new THREE.PlaneGeometry(floor.size, floor.size);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: floor.color,
            roughness: floor.roughness,
            metalness: floor.metalness
        });
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -0.01;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
        
        this.setEnvironmentVisible(false);
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
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
    
    setEnvironmentVisible(visible) {
        this.gridHelper.visible = visible;
        this.floor.visible = visible;
    }
    
    toggleGrid() {
        this.setEnvironmentVisible(!this.gridHelper.visible);
    }
    
// SceneManager.js의 setCameraView 메서드 개선 버전

// SceneManager 클래스에 추가할 메서드들

setCameraView(viewName, options = {}) {
    // 기본 옵션 설정
    const defaultOptions = {
        duration: 1.5,
        easeType: 'easeInOutCubic',
        disableControls: true,
        priority: 'normal'
    };
    const transitionOptions = { ...defaultOptions, ...options };
    
    // 카메라 전환 중 알림
    if (this.onCameraTransitionStart) {
        this.onCameraTransitionStart(viewName);
    }
    
    // 카메라 전환 매니저 확인
    if (!this.cameraTransition) {
        console.warn('[SceneManager] CameraTransitionManager가 초기화되지 않았습니다.');
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

// GLTF 카메라로 전환
transitionToGLTFCamera(viewName, options) {
    const cameraIndex = parseInt(viewName.replace('gltf_', ''));
    const gltfCamera = this.gltfCameras[cameraIndex];
    
    if (gltfCamera) {
        this.cameraTransition.transitionToGLTFCamera(gltfCamera, {
            ...options,
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
        this.cameraTransition.orbitAroundModel(this.currentModel, {
            ...options,
            angle: angle,
            adjustRadius: true,
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

// 특정 핫스팟으로 카메라 이동 - 개선된 버전
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
                console.log(`[SceneManager] 핫스팟 '${hotspot.name}' 포커스 완료`);
                if (options.onComplete) options.onComplete();
            }
        }
    );
}

// 폴백 카메라 뷰 (즉시 이동)
fallbackCameraView(viewName) {
    console.warn('[SceneManager] 폴백 모드로 카메라 이동');
    
    switch (viewName) {
        case 'default':
            this.camera.position.copy(this.defaultCameraPosition);
            this.camera.lookAt(0, 0, 0);
            if (this.controls) {
                this.controls.target.set(0, 0, 0);
                this.controls.update();
            }
            break;
            
        case 'focus-model':
            if (this.currentModel) {
                const box = new THREE.Box3().setFromObject(this.currentModel);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                
                this.camera.position.set(
                    center.x + maxDim,
                    center.y + maxDim * 0.5,
                    center.z + maxDim
                );
                this.camera.lookAt(center);
                
                if (this.controls) {
                    this.controls.target.copy(center);
                    this.controls.update();
                }
            }
            break;
    }
}

// 카메라 전환 중단
cancelCameraTransition() {
    if (this.cameraTransition) {
        this.cameraTransition.cancelAllTransitions();
    }
}

// 카메라 상태 저장
saveCameraState() {
    if (this.cameraTransition) {
        return this.cameraTransition.saveState();
    }
    return null;
}

// 저장된 카메라 상태로 복원
restoreCameraState(state, options = {}) {
    if (this.cameraTransition && state) {
        return this.cameraTransition.restoreState(state, options);
    }
}

// 카메라 전환 설정 변경
setCameraTransitionDuration(duration) {
    if (this.cameraTransition) {
        this.cameraTransition.transitionDuration = duration;
    }
}

setCameraTransitionEasing(easeType) {
    if (this.cameraTransition) {
        this.cameraTransition.easeType = easeType;
    }
}

// 카메라 전환 디버그 정보
getCameraDebugInfo() {
    if (this.cameraTransition) {
        return this.cameraTransition.getDebugInfo();
    }
    return null;
}

    // 5. 추가 유틸리티 메서드들:

// 카메라 상태 저장
saveCameraState() {
    if (this.cameraTransition) {
        return this.cameraTransition.saveState();
    }
    return null;
}

// 저장된 카메라 상태로 복원
restoreCameraState(state, options = {}) {
    if (this.cameraTransition && state) {
        return this.cameraTransition.restoreState(state, options);
    }
}

// 특정 핫스팟으로 카메라 이동
focusOnHotspot(hotspot, options = {}) {
    if (!this.cameraTransition || !hotspot.position) return;
    
    const worldPosition = hotspot.position.clone();
    if (this.currentModel) {
        worldPosition.applyMatrix4(this.currentModel.matrixWorld);
    }
    
    // 핫스팟에서 약간 떨어진 위치로 카메라 이동
    const offset = new THREE.Vector3(5, 5, 5);
    const cameraPosition = worldPosition.clone().add(offset);
    
    return this.cameraTransition.transitionTo(
        cameraPosition,
        null,
        this.camera.fov,
        {
            duration: 1.0,
            lookAt: worldPosition,
            ...options
        }
    );
}

// 카메라 전환 설정 변경
setCameraTransitionDuration(duration) {
    if (this.cameraTransition) {
        this.cameraTransition.setTransitionDuration(duration);
    }
}

setCameraTransitionEasing(easeType) {
    if (this.cameraTransition) {
        this.cameraTransition.setEaseType(easeType);
    }
}
    
    setGLTFCameras(cameras) {
        this.gltfCameras = cameras;
    }

    render() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}