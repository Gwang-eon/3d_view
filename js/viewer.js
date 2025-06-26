// js/viewer.js - 3D 뷰어 코어 모듈 (CSS2DRenderer 지원 버전)

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
        
        // 렌더링 콜백 (CSS2DRenderer 등을 위한)
        this.onRenderCallbacks = [];
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
            alpha: false,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(this.config.performance.pixelRatio);
        
        // 그림자 설정
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        
        // 톤 매핑 - 더 밝게
        this.renderer.toneMapping = THREE.LinearToneMapping;  // ACESFilmic 대신
        this.renderer.toneMappingExposure = 1.2;
        

        
        this.container.appendChild(this.renderer.domElement);
    }
    
    /**
     * 카메라 컨트롤 생성
     */
    createControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        // 컨트롤 설정 적용
        Object.assign(this.controls, this.config.controls);


        // 추가 설정 (새로 추가)
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        
        // 터치 설정 (새로 추가)
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
     * 조명 설정
     */
    setupLights() {
        // 절차적 환경맵 생성 (하늘)
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        
        // 간단한 그라데이션 하늘 생성
        const skyScene = new THREE.Scene();
        const skyGeo = new THREE.SphereGeometry(500, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x87CEEB) }, // 하늘색
                bottomColor: { value: new THREE.Color(0xF0E68C) }, // 지평선색
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeo, skyMat);
        skyScene.add(sky);
        
        // 환경맵 생성
        const renderTarget = pmremGenerator.fromScene(skyScene,0.04);
        this.scene.environment = renderTarget.texture;

        
        
        // 배경은 그라데이션 색상으로
        this.scene.background = new THREE.Color(0x87CEEB);
        
        // 안개 추가 (깊이감)
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 300);
        
        // 태양광 (그림자용)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(10, 20, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.1;
        sunLight.shadow.camera.far = 100;
        sunLight.shadow.bias = -0.001;
        sunLight.shadow.normalBias = 0.02;

        // 초기 그림자 범위 (setModel에서 자동 조정됨)
        // sunLight.shadow.camera.left = -30;
        // sunLight.shadow.camera.right = 30;
        // sunLight.shadow.camera.top = 30;
        // sunLight.shadow.camera.bottom = -30;

        // 그림자 부드러움
        sunLight.shadow.radius = 4;
        sunLight.shadow.blurSamples = 25;

        this.scene.add(sunLight);
        
        this.sunLight = sunLight;

        // 4. 반구광 추가 (하늘/땅 색상)
        const hemiLight = new THREE.HemisphereLight(
        0x87CEEB, // 하늘색
        0x8B7355, // 땅색
        0.8       // 강도
        );

        this.scene.add(hemiLight);
        
        // 약간의 환경광 추가
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        pmremGenerator.dispose();
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
                
                // 머티리얼 확인 및 수정
                if (child.material) {
                    // MeshBasicMaterial은 그림자를 받지 못하므로 변경
                    if (child.material.type === 'MeshBasicMaterial') {
                        const oldMat = child.material;
                        child.material = new THREE.MeshStandardMaterial({
                            color: oldMat.color,
                            map: oldMat.map,
                            transparent: oldMat.transparent,
                            opacity: oldMat.opacity
                        });
                        oldMat.dispose();
                    }
                    
                    child.material.envMapIntensity = 0.6;

                    child.material.needsUpdate = true;
                }
            }
        });

        // 모델 크기 조정 및 중심 맞추기
        this.centerModel(model);
        
        // 씬에 추가
        this.scene.add(model);
        
        // 모델에 맞게 그림자 카메라 범위 자동 조정
        if (this.sunLight) {
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.z) * 0.7; // 수평 크기 기준
            
            // 그림자 카메라 범위를 모델 크기에 맞게 조정
            const shadowCam = this.sunLight.shadow.camera;
            shadowCam.left = -maxDim;
            shadowCam.right = maxDim;
            shadowCam.top = maxDim;
            shadowCam.bottom = -maxDim;
            shadowCam.updateProjectionMatrix();

            // 태양 위치도 모델 크기에 맞게 조정
            this.sunLight.position.set(maxDim * 0.5, maxDim, maxDim * 0.5);
            this.sunLight.target.position.copy(center);
            this.sunLight.target.updateMatrixWorld();
        
            // 그림자 헬퍼 업데이트
            if (this.shadowHelper) {
                this.shadowHelper.update();
            }
        }
        
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
        //model.position.sub(center);
        
        // 크기가 너무 크거나 작은 경우 스케일 조정
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 10 || maxDim < 1) {
            const targetSize = 26;
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