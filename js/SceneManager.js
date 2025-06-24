import { CONFIG } from './config.js';

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
    
    setCameraView(viewName) {
        if (viewName === 'default') {
            // 기본 카메라 뷰로 리셋
            this.camera.position.copy(this.defaultCameraPosition);
            this.camera.lookAt(0, 0, 0);
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        } else if (viewName.startsWith('gltf_')) {
            // GLTF 카메라 뷰 적용
            const cameraIndex = parseInt(viewName.replace('gltf_', ''));
            const gltfCameras = this.gltfCameras || [];
            
            if (gltfCameras[cameraIndex]) {
                const gltfCamera = gltfCameras[cameraIndex];
                
                // GLTF 카메라의 속성을 현재 카메라에 복사
                if (gltfCamera.isPerspectiveCamera) {
                    this.camera.fov = gltfCamera.fov;
                    this.camera.aspect = gltfCamera.aspect;
                    this.camera.near = gltfCamera.near;
                    this.camera.far = gltfCamera.far;
                    this.camera.updateProjectionMatrix();
                }
                
                // 카메라 위치와 회전 적용
                this.camera.position.copy(gltfCamera.position);
                this.camera.rotation.copy(gltfCamera.rotation);
                this.camera.quaternion.copy(gltfCamera.quaternion);
                
                // 컨트롤 타겟 업데이트 (카메라가 바라보는 방향)
                const direction = new THREE.Vector3(0, 0, -1);
                direction.applyQuaternion(gltfCamera.quaternion);
                const target = gltfCamera.position.clone().add(direction);
                this.controls.target.copy(target);
                this.controls.update();
            }
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