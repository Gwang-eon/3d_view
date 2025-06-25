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
    
    setCameraView(viewName, options = {}) {
        // 기본 옵션 설정
        const defaultOptions = {
            duration: 1.5,        // 전환 시간 (초)
            easeType: 'easeInOutCubic'  // 이징 타입
        };
        const transitionOptions = { ...defaultOptions, ...options };
        
        if (viewName === 'default') {
            // 기본 카메라 뷰로 부드럽게 전환
            if (this.cameraTransition) {
                this.cameraTransition.transitionTo(
                    this.defaultCameraPosition,
                    null,
                    CONFIG.camera.fov,
                    {
                        ...transitionOptions,
                        lookAt: new THREE.Vector3(0, 0, 0),
                        onComplete: () => {
                            console.log('[SceneManager] 기본 뷰로 전환 완료');
                        }
                    }
                );
            } else {
                // 폴백: 즉시 이동
                this.camera.position.copy(this.defaultCameraPosition);
                this.camera.lookAt(0, 0, 0);
                this.controls.target.set(0, 0, 0);
                this.controls.update();
            }
        } else if (viewName.startsWith('gltf_')) {
            // GLTF 카메라 뷰로 부드럽게 전환
            const cameraIndex = parseInt(viewName.replace('gltf_', ''));
            const gltfCamera = this.gltfCameras[cameraIndex];
            
            if (gltfCamera && this.cameraTransition) {
                this.cameraTransition.transitionToGLTFCamera(gltfCamera, {
                    ...transitionOptions,
                    onComplete: () => {
                        console.log(`[SceneManager] GLTF 카메라 ${cameraIndex}로 전환 완료`);
                    }
                });
            } else if (gltfCamera) {
                // 폴백: 즉시 이동
                if (gltfCamera.isPerspectiveCamera) {
                    this.camera.fov = gltfCamera.fov;
                    this.camera.aspect = gltfCamera.aspect;
                    this.camera.near = gltfCamera.near;
                    this.camera.far = gltfCamera.far;
                    this.camera.updateProjectionMatrix();
                }
                
                this.camera.position.copy(gltfCamera.position);
                this.camera.rotation.copy(gltfCamera.rotation);
                this.camera.quaternion.copy(gltfCamera.quaternion);
                
                const direction = new THREE.Vector3(0, 0, -1);
                direction.applyQuaternion(gltfCamera.quaternion);
                const target = gltfCamera.position.clone().add(direction);
                this.controls.target.copy(target);
                this.controls.update();
            }
        } else if (viewName === 'focus-model' && this.currentModel) {
            // 현재 모델에 포커스
            if (this.cameraTransition) {
                this.cameraTransition.focusOnObject(this.currentModel, transitionOptions);
            }
        } else if (viewName.startsWith('orbit-')) {
            // 모델 주위를 도는 뷰 (orbit-0, orbit-90, orbit-180, orbit-270)
            const angle = parseInt(viewName.replace('orbit-', '')) * (Math.PI / 180);
            if (this.currentModel && this.cameraTransition) {
                this.cameraTransition.orbitAroundModel(this.currentModel, {
                    ...transitionOptions,
                    angle: angle
                });
            }
        }
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