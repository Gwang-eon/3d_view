// UIController.js - UI 제어 시스템 완전한 버전

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * UI 제어 시스템
 * - 모든 UI 컴포넌트 관리
 * - 사용자 입력 처리
 * - 상태 기반 UI 업데이트
 * - 반응형 레이아웃
 * - 접근성 지원
 * - 다국어 지원
 * - 테마 시스템
 */
export class UIController {
    constructor(sceneManager, modelLoader, animationController, hotspotManager) {
        // 서비스 의존성
        this.sceneManager = sceneManager;
        this.modelLoader = modelLoader;
        this.animationController = animationController;
        this.hotspotManager = hotspotManager;
        
        // UI 상태
        this.state = {
            isLoading: false,
            selectedModel: null,
            currentView: 'viewer',
            modalOpen: null,
            sidebarCollapsed: false,
            fullscreen: false,
            settingsOpen: false,
            infoOpen: false
        };
        
        // DOM 요소 캐시
        this.elements = new Map();
        
        // UI 컴포넌트
        this.components = new Map();
        
        // 테마 시스템
        this.theme = {
            current: getConfig('ui.theme', 'light'),
            available: ['light', 'dark', 'auto'],
            customThemes: new Map()
        };
        
        // 다국어 지원
        this.localization = {
            currentLanguage: getConfig('ui.language', 'ko'),
            translations: new Map(),
            fallbackLanguage: 'en'
        };
        
        // 반응형 레이아웃
        this.breakpoints = {
            mobile: 480,
            tablet: 768,
            desktop: 1024,
            wide: 1440
        };
        
        // 접근성
        this.accessibility = {
            keyboardNavigation: false,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            highContrast: window.matchMedia('(prefers-contrast: high)').matches,
            announcements: []
        };
        
        // 성능 모니터링
        this.performance = {
            lastUpdate: 0,
            updateInterval: 16, // 60fps
            frameSkips: 0
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // UI 업데이트 인터벌
        this.uiUpdateId = null;
        
        // 바인드된 메서드들
        this.handleResize = this.handleResize.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.updateUI = this.updateUI.bind(this);
        
        console.log('[UIController] 생성됨');
    }
    
    /**
     * 초기화
     */
    async init() {
        console.log('[UIController] 초기화 시작');
        
        try {
            // 접근성 설정
            this.setupAccessibility();
            
            // DOM 요소 캐싱
            await this.cacheDOMElements();
            
            // 컴포넌트 시스템 초기화
            this.initializeComponents();
            
            // 테마 시스템 초기화
            this.initializeTheme();
            
            // 다국어 시스템 초기화
            await this.initializeLocalization();
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 반응형 UI 설정
            this.setupResponsiveUI();
            
            // 초기 UI 상태 설정
            this.initializeUIState();
            
            // 성능 모니터링 시작
            this.startPerformanceMonitoring();
            
            // UI 업데이트 루프 시작
            this.startUIUpdateLoop();
            
            this.emit('initialized');
            console.log('[UIController] 초기화 완료');
            
        } catch (error) {
            console.error('[UIController] 초기화 실패:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * DOM 요소 캐싱
     */
    async cacheDOMElements() {
        const elementIds = [
            'loading', 'loading-progress', 'loading-message',
            'error', 'error-message',
            'viewer-container', 'ui-container',
            'model-selector', 'model-list',
            'toolbar', 'sidebar', 'info-panel',
            'animation-controls', 'play-pause-btn', 'animation-slider',
            'camera-controls', 'camera-menu',
            'settings-panel', 'settings-btn',
            'fullscreen-btn', 'home-btn',
            'stats-panel', 'fps-counter'
        ];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
        });
        
        console.log(`[UIController] ${this.elements.size}개 DOM 요소 캐시됨`);
    }
    
    /**
     * 컴포넌트 초기화
     */
    initializeComponents() {
        // 여기서는 간단한 구조만 설정
        // 실제 컴포넌트는 필요에 따라 동적으로 생성
        
        this.components.set('modelSelector', {
            isOpen: false,
            selectedIndex: null
        });
        
        this.components.set('animationControls', {
            isPlaying: false,
            progress: 0
        });
        
        this.components.set('cameraMenu', {
            isOpen: false,
            currentCamera: 'default'
        });
    }
    
    /**
     * 테마 초기화
     */
    initializeTheme() {
        const savedTheme = localStorage.getItem('viewer-theme') || this.theme.current;
        this.setTheme(savedTheme);
        
        // 시스템 테마 변경 감지
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (this.theme.current === 'auto') {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    }
    
    /**
     * 다국어 초기화
     */
    async initializeLocalization() {
        // 간단한 번역 데이터
        this.localization.translations.set('ko', {
            loading: '로딩 중...',
            error: '오류',
            selectModel: '모델 선택',
            play: '재생',
            pause: '일시정지',
            settings: '설정',
            fullscreen: '전체화면',
            exitFullscreen: '전체화면 종료',
            home: '홈으로'
        });
        
        this.localization.translations.set('en', {
            loading: 'Loading...',
            error: 'Error',
            selectModel: 'Select Model',
            play: 'Play',
            pause: 'Pause',
            settings: 'Settings',
            fullscreen: 'Fullscreen',
            exitFullscreen: 'Exit Fullscreen',
            home: 'Home'
        });
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 윈도우 이벤트
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('orientationchange', this.handleResize);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // 키보드 이벤트
        document.addEventListener('keydown', this.handleKeyDown);
        
        // 서비스 이벤트 구독
        this.subscribeToServiceEvents();
        
        // 컴포넌트 이벤트 구독
        this.subscribeToComponentEvents();
        
        console.log('[UIController] ✓ 이벤트 리스너 설정됨');
    }
    
    /**
     * 서비스 이벤트 구독
     */
    subscribeToServiceEvents() {
        // ModelLoader 이벤트
        if (this.modelLoader) {
            this.modelLoader.on('loading:start', (data) => {
                this.showLoadingScreen(data.message);
            });
            
            this.modelLoader.on('loading:progress', (data) => {
                this.updateLoadingProgress(data.progress, data.message);
            });
            
            this.modelLoader.on('loading:complete', (data) => {
                this.hideLoadingScreen();
                this.switchToViewerUI(data.modelInfo);
            });
            
            this.modelLoader.on('loading:error', (error) => {
                this.hideLoadingScreen();
                this.showErrorModal(error.message);
            });
        }
        
        // SceneManager 이벤트
        if (this.sceneManager) {
            this.sceneManager.on('model:changed', (data) => {
                this.updateModelInfo(data.model, data.modelInfo);
            });
            
            this.sceneManager.on('stats:updated', (stats) => {
                this.updateStats(stats);
            });
            
            this.sceneManager.on('camera:change', (data) => {
                this.updateCameraInfo(data);
            });
        }
        
        // AnimationController 이벤트
        if (this.animationController) {
            this.animationController.on('animation:start', () => {
                this.updateAnimationControls('playing');
            });
            
            this.animationController.on('animation:pause', () => {
                this.updateAnimationControls('paused');
            });
            
            this.animationController.on('animation:stop', () => {
                this.updateAnimationControls('stopped');
            });
            
            this.animationController.on('animation:progress', (progress) => {
                this.updateAnimationProgress(progress);
            });
        }
    }
    
    /**
     * 컴포넌트 이벤트 구독
     */
    subscribeToComponentEvents() {
        // 예제: 버튼 클릭 이벤트들
        const playBtn = this.elements.get('play-pause-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                this.toggleAnimation();
            });
        }
        
        const animationSlider = this.elements.get('animation-slider');
        if (animationSlider) {
            animationSlider.addEventListener('input', (e) => {
                this.seekAnimation(parseFloat(e.target.value));
            });
        }
    }
    
    /**
     * 접근성 설정
     */
    setupAccessibility() {
        // 키보드 네비게이션 감지
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                this.accessibility.keyboardNavigation = true;
                document.body.classList.add('keyboard-navigation');
            }
        });
        
        // 마우스 사용 감지
        document.addEventListener('mousedown', () => {
            this.accessibility.keyboardNavigation = false;
            document.body.classList.remove('keyboard-navigation');
        });
        
        // 고대비 모드
        if (this.accessibility.highContrast) {
            document.body.classList.add('high-contrast');
        }
        
        // 애니메이션 감소 모드
        if (this.accessibility.reducedMotion) {
            document.body.classList.add('reduced-motion');
        }
    }
    
    /**
     * 반응형 UI 설정
     */
    setupResponsiveUI() {
        this.updateResponsiveClasses();
        
        // 미디어 쿼리 리스너
        Object.entries(this.breakpoints).forEach(([name, width]) => {
            const mediaQuery = window.matchMedia(`(max-width: ${width}px)`);
            mediaQuery.addEventListener('change', () => {
                this.updateResponsiveClasses();
            });
        });
    }
    
    /**
     * 초기 UI 상태 설정
     */
    initializeUIState() {
        // 로딩 화면 숨기기
        this.hideLoadingScreen();
        
        // 초기 뷰 설정
        this.switchView('selector');
        
        // 툴바 초기화
        this.updateToolbar();
    }
    
    /**
     * 성능 모니터링 시작
     */
    startPerformanceMonitoring() {
        if (!getConfig('ui.enablePerformanceMonitoring', true)) return;
        
        // FPS 모니터링은 SceneManager에서 처리
        if (this.sceneManager) {
            this.sceneManager.on('stats:fps', (fps) => {
                this.updateFPSCounter(fps);
            });
        }
    }
    
    /**
     * UI 업데이트 루프
     */
    startUIUpdateLoop() {
        const updateInterval = getConfig('ui.updateInterval', 100);
        
        this.uiUpdateId = setInterval(() => {
            this.updateUI();
        }, updateInterval);
    }
    
    /**
     * UI 업데이트
     */
    updateUI() {
        const now = performance.now();
        
        // 프레임 스킵 체크
        if (now - this.performance.lastUpdate < this.performance.updateInterval) {
            return;
        }
        
        // 애니메이션 진행률 업데이트
        if (this.state.isPlaying && this.animationController) {
            const progress = this.animationController.getProgress();
            this.updateAnimationProgress(progress);
        }
        
        // 통계 업데이트
        if (this.sceneManager) {
            const stats = this.sceneManager.getStats();
            this.updateStats(stats);
        }
        
        this.performance.lastUpdate = now;
    }
    
    // === UI 조작 메서드들 ===
    
    /**
     * 로딩 화면 표시
     */
    showLoadingScreen(message = '로딩 중...') {
        this.state.isLoading = true;
        
        const loadingEl = this.elements.get('loading');
        const messageEl = this.elements.get('loading-message');
        
        if (loadingEl) {
            loadingEl.style.display = 'flex';
            if (messageEl) {
                messageEl.textContent = this.translate(message);
            }
        }
        
        this.emit('loading:show');
    }
    
    /**
     * 로딩 진행률 업데이트
     */
    updateLoadingProgress(progress, message) {
        const progressEl = this.elements.get('loading-progress');
        const messageEl = this.elements.get('loading-message');
        
        if (progressEl) {
            progressEl.style.width = `${progress}%`;
            progressEl.setAttribute('aria-valuenow', progress);
        }
        
        if (messageEl && message) {
            messageEl.textContent = this.translate(message);
        }
        
        this.emit('loading:progress', { progress, message });
    }
    
    /**
     * 로딩 화면 숨기기
     */
    hideLoadingScreen() {
        this.state.isLoading = false;
        
        const loadingEl = this.elements.get('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
        
        this.emit('loading:hide');
    }
    
    /**
     * 에러 모달 표시
     */
    showErrorModal(message) {
        const errorEl = this.elements.get('error');
        const messageEl = this.elements.get('error-message');
        
        if (errorEl) {
            errorEl.style.display = 'block';
            if (messageEl) {
                messageEl.textContent = this.translate(message);
            }
            
            // 5초 후 자동 숨김
            setTimeout(() => {
                this.hideErrorModal();
            }, 5000);
        }
        
        this.emit('error:show', { message });
    }
    
    /**
     * 에러 모달 숨기기
     */
    hideErrorModal() {
        const errorEl = this.elements.get('error');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
        
        this.emit('error:hide');
    }
    
    /**
     * 뷰어 UI로 전환
     */
    switchToViewerUI(modelInfo) {
        this.state.currentView = 'viewer';
        this.state.selectedModel = modelInfo;
        
        // 모델 선택기 숨기기
        this.hideModelSelector();
        
        // 뷰어 UI 표시
        this.showViewerControls();
        
        // 모델 정보 업데이트
        this.updateModelInfo(null, modelInfo);
        
        this.emit('view:changed', { view: 'viewer', modelInfo });
    }
    
    /**
     * 모델 선택기 표시
     */
    showModelSelector() {
        const selectorEl = this.elements.get('model-selector');
        if (selectorEl) {
            selectorEl.style.display = 'block';
            this.renderModelList();
        }
        
        this.state.currentView = 'selector';
        this.components.get('modelSelector').isOpen = true;
    }
    
    /**
     * 모델 선택기 숨기기
     */
    hideModelSelector() {
        const selectorEl = this.elements.get('model-selector');
        if (selectorEl) {
            selectorEl.style.display = 'none';
        }
        
        this.components.get('modelSelector').isOpen = false;
    }
    
    /**
     * 모델 선택기 토글
     */
    toggleModelSelector() {
        if (this.components.get('modelSelector').isOpen) {
            this.hideModelSelector();
        } else {
            this.showModelSelector();
        }
    }
    
    /**
     * 모델 목록 렌더링
     */
    renderModelList() {
        const listEl = this.elements.get('model-list');
        if (!listEl || !this.modelLoader) return;
        
        const models = this.modelLoader.getModelList();
        
        listEl.innerHTML = models.map(model => `
            <div class="model-item ${model.isCached ? 'cached' : ''}" data-index="${model.index}">
                <h3>${model.name}</h3>
                ${model.isDefault ? '<span class="badge">기본</span>' : ''}
                ${model.isCached ? '<span class="badge cached">캐시됨</span>' : ''}
            </div>
        `).join('');
        
        // 클릭 이벤트 추가
        listEl.querySelectorAll('.model-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.selectModel(index);
            });
        });
    }
    
    /**
     * 모델 선택
     */
    async selectModel(index) {
        try {
            this.showLoadingScreen(`모델 로딩 중...`);
            await this.modelLoader.loadModel(index);
            this.components.get('modelSelector').selectedIndex = index;
        } catch (error) {
            console.error('[UIController] 모델 선택 실패:', error);
            this.showErrorModal('모델을 로드할 수 없습니다.');
        }
    }
    
    /**
     * 뷰어 컨트롤 표시
     */
    showViewerControls() {
        const toolbar = this.elements.get('toolbar');
        const sidebar = this.elements.get('sidebar');
        
        if (toolbar) toolbar.style.display = 'flex';
        if (sidebar) sidebar.style.display = 'block';
    }
    
    /**
     * 애니메이션 토글
     */
    toggleAnimation() {
        if (!this.animationController) return;
        
        if (this.components.get('animationControls').isPlaying) {
            this.animationController.pause();
        } else {
            this.animationController.play();
        }
    }
    
    /**
     * 애니메이션 시크
     */
    seekAnimation(progress) {
        if (!this.animationController) return;
        
        this.animationController.setProgress(progress);
    }
    
    /**
     * 애니메이션 컨트롤 업데이트
     */
    updateAnimationControls(state) {
        const playBtn = this.elements.get('play-pause-btn');
        const isPlaying = state === 'playing';
        
        this.components.get('animationControls').isPlaying = isPlaying;
        
        if (playBtn) {
            playBtn.textContent = isPlaying ? '⏸' : '▶';
            playBtn.setAttribute('aria-label', isPlaying ? this.translate('pause') : this.translate('play'));
        }
        
        this.state.isPlaying = isPlaying;
    }
    
    /**
     * 애니메이션 진행률 업데이트
     */
    updateAnimationProgress(progress) {
        const slider = this.elements.get('animation-slider');
        
        if (slider && !slider.matches(':active')) {
            slider.value = progress;
        }
        
        this.components.get('animationControls').progress = progress;
    }
    
    /**
     * 모델 정보 업데이트
     */
    updateModelInfo(model, modelInfo) {
        const infoPanel = this.elements.get('info-panel');
        if (!infoPanel) return;
        
        const info = modelInfo || this.state.selectedModel;
        if (!info) return;
        
        // 간단한 정보 표시
        const html = `
            <h2>${info.name}</h2>
            <dl>
                <dt>파일</dt>
                <dd>${info.fileName}</dd>
                <dt>정점</dt>
                <dd>${info.stats?.vertices?.toLocaleString() || 0}</dd>
                <dt>삼각형</dt>
                <dd>${info.stats?.triangles?.toLocaleString() || 0}</dd>
                <dt>애니메이션</dt>
                <dd>${info.stats?.animations || 0}개</dd>
            </dl>
        `;
        
        infoPanel.innerHTML = html;
    }
    
    /**
     * 통계 업데이트
     */
    updateStats(stats) {
        const statsPanel = this.elements.get('stats-panel');
        if (!statsPanel || !stats) return;
        
        // 간단한 통계 표시
        statsPanel.innerHTML = `
            <div>FPS: ${stats.fps}</div>
            <div>드로우콜: ${stats.drawCalls}</div>
            <div>삼각형: ${stats.triangles?.toLocaleString()}</div>
        `;
    }
    
    /**
     * FPS 카운터 업데이트
     */
    updateFPSCounter(fps) {
        const fpsCounter = this.elements.get('fps-counter');
        if (fpsCounter) {
            fpsCounter.textContent = `${fps} FPS`;
        }
    }
    
    /**
     * 카메라 정보 업데이트
     */
    updateCameraInfo(data) {
        // 필요시 카메라 정보 UI 업데이트
        this.emit('camera:updated', data);
    }
    
    /**
     * 설정 토글
     */
    toggleSettings() {
        this.state.settingsOpen = !this.state.settingsOpen;
        
        const settingsPanel = this.elements.get('settings-panel');
        if (settingsPanel) {
            settingsPanel.style.display = this.state.settingsOpen ? 'block' : 'none';
        }
    }
    
    /**
     * 정보 패널 토글
     */
    toggleInfo() {
        this.state.infoOpen = !this.state.infoOpen;
        
        const infoPanel = this.elements.get('info-panel');
        if (infoPanel) {
            infoPanel.style.display = this.state.infoOpen ? 'block' : 'none';
        }
    }
    
    /**
     * 카메라 메뉴 표시
     */
    showCameraMenu() {
        const menu = this.elements.get('camera-menu');
        if (!menu) return;
        
        const cameras = this.sceneManager.getGLTFCameras();
        
        if (cameras.length === 0) {
            this.showTooltip('사용 가능한 카메라가 없습니다.');
            return;
        }
        
        // 카메라 목록 렌더링
        menu.innerHTML = `
            <button data-camera="default">기본 카메라</button>
            ${cameras.map((cam, i) => `
                <button data-camera="${i}">카메라 ${i + 1}</button>
            `).join('')}
        `;
        
        // 클릭 이벤트
        menu.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const camera = btn.dataset.camera;
                if (camera === 'default') {
                    this.sceneManager.resetCamera();
                } else {
                    this.sceneManager.switchToGLTFCamera(parseInt(camera));
                }
                menu.style.display = 'none';
            });
        });
        
        menu.style.display = 'block';
    }
    
    /**
     * 모든 모달 닫기
     */
    closeAllModals() {
        this.hideErrorModal();
        this.hideModelSelector();
        
        if (this.state.settingsOpen) {
            this.toggleSettings();
        }
        
        const cameraMenu = this.elements.get('camera-menu');
        if (cameraMenu) {
            cameraMenu.style.display = 'none';
        }
    }
    
    /**
     * 툴팁 표시
     */
    showTooltip(message, duration = 3000) {
        // 간단한 툴팁 구현
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = this.translate(message);
        
        document.body.appendChild(tooltip);
        
        setTimeout(() => {
            tooltip.remove();
        }, duration);
    }
    
    // === 테마 시스템 ===
    
    /**
     * 테마 설정
     */
    setTheme(theme) {
        if (!this.theme.available.includes(theme)) {
            console.warn(`[UIController] 지원하지 않는 테마: ${theme}`);
            return;
        }
        
        this.theme.current = theme;
        localStorage.setItem('viewer-theme', theme);
        
        if (theme === 'auto') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.applyTheme(isDark ? 'dark' : 'light');
        } else {
            this.applyTheme(theme);
        }
    }
    
    /**
     * 테마 적용
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.emit('theme:changed', { theme });
    }
    
    // === 다국어 시스템 ===
    
    /**
     * 번역
     */
    translate(key, params = {}) {
        const translations = this.localization.translations.get(this.localization.currentLanguage) ||
                           this.localization.translations.get(this.localization.fallbackLanguage) ||
                           {};
        
        let text = translations[key] || key;
        
        // 파라미터 치환
        Object.entries(params).forEach(([k, v]) => {
            text = text.replace(`{${k}}`, v);
        });
        
        return text;
    }
    
    /**
     * 언어 설정
     */
    setLanguage(language) {
        if (!this.localization.translations.has(language)) {
            console.warn(`[UIController] 지원하지 않는 언어: ${language}`);
            return;
        }
        
        this.localization.currentLanguage = language;
        localStorage.setItem('viewer-language', language);
        
        // UI 텍스트 업데이트
        this.updateUITexts();
        
        this.emit('language:changed', { language });
    }
    
    /**
     * UI 텍스트 업데이트
     */
    updateUITexts() {
        // 모든 번역 가능한 요소 업데이트
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.translate(key);
        });
    }
    
    // === 이벤트 핸들러 ===
    
    /**
     * 리사이즈 핸들러
     */
    handleResize() {
        this.updateResponsiveClasses();
        this.emit('resize', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }
    
    /**
     * 반응형 클래스 업데이트
     */
    updateResponsiveClasses() {
        const width = window.innerWidth;
        const body = document.body;
        
        // 기존 클래스 제거
        body.classList.remove('mobile', 'tablet', 'desktop', 'wide');
        
        // 새 클래스 추가
        if (width <= this.breakpoints.mobile) {
            body.classList.add('mobile');
        } else if (width <= this.breakpoints.tablet) {
            body.classList.add('tablet');
        } else if (width <= this.breakpoints.desktop) {
            body.classList.add('desktop');
        } else {
            body.classList.add('wide');
        }
    }
    
    /**
     * 키보드 핸들러
     */
    handleKeyDown(e) {
        // ESC - 모달 닫기
        if (e.key === 'Escape') {
            this.closeAllModals();
        }
        
        // 기타 단축키는 viewer-main.js에서 처리
    }
    
    /**
     * 가시성 변경 핸들러
     */
    handleVisibilityChange() {
        if (document.hidden) {
            // 페이지가 숨겨짐 - 애니메이션 일시정지
            if (this.state.isPlaying && this.animationController) {
                this.animationController.pause();
                this.state.wasPlaying = true;
            }
        } else {
            // 페이지가 표시됨 - 애니메이션 재개
            if (this.state.wasPlaying && this.animationController) {
                this.animationController.play();
                this.state.wasPlaying = false;
            }
        }
    }
    
    /**
     * 뷰 전환
     */
    switchView(view) {
        this.state.currentView = view;
        
        // 뷰에 따른 UI 조정
        switch(view) {
            case 'selector':
                this.showModelSelector();
                break;
            case 'viewer':
                this.showViewerControls();
                break;
        }
    }
    
    /**
     * 툴바 업데이트
     */
    updateToolbar() {
        const toolbar = this.elements.get('toolbar');
        if (!toolbar) return;
        
        // 현재 상태에 따라 툴바 버튼 활성화/비활성화
        toolbar.querySelectorAll('button').forEach(btn => {
            // 예: 애니메이션이 없으면 애니메이션 버튼 비활성화
            if (btn.id === 'play-pause-btn' && !this.animationController?.hasAnimations()) {
                btn.disabled = true;
            }
        });
    }
    
    // === 이벤트 시스템 ===
    
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
        return this;
    }
    
    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
        return this;
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
        return this;
    }
    
    /**
     * 정리
     */
    dispose() {
        console.log('[UIController] 정리 중...');
        
        // 업데이트 루프 중지
        if (this.uiUpdateId) {
            clearInterval(this.uiUpdateId);
        }
        
        // 이벤트 리스너 제거
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleResize);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // 컴포넌트 정리
        this.components.forEach(component => {
            if (component.dispose) {
                component.dispose();
            }
        });
        this.components.clear();
        
        // DOM 요소 캐시 정리
        this.elements.clear();
        
        // 이벤트 정리
        this.events.clear();
        
        this.emit('disposed');
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
        console.log('컴포넌트 수:', this.components.size);
        console.log('성능:', this.performance);
        console.log('접근성:', this.accessibility);
        console.log('등록된 이벤트:', Array.from(this.events.keys()));
        console.log('뷰포트:', {
            width: window.innerWidth,
            height: window.innerHeight
        });
        console.groupEnd();
    }
}

export default UIController;