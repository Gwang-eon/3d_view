// js/viewer.js - 3D 뷰어 코어 모듈

export class Viewer3D {
    constructor(config) {
        this.config = config;
        this.container = null;
        
        // Three.js 객체
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.loadingManager = null;
        
        // 조명
        this.lights = {};
        
        // 현재 모델
        this.currentModel = null;
        
        // 헬퍼
        this.gridHelper = null;
        this.axesHelper = null;
        
        // 상태
        this.isInitialized = false;
    }
    
    /**
     * 뷰어 초기화
     */
    async init() {
        try {
            // 컨테이너 설정
            this.container = document.getElementById(this.config.viewer.container);
            if (!this.container) {
                throw new Error('뷰어 컨테이너를 찾을 수 없습니다.');
            }
            
            // 로딩 매니저 생성
            this.createLoadingManager();
            
            // 씬 생성
            this.createScene();
            
            // 카메라 생성
            this.createCamera();
            
            // 렌더러 생성
            this.createRenderer();
            
            // 컨트롤 생성
            this.createControls();
            
            // 조명 설정
            this.setupLights();
            
            // 헬퍼 설정
            this.setupHelpers();
            
            // 애니메이션 시작
            this.animate();
            
            this.isInitialized = true;
            console.log('✅ 3D 뷰어 초기화 완료');
            
        } catch (error) {
            console.error('❌ 뷰어 초기화 실패:', error);
            throw error;
        }
    }
    
    /**
     * 로딩 매니저 생성
     */
    createLoadingManager() {
        this.loadingManager = new THREE.LoadingManager();
        
        this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
            console.log(`로딩 시작: ${url}`);
        };
        
        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal) * 100;
            console.log(`로딩 중: ${progress.toFixed(0)}%`);
        };
        
        this.loadingManager.onLoad = () => {
            console.log('모든 리소스 로딩 완료');
        };
        
        this.loadingManager.onError = (url) => {
            console.error(`로딩 실패: ${url}`);
        };
    }
    
    /**
     * 씬 생성
     */
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.config.viewer.backgroundColor);
        
        // 안개 설정
        if (this.config.viewer.fog.enabled) {
            this.scene.fog = new THREE.Fog(
                this.config.viewer.fog.color,
                this.config.viewer.fog.near,
                this.config.viewer.fog.far
            );
        }
    }
    
    /**
     * 카메라 생성
     */
    createCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        
        this.camera = new THREE.PerspectiveCamera(
            this.config.camera.fov,
            aspect,
            this.config.camera.near,
            this.config.camera.far
        );
        
        this.camera.position.set(
            this.config.camera.position.x,
            this.config.camera.position.y,
            this.config.camera.position.z
        );
        
        this.camera.lookAt(
            this.config.camera.lookAt.x,
            this.config.camera.lookAt.y,
            this.config.camera.lookAt.z
        );
    }
    
    /**
     * 렌더러 생성
     */
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.config.performance.antialias,
            alpha: false
        });
        
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(this.config.performance.pixelRatio);
        
        // 그림자 설정
        if (this.config.performance.shadowsEnabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        // 톤 매핑
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        
        // 컨테이너에 추가
        this.container.appendChild(this.renderer.domElement);
    }
    
    /**
     * 카메라 컨트롤 생성
     */
    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // 컨트롤 설정 적용
        Object.assign(this.controls, this.config.controls);
        
        this.controls.target.set(
            this.config.camera.lookAt.x,
            this.config.camera.lookAt.y,
            this.config.camera.lookAt.z
        );
        
        this.controls.update();
    }
    
    /**
     * 조명 설정
     */
    setupLights() {
        // 환경광
        const ambientLight = new THREE.AmbientLight(
            this.config.lights.ambient.color,
            this.config.lights.ambient.intensity
        );
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;
        
        // 방향광
        const directionalLight = new THREE.DirectionalLight(
            this.config.lights.directional.color,
            this.config.lights.directional.intensity
        );
        
        directionalLight.position.set(
            this.config.lights.directional.position.x,
            this.config.lights.directional.position.y,
            this.config.lights.directional.position.z
        );
        
        if (this.config.lights.directional.castShadow) {
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = this.config.lights.directional.shadowMapSize;
            directionalLight.shadow.mapSize.height = this.config.lights.directional.shadowMapSize;
            directionalLight.shadow.camera.near = 0.1;
            directionalLight.shadow.camera.far = 50;
            directionalLight.shadow.camera.left = -10;
            directionalLight.shadow.camera.right = 10;
            directionalLight.shadow.camera.top = 10;
            directionalLight.shadow.camera.bottom = -10;
        }
        
        this.scene.add(directionalLight);
        this.lights.directional = directionalLight;
        
        // 포인트 라이트
        const pointLight = new THREE.PointLight(
            this.config.lights.point.color,
            this.config.lights.point.intensity
        );
        
        pointLight.position.set(
            this.config.lights.point.position.x,
            this.config.lights.point.position.y,
            this.config.lights.point.position.z
        );
        
        this.scene.add(pointLight);
        this.lights.point = pointLight;
    }
    
    /**
     * 헬퍼 설정
     */
    setupHelpers() {
        // 그리드 헬퍼
        if (this.config.viewer.showGrid) {
            this.gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
            this.scene.add(this.gridHelper);
        }
        
        // 축 헬퍼
        if (this.config.viewer.showAxes) {
            this.axesHelper = new THREE.AxesHelper(5);
            this.scene.add(this.axesHelper);
        }
    }
    
    /**
     * 모델 설정
     */
    setModel(model) {
        // 기존 모델 제거
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.disposeObject(this.currentModel);
        }
        
        this.currentModel = model;
        
        // 그림자 설정
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // 모델 크기 조정 및 중심 맞추기
        this.centerModel(model);
        
        // 씬에 추가
        this.scene.add(model);
        
        // 카메라 위치 조정
        this.adjustCameraToModel();
    }
    
    /**
     * 모델 중심 맞추기
     */
    centerModel(model) {
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // 모델을 원점으로 이동
        model.position.sub(center);
        
        // 크기가 너무 크거나 작은 경우 스케일 조정
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 10 || maxDim < 1) {
            const targetSize = 5;
            const scale = targetSize / maxDim;
            model.scale.multiplyScalar(scale);
        }
    }
    
    /**
     * 카메라 위치 조정
     */
    adjustCameraToModel() {
        if (!this.currentModel) return;
        
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        const distance = maxDim * 2.5;
        
        this.camera.position.set(distance, distance, distance);
        this.camera.lookAt(0, 0, 0);
        
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }
    
    /**
     * 뷰 설정
     */
    setView(viewName) {
        const distance = 10;
        let position;
        
        switch(viewName) {
            case 'front':
                position = new THREE.Vector3(0, 0, distance);
                break;
            case 'back':
                position = new THREE.Vector3(0, 0, -distance);
                break;
            case 'left':
                position = new THREE.Vector3(-distance, 0, 0);
                break;
            case 'right':
                position = new THREE.Vector3(distance, 0, 0);
                break;
            case 'top':
                position = new THREE.Vector3(0, distance, 0);
                break;
            case 'bottom':
                position = new THREE.Vector3(0, -distance, 0);
                break;
            case 'reset':
                this.resetCamera();
                return;
        }
        
        if (position) {
            this.camera.position.copy(position);
            this.camera.lookAt(0, 0, 0);
            this.controls.target.set(0, 0, 0);
            this.controls.update();
        }
    }
    
    /**
     * 카메라 리셋
     */
    resetCamera() {
        this.camera.position.set(
            this.config.camera.position.x,
            this.config.camera.position.y,
            this.config.camera.position.z
        );
        
        this.camera.lookAt(
            this.config.camera.lookAt.x,
            this.config.camera.lookAt.y,
            this.config.camera.lookAt.z
        );
        
        this.controls.target.set(
            this.config.camera.lookAt.x,
            this.config.camera.lookAt.y,
            this.config.camera.lookAt.z
        );
        
        this.controls.update();
        
        // 현재 모델이 있으면 그에 맞게 조정
        if (this.currentModel) {
            this.adjustCameraToModel();
        }
    }
    
    /**
     * 그리드 토글
     */
    toggleGrid() {
        if (this.gridHelper) {
            this.gridHelper.visible = !this.gridHelper.visible;
        }
    }
    
    /**
     * 창 크기 변경 처리
     */
    handleResize() {
        if (!this.container) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    /**
     * 애니메이션 루프
     */
    animate = () => {
        requestAnimationFrame(this.animate);
        
        // 컨트롤 업데이트
        if (this.controls.enableDamping) {
            this.controls.update();
        }
        
        // 렌더링
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * 객체 정리
     */
    disposeObject(object) {
        object.traverse((child) => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        this.disposeMaterial(material);
                    });
                } else {
                    this.disposeMaterial(child.material);
                }
            }
        });
    }
    
    /**
     * 머티리얼 정리
     */
    disposeMaterial(material) {
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        material.dispose();
    }
    
    /**
     * 뷰어 정리
     */
    destroy() {
        // 애니메이션 중지
        cancelAnimationFrame(this.animate);
        
        // 현재 모델 정리
        if (this.currentModel) {
            this.disposeObject(this.currentModel);
        }
        
        // 렌더러 정리
        this.renderer.dispose();
        
        // DOM에서 제거
        if (this.container && this.renderer.domElement) {
            this.container.removeChild(this.renderer.domElement);
        }
        
        console.log('🔚 3D 뷰어 정리 완료');
    }
}