/**
 * WallViewer.js - 옹벽 3D 뷰어 통합 클래스
 * 기존의 파편화된 모듈들을 하나로 통합한 심플 구조
 */

export class WallViewer {
    constructor(config) {
        this.config = config;
        
        // Three.js 핵심 객체들
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.clock = new THREE.Clock();
        
        // 애니메이션 관련
        this.mixer = null;
        this.actions = new Map();
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.animationLoop = null;
        
        // 모델 관련
        this.currentModel = null;
        this.currentModelIndex = 0;
        this.loader = new THREE.GLTFLoader();
        this.modelCache = new Map();
        
        // 핫스팟 관련
        this.hotspots = [];
        this.activeHotspot = null;
        
        // UI 상태
        this.isLoading = false;
        this.isDragging = false;
        
        // DOM 요소들
        this.elements = {};
        
        console.log('🎯 WallViewer v2 생성됨');
    }
    
    /**
     * 초기화
     */
    async init() {
        try {
            console.log('🚀 WallViewer 초기화 시작...');
            
            // WebGL 지원 체크
            if (!this.checkWebGLSupport()) {
                throw new Error('WebGL을 지원하지 않는 브라우저입니다.');
            }
            
            // DOM 요소 캐싱
            this.cacheElements();
            
            // Three.js 초기화
            this.initThreeJS();
            
            // UI 초기화
            this.initUI();
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // URL 파라미터 처리
            this.handleURLParams();
            
            // 첫 번째 모델 로드
            await this.loadModel(this.currentModelIndex);
            
            console.log('✅ WallViewer 초기화 완료');
            
        } catch (error) {
            console.error('❌ 초기화 실패:', error);
            this.showError(error.message);
        }
    }
    
    /**
     * WebGL 지원 확인
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * DOM 요소 캐싱
     */
    cacheElements() {
        this.elements = {
            viewer: document.getElementById('viewer'),
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            errorMessage: document.getElementById('error-message'),
            errorClose: document.getElementById('error-close'),
            
            // 헤더
            modelSelector: document.querySelector('.model-selector'),
            
            // 컨트롤
            cameraSelect: document.getElementById('camera-select'),
            viewButtons: document.querySelectorAll('.view-btn'),
            toggleHotspots: document.getElementById('toggle-hotspots'),
            hotspotFilter: document.getElementById('hotspot-filter'),
            resetCamera: document.getElementById('reset-camera'),
            toggleGrid: document.getElementById('toggle-grid'),
            
            // 타임라인
            timeline: document.getElementById('timeline'),
            playBtn: document.getElementById('play-btn'),
            timelineSlider: document.getElementById('timeline-slider'),
            timelineProgress: document.querySelector('.timeline-progress'),
            currentTime: document.getElementById('current-time'),
            totalTime: document.getElementById('total-time'),
            sensorMode: document.getElementById('sensor-mode'),
            
            // 핫스팟 정보
            hotspotInfo: document.getElementById('hotspot-info'),
            hotspotTitle: document.getElementById('hotspot-title'),
            hotspotClose: document.getElementById('hotspot-close'),
            hotspotBody: document.querySelector('.hotspot-info-body')
        };
    }
    
    /**
     * Three.js 초기화
     */
    initThreeJS() {
        console.log('🔧 Three.js 초기화...');
        
        // 씬 생성
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
        
        // 카메라 생성
        const aspect = this.elements.viewer.clientWidth / this.elements.viewer.clientHeight;
        this.camera = new THREE.PerspectiveCamera(
            this.config.camera.fov,
            aspect,
            this.config.camera.near,
            this.config.camera.far
        );
        
        // 카메라 초기 위치
        const pos = this.config.camera.defaultPosition;
        const look = this.config.camera.defaultLookAt;
        this.camera.position.set(pos[0], pos[1], pos[2]);
        this.camera.lookAt(look[0], look[1], look[2]);
        
        // 렌더러 생성
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.config.performance.antialias,
            alpha: false
        });
        
        this.renderer.setSize(
            this.elements.viewer.clientWidth,
            this.elements.viewer.clientHeight
        );
        this.renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, this.config.performance.pixelRatio)
        );
        
        // 그림자 설정
        if (this.config.performance.shadowsEnabled) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        // 톤 매핑
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        
        // 뷰어에 추가
        this.elements.viewer.appendChild(this.renderer.domElement);
        
        // 컨트롤 생성
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        Object.assign(this.controls, this.config.controls);
        
        // 조명 설정
        this.setupLights();
        
        // 그리드 설정
        if (this.config.viewer.showGrid) {
            this.setupGrid();
        }
        
        // 렌더 루프 시작
        this.startRenderLoop();
        
        console.log('✅ Three.js 초기화 완료');
    }
    
    /**
     * 조명 설정
     */
    setupLights() {
        // 앰비언트 라이트
        const ambient = new THREE.AmbientLight(
            this.config.lights.ambient.color,
            this.config.lights.ambient.intensity
        );
        this.scene.add(ambient);
        
        // 디렉셔널 라이트
        const directional = new THREE.DirectionalLight(
            this.config.lights.directional.color,
            this.config.lights.directional.intensity
        );
        
        const dirPos = this.config.lights.directional.position;
        directional.position.set(dirPos[0], dirPos[1], dirPos[2]);
        
        if (this.config.lights.directional.castShadow) {
            directional.castShadow = true;
            directional.shadow.mapSize.width = this.config.lights.directional.shadowMapSize;
            directional.shadow.mapSize.height = this.config.lights.directional.shadowMapSize;
            directional.shadow.camera.near = 0.1;
            directional.shadow.camera.far = 50;
            directional.shadow.camera.left = -10;
            directional.shadow.camera.right = 10;
            directional.shadow.camera.top = 10;
            directional.shadow.camera.bottom = -10;
        }
        
        this.scene.add(directional);
        
        // 포인트 라이트
        const point = new THREE.PointLight(
            this.config.lights.point.color,
            this.config.lights.point.intensity
        );
        
        const pointPos = this.config.lights.point.position;
        point.position.set(pointPos[0], pointPos[1], pointPos[2]);
        this.scene.add(point);
    }
    
    /**
     * 그리드 설정
     */
    setupGrid() {
        const grid = new THREE.GridHelper(20, 20);
        grid.material.opacity = 0.2;
        grid.material.transparent = true;
        this.scene.add(grid);
        this.grid = grid;
    }
    
    /**
     * UI 초기화
     */
    initUI() {
        console.log('🎨 UI 초기화...');
        
        // 모델 버튼 생성
        this.createModelButtons();
        
        // 핫스팟 필터 옵션 설정
        this.setupHotspotFilter();
        
        console.log('✅ UI 초기화 완료');
    }
    
    /**
     * 모델 버튼 생성
     */
    createModelButtons() {
        this.config.models.forEach((model, index) => {
            const button = document.createElement('button');
            button.className = 'model-btn';
            button.dataset.modelIndex = index;
            
            button.innerHTML = `
                <span class="model-icon">${model.icon}</span>
                <span class="model-name">${model.name}</span>
            `;
            
            button.addEventListener('click', () => this.loadModel(index));
            this.elements.modelSelector.appendChild(button);
        });
        
        // 첫 번째 버튼 활성화
        this.setActiveModelButton(0);
    }
    
    /**
     * 핫스팟 필터 설정
     */
    setupHotspotFilter() {
        // 기본 옵션은 HTML에 이미 있음
        console.log('핫스팟 필터 옵션 설정 완료');
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        console.log('🔗 이벤트 리스너 설정...');
        
        // 윈도우 리사이즈
        window.addEventListener('resize', () => this.onWindowResize());
        
        // 에러 닫기
        this.elements.errorClose?.addEventListener('click', () => this.hideError());
        
        // 카메라 선택
        this.elements.cameraSelect?.addEventListener('change', (e) => {
            this.switchCamera(e.target.value);
        });
        
        // 뷰 버튼들
        this.elements.viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewType = e.target.id.replace('view-', '');
                this.setView(viewType);
            });
        });
        
        // 컨트롤 버튼들
        this.elements.toggleHotspots?.addEventListener('click', () => this.toggleHotspots());
        this.elements.resetCamera?.addEventListener('click', () => this.resetCamera());
        this.elements.toggleGrid?.addEventListener('click', () => this.toggleGrid());
        
        // 핫스팟 필터
        this.elements.hotspotFilter?.addEventListener('change', (e) => {
            this.filterHotspots(e.target.value);
        });
        
        // 타임라인 컨트롤
        this.elements.playBtn?.addEventListener('click', () => this.toggleAnimation());
        this.elements.timelineSlider?.addEventListener('input', (e) => this.seekAnimation(e));
        this.elements.timelineSlider?.addEventListener('mousedown', () => this.isDragging = true);
        this.elements.timelineSlider?.addEventListener('mouseup', () => this.isDragging = false);
        
        // 센서 모드 토글
        this.elements.sensorMode?.addEventListener('change', (e) => {
            console.log('센서 모드:', e.target.checked ? '활성' : '비활성');
        });
        
        // 핫스팟 정보 닫기
        this.elements.hotspotClose?.addEventListener('click', () => this.hideHotspotInfo());
        
        // 키보드 단축키
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        console.log('✅ 이벤트 리스너 설정 완료');
    }
    
    /**
     * URL 파라미터 처리
     */
    handleURLParams() {
        const params = new URLSearchParams(window.location.search);
        const modelParam = params.get('model');
        
        if (modelParam !== null) {
            const index = parseInt(modelParam);
            if (!isNaN(index) && index >= 0 && index < this.config.models.length) {
                this.currentModelIndex = index;
            }
        }
    }
    
    /**
     * 모델 로드
     */
    async loadModel(index) {
        if (this.isLoading || index === this.currentModelIndex) return;
        
        try {
            this.isLoading = true;
            this.showLoading();
            this.setActiveModelButton(index);
            
            const modelConfig = this.config.models[index];
            const modelPath = `${this.config.app.basePath}${modelConfig.folder}/${modelConfig.fileName}`;
            
            console.log(`📦 모델 로드: ${modelConfig.name}`);
            console.log(`📂 경로: ${modelPath}`);
            
            // 캐시 확인
            let gltf;
            if (this.modelCache.has(modelPath)) {
                console.log('📦 캐시에서 로드');
                gltf = this.modelCache.get(modelPath);
            } else {
                gltf = await this.loadGLTF(modelPath);
                this.modelCache.set(modelPath, gltf);
            }
            
            // 기존 모델 제거
            this.clearCurrentModel();
            
            // 새 모델 추가
            this.currentModel = gltf.scene;
            this.scene.add(this.currentModel);
            this.currentModelIndex = index;
            
            // 모델 설정 적용
            this.setupModel(gltf, modelConfig);
            
            // 카메라 조정
            this.adjustCameraToModel(modelConfig);
            
            // 애니메이션 설정
            this.setupAnimations(gltf);
            
            // 핫스팟 설정
            this.setupHotspots();
            
            console.log(`✅ 모델 로드 완료: ${modelConfig.name}`);
            
        } catch (error) {
            console.error('❌ 모델 로드 실패:', error);
            this.showError(`모델 로드 실패: ${error.message}`);
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }
    
    /**
     * GLTF 파일 로드
     */
    loadGLTF(path) {
        return new Promise((resolve, reject) => {
            this.loader.load(
                path,
                (gltf) => {
                    console.log('✅ GLTF 로드 성공');
                    resolve(gltf);
                },
                (progress) => {
                    if (progress.lengthComputable) {
                        const percent = (progress.loaded / progress.total) * 100;
                        console.log(`로딩: ${percent.toFixed(0)}%`);
                    }
                },
                (error) => {
                    console.error('❌ GLTF 로드 실패:', error);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * 기존 모델 정리
     */
    clearCurrentModel() {
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.currentModel = null;
        }
        
        // 애니메이션 정리
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
            this.actions.clear();
        }
        
        // 핫스팟 정리
        this.clearHotspots();
        
        // 타임라인 숨기기
        this.hideTimeline();
    }
    
    /**
     * 모델 설정
     */
    setupModel(gltf, modelConfig) {
        // 그림자 설정
        if (this.config.performance.shadowsEnabled) {
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
        
        console.log('✅ 모델 설정 완료');
    }
    
    /**
     * 카메라 조정
     */
    adjustCameraToModel(modelConfig) {
        if (modelConfig.camera) {
            const pos = modelConfig.camera.position;
            const look = modelConfig.camera.lookAt;
            
            this.camera.position.set(pos[0], pos[1], pos[2]);
            this.camera.lookAt(look[0], look[1], look[2]);
            this.controls.target.set(look[0], look[1], look[2]);
            this.controls.update();
        }
    }
    
    /**
     * 애니메이션 설정
     */
    setupAnimations(gltf) {
        if (!gltf.animations || gltf.animations.length === 0) {
            console.log('ℹ️ 애니메이션 없음');
            return;
        }
        
        console.log(`🎬 애니메이션 ${gltf.animations.length}개 발견`);
        
        // 믹서 생성
        this.mixer = new THREE.AnimationMixer(gltf.scene);
        
        // 액션 생성
        gltf.animations.forEach((clip) => {
            const action = this.mixer.clipAction(clip);
            action.setLoop(THREE.LoopOnce);
            action.clampWhenFinished = true;
            this.actions.set(clip.name, action);
        });
        
        // 지속 시간 계산
        this.duration = Math.max(...gltf.animations.map(clip => clip.duration));
        
        // 타임라인 표시
        this.showTimeline();
        
        console.log(`✅ 애니메이션 설정 완료 (${this.duration.toFixed(2)}초)`);
    }
    
    /**
     * 핫스팟 설정 (간단 버전)
     */
    setupHotspots() {
        if (!this.config.hotspots.enabled) return;
        
        // 모델에서 HS_로 시작하는 오브젝트 찾기
        const hotspotObjects = [];
        this.currentModel.traverse((child) => {
            if (child.name && child.name.startsWith(this.config.hotspots.prefix)) {
                hotspotObjects.push(child);
            }
        });
        
        console.log(`🎯 핫스팟 ${hotspotObjects.length}개 발견`);
        
        // 임시로 빨간 구체로 표시
        hotspotObjects.forEach((obj, index) => {
            const geometry = new THREE.SphereGeometry(0.1, 8, 8);
            const material = new THREE.MeshBasicMaterial({ 
                color: this.config.hotspots.styles.danger.color 
            });
            const sphere = new THREE.Mesh(geometry, material);
            
            sphere.position.copy(obj.position);
            sphere.userData = {
                hotspotId: obj.name,
                sensorType: 'crack',
                status: 'danger'
            };
            
            this.scene.add(sphere);
            this.hotspots.push(sphere);
        });
    }
    
    /**
     * 렌더 루프 시작
     */
    startRenderLoop() {
        const animate = () => {
            this.animationLoop = requestAnimationFrame(animate);
            
            const delta = this.clock.getDelta();
            
            // 애니메이션 업데이트
            if (this.mixer && this.isPlaying) {
                this.mixer.update(delta);
                this.currentTime += delta;
                this.updateTimelineDisplay();
            }
            
            // 컨트롤 업데이트
            this.controls.update();
            
            // 렌더링
            this.renderer.render(this.scene, this.camera);
        };
        
        animate();
    }
    
    /**
     * UI 메서드들
     */
    
    showLoading() {
        if (this.elements.loading) {
            this.elements.loading.style.display = 'flex';
        }
    }
    
    hideLoading() {
        if (this.elements.loading) {
            this.elements.loading.style.display = 'none';
        }
    }
    
    showError(message) {
        if (this.elements.error && this.elements.errorMessage) {
            this.elements.errorMessage.textContent = message;
            this.elements.error.style.display = 'flex';
        }
    }
    
    hideError() {
        if (this.elements.error) {
            this.elements.error.style.display = 'none';
        }
    }
    
    setActiveModelButton(index) {
        document.querySelectorAll('.model-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === index);
        });
    }
    
    showTimeline() {
        if (this.elements.timeline) {
            this.elements.timeline.style.display = 'flex';
            this.updateTimelineDisplay();
        }
    }
    
    hideTimeline() {
        if (this.elements.timeline) {
            this.elements.timeline.style.display = 'none';
        }
    }
    
    updateTimelineDisplay() {
        if (!this.elements.timeline || this.isDragging) return;
        
        const progress = (this.currentTime / this.duration) * 100;
        
        if (this.elements.timelineSlider) {
            this.elements.timelineSlider.value = progress;
        }
        
        if (this.elements.timelineProgress) {
            this.elements.timelineProgress.style.width = `${progress}%`;
        }
        
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(this.currentTime);
        }
        
        if (this.elements.totalTime) {
            this.elements.totalTime.textContent = this.formatTime(this.duration);
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * 컨트롤 메서드들
     */
    
    toggleAnimation() {
        if (!this.mixer) return;
        
        if (this.isPlaying) {
            this.pauseAnimation();
        } else {
            this.playAnimation();
        }
    }
    
    playAnimation() {
        if (!this.mixer) return;
        
        this.actions.forEach(action => {
            if (!action.isRunning()) {
                action.reset();
                action.play();
            }
            action.paused = false;
        });
        
        this.isPlaying = true;
        
        if (this.elements.playBtn) {
            this.elements.playBtn.innerHTML = '<span class="play-icon">⏸</span>';
        }
        
        console.log('▶️ 애니메이션 재생');
    }
    
    pauseAnimation() {
        if (!this.mixer) return;
        
        this.actions.forEach(action => {
            action.paused = true;
        });
        
        this.isPlaying = false;
        
        if (this.elements.playBtn) {
            this.elements.playBtn.innerHTML = '<span class="play-icon">▶</span>';
        }
        
        console.log('⏸️ 애니메이션 일시정지');
    }
    
    seekAnimation(event) {
        if (!this.mixer) return;
        
        const progress = parseFloat(event.target.value) / 100;
        this.currentTime = progress * this.duration;
        
        this.actions.forEach(action => {
            action.time = this.currentTime;
        });
        
        this.updateTimelineDisplay();
    }
    
    resetCamera() {
        const pos = this.config.camera.defaultPosition;
        const look = this.config.camera.defaultLookAt;
        
        this.camera.position.set(pos[0], pos[1], pos[2]);
        this.controls.target.set(look[0], look[1], look[2]);
        this.controls.update();
        
        console.log('📷 카메라 리셋');
    }
    
    switchCamera(cameraIndex) {
        console.log('📷 카메라 전환:', cameraIndex);
        // TODO: GLTF 카메라 지원
    }
    
    setView(viewType) {
        const modelConfig = this.config.models[this.currentModelIndex];
        let position, target;
        
        switch (viewType) {
            case 'front':
                position = [0, 0, 10];
                target = [0, 0, 0];
                break;
            case 'side':
                position = [10, 0, 0];
                target = [0, 0, 0];
                break;
            case 'top':
                position = [0, 10, 0];
                target = [0, 0, 0];
                break;
            case 'iso':
                position = modelConfig?.camera?.position || [5, 5, 10];
                target = modelConfig?.camera?.lookAt || [0, 0, 0];
                break;
        }
        
        this.camera.position.set(...position);
        this.controls.target.set(...target);
        this.controls.update();
        
        console.log(`👁️ ${viewType} 뷰로 전환`);
    }
    
    toggleGrid() {
        if (this.grid) {
            this.grid.visible = !this.grid.visible;
            console.log('🔲 그리드:', this.grid.visible ? '표시' : '숨김');
        }
    }
    
    toggleHotspots() {
        this.hotspots.forEach(hotspot => {
            hotspot.visible = !hotspot.visible;
        });
        console.log('🎯 핫스팟:', this.hotspots[0]?.visible ? '표시' : '숨김');
    }
    
    filterHotspots(filterType) {
        console.log('🔍 핫스팟 필터:', filterType);
        // TODO: 필터 로직 구현
    }
    
    clearHotspots() {
        this.hotspots.forEach(hotspot => {
            this.scene.remove(hotspot);
        });
        this.hotspots = [];
        this.hideHotspotInfo();
    }
    
    hideHotspotInfo() {
        if (this.elements.hotspotInfo) {
            this.elements.hotspotInfo.style.display = 'none';
        }
        this.activeHotspot = null;
    }
    
    /**
     * 키보드 단축키
     */
    handleKeyPress(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') {
            return;
        }
        
        switch (event.key) {
            case ' ':
                event.preventDefault();
                this.toggleAnimation();
                break;
            case 'r':
            case 'R':
                this.resetCamera();
                break;
            case 'g':
            case 'G':
                this.toggleGrid();
                break;
            case 'h':
            case 'H':
                this.toggleHotspots();
                break;
            case '1':
            case '2':
            case '3':
                const index = parseInt(event.key) - 1;
                if (index < this.config.models.length) {
                    this.loadModel(index);
                }
                break;
        }
    }
    
    /**
     * 윈도우 리사이즈 처리
     */
    onWindowResize() {
        const width = this.elements.viewer.clientWidth;
        const height = this.elements.viewer.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    /**
     * 정리
     */
    destroy() {
        // 애니메이션 루프 중단
        if (this.animationLoop) {
            cancelAnimationFrame(this.animationLoop);
        }
        
        // Three.js 객체들 정리
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        if (this.scene) {
            this.scene.clear();
        }
        
        console.log('🔚 WallViewer 정리 완료');
    }
}