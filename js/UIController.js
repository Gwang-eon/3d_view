// js/UIController.js
// ConfigManager 기반 완전 개선 버전 - 모든 하드코딩 제거

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * UI 컨트롤러 클래스
 * - ConfigManager 기반 설정 관리
 * - 모든 DOM 셀렉터 설정화
 * - 이벤트 기반 통신
 * - 반응형 UI 지원
 */
export class UIController {
    constructor(sceneManager, modelLoader, animationController, hotspotManager) {
        // 서비스 의존성
        this.sceneManager = sceneManager;
        this.modelLoader = modelLoader;
        this.animationController = animationController;
        this.hotspotManager = hotspotManager;
        
        // DOM 요소 캐시
        this.elements = new Map();
        
        // 상태 관리
        this.state = {
            currentModel: null,
            loading: false,
            panelsVisible: {
                left: true,
                right: true,
                bottom: true
            },
            selectedHotspot: null
        };
        
        // 성능 모니터링
        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // 초기화
        this.init();
        
        console.log('[UIController] 초기화 완료');
    }
    
    /**
     * 초기화
     */
    init() {
        try {
            // DOM 요소 캐싱
            this.cacheDOMElements();
            
            // DOM 요소 검증
            this.validateDOMElements();
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 초기 UI 상태 설정
            this.initializeUIState();
            
            // 모델 선택 화면 구성
            this.setupModelSelector();
            
            // 성능 모니터링 시작
            this.startPerformanceMonitoring();
            
            // 반응형 UI 설정
            this.setupResponsiveUI();
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('[UIController] 초기화 실패:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * DOM 요소 캐싱 (ConfigManager 기반)
     */
    cacheDOMElements() {
        // ConfigManager에서 셀렉터 가져오기
        const selectors = getConfig('selectors');
        
        // 모든 셀렉터를 순회하며 요소 캐싱
        Object.entries(selectors).forEach(([key, selector]) => {
            const element = document.querySelector(selector);
            if (element) {
                this.elements.set(key, element);
            } else {
                console.warn(`[UIController] 요소를 찾을 수 없음: ${key} (${selector})`);
            }
        });
        
        // 추가 요소들 (동적 생성되는 것들)
        this.findOptionalElements();
        
        console.log(`[UIController] ✓ DOM 요소 캐싱 완료: ${this.elements.size}개`);
    }
    
    /**
     * 선택적 요소들 찾기
     */
    findOptionalElements() {
        const optionalSelectors = {
            // 패널들
            leftPanelToggle: '#left-panel-toggle',
            rightPanelToggle: '#right-panel-toggle',
            bottomPanelToggle: '#bottom-panel-toggle',
            
            // 뷰어 전용
            viewerContainer: '#viewer-container',
            toolbar: '#toolbar',
            statusBar: '#status-bar',
            
            // 애니메이션 관련
            playButton: '#play-button',
            pauseButton: '#pause-button',
            stopButton: '#stop-button',
            timelineSlider: '#timeline-slider',
            speedControl: '#speed-control',
            
            // 카메라 관련
            cameraPresets: '#camera-presets',
            resetCameraBtn: '#reset-camera',
            
            // 설정 관련
            settingsPanel: '#settings-panel',
            themeToggle: '#theme-toggle',
            languageSelector: '#language-selector'
        };
        
        Object.entries(optionalSelectors).forEach(([key, selector]) => {
            const element = document.querySelector(selector);
            if (element) {
                this.elements.set(key, element);
            }
        });
    }
    
    /**
     * DOM 요소 검증
     */
    validateDOMElements() {
        const requiredElements = [
            'modelSelector',
            'modelList',
            'canvasContainer'
        ];
        
        const missingElements = requiredElements.filter(key => !this.elements.has(key));
        
        if (missingElements.length > 0) {
            console.warn('[UIController] 필수 요소 누락:', missingElements);
            
            // 자동 생성 시도 (개발 모드)
            if (getConfig('app.debug')) {
                this.createMissingElements(missingElements);
            }
        }
    }
    
    /**
     * 누락된 요소 자동 생성
     */
    createMissingElements(missingKeys) {
        const selectors = getConfig('selectors');
        
        missingKeys.forEach(key => {
            const selector = selectors[key];
            if (!selector) return;
            
            try {
                const element = document.createElement('div');
                element.id = selector.replace('#', '');
                element.className = key.toLowerCase().replace(/([A-Z])/g, '-$1');
                
                // 기본 스타일 적용
                this.applyDefaultStyles(element, key);
                
                // 적절한 부모에 추가
                const parent = this.findAppropriateParent(key);
                parent.appendChild(element);
                
                // 캐시에 추가
                this.elements.set(key, element);
                
                console.log(`[UIController] 요소 생성: ${key}`);
                
            } catch (error) {
                console.error(`[UIController] 요소 생성 실패: ${key}`, error);
            }
        });
    }
    
    /**
     * 기본 스타일 적용
     */
    applyDefaultStyles(element, key) {
        const styles = {
            modelSelector: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #1e1e1e, #2a2a2a)',
                color: '#fff',
                fontFamily: 'Arial, sans-serif'
            },
            modelList: {
                display: 'flex',
                gap: '20px',
                flexWrap: 'wrap',
                justifyContent: 'center'
            },
            canvasContainer: {
                width: '100%',
                height: '100vh',
                position: 'relative',
                overflow: 'hidden'
            }
        };
        
        const style = styles[key];
        if (style) {
            Object.assign(element.style, style);
        }
    }
    
    /**
     * 적절한 부모 요소 찾기
     */
    findAppropriateParent(key) {
        // 우선순위: 지정된 컨테이너 → body
        const containers = ['#app', '#main', '#container'];
        
        for (const selector of containers) {
            const container = document.querySelector(selector);
            if (container) return container;
        }
        
        return document.body;
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 윈도우 이벤트
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));
        
        // 키보드 이벤트
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // 모델 변경 버튼
        const changeModelBtn = this.elements.get('changeModelBtn');
        if (changeModelBtn) {
            changeModelBtn.addEventListener('click', this.showModelSelector.bind(this));
        }
        
        // 패널 토글 버튼들
        this.setupPanelToggles();
        
        // 애니메이션 컨트롤
        this.setupAnimationControls();
        
        // 카메라 컨트롤
        this.setupCameraControls();
        
        // 설정 컨트롤
        this.setupSettingsControls();
        
        // 서비스 이벤트 리스너
        this.setupServiceEventListeners();
        
        console.log('[UIController] ✓ 이벤트 리스너 설정 완료');
    }
    
    /**
     * 패널 토글 설정
     */
    setupPanelToggles() {
        const panels = ['left', 'right', 'bottom'];
        
        panels.forEach(panel => {
            const toggleBtn = this.elements.get(`${panel}PanelToggle`);
            const panelElement = this.elements.get(`${panel}Panel`);
            
            if (toggleBtn && panelElement) {
                toggleBtn.addEventListener('click', () => {
                    this.togglePanel(panel);
                });
            }
        });
    }
    
    /**
     * 애니메이션 컨트롤 설정
     */
    setupAnimationControls() {
        // 재생/일시정지/정지 버튼
        const controls = ['play', 'pause', 'stop'];
        
        controls.forEach(action => {
            const btn = this.elements.get(`${action}Button`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.handleAnimationControl(action);
                });
            }
        });
        
        // 타임라인 슬라이더
        const timelineSlider = this.elements.get('timelineSlider');
        if (timelineSlider) {
            timelineSlider.addEventListener('input', (event) => {
                this.handleTimelineChange(parseFloat(event.target.value));
            });
        }
        
        // 속도 컨트롤
        const speedControl = this.elements.get('speedControl');
        if (speedControl) {
            speedControl.addEventListener('input', (event) => {
                this.handleSpeedChange(parseFloat(event.target.value));
            });
        }
    }
    
    /**
     * 카메라 컨트롤 설정
     */
    setupCameraControls() {
        // 카메라 리셋 버튼
        const resetBtn = this.elements.get('resetCameraBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetCamera();
            });
        }
        
        // 카메라 프리셋 버튼들
        const presetsContainer = this.elements.get('cameraPresets');
        if (presetsContainer) {
            presetsContainer.addEventListener('click', (event) => {
                if (event.target.dataset.preset) {
                    this.applyCameraPreset(event.target.dataset.preset);
                }
            });
        }
        
        // FOV 컨트롤
        const fovControl = this.elements.get('cameraFov');
        if (fovControl) {
            fovControl.addEventListener('input', (event) => {
                this.handleFovChange(parseFloat(event.target.value));
            });
        }
    }
    
    /**
     * 설정 컨트롤 설정
     */
    setupSettingsControls() {
        // 테마 토글
        const themeToggle = this.elements.get('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        
        // 언어 선택
        const languageSelector = this.elements.get('languageSelector');
        if (languageSelector) {
            languageSelector.addEventListener('change', (event) => {
                this.changeLanguage(event.target.value);
            });
        }
        
        // 품질 설정
        const qualitySelector = this.elements.get('qualitySelector');
        if (qualitySelector) {
            qualitySelector.addEventListener('change', (event) => {
                this.changeQuality(event.target.value);
            });
        }
    }
    
    /**
     * 서비스 이벤트 리스너 설정
     */
    setupServiceEventListeners() {
        // SceneManager 이벤트
        if (this.sceneManager) {
            this.sceneManager.on('model:added', (gltf, modelInfo) => {
                this.handleModelLoaded(modelInfo);
            });
            
            this.sceneManager.on('stats:updated', (stats) => {
                this.updateModelStats(stats);
            });
        }
        
        // ModelLoader 이벤트
        if (this.modelLoader) {
            this.modelLoader.on('loading:start', () => {
                this.showLoading();
            });
            
            this.modelLoader.on('loading:progress', (progress) => {
                this.updateLoadingProgress(progress);
            });
            
            this.modelLoader.on('loading:complete', () => {
                this.hideLoading();
            });
            
            this.modelLoader.on('loading:error', (error) => {
                this.showError(error.message);
            });
        }
        
        // AnimationController 이벤트
        if (this.animationController) {
            this.animationController.on('play', () => {
                this.updateAnimationUI('playing');
            });
            
            this.animationController.on('pause', () => {
                this.updateAnimationUI('paused');
            });
            
            this.animationController.on('stop', () => {
                this.updateAnimationUI('stopped');
            });
            
            this.animationController.on('frame:changed', (frame) => {
                this.updateTimelineUI(frame);
            });
        }
        
        // HotspotManager 이벤트
        if (this.hotspotManager) {
            this.hotspotManager.on('hotspot:click', (hotspot) => {
                this.handleHotspotClick(hotspot);
            });
            
            this.hotspotManager.on('hotspot:hover', (hotspot) => {
                this.handleHotspotHover(hotspot);
            });
        }
    }
    
    /**
     * 초기 UI 상태 설정
     */
    initializeUIState() {
        // 로딩 화면 숨김
        this.hideLoading();
        
        // 모델 선택 화면 표시 여부 결정
        const urlParams = new URLSearchParams(window.location.search);
        const autoLoad = urlParams.get('model') !== null;
        
        if (autoLoad) {
            this.hideModelSelector();
        } else {
            this.showModelSelector();
        }
        
        // UI 테마 적용
        const theme = getConfig('ui.theme', 'dark');
        this.applyTheme(theme);
        
        // 언어 설정
        const language = getConfig('ui.language', 'ko');
        this.applyLanguage(language);
        
        // 패널 초기 상태
        const panelsConfig = getConfig('ui.panels', {});
        Object.entries(panelsConfig).forEach(([panel, visible]) => {
            this.setPanelVisibility(panel, visible);
        });
    }
    
    /**
     * 모델 선택기 설정
     */
    setupModelSelector() {
        const modelList = this.elements.get('modelList');
        if (!modelList) return;
        
        const models = getConfig('models.defaultModels', []);
        
        // 기존 내용 제거
        modelList.innerHTML = '';
        
        // 모델 카드 생성
        models.forEach((model, index) => {
            const card = this.createModelCard(model, index);
            modelList.appendChild(card);
        });
        
        console.log(`[UIController] ✓ 모델 선택기 구성: ${models.length}개 모델`);
    }
    
    /**
     * 모델 카드 생성
     */
    createModelCard(model, index) {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.dataset.modelIndex = index;
        
        // 카드 내용
        card.innerHTML = `
            <div class="model-card-icon">${model.icon || '🏗️'}</div>
            <h3 class="model-card-title">${model.name}</h3>
            <p class="model-card-description">${model.description || ''}</p>
            <div class="model-card-actions">
                <button class="load-model-btn" data-model-index="${index}">
                    ${this.getLocalizedText('loadModel', '모델 보기')}
                </button>
            </div>
        `;
        
        // 카드 스타일 적용
        this.applyModelCardStyles(card);
        
        // 이벤트 리스너
        card.addEventListener('click', () => {
            this.selectModel(model, index);
        });
        
        return card;
    }
    
    /**
     * 모델 카드 스타일 적용
     */
    applyModelCardStyles(card) {
        const styles = {
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            minWidth: '250px',
            maxWidth: '300px'
        };
        
        Object.assign(card.style, styles);
        
        // 호버 효과
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.background = 'rgba(255, 255, 255, 0.15)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.background = 'rgba(255, 255, 255, 0.1)';
        });
    }
    
    /**
     * 모델 선택 처리
     */
    async selectModel(model, index) {
        try {
            this.state.currentModel = index;
            
            // 로딩 시작
            this.showLoading();
            this.hideModelSelector();
            
            // 모델 로드 요청
            this.emit('model:select', model, index);
            
            // 앱이 있으면 앱을 통해 로드
            if (this.app && typeof this.app.loadModel === 'function') {
                await this.app.loadModel(index);
            }
            
        } catch (error) {
            console.error('[UIController] 모델 선택 실패:', error);
            this.showError(`모델 로드 실패: ${error.message}`);
            this.showModelSelector();
        }
    }
    
    /**
     * 성능 모니터링 시작
     */
    startPerformanceMonitoring() {
        const updateInterval = getConfig('ui.fpsUpdateInterval', 1000);
        
        const updateFPS = () => {
            this.frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - this.lastTime >= updateInterval) {
                this.fps = Math.round(this.frameCount * 1000 / (currentTime - this.lastTime));
                this.frameCount = 0;
                this.lastTime = currentTime;
                
                // FPS 표시 업데이트
                this.updateFPSDisplay();
                
                // 성능 이벤트 발생
                this.emit('performance:update', { fps: this.fps });
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);
    }
    
    /**
     * 반응형 UI 설정
     */
    setupResponsiveUI() {
        const updateLayout = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const isMobile = width <= 768;
            const isTablet = width <= 1024 && width > 768;
            
            // 반응형 클래스 적용
            document.body.classList.toggle('mobile', isMobile);
            document.body.classList.toggle('tablet', isTablet);
            document.body.classList.toggle('desktop', !isMobile && !isTablet);
            
            // 모바일에서는 일부 패널 자동 숨김
            if (isMobile) {
                this.setPanelVisibility('left', false);
                this.setPanelVisibility('right', false);
            }
            
            this.emit('layout:change', { width, height, isMobile, isTablet });
        };
        
        // 초기 실행 및 리사이즈 시 실행
        updateLayout();
        window.addEventListener('resize', updateLayout);
    }
    
    /**
     * 모델 로드 완료 처리
     */
    handleModelLoaded(modelInfo) {
        this.hideLoading();
        this.state.currentModel = modelInfo;
        
        // UI 업데이트
        this.updateModelInfo(modelInfo);
        this.showViewerUI();
        
        // 성공 알림
        this.showNotification(`${modelInfo.name} 로드 완료`, 'success');
        
        this.emit('model:loaded', modelInfo);
    }
    
    /**
     * 모델 정보 업데이트
     */
    updateModelInfo(modelInfo) {
        // 모델명 표시
        const modelNameElement = this.elements.get('modelName');
        if (modelNameElement) {
            modelNameElement.textContent = modelInfo.name;
        }
        
        // 로드 시간 표시
        const loadTimeElement = this.elements.get('loadTime');
        if (loadTimeElement && modelInfo.loadTime) {
            loadTimeElement.textContent = `${modelInfo.loadTime}s`;
        }
    }
    
    /**
     * 모델 통계 업데이트
     */
    updateModelStats(stats) {
        const statsMap = {
            'meshCount': stats.meshes,
            'vertexCount': stats.vertices,
            'triangleCount': stats.triangles
        };
        
        Object.entries(statsMap).forEach(([key, value]) => {
            const element = this.elements.get(key);
            if (element) {
                element.textContent = this.formatNumber(value);
            }
        });
        
        // 핫스팟 수 업데이트
        const hotspotCountElement = this.elements.get('hotspotCount');
        if (hotspotCountElement && this.hotspotManager) {
            const hotspotCount = this.hotspotManager.getHotspotCount?.() || 0;
            hotspotCountElement.textContent = hotspotCount;
        }
    }
    
    /**
     * FPS 표시 업데이트
     */
    updateFPSDisplay() {
        const fpsElement = this.elements.get('fpsDisplay');
        if (fpsElement) {
            fpsElement.textContent = `${this.fps} FPS`;
            
            // FPS에 따른 색상 변경
            if (this.fps >= 50) {
                fpsElement.style.color = '#4CAF50'; // 녹색
            } else if (this.fps >= 30) {
                fpsElement.style.color = '#FF9800'; // 주황색
            } else {
                fpsElement.style.color = '#F44336'; // 빨간색
            }
        }
    }
    
    /**
     * 로딩 화면 표시
     */
    showLoading() {
        this.state.loading = true;
        
        const loadingElement = this.elements.get('loadingScreen');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
        
        this.emit('loading:show');
    }
    
    /**
     * 로딩 진행률 업데이트
     */
    updateLoadingProgress(progress) {
        const progressBar = this.elements.get('progressBar');
        const progressText = this.elements.get('progressText');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
        
        this.emit('loading:progress', progress);
    }
    
    /**
     * 로딩 화면 숨김
     */
    hideLoading() {
        this.state.loading = false;
        
        const loadingElement = this.elements.get('loadingScreen');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        this.emit('loading:hide');
    }
    
    /**
     * 모델 선택기 표시
     */
    showModelSelector() {
        const selectorElement = this.elements.get('modelSelector');
        if (selectorElement) {
            selectorElement.style.display = 'flex';
        }
        
        this.hideViewerUI();
        this.emit('selector:show');
    }
    
    /**
     * 모델 선택기 숨김
     */
    hideModelSelector() {
        const selectorElement = this.elements.get('modelSelector');
        if (selectorElement) {
            selectorElement.style.display = 'none';
        }
        
        this.emit('selector:hide');
    }
    
    /**
     * 뷰어 UI 표시
     */
    showViewerUI() {
        const viewerContainer = this.elements.get('viewerContainer');
        if (viewerContainer) {
            viewerContainer.style.display = 'block';
        }
        
        // 패널들 표시
        this.showPanels();
        
        this.emit('viewer:show');
    }
    
    /**
     * 뷰어 UI 숨김
     */
    hideViewerUI() {
        const viewerContainer = this.elements.get('viewerContainer');
        if (viewerContainer) {
            viewerContainer.style.display = 'none';
        }
        
        this.emit('viewer:hide');
    }
    
    /**
     * 패널 표시
     */
    showPanels() {
        const panels = ['left', 'right', 'bottom'];
        panels.forEach(panel => {
            if (this.state.panelsVisible[panel]) {
                this.setPanelVisibility(panel, true);
            }
        });
    }
    
    /**
     * 패널 가시성 설정
     */
    setPanelVisibility(panel, visible) {
        const panelElement = this.elements.get(`${panel}Panel`);
        const toggleBtn = this.elements.get(`${panel}PanelToggle`);
        
        if (panelElement) {
            panelElement.style.display = visible ? 'block' : 'none';
        }
        
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', visible);
        }
        
        this.state.panelsVisible[panel] = visible;
        this.emit('panel:toggle', panel, visible);
    }
    
    /**
     * 패널 토글
     */
    togglePanel(panel) {
        const currentVisibility = this.state.panelsVisible[panel];
        this.setPanelVisibility(panel, !currentVisibility);
    }
    
    /**
     * 애니메이션 컨트롤 처리
     */
    handleAnimationControl(action) {
        if (!this.animationController) return;
        
        switch (action) {
            case 'play':
                this.animationController.play();
                break;
            case 'pause':
                this.animationController.pause();
                break;
            case 'stop':
                this.animationController.stop();
                break;
        }
        
        this.emit('animation:control', action);
    }
    
    /**
     * 타임라인 변경 처리
     */
    handleTimelineChange(frame) {
        if (this.animationController) {
            this.animationController.setFrame(frame);
        }
        
        this.emit('timeline:change', frame);
    }
    
    /**
     * 속도 변경 처리
     */
    handleSpeedChange(speed) {
        if (this.animationController) {
            this.animationController.setSpeed(speed);
        }
        
        // 설정에도 저장
        setConfig('animation.defaultSpeed', speed);
        
        this.emit('speed:change', speed);
    }
    
    /**
     * 애니메이션 UI 업데이트
     */
    updateAnimationUI(state) {
        const buttons = {
            play: this.elements.get('playButton'),
            pause: this.elements.get('pauseButton'),
            stop: this.elements.get('stopButton')
        };
        
        // 모든 버튼 비활성화
        Object.values(buttons).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        
        // 현재 상태 버튼 활성화
        if (buttons[state]) {
            buttons[state].classList.add('active');
        }
    }
    
    /**
     * 타임라인 UI 업데이트
     */
    updateTimelineUI(frame) {
        const timelineSlider = this.elements.get('timelineSlider');
        if (timelineSlider) {
            timelineSlider.value = frame;
        }
    }
    
    /**
     * 카메라 리셋
     */
    resetCamera() {
        if (this.sceneManager) {
            const cameraConfig = getConfig('scene.camera');
            const pos = cameraConfig.position;
            const target = cameraConfig.target;
            
            this.sceneManager.animateCameraTo(
                new THREE.Vector3(pos.x, pos.y, pos.z),
                new THREE.Vector3(target.x, target.y, target.z)
            );
        }
        
        this.emit('camera:reset');
    }
    
    /**
     * 카메라 프리셋 적용
     */
    applyCameraPreset(preset) {
        // 프리셋 정의
        const presets = {
            front: { position: [0, 0, 20], target: [0, 0, 0] },
            back: { position: [0, 0, -20], target: [0, 0, 0] },
            left: { position: [-20, 0, 0], target: [0, 0, 0] },
            right: { position: [20, 0, 0], target: [0, 0, 0] },
            top: { position: [0, 20, 0], target: [0, 0, 0] },
            bottom: { position: [0, -20, 0], target: [0, 0, 0] },
            isometric: { position: [15, 15, 15], target: [0, 0, 0] }
        };
        
        const presetData = presets[preset];
        if (presetData && this.sceneManager) {
            this.sceneManager.animateCameraTo(
                new THREE.Vector3(...presetData.position),
                new THREE.Vector3(...presetData.target)
            );
        }
        
        this.emit('camera:preset', preset);
    }
    
    /**
     * FOV 변경 처리
     */
    handleFovChange(fov) {
        setConfig('scene.camera.fov', fov);
        
        if (this.sceneManager && this.sceneManager.camera) {
            this.sceneManager.camera.fov = fov;
            this.sceneManager.camera.updateProjectionMatrix();
        }
        
        this.emit('camera:fov', fov);
    }
    
    /**
     * 테마 토글
     */
    toggleTheme() {
        const currentTheme = getConfig('ui.theme', 'dark');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        setConfig('ui.theme', newTheme);
        this.applyTheme(newTheme);
        
        this.emit('theme:change', newTheme);
    }
    
    /**
     * 테마 적용
     */
    applyTheme(theme) {
        document.body.classList.remove('theme-dark', 'theme-light');
        document.body.classList.add(`theme-${theme}`);
        
        // CSS 변수 업데이트 (선택적)
        if (theme === 'light') {
            document.documentElement.style.setProperty('--bg-primary', '#ffffff');
            document.documentElement.style.setProperty('--text-primary', '#000000');
        } else {
            document.documentElement.style.setProperty('--bg-primary', '#1a1a1a');
            document.documentElement.style.setProperty('--text-primary', '#ffffff');
        }
    }
    
    /**
     * 언어 변경
     */
    changeLanguage(language) {
        setConfig('ui.language', language);
        this.applyLanguage(language);
        
        this.emit('language:change', language);
    }
    
    /**
     * 언어 적용
     */
    applyLanguage(language) {
        document.documentElement.lang = language;
        
        // 텍스트 업데이트 (간단한 구현)
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.dataset.i18n;
            const text = this.getLocalizedText(key, element.textContent);
            element.textContent = text;
        });
    }
    
    /**
     * 품질 변경
     */
    changeQuality(quality) {
        const qualitySettings = {
            low: {
                'scene.renderer.pixelRatio': 1,
                'performance.targetFPS': 30,
                'scene.renderer.shadowMapSize': 512
            },
            medium: {
                'scene.renderer.pixelRatio': 1.5,
                'performance.targetFPS': 60,
                'scene.renderer.shadowMapSize': 1024
            },
            high: {
                'scene.renderer.pixelRatio': Math.min(window.devicePixelRatio, 2),
                'performance.targetFPS': 60,
                'scene.renderer.shadowMapSize': 2048
            }
        };
        
        const settings = qualitySettings[quality];
        if (settings) {
            Object.entries(settings).forEach(([key, value]) => {
                setConfig(key, value);
            });
        }
        
        this.emit('quality:change', quality);
    }
    
    /**
     * 핫스팟 클릭 처리
     */
    handleHotspotClick(hotspot) {
        this.state.selectedHotspot = hotspot;
        this.showHotspotDetails(hotspot);
        
        this.emit('hotspot:select', hotspot);
    }
    
    /**
     * 핫스팟 호버 처리
     */
    handleHotspotHover(hotspot) {
        // 툴팁 표시 등
        this.emit('hotspot:hover', hotspot);
    }
    
    /**
     * 핫스팟 상세정보 표시
     */
    showHotspotDetails(hotspot) {
        // 우측 패널에 상세정보 표시
        const rightPanel = this.elements.get('rightPanel');
        if (rightPanel) {
            rightPanel.innerHTML = `
                <div class="hotspot-details">
                    <h3>${hotspot.name}</h3>
                    <div class="hotspot-info">
                        ${this.generateHotspotInfo(hotspot)}
                    </div>
                </div>
            `;
        }
        
        // 우측 패널 표시
        this.setPanelVisibility('right', true);
    }
    
    /**
     * 핫스팟 정보 생성
     */
    generateHotspotInfo(hotspot) {
        if (!hotspot.userData) return '';
        
        return Object.entries(hotspot.userData)
            .filter(([key]) => !['icon', 'title'].includes(key))
            .map(([key, value]) => `
                <div class="info-row">
                    <span class="info-label">${this.formatLabel(key)}:</span>
                    <span class="info-value">${value}</span>
                </div>
            `).join('');
    }
    
    /**
     * 에러 표시
     */
    showError(message) {
        this.showNotification(message, 'error');
        this.emit('error:show', message);
    }
    
    /**
     * 알림 표시
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // 스타일 적용
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '6px',
            color: '#fff',
            zIndex: '10000',
            maxWidth: '400px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            background: this.getNotificationColor(type)
        });
        
        document.body.appendChild(notification);
        
        // 자동 제거
        const duration = getConfig('ui.notificationDuration', 3000);
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
        
        this.emit('notification:show', message, type);
    }
    
    /**
     * 알림 색상 가져오기
     */
    getNotificationColor(type) {
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',
            error: '#F44336'
        };
        
        return colors[type] || colors.info;
    }
    
    /**
     * 이벤트 핸들러들
     */
    handleResize() {
        // 반응형 UI 업데이트는 setupResponsiveUI에서 처리
        this.emit('resize');
    }
    
    handleOrientationChange() {
        // 방향 변경 시 UI 재조정
        setTimeout(() => {
            this.handleResize();
        }, 100);
    }
    
    handleKeyDown(event) {
        // 키보드 단축키 처리
        if (event.ctrlKey || event.metaKey) {
            switch (event.code) {
                case 'KeyM':
                    event.preventDefault();
                    this.showModelSelector();
                    break;
                    
                case 'KeyF':
                    event.preventDefault();
                    this.toggleFullscreen();
                    break;
                    
                case 'Space':
                    event.preventDefault();
                    this.handleAnimationControl('play');
                    break;
            }
        }
    }
    
    /**
     * 전체화면 토글
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
        
        this.emit('fullscreen:toggle');
    }
    
    /**
     * 유틸리티 메서드들
     */
    formatNumber(num) {
        return num?.toLocaleString() || '0';
    }
    
    formatLabel(str) {
        return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    }
    
    getLocalizedText(key, fallback) {
        // 간단한 다국어 지원 (확장 가능)
        const language = getConfig('ui.language', 'ko');
        const texts = {
            ko: {
                loadModel: '모델 보기',
                loading: '로딩 중...',
                error: '오류',
                // 더 많은 텍스트...
            },
            en: {
                loadModel: 'View Model',
                loading: 'Loading...',
                error: 'Error',
                // 더 많은 텍스트...
            }
        };
        
        return texts[language]?.[key] || fallback || key;
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
                    console.error(`[UIController] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
    }
    
    /**
     * 정리
     */
    destroy() {
        console.log('[UIController] 정리 중...');
        
        // 이벤트 리스너 제거
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleOrientationChange);
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // DOM 요소 캐시 정리
        this.elements.clear();
        
        // 이벤트 정리
        this.events.clear();
        
        this.emit('destroyed');
        console.log('[UIController] 정리 완료');
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[UIController] 디버그 정보');
        console.log('상태:', this.state);
        console.log('캐시된 요소 수:', this.elements.size);
        console.log('FPS:', this.fps);
        console.log('등록된 이벤트:', Array.from(this.events.keys()));
        console.log('현재 테마:', getConfig('ui.theme'));
        console.log('현재 언어:', getConfig('ui.language'));
        console.groupEnd();
    }
}

export default UIController;