// js/viewer.js - 3D 뷰어 코어 모듈 (카메라 방향 수정)

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
        this.modelCenter = null;  // 모델 중심점 저장
        
        // 헬퍼
        this.gridHelper = null;
        this.axesHelper = null;
        
        // 상태
        this.isInitialized = false;
        
        // 렌더링 콜백 (CSS2DRenderer 등을 위한)
        this.onRenderCallbacks = [];
        
        // 카메라 애니메이션
        this.cameraAnimation = {
            active: false,
            startPosition: new THREE.Vector3(),
            startTarget: new THREE.Vector3(),
            endPosition: new THREE.Vector3(),
            endTarget: new THREE.Vector3(),
            startTime: 0,
            duration: 1000, // 밀리초
            easing: 'easeInOutCubic'
        };
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
        // 밝은 회색 배경 (Three.js 에디터 스타일)
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // 안개 제거 - 선명한 렌더링을 위해
        this.scene.fog = null;
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
            alpha: false,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true
        });
        
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(this.config.performance.pixelRatio);
        
        // 그림자 설정
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 더 선명한 그림자
        
        // 렌더러 설정 - 밝은 렌더링을 위한 최적화
        this.renderer.toneMapping = THREE.NoToneMapping; // 톤 매핑 비활성화
        this.renderer.toneMappingExposure = 1.0;
        
        // 출력 인코딩
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        
        // 물리적으로 정확한 조명
        this.renderer.physicallyCorrectLights = true;
        
        this.container.appendChild(this.renderer.domElement);

        // 렌더러 추가 후 즉시 리사이즈 (추가)
        requestAnimationFrame(() => {
            this.handleResize();
        }); 
    }
    
    /**
     * 카메라 컨트롤 생성
     */
    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // 컨트롤 설정 적용
        Object.assign(this.controls, this.config.controls);

        // 추가 설정
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        
        // 터치 설정
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };

        this.controls.target.set(
            this.config.camera.lookAt.x,
            this.config.camera.lookAt.y,
            this.config.camera.lookAt.z
        );
        
        this.controls.update();
    }
    
    /**
     * 조명 설정 - 밝고 선명한 렌더링을 위한 최적화
     */
    setupLights() {
        // 1. 주변광 - 더 밝게
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);
        this.lights.ambient = ambientLight;
        
        // 2. 주 방향광 (태양광) - 강하고 선명한 그림자
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
        mainLight.position.set(10, 20, 10);
        mainLight.castShadow = true;
        
        // 그림자 설정 - 더 선명하고 부드러운 그림자
        mainLight.shadow.mapSize.width = 4096;  // 고해상도
        mainLight.shadow.mapSize.height = 4096;
        mainLight.shadow.camera.near = 0.1;
        mainLight.shadow.camera.far = 100;
        
        // 그림자 bias 조정 - 그림자 아티팩트 제거
        mainLight.shadow.bias = -0.0005;
        mainLight.shadow.normalBias = 0.02;
        
        // 초기 그림자 범위 (모델 로드 시 자동 조정됨)
        mainLight.shadow.camera.left = -20;
        mainLight.shadow.camera.right = 20;
        mainLight.shadow.camera.top = 20;
        mainLight.shadow.camera.bottom = -20;
        
        // 그림자 부드러움 감소 - 더 선명한 그림자
        mainLight.shadow.radius = 2;
        mainLight.shadow.blurSamples = 8;
        
        this.scene.add(mainLight);
        this.lights.main = mainLight;
        
        // 3. 보조 방향광 - 반대편에서 비추는 fill light
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-5, 10, -5);
        this.scene.add(fillLight);
        this.lights.fill = fillLight;
        
        // 4. 반구광 - 하늘과 땅의 색상 차이
        const hemiLight = new THREE.HemisphereLight(
            0xffffff, // 하늘색
            0xcccccc, // 땅색
            0.6
        );
        hemiLight.position.set(0, 20, 0);
        this.scene.add(hemiLight);
        this.lights.hemisphere = hemiLight;
        
        // 5. 환경맵 생성 (선택적) - 더 밝은 환경
        this.createEnvironment();
    }
    
    /**
     * 환경맵 생성 - 밝은 스튜디오 조명 환경
     */
    createEnvironment() {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        
        // 밝은 스튜디오 환경 생성
        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(0xffffff);
        
        // 위쪽 조명
        const topLight = new THREE.Mesh(
            new THREE.SphereGeometry(50, 32, 16),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 2
            })
        );
        topLight.position.y = 50;
        envScene.add(topLight);
        
        // 환경맵 생성
        const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
        this.scene.environment = renderTarget.texture;
        
        // 정리
        pmremGenerator.dispose();
        renderTarget.dispose();
    }
    
    /**
     * 헬퍼 설정
     */
    setupHelpers() {
        // 그리드 헬퍼 - 더 밝은 색상
        if (this.config.viewer.showGrid) {
            this.gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
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
        
        // 그림자 설정 및 머티리얼 최적화
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // 머티리얼 확인 및 수정
                if (child.material) {
                    // MeshBasicMaterial은 그림자를 받지 못하므로 변경
                    if (child.material.type === 'MeshBasicMaterial') {
                        const oldMat = child.material;
                        child.material = new THREE.MeshStandardMaterial({
                            color: oldMat.color,
                            map: oldMat.map,
                            transparent: oldMat.transparent,
                            opacity: oldMat.opacity,
                            side: oldMat.side
                        });
                        oldMat.dispose();
                    }
                    
                    // 머티리얼 속성 최적화
                    if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                        // 환경맵 반사 강도 증가
                        child.material.envMapIntensity = 1.0;
                        
                        // 기본 roughness/metalness 조정 (너무 반사되지 않도록)
                        if (child.material.roughness !== undefined && child.material.roughness < 0.5) {
                            child.material.roughness = 0.5;
                        }
                        if (child.material.metalness !== undefined && child.material.metalness > 0.5) {
                            child.material.metalness = 0.5;
                        }
                    }
                    
                    child.material.needsUpdate = true;
                }
            }
        });

        // 모델 크기 조정 및 중심 맞추기
        this.centerModel(model);
        
        // 씬에 추가
        this.scene.add(model);
        
        // 모델에 맞게 그림자 카메라 범위 자동 조정
        this.adjustShadowCamera();
        
        // 카메라 위치 조정
        this.adjustCameraToModel();

        // 모델 로드 시 Grid 자동 숨김
        if (this.gridHelper) {
            this.gridHelper.visible = false;
            console.log('🔲 Grid 숨김 (모델 로드됨)');
        }
        
        // 모델 중심점 저장 (카메라 회전용)
        const box = new THREE.Box3().setFromObject(model);
        this.modelCenter = box.getCenter(new THREE.Vector3());
        console.log('📍 모델 중심점 계산:', this.modelCenter);


        // 모델 설정 완료 후 리사이즈 (추가)
        requestAnimationFrame(() => {
            this.handleResize();
        });
    }
    
    /**
     * 그림자 카메라 자동 조정
     */
    adjustShadowCamera() {
        if (!this.currentModel || !this.lights.main) return;
        
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.z) * 0.7;
        
        const shadowCam = this.lights.main.shadow.camera;
        shadowCam.left = -maxDim;
        shadowCam.right = maxDim;
        shadowCam.top = maxDim;
        shadowCam.bottom = -maxDim;
        shadowCam.updateProjectionMatrix();
        
        // 조명 위치도 모델 크기에 맞게 조정
        this.lights.main.position.set(maxDim * 0.5, maxDim * 1.5, maxDim * 0.5);
        this.lights.main.target.position.copy(center);
        this.lights.main.target.updateMatrixWorld();
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
            const targetSize = 15;
            const scale = targetSize / maxDim;
            model.scale.multiplyScalar(scale);
        }
    }
    
    /**
     * 카메라 위치 조정
     */
    adjustCameraToModel(animate = false) {
        if (!this.currentModel) return;
        
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // 카메라 거리 계산
        const distance = maxDim * 2.5;
        
        // 카메라 위치 설정 (약간 위에서 비스듬히)
        const targetPosition = new THREE.Vector3(
            center.x + distance * 0.7,
            center.y + distance * 0.7,
            center.z + distance * 0.7
        );
        
        if (animate) {
            this.animateCamera(targetPosition, center);
        } else {
            this.camera.position.copy(targetPosition);
            this.camera.lookAt(center);
            this.controls.target.copy(center);
            this.controls.update();
        }
    }
    
    /**
     * 뷰 설정 - 수정된 방향으로 부드러운 카메라 전환
     */
    setView(viewName) {
        if (!this.currentModel) return;
        
        // 모델의 크기 계산
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // 적절한 거리 계산
        const distance = maxDim * 2;
        let targetPosition;
        
        switch(viewName) {
            case 'front':
                // 정면 - 남쪽에서 북쪽을 보는 뷰 (Z- 방향에서)
                targetPosition = new THREE.Vector3(center.x, center.y, center.z - distance);
                break;
            case 'back':
                // 우측 - 서쪽에서 동쪽을 보는 뷰 (X- 방향에서)
                targetPosition = new THREE.Vector3(center.x - distance, center.y, center.z);
                break;
            case 'left':
                // 후면 - 북쪽에서 남쪽을 보는 뷰 (Z+ 방향에서)
                targetPosition = new THREE.Vector3(center.x, center.y, center.z + distance);
                break;
            case 'right':
                // 정면 - 남쪽에서 북쪽을 보는 뷰 (Z- 방향에서)
                targetPosition = new THREE.Vector3(center.x, center.y, center.z - distance);
                break;
            case 'top':
                // 상단 - 위에서 아래를 보는 뷰
                targetPosition = new THREE.Vector3(center.x, center.y + distance, center.z);
                break;
            case 'reset':
                this.resetCamera(true); // 애니메이션 플래그 추가
                return;
        }
        
        if (targetPosition) {
            this.animateCamera(targetPosition, center);
        }
    }
    
    /**
     * 카메라 리셋
     */
    resetCamera(animate = false) {
        // 현재 모델이 있으면 그에 맞게 조정
        if (this.currentModel) {
            const box = new THREE.Box3().setFromObject(this.currentModel);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            
            const distance = maxDim * 2.5;
            const targetPosition = new THREE.Vector3(
                center.x + distance * 0.7,
                center.y + distance * 0.7,
                center.z + distance * 0.7
            );
            
            if (animate) {
                this.animateCamera(targetPosition, center);
            } else {
                this.camera.position.copy(targetPosition);
                this.camera.lookAt(center);
                this.controls.target.copy(center);
                this.controls.update();
            }
        } else {
            const targetPosition = new THREE.Vector3(
                this.config.camera.position.x,
                this.config.camera.position.y,
                this.config.camera.position.z
            );
            const targetLookAt = new THREE.Vector3(
                this.config.camera.lookAt.x,
                this.config.camera.lookAt.y,
                this.config.camera.lookAt.z
            );
            
            if (animate) {
                this.animateCamera(targetPosition, targetLookAt);
            } else {
                this.camera.position.copy(targetPosition);
                this.camera.lookAt(targetLookAt);
                this.controls.target.copy(targetLookAt);
                this.controls.update();
            }
        }
    }
    
    /**
     * 카메라 애니메이션
     */
    animateCamera(targetPosition, targetLookAt, duration = 800, easing = 'easeInOutCubic') {
        // 이미 애니메이션 중이면 중단
        if (this.cameraAnimation.active) {
            this.cameraAnimation.active = false;
        }
        
        // 애니메이션 설정
        this.cameraAnimation.active = true;
        this.cameraAnimation.startPosition.copy(this.camera.position);
        this.cameraAnimation.startTarget.copy(this.controls.target);
        this.cameraAnimation.endPosition.copy(targetPosition);
        this.cameraAnimation.endTarget.copy(targetLookAt);
        this.cameraAnimation.startTime = performance.now();
        this.cameraAnimation.duration = duration;
        this.cameraAnimation.easing = easing;
        
        // 애니메이션 중 컨트롤 비활성화
        this.controls.enabled = false;
    }
    
    /**
     * 카메라 애니메이션 업데이트
     */
    updateCameraAnimation() {
        if (!this.cameraAnimation.active) return;
        
        const now = performance.now();
        const elapsed = now - this.cameraAnimation.startTime;
        const progress = Math.min(elapsed / this.cameraAnimation.duration, 1);
        
        // 이징 함수 적용
        const easedProgress = this.getEasingValue(progress, this.cameraAnimation.easing);
        
        // 위치 보간
        this.camera.position.lerpVectors(
            this.cameraAnimation.startPosition,
            this.cameraAnimation.endPosition,
            easedProgress
        );
        
        // 타겟 보간
        this.controls.target.lerpVectors(
            this.cameraAnimation.startTarget,
            this.cameraAnimation.endTarget,
            easedProgress
        );
        
        // 카메라가 타겟을 바라보도록
        this.camera.lookAt(this.controls.target);
        
        // 컨트롤 업데이트 (중요!)
        this.controls.update();
        
        // 애니메이션 완료 체크
        if (progress >= 1) {
            this.cameraAnimation.active = false;
            this.controls.enabled = true;
            this.controls.update();
            console.log('📍 카메라 애니메이션 완료. 최종 타겟:', this.controls.target);
        }
    }
    
    /**
     * 이징 함수
     */
    getEasingValue(t, easing) {
        switch (easing) {
            case 'linear':
                return t;
            case 'easeInQuad':
                return t * t;
            case 'easeOutQuad':
                return t * (2 - t);
            case 'easeInOutQuad':
                return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            case 'easeInCubic':
                return t * t * t;
            case 'easeOutCubic':
                return (--t) * t * t + 1;
            case 'easeInOutCubic':
                return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
            case 'easeInQuart':
                return t * t * t * t;
            case 'easeOutQuart':
                return 1 - (--t) * t * t * t;
            case 'easeInOutQuart':
                return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
            case 'easeInExpo':
                return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
            case 'easeOutExpo':
                return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
            case 'easeInOutExpo':
                return t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? 
                    Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
            default:
                return this.getEasingValue(t, 'easeInOutCubic');
        }
    }
    
    /**
     * 카메라 속도 설정
     */
    setCameraAnimationDuration(duration) {
        this.cameraAnimation.duration = duration;
    }
    
    /**
     * 카메라 이징 설정
     */
    setCameraEasing(easing) {
        this.cameraAnimation.easing = easing;
    }
    
    /**
     * 커스텀 카메라 적용 (블렌더에서 가져온 카메라) - 애니메이션 추가
     */
    applyCustomCamera(customCamera, animate = true) {
        if (!customCamera.isPerspectiveCamera) return;
        
        // 타겟 위치와 방향 계산
        const targetPosition = new THREE.Vector3();
        targetPosition.setFromMatrixPosition(customCamera.matrixWorld);
        
        // 모델의 중심점을 타겟으로 설정
        let targetLookAt = new THREE.Vector3(0, 0, 0); // 기본값
        
        // 저장된 모델 중심점 사용 또는 재계산
        if (this.modelCenter) {
            targetLookAt = this.modelCenter.clone();
        } else if (this.currentModel) {
            // 현재 모델의 중심점 계산
            const box = new THREE.Box3().setFromObject(this.currentModel);
            targetLookAt = box.getCenter(new THREE.Vector3());
            this.modelCenter = targetLookAt.clone();
        }
        
        console.log('📍 카메라 타겟 설정:', targetLookAt);
        
        // FOV 및 기타 속성 업데이트
        this.camera.fov = customCamera.fov;
        this.camera.aspect = customCamera.aspect;
        this.camera.near = customCamera.near;
        this.camera.far = customCamera.far;
        this.camera.updateProjectionMatrix();
        
        if (animate) {
            // 애니메이션으로 전환
            this.animateCamera(targetPosition, targetLookAt);
        } else {
            this.camera.position.copy(targetPosition);
            this.camera.lookAt(targetLookAt);
            this.controls.target.copy(targetLookAt);
            this.controls.update();
        }
        
        console.log('✅ 카메라 적용됨:', customCamera.name || '이름 없음');
        console.log('   위치:', targetPosition);
        console.log('   타겟:', targetLookAt);
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
        
        // 카메라 애니메이션 업데이트
        this.updateCameraAnimation();
        
        // 컨트롤 업데이트
        if (this.controls.enableDamping) {
            this.controls.update();
        }

        // 모델 매트릭스 강제 업데이트
        if (this.currentModel) {
            this.currentModel.updateMatrixWorld(true);
        }
        
        // 렌더링 전에 매트릭스 업데이트
        this.scene.updateMatrixWorld();

        // 메인 렌더링
        this.renderer.render(this.scene, this.camera);
        
        // 추가 렌더링 콜백 실행 (CSS2DRenderer 등)
        this.onRenderCallbacks.forEach(callback => callback());
    }
    
    /**
     * 렌더링 콜백 추가
     */
    addRenderCallback(callback) {
        if (typeof callback === 'function') {
            this.onRenderCallbacks.push(callback);
        }
    }
    
    /**
     * 렌더링 콜백 제거
     */
    removeRenderCallback(callback) {
        const index = this.onRenderCallbacks.indexOf(callback);
        if (index > -1) {
            this.onRenderCallbacks.splice(index, 1);
        }
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
     * 회전 속도 설정
     */
    setRotateSpeed(speed) {
        if (this.controls) {
            this.controls.rotateSpeed = speed;
        }
    }

    /**
     * 줌 속도 설정
     */
    setZoomSpeed(speed) {
        if (this.controls) {
            this.controls.zoomSpeed = speed;
        }
    }

    /**
     * 이동 속도 설정
     */
    setPanSpeed(speed) {
        if (this.controls) {
            this.controls.panSpeed = speed;
        }
    }

    /**
     * 모든 컨트롤 속도 리셋
     */
    resetControlSpeeds() {
        this.setRotateSpeed(this.config.controls.rotateSpeed || 0.5);
        this.setZoomSpeed(this.config.controls.zoomSpeed || 0.8);
        this.setPanSpeed(this.config.controls.panSpeed || 0.5);
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