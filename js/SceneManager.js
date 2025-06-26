// js/SceneManager.js
// 씬 관리 모듈 - 기존 구조 유지 + getter 메서드 추가

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
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 모델 정보
        this.currentModelInfo = null;
        this.modelBounds = null;
        
        // 성능 모니터링
        this.stats = {
            triangles: 0,
            vertices: 0,
            meshes: 0,
            drawCalls: 0,
            fps: 0
        };
        
        // 렌더링 상태
        this.renderingEnabled = true;
        this.needsUpdate = true;
        
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
        this.startRenderLoop();
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
            alpha: CONFIG.renderer.alpha
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = CONFIG.renderer.shadowMap;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = CONFIG.renderer.exposure;
        
        const container = document.getElementById('canvas-container');
        if (container) {
            container.appendChild(this.renderer.domElement);
        } else {
            document.body.appendChild(this.renderer.domElement);
        }
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
        this.controls.maxPolarAngle = CONFIG.controls.maxPolarAngle;
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }
    
    createLights() {
        // 환경광
        const ambientLight = new THREE.AmbientLight(
            CONFIG.lights.ambient.color,
            CONFIG.lights.ambient.intensity
        );
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;
        
        // 방향광
        const directionalLight = new THREE.DirectionalLight(
            CONFIG.lights.directional.color,
            CONFIG.lights.directional.intensity
        );
        directionalLight.position.set(
            CONFIG.lights.directional.position.x,
            CONFIG.lights.directional.position.y,
            CONFIG.lights.directional.position.z
        );
        directionalLight.castShadow = CONFIG.lights.directional.castShadow;
        
        if (directionalLight.castShadow) {
            directionalLight.shadow.mapSize.width = CONFIG.lights.directional.shadowMapSize;
            directionalLight.shadow.mapSize.height = CONFIG.lights.directional.shadowMapSize;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 50;
            const shadowSize = 20;
            directionalLight.shadow.camera.left = -shadowSize;
            directionalLight.shadow.camera.right = shadowSize;
            directionalLight.shadow.camera.top = shadowSize;
            directionalLight.shadow.camera.bottom = -shadowSize;
        }
        
        this.scene.add(directionalLight);
        this.lights.directional = directionalLight;
    }
    
    createEnvironment() {
        // 그리드 헬퍼
        this.gridHelper = new THREE.GridHelper(
            50,  // size
            50,  // divisions
            0x444444,  // colorCenterLine
            0x222222   // colorGrid
        );
        this.gridHelper.visible = true;
        this.scene.add(this.gridHelper);
        
        // 바닥
        const floorGeometry = new THREE.PlaneGeometry(100, 100);
        const floorMaterial = new THREE.ShadowMaterial({
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -0.01;
        this.floor.receiveShadow = true;
        this.floor.visible = true;
        this.scene.add(this.floor);
    }
    
    setupEventListeners() {
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        this.needsUpdate = true;
        
        this.emit('resize', { width, height });
    }
    
    setupAdaptiveSpeed() {
        // 모델 크기에 따른 카메라 속도 자동 조정
        this.on('model:changed', (data) => {
            if (data.modelInfo && data.modelInfo.boundingBox) {
                const size = data.modelInfo.boundingBox.getSize(new THREE.Vector3());
                const maxDimension = Math.max(size.x, size.y, size.z);
                
                // 모델 크기에 따라 속도 조정
                this.cameraSpeedMultiplier = Math.max(0.5, Math.min(2.0, maxDimension / 10));
                this.updateCameraSpeed();
            }
        });
    }
    
    updateCameraSpeed() {
        if (this.controls) {
            this.controls.rotateSpeed = CONFIG.controls.rotateSpeed * this.cameraSpeedMultiplier;
            this.controls.zoomSpeed = CONFIG.controls.zoomSpeed * this.cameraSpeedMultiplier;
            this.controls.panSpeed = CONFIG.controls.panSpeed * this.cameraSpeedMultiplier;
        }
    }
    
    setModel(model, modelInfo = {}) {
        console.log('[SceneManager] 모델 설정', modelInfo.name || 'Unknown');
        
        // 이전 모델 제거
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.currentModel = null;
        }
        
        // 새 모델 추가
        this.currentModel = model;
        this.currentModelInfo = modelInfo;
        this.scene.add(model);
        
        // 모델 경계 계산
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        this.modelBounds = {
            box: box,
            center: center,
            size: size,
            radius: size.length() * 0.5
        };
        
        // 카메라 포커스 조정
        this.focusOnModel();
        
        // GLTF 카메라 처리
        if (modelInfo.cameras && modelInfo.cameras.length > 0) {
            this.gltfCameras = modelInfo.cameras;
            console.log(`[SceneManager] ${this.gltfCameras.length}개의 GLTF 카메라 감지됨`);
        } else {
            this.gltfCameras = [];
        }
        
        // 통계 업데이트
        this.updateStats(model);
        
        // 이벤트 발생
        this.emit('model:changed', { model, modelInfo });
        this.needsUpdate = true;
    }
    
    focusOnModel() {
        if (!this.modelBounds) return;
        
        const { center, radius } = this.modelBounds;
        
        // 카메라 위치 계산
        const distance = radius * 2.5;
        const cameraPosition = new THREE.Vector3(
            center.x + distance * 0.7,
            center.y + distance * 0.5,
            center.z + distance * 0.7
        );
        
        // 카메라 설정
        this.camera.position.copy(cameraPosition);
        this.camera.lookAt(center);
        
        // 컨트롤 타겟 설정
        this.controls.target.copy(center);
        this.controls.minDistance = radius * 0.5;
        this.controls.maxDistance = radius * 5;
        this.controls.update();
        
        console.log('[SceneManager] 모델에 포커스 맞춤');
    }
    
    switchToGLTFCamera(index) {
        if (!this.gltfCameras || index < 0 || index >= this.gltfCameras.length) {
            console.warn('[SceneManager] 잘못된 카메라 인덱스:', index);
            return;
        }
        
        const gltfCamera = this.gltfCameras[index];
        console.log(`[SceneManager] GLTF 카메라 ${index}로 전환`);
        
        // 카메라 속성 복사
        if (gltfCamera.isPerspectiveCamera) {
            this.camera.fov = gltfCamera.fov;
            this.camera.near = gltfCamera.near;
            this.camera.far = gltfCamera.far;
            this.camera.aspect = gltfCamera.aspect || (window.innerWidth / window.innerHeight);
            this.camera.updateProjectionMatrix();
        }
        
        // 카메라 위치와 회전 복사
        this.camera.position.copy(gltfCamera.position);
        this.camera.quaternion.copy(gltfCamera.quaternion);
        
        // 컨트롤 업데이트
        if (this.modelBounds) {
            this.controls.target.copy(this.modelBounds.center);
        }
        this.controls.update();
        
        this.emit('camera:switched', { index, camera: gltfCamera });
        this.needsUpdate = true;
    }
    
    resetCamera() {
        console.log('[SceneManager] 카메라 리셋');
        
        // 기본 위치로 복귀
        this.camera.position.copy(this.defaultCameraPosition);
        this.camera.lookAt(0, 0, 0);
        
        // FOV 및 기타 속성 리셋
        this.camera.fov = CONFIG.camera.fov;
        this.camera.near = CONFIG.camera.near;
        this.camera.far = CONFIG.camera.far;
        this.camera.updateProjectionMatrix();
        
        // 컨트롤 리셋
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        
        // 모델이 있으면 포커스
        if (this.currentModel) {
            this.focusOnModel();
        }
        
        this.emit('camera:reset');
        this.needsUpdate = true;
    }
    
    updateStats(model) {
        if (!model) return;
        
        let triangles = 0;
        let vertices = 0;
        let meshes = 0;
        
        model.traverse((child) => {
            if (child.isMesh) {
                meshes++;
                const geometry = child.geometry;
                if (geometry) {
                    vertices += geometry.attributes.position?.count || 0;
                    if (geometry.index) {
                        triangles += geometry.index.count / 3;
                    } else {
                        triangles += (geometry.attributes.position?.count || 0) / 3;
                    }
                }
            }
        });
        
        this.stats = {
            triangles: Math.floor(triangles),
            vertices: vertices,
            meshes: meshes,
            drawCalls: this.renderer.info.render.calls,
            fps: 0
        };
        
        this.emit('stats:updated', this.stats);
    }
    
    startRenderLoop() {
        let lastTime = performance.now();
        let frameCount = 0;
        let fpsTime = 0;
        
        const animate = () => {
            requestAnimationFrame(animate);
            
            const currentTime = performance.now();
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;
            
            // FPS 계산
            frameCount++;
            fpsTime += deltaTime;
            if (fpsTime >= 1000) {
                this.stats.fps = Math.round(frameCount * 1000 / fpsTime);
                frameCount = 0;
                fpsTime = 0;
                this.emit('fps:updated', this.stats.fps);
            }
            
            // 렌더링
            if (this.renderingEnabled && (this.needsUpdate || CONFIG.rendering.continuous)) {
                this.render();
                this.needsUpdate = false;
            }
            
            // 컨트롤 업데이트
            if (this.controls && this.controls.enabled) {
                this.controls.update();
            }
        };
        
        animate();
    }
    
    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    update() {
        this.needsUpdate = true;
    }
    
    // 이벤트 시스템
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
    }
    
    off(event, callback) {
        if (this.events.has(event)) {
            const callbacks = this.events.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    emit(event, data = {}) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[SceneManager] 이벤트 핸들러 오류:`, error);
                }
            });
        }
    }
    
    // 렌더링 제어
    setRenderingEnabled(enabled) {
        this.renderingEnabled = enabled;
        this.emit('rendering:changed', { enabled });
    }
    
    toggleHelpers() {
        if (this.gridHelper) {
            this.gridHelper.visible = !this.gridHelper.visible;
        }
        this.needsUpdate = true;
    }
    
    setEnvironmentVisibility(showGrid, showAxes, showFloor) {
        if (this.gridHelper) {
            this.gridHelper.visible = showGrid;
        }
        if (this.floor) {
            this.floor.visible = showFloor;
        }
        this.needsUpdate = true;
        
        this.emit('environment:changed', { showGrid, showAxes, showFloor });
    }
    
    setCameraTransitionManager(transitionManager) {
        this.cameraTransition = transitionManager;
        
        if (transitionManager) {
            transitionManager.onTransitionStart = this.onCameraTransitionStart;
            transitionManager.onTransitionEnd = this.onCameraTransitionEnd;
        }
    }
    
    // 정리
    cleanup() {
        console.log('[SceneManager] 정리 시작');
        
        // 이벤트 정리
        this.events.clear();
        
        // 렌더링 중지
        this.renderingEnabled = false;
        
        // 씬 정리
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        // 조명 제거
        Object.values(this.lights).forEach(light => {
            this.scene.remove(light);
        });
        
        // 헬퍼 제거
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
        }
        if (this.floor) {
            this.scene.remove(this.floor);
        }
        
        // 렌더러 정리
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement.remove();
        }
        
        // 컨트롤 정리
        if (this.controls) {
            this.controls.dispose();
        }
        
        // 이벤트 리스너 제거
        window.removeEventListener('resize', this.handleResize);
        
        console.log('[SceneManager] 정리 완료');
    }
    
    // Getter 메서드들
    getCamera() { 
        return this.camera; 
    }
    
    getScene() { 
        return this.scene; 
    }
    
    getRenderer() { 
        return this.renderer; 
    }
    
    getControls() { 
        return this.controls; 
    }
    
    /**
     * 현재 모델 가져오기
     */
    getCurrentModel() { 
        return this.currentModel; 
    }
    
    /**
     * 현재 모델 정보 가져오기
     */
    getCurrentModelInfo() { 
        return this.currentModelInfo; 
    }
    
    /**
     * 통계 정보 가져오기
     */
    getStats() { 
        return { ...this.stats }; 
    }
    
    /**
     * GLTF 카메라 목록 가져오기
     */
    getGLTFCameras() { 
        return [...this.gltfCameras]; 
    }
    
    /**
     * 모델 경계 정보 가져오기
     */
    getModelBounds() {
        return this.modelBounds ? { ...this.modelBounds } : null;
    }
    
    /**
     * 렌더링 상태 확인
     */
    isRenderingEnabled() {
        return this.renderingEnabled;
    }
}

export default SceneManager;