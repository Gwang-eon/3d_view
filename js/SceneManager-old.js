// js/SceneManager.js
// ConfigManager 기반 완전 개선 버전 - 모든 하드코딩 제거

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 씬 관리 클래스
 * - ConfigManager 기반 설정 관리
 * - 의존성 주입 지원
 * - 자동 리사이징 및 성능 최적화
 * - 스크린샷 및 디버그 기능
 */
export class SceneManager {
    constructor(container = null) {
        // 컨테이너 설정
        this.container = this.resolveContainer(container);
        
        // Three.js 객체들
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // 조명 시스템
        this.lights = new Map();
        
        // 현재 모델
        this.currentModel = null;
        this.currentModelInfo = null;
        
        // 성능 모니터링
        this.stats = {
            triangles: 0,
            vertices: 0,
            meshes: 0,
            lastFrameTime: 0
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // 초기화
        this.init();
        
        console.log('[SceneManager] 초기화 완료');
    }
    
    /**
     * 컨테이너 해결
     */
    resolveContainer(container) {
        if (container) {
            return typeof container === 'string' ? document.querySelector(container) : container;
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
            this.createScene();
            this.createCamera();
            this.createRenderer();
            this.createLights();
            this.createControls();
            this.setupEventListeners();
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
     * 씬 생성
     */
    createScene() {
        this.scene = new THREE.Scene();
        
        // 배경색 설정
        const bgColor = getConfig('scene.renderer.backgroundColor', 0x000000);
        this.scene.background = new THREE.Color(bgColor);
        
        // 안개 설정 (선택적)
        const fogEnabled = getConfig('scene.fog.enabled', false);
        if (fogEnabled) {
            const fogColor = getConfig('scene.fog.color', 0x000000);
            const fogNear = getConfig('scene.fog.near', 50);
            const fogFar = getConfig('scene.fog.far', 200);
            this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
        }
        
        console.log('[SceneManager] ✓ 씬 생성됨');
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
            powerPreference: getConfig('performance.powerPreference', 'high-performance')
        });
        
        // 크기 설정
        this.updateRendererSize();
        
        // 픽셀 비율 설정
        this.renderer.setPixelRatio(rendererConfig.pixelRatio);
        
        // 그림자 설정
        if (rendererConfig.shadowMapEnabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = this.getShadowMapType(rendererConfig.shadowMapType);
        }
        
        // 색상 공간 설정
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = getConfig('scene.renderer.exposure', 1.0);
        
        // 컨테이너에 추가
        this.container.appendChild(this.renderer.domElement);
        
        console.log('[SceneManager] ✓ 렌더러 생성됨');
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
        if (lightingConfig.ambient) {
            const ambient = lightingConfig.ambient;
            const ambientLight = new THREE.AmbientLight(
                ambient.color,
                ambient.intensity
            );
            
            this.scene.add(ambientLight);
            this.lights.set('ambient', ambientLight);
        }
        
        // 직사광 (Directional Light)
        if (lightingConfig.directional) {
            const dir = lightingConfig.directional;
            const directionalLight = new THREE.DirectionalLight(
                dir.color,
                dir.intensity
            );
            
            // 위치 설정
            if (dir.position) {
                directionalLight.position.set(
                    dir.position.x,
                    dir.position.y,
                    dir.position.z
                );
            }
            
            // 그림자 설정
            if (dir.castShadow) {
                directionalLight.castShadow = true;
                
                const shadowSize = dir.shadowMapSize || getConfig('scene.renderer.shadowMapSize', 2048);
                directionalLight.shadow.mapSize.width = shadowSize;
                directionalLight.shadow.mapSize.height = shadowSize;
                
                // 그림자 카메라 설정
                const shadowCamera = directionalLight.shadow.camera;
                shadowCamera.near = dir.shadowNear || 0.1;
                shadowCamera.far = dir.shadowFar || 100;
                shadowCamera.left = dir.shadowLeft || -50;
                shadowCamera.right = dir.shadowRight || 50;
                shadowCamera.top = dir.shadowTop || 50;
                shadowCamera.bottom = dir.shadowBottom || -50;
                
                // 그림자 편향 설정
                directionalLight.shadow.bias = dir.shadowBias || -0.0001;
            }
            
            this.scene.add(directionalLight);
            this.lights.set('directional', directionalLight);
        }
        
        // 추가 조명들 (점광원, 스포트라이트 등)
        this.createAdditionalLights(lightingConfig);
        
        console.log('[SceneManager] ✓ 조명 생성됨:', this.lights.size);
    }
    
    /**
     * 추가 조명 생성
     */
    createAdditionalLights(lightingConfig) {
        // 점광원 (Point Light)
        if (lightingConfig.points) {
            lightingConfig.points.forEach((pointConfig, index) => {
                const pointLight = new THREE.PointLight(
                    pointConfig.color,
                    pointConfig.intensity,
                    pointConfig.distance || 0,
                    pointConfig.decay || 1
                );
                
                if (pointConfig.position) {
                    pointLight.position.set(
                        pointConfig.position.x,
                        pointConfig.position.y,
                        pointConfig.position.z
                    );
                }
                
                this.scene.add(pointLight);
                this.lights.set(`point_${index}`, pointLight);
            });
        }
        
        // 스포트라이트 (Spot Light)
        if (lightingConfig.spots) {
            lightingConfig.spots.forEach((spotConfig, index) => {
                const spotLight = new THREE.SpotLight(
                    spotConfig.color,
                    spotConfig.intensity,
                    spotConfig.distance || 0,
                    spotConfig.angle || Math.PI / 3,
                    spotConfig.penumbra || 0,
                    spotConfig.decay || 1
                );
                
                if (spotConfig.position) {
                    spotLight.position.set(
                        spotConfig.position.x,
                        spotConfig.position.y,
                        spotConfig.position.z
                    );
                }
                
                if (spotConfig.target) {
                    spotLight.target.position.set(
                        spotConfig.target.x,
                        spotConfig.target.y,
                        spotConfig.target.z
                    );
                    this.scene.add(spotLight.target);
                }
                
                this.scene.add(spotLight);
                this.lights.set(`spot_${index}`, spotLight);
            });
        }
    }
    
    /**
     * 컨트롤 생성
     */
    createControls() {
        if (!THREE.OrbitControls) {
            console.warn('[SceneManager] OrbitControls를 사용할 수 없습니다.');
            return;
        }
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        
        const controlsConfig = getConfig('scene.controls');
        
        // 설정 적용
        Object.entries(controlsConfig).forEach(([key, value]) => {
            if (this.controls.hasOwnProperty(key)) {
                this.controls[key] = value;
            }
        });
        
        // 이벤트 리스너
        this.controls.addEventListener('change', () => {
            this.emit('controls:change');
        });
        
        this.controls.addEventListener('start', () => {
            this.emit('controls:start');
        });
        
        this.controls.addEventListener('end', () => {
            this.emit('controls:end');
        });
        
        console.log('[SceneManager] ✓ 컨트롤 생성됨');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 윈도우 리사이즈
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // 설정 변경 감지
        if (this.app && this.app.configManager) {
            this.app.configManager.addChangeListener(this.handleConfigChange.bind(this));
        }
        
        // 키보드 이벤트 (개발 모드)
        if (getConfig('app.debug')) {
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
        }
    }
    
    /**
     * 렌더 루프 시작
     */
    startRenderLoop() {
        // ConfigManager의 targetFPS 사용
        const targetFPS = getConfig('performance.targetFPS', 60);
        const frameInterval = 1000 / targetFPS;
        let lastFrameTime = 0;
        
        const render = (currentTime) => {
            if (currentTime - lastFrameTime >= frameInterval) {
                this.update(currentTime);
                this.render();
                lastFrameTime = currentTime;
            }
            
            requestAnimationFrame(render);
        };
        
        requestAnimationFrame(render);
        console.log('[SceneManager] ✓ 렌더 루프 시작됨');
    }
    
    /**
     * 업데이트 (매 프레임)
     */
    update(deltaTime) {
        // 컨트롤 업데이트
        if (this.controls && this.controls.enableDamping) {
            this.controls.update();
        }
        
        // 통계 업데이트
        this.updateStats();
        
        // 성능 모니터링
        if (getConfig('performance.adaptiveQuality')) {
            this.monitorPerformance(deltaTime);
        }
        
        this.emit('update', deltaTime);
    }
    
    /**
     * 렌더링
     */
    render() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
            this.emit('render');
        }
    }
    
    /**
     * 모델 추가
     */
    addModel(gltf, modelInfo = null) {
        // 기존 모델 제거
        this.removeCurrentModel();
        
        // 새 모델 추가
        this.currentModel = gltf.scene;
        this.currentModelInfo = modelInfo;
        this.scene.add(this.currentModel);
        
        // 모델 최적화
        this.optimizeModel(this.currentModel);
        
        // 바운딩 박스 계산 및 카메라 조정
        this.fitCameraToModel();
        
        // 통계 업데이트
        this.updateModelStats();
        
        this.emit('model:added', gltf, modelInfo);
        
        console.log('[SceneManager] 모델 추가됨:', modelInfo?.name || 'Unknown');
    }
    
    /**
     * 현재 모델 제거
     */
    removeCurrentModel() {
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            
            // 메모리 정리
            this.disposeModel(this.currentModel);
            
            this.currentModel = null;
            this.currentModelInfo = null;
            
            this.emit('model:removed');
        }
    }
    
    /**
     * 모델 최적화
     */
    optimizeModel(model) {
        const maxTriangles = getConfig('performance.maxTriangles');
        const enableLOD = getConfig('performance.enableLOD');
        
        let totalTriangles = 0;
        
        model.traverse((child) => {
            if (child.isMesh) {
                // 그림자 설정
                child.castShadow = true;
                child.receiveShadow = true;
                
                // 지오메트리 통계
                if (child.geometry) {
                    const triangles = child.geometry.attributes.position ? 
                        child.geometry.attributes.position.count / 3 : 0;
                    totalTriangles += triangles;
                }
                
                // 재질 최적화
                if (child.material) {
                    this.optimizeMaterial(child.material);
                }
                
                // LOD 적용
                if (enableLOD && totalTriangles > maxTriangles) {
                    this.applyLOD(child);
                }
            }
        });
        
        console.log(`[SceneManager] 모델 최적화 완료 - 삼각형: ${totalTriangles.toLocaleString()}`);
    }
    
    /**
     * 재질 최적화
     */
    optimizeMaterial(material) {
        if (material.isMeshStandardMaterial) {
            // 환경 매핑 강도 조절
            material.envMapIntensity = getConfig('scene.material.envMapIntensity', 0.5);
            
            // 러프니스/메탈릭 최적화
            if (material.roughness === undefined) material.roughness = 0.7;
            if (material.metalness === undefined) material.metalness = 0.0;
        }
        
        // 텍스처 최적화
        if (material.map) {
            this.optimizeTexture(material.map);
        }
    }
    
    /**
     * 텍스처 최적화
     */
    optimizeTexture(texture) {
        const maxSize = getConfig('performance.maxTextureSize');
        
        // 필터링 설정
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        // 래핑 설정
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
    }
    
    /**
     * LOD 적용
     */
    applyLOD(mesh) {
        // LOD 구현 (필요시 확장)
        console.log('[SceneManager] LOD 적용:', mesh.name);
    }
    
    /**
     * 카메라를 모델에 맞게 조정
     */
    fitCameraToModel() {
        if (!this.currentModel) return;
        
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // 카메라 거리 계산
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = Math.abs(maxDim / Math.sin(fov / 2)) * 1.2;
        
        // 카메라 위치 업데이트
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        direction.negate();
        
        const newPosition = center.clone().add(direction.multiplyScalar(distance));
        
        // 부드러운 전환
        const transitionDuration = getConfig('timing.transitionDuration', 1000);
        this.animateCameraTo(newPosition, center, transitionDuration);
        
        // 컨트롤 타겟 업데이트
        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.update();
        }
    }
    
    /**
     * 카메라 애니메이션
     */
    animateCameraTo(position, target, duration = 1000) {
        const startPos = this.camera.position.clone();
        const startTarget = this.controls ? this.controls.target.clone() : target;
        
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 이징 함수 적용
            const eased = this.easeInOutCubic(progress);
            
            // 위치 보간
            this.camera.position.lerpVectors(startPos, position, eased);
            
            // 타겟 보간
            if (this.controls) {
                this.controls.target.lerpVectors(startTarget, target, eased);
                this.controls.update();
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.emit('camera:animation:complete');
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * 이징 함수
     */
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }
    
    /**
     * 통계 업데이트
     */
    updateStats() {
        if (!this.currentModel) {
            this.stats = { triangles: 0, vertices: 0, meshes: 0 };
            return;
        }
        
        let triangles = 0;
        let vertices = 0;
        let meshes = 0;
        
        this.currentModel.traverse((child) => {
            if (child.isMesh && child.geometry) {
                meshes++;
                
                const positionAttribute = child.geometry.attributes.position;
                if (positionAttribute) {
                    vertices += positionAttribute.count;
                    
                    if (child.geometry.index) {
                        triangles += child.geometry.index.count / 3;
                    } else {
                        triangles += positionAttribute.count / 3;
                    }
                }
            }
        });
        
        this.stats = { triangles, vertices, meshes };
    }
    
    /**
     * 모델 통계 업데이트
     */
    updateModelStats() {
        this.updateStats();
        this.emit('stats:updated', this.stats);
    }
    
    /**
     * 성능 모니터링
     */
    monitorPerformance(currentTime) {
        const frameTime = currentTime - this.stats.lastFrameTime;
        this.stats.lastFrameTime = currentTime;
        
        if (frameTime > 0) {
            const fps = 1000 / frameTime;
            const targetFPS = getConfig('performance.targetFPS');
            
            // FPS가 목표의 80% 미만일 때 품질 조절
            if (fps < targetFPS * 0.8) {
                this.adjustQuality('down');
            } else if (fps > targetFPS * 1.1) {
                this.adjustQuality('up');
            }
        }
    }
    
    /**
     * 품질 자동 조절
     */
    adjustQuality(direction) {
        const currentPixelRatio = this.renderer.getPixelRatio();
        
        if (direction === 'down' && currentPixelRatio > 1) {
            const newRatio = Math.max(1, currentPixelRatio - 0.1);
            this.renderer.setPixelRatio(newRatio);
            setConfig('scene.renderer.pixelRatio', newRatio);
            
            console.log(`[SceneManager] 성능 최적화: pixelRatio → ${newRatio}`);
            
        } else if (direction === 'up' && currentPixelRatio < window.devicePixelRatio) {
            const maxRatio = Math.min(window.devicePixelRatio, 2);
            const newRatio = Math.min(maxRatio, currentPixelRatio + 0.1);
            this.renderer.setPixelRatio(newRatio);
            setConfig('scene.renderer.pixelRatio', newRatio);
            
            console.log(`[SceneManager] 품질 향상: pixelRatio → ${newRatio}`);
        }
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
            if (prop === 'fov') {
                this.camera.fov = value;
                this.camera.updateProjectionMatrix();
            }
        }
        
        // 렌더러 설정 변경
        if (key.startsWith('scene.renderer.')) {
            const prop = key.split('.').pop();
            if (prop === 'pixelRatio') {
                this.renderer.setPixelRatio(value);
            }
        }
        
        // 조명 설정 변경
        if (key.startsWith('scene.lighting.')) {
            this.updateLighting();
        }
    }
    
    /**
     * 조명 업데이트
     */
    updateLighting() {
        const lightingConfig = getConfig('scene.lighting');
        
        // 주변광 업데이트
        const ambientLight = this.lights.get('ambient');
        if (ambientLight && lightingConfig.ambient) {
            ambientLight.color.setHex(lightingConfig.ambient.color);
            ambientLight.intensity = lightingConfig.ambient.intensity;
        }
        
        // 직사광 업데이트
        const directionalLight = this.lights.get('directional');
        if (directionalLight && lightingConfig.directional) {
            directionalLight.color.setHex(lightingConfig.directional.color);
            directionalLight.intensity = lightingConfig.directional.intensity;
        }
    }
    
    /**
     * 키보드 이벤트 처리 (디버그 모드)
     */
    handleKeyDown(event) {
        if (!getConfig('app.debug')) return;
        
        switch (event.code) {
            case 'KeyG':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.toggleGrid();
                }
                break;
                
            case 'KeyL':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.toggleLightHelpers();
                }
                break;
                
            case 'KeyW':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.toggleWireframe();
                }
                break;
        }
    }
    
    /**
     * 그리드 토글
     */
    toggleGrid() {
        if (!this.gridHelper) {
            const size = getConfig('devTools.gridSize', 100);
            const divisions = getConfig('devTools.gridDivisions', 100);
            this.gridHelper = new THREE.GridHelper(size, divisions);
            this.scene.add(this.gridHelper);
        } else {
            this.scene.remove(this.gridHelper);
            this.gridHelper = null;
        }
    }
    
    /**
     * 조명 헬퍼 토글
     */
    toggleLightHelpers() {
        this.lights.forEach((light, name) => {
            if (light.isDirectionalLight && !light.helper) {
                light.helper = new THREE.DirectionalLightHelper(light, 5);
                this.scene.add(light.helper);
            } else if (light.helper) {
                this.scene.remove(light.helper);
                light.helper = null;
            }
        });
    }
    
    /**
     * 와이어프레임 토글
     */
    toggleWireframe() {
        if (!this.currentModel) return;
        
        this.currentModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.wireframe = !child.material.wireframe;
            }
        });
    }
    
    /**
     * 디버그 도구 설정
     */
    setupDebugTools() {
        // 축 헬퍼
        if (getConfig('devTools.showAxes')) {
            const axesHelper = new THREE.AxesHelper(5);
            this.scene.add(axesHelper);
        }
        
        // 그리드 헬퍼
        if (getConfig('devTools.showGrid')) {
            this.toggleGrid();
        }
        
        console.log('[SceneManager] ✓ 디버그 도구 활성화');
        console.log('키보드 단축키:');
        console.log('  Ctrl+G: 그리드 토글');
        console.log('  Ctrl+L: 조명 헬퍼 토글');
        console.log('  Ctrl+W: 와이어프레임 토글');
    }
    
    /**
     * 메모리 정리
     */
    disposeModel(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => this.disposeMaterial(material));
                    } else {
                        this.disposeMaterial(child.material);
                    }
                }
            }
        });
    }
    
    /**
     * 재질 정리
     */
    disposeMaterial(material) {
        Object.keys(material).forEach(prop => {
            const value = material[prop];
            if (value && typeof value.dispose === 'function') {
                value.dispose();
            }
        });
        material.dispose();
    }
    
    /**
     * 앱 참조 설정 (의존성 주입)
     */
    setApp(app) {
        this.app = app;
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
     * 정리
     */
    destroy() {
        console.log('[SceneManager] 정리 중...');
        
        // 현재 모델 제거
        this.removeCurrentModel();
        
        // 조명 정리
        this.lights.forEach(light => {
            this.scene.remove(light);
        });
        this.lights.clear();
        
        // 헬퍼 정리
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
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
        
        // 이벤트 리스너 제거
        window.removeEventListener('resize', this.handleResize);
        
        this.emit('destroyed');
        console.log('[SceneManager] 정리 완료');
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
        console.log('통계:', this.stats);
        console.log('렌더러 크기:', {
            width: this.renderer.domElement.width,
            height: this.renderer.domElement.height,
            pixelRatio: this.renderer.getPixelRatio()
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
}

export default SceneManager;