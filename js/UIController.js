// js/UIController.js
// ConfigManager 기반 완전 개선 버전 - 모든 하드코딩 제거

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * UI 컨트롤러 클래스
 * - ConfigManager 기반 설정 관리
 * - 컴포넌트 기반 UI 시스템
 * - 이벤트 기반 통신
 * - 반응형 UI 지원
 * - 접근성 개선
 * - 테마 및 다국어 지원
 * - 상태 관리 시스템
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
        this.components = new Map();
        
        // 상태 관리
        this.state = {
            currentView: 'model-selector', // 'model-selector', 'viewer'
            currentModel: null,
            loading: false,
            panelsVisible: {
                left: true,
                right: true,
                bottom: true,
                top: false
            },
            selectedHotspot: null,
            theme: getConfig('ui.theme', 'dark'),
            language: getConfig('ui.language', 'ko'),
            fullscreen: false,
            sidebarCollapsed: false
        };
        
        // 성능 모니터링
        this.performance = {
            fps: 0,
            frameCount: 0,
            lastTime: performance.now(),
            renderTime: 0,
            updateTime: 0
        };
        
        // UI 업데이트 최적화
        this.uiUpdateQueue = new Set();
        this.uiUpdateId = null;
        
        // 반응형 브레이크포인트
        this.breakpoints = getConfig('ui.breakpoints', {
            mobile: 768,
            tablet: 1024,
            desktop: 1200
        });
        
        // 접근성 관리
        this.accessibility = {
            reducedMotion: this.checkReducedMotion(),
            highContrast: this.checkHighContrast(),
            keyboardNavigation: false,
            screenReader: this.checkScreenReader()
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // 바인드된 메서드들
        this.handleResize = this.handleResize.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.updateUI = this.updateUI.bind(this);
        
        // 초기화
        this.init();
        
        console.log('[UIController] 초기화 완료');
    }
    
    /**
     * 초기화
     */
    async init() {
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
            this.initializeLocalization();
            
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
            
        } catch (error) {
            console.error('[UIController] 초기화 실패:', error);
            this.emit('error', error);
            throw error;
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
        
        // 미디어 쿼리 리스너
        const mediaQueries = {
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
            highContrast: window.matchMedia('(prefers-contrast: high)'),
            darkMode: window.matchMedia('(prefers-color-scheme: dark)')
        };
        
        Object.entries(mediaQueries).forEach(([key, mq]) => {
            mq.addEventListener('change', () => {
                this.accessibility[key] = mq.matches;
                this.applyAccessibilitySettings();
            });
        });
    }
    
    /**
     * 접근성 확인 메서드들
     */
    checkReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    
    checkHighContrast() {
        return window.matchMedia('(prefers-contrast: high)').matches;
    }
    
    checkScreenReader() {
        return window.speechSynthesis !== undefined && 
               window.navigator.userAgent.includes('NVDA');
    }
    
    /**
     * 접근성 설정 적용
     */
    applyAccessibilitySettings() {
        const root = document.documentElement;
        
        // 애니메이션 감소
        if (this.accessibility.reducedMotion) {
            root.style.setProperty('--animation-duration', '0ms');
            root.style.setProperty('--transition-duration', '0ms');
        } else {
            root.style.removeProperty('--animation-duration');
            root.style.removeProperty('--transition-duration');
        }
        
        // 고대비 모드
        if (this.accessibility.highContrast) {
            document.body.classList.add('high-contrast');
        } else {
            document.body.classList.remove('high-contrast');
        }
    }
    
    /**
     * DOM 요소 캐싱 (ConfigManager 기반)
     */
    async cacheDOMElements() {
        const selectors = getConfig('selectors');
        const requiredElements = getConfig('ui.requiredElements', []);
        const optionalElements = getConfig('ui.optionalElements', []);
        
        // 필수 요소 캐싱
        for (const key of requiredElements) {
            const selector = selectors[key];
            if (selector) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements.set(key, element);
                } else {
                    console.warn(`[UIController] 필수 요소 누락: ${key} (${selector})`);
                    // 자동 생성 시도
                    await this.createMissingElement(key, selector);
                }
            }
        }
        
        // 선택적 요소 캐싱
        for (const key of optionalElements) {
            const selector = selectors[key];
            if (selector) {
                const element = document.querySelector(selector);
                if (element) {
                    this.elements.set(key, element);
                }
            }
        }
        
        // 동적 요소 캐싱
        this.cacheDynamicElements();
        
        console.log(`[UIController] ✓ DOM 요소 캐싱 완료: ${this.elements.size}개`);
    }
    
    /**
     * 동적 요소 캐싱
     */
    cacheDynamicElements() {
        // 모든 버튼 요소
        document.querySelectorAll('button[data-action]').forEach(btn => {
            const action = btn.dataset.action;
            this.elements.set(`action_${action}`, btn);
        });
        
        // 모든 슬라이더 요소
        document.querySelectorAll('input[type="range"][data-control]').forEach(slider => {
            const control = slider.dataset.control;
            this.elements.set(`slider_${control}`, slider);
        });
        
        // 모든 토글 요소
        document.querySelectorAll('[data-toggle]').forEach(toggle => {
            const target = toggle.dataset.toggle;
            this.elements.set(`toggle_${target}`, toggle);
        });
    }
    
    /**
     * 누락된 요소 생성
     */
    async createMissingElement(key, selector) {
        try {
            const element = this.createElement(key, selector);
            const parent = this.findAppropriateParent(key);
            parent.appendChild(element);
            this.elements.set(key, element);
            
            console.log(`[UIController] 요소 생성: ${key}`);
        } catch (error) {
            console.error(`[UIController] 요소 생성 실패: ${key}`, error);
        }
    }
    
    /**
     * 요소 생성
     */
    createElement(key, selector) {
        const element = document.createElement('div');
        element.id = selector.replace('#', '').replace('.', '');
        element.className = this.generateClassName(key);
        
        // 기본 내용 설정
        this.setElementDefaults(element, key);
        
        // 접근성 속성 설정
        this.setAccessibilityAttributes(element, key);
        
        return element;
    }
    
    /**
     * 클래스명 생성
     */
    generateClassName(key) {
        return key.replace(/([A-Z])/g, '-$1').toLowerCase();
    }
    
    /**
     * 요소 기본값 설정
     */
    setElementDefaults(element, key) {
        const defaults = getConfig('ui.elementDefaults', {});
        const keyDefaults = defaults[key];
        
        if (keyDefaults) {
            if (keyDefaults.innerHTML) {
                element.innerHTML = keyDefaults.innerHTML;
            }
            if (keyDefaults.className) {
                element.className += ` ${keyDefaults.className}`;
            }
            if (keyDefaults.style) {
                Object.assign(element.style, keyDefaults.style);
            }
        }
    }
    
    /**
     * 접근성 속성 설정
     */
    setAccessibilityAttributes(element, key) {
        const a11yConfig = getConfig('ui.accessibility', {});
        const keyA11y = a11yConfig[key];
        
        if (keyA11y) {
            Object.entries(keyA11y).forEach(([attr, value]) => {
                element.setAttribute(attr, value);
            });
        }
    }
    
    /**
     * 적절한 부모 요소 찾기
     */
    findAppropriateParent(key) {
        const parentMap = getConfig('ui.parentMapping', {});
        const parentSelector = parentMap[key];
        
        if (parentSelector) {
            const parent = document.querySelector(parentSelector);
            if (parent) return parent;
        }
        
        // 기본 부모 찾기
        const defaultParents = ['#app', '#main', '#container', 'body'];
        for (const selector of defaultParents) {
            const parent = document.querySelector(selector);
            if (parent) return parent;
        }
        
        return document.body;
    }
    
    /**
     * 컴포넌트 시스템 초기화
     */
    initializeComponents() {
        const componentConfig = getConfig('ui.components', {});
        
        Object.entries(componentConfig).forEach(([name, config]) => {
            try {
                const component = this.createComponent(name, config);
                this.components.set(name, component);
            } catch (error) {
                console.error(`[UIController] 컴포넌트 생성 실패: ${name}`, error);
            }
        });
        
        console.log(`[UIController] ✓ ${this.components.size}개 컴포넌트 초기화됨`);
    }
    
    /**
     * 컴포넌트 생성
     */
    createComponent(name, config) {
        const { type, container, props = {} } = config;
        const containerElement = this.elements.get(container) || document.querySelector(container);
        
        if (!containerElement) {
            throw new Error(`컴포넌트 컨테이너를 찾을 수 없음: ${container}`);
        }
        
        // 컴포넌트 팩토리
        switch (type) {
            case 'ModelSelector':
                return this.createModelSelector(containerElement, props);
            case 'LoadingScreen':
                return this.createLoadingScreen(containerElement, props);
            case 'InfoPanel':
                return this.createInfoPanel(containerElement, props);
            case 'ControlPanel':
                return this.createControlPanel(containerElement, props);
            case 'StatusBar':
                return this.createStatusBar(containerElement, props);
            case 'Modal':
                return this.createModal(containerElement, props);
            case 'Tooltip':
                return this.createTooltip(containerElement, props);
            default:
                throw new Error(`알 수 없는 컴포넌트 타입: ${type}`);
        }
    }
    
    /**
     * 모델 선택기 컴포넌트
     */
    createModelSelector(container, props) {
        const component = {
            element: container,
            models: [],
            
            async render() {
                this.models = await this.loadModels();
                this.element.innerHTML = this.generateHTML();
                this.bindEvents();
            },
            
            async loadModels() {
                // ConfigManager에서 모델 목록 가져오기
                return getConfig('models.defaultModels', []);
            },
            
            generateHTML() {
                const { title, subtitle } = props;
                return `
                    <div class="model-selector">
                        <div class="model-selector__header">
                            <h1 class="model-selector__title">${this.t(title)}</h1>
                            <p class="model-selector__subtitle">${this.t(subtitle)}</p>
                        </div>
                        <div class="model-selector__grid">
                            ${this.models.map(model => this.renderModelCard(model)).join('')}
                        </div>
                    </div>
                `;
            },
            
            renderModelCard(model) {
                return `
                    <div class="model-card" data-model-id="${model.id}" tabindex="0" role="button">
                        <div class="model-card__image">
                            <img src="${model.thumbnail || '/images/default-model.jpg'}" 
                                 alt="${model.name}" 
                                 loading="lazy">
                        </div>
                        <div class="model-card__content">
                            <h3 class="model-card__title">${model.name}</h3>
                            <p class="model-card__description">${model.description}</p>
                            <div class="model-card__metadata">
                                <span class="model-card__type">${model.type}</span>
                                <span class="model-card__complexity">${model.complexity}</span>
                            </div>
                        </div>
                    </div>
                `;
            },
            
            bindEvents() {
                this.element.querySelectorAll('.model-card').forEach(card => {
                    card.addEventListener('click', (e) => {
                        const modelId = e.currentTarget.dataset.modelId;
                        this.selectModel(modelId);
                    });
                    
                    card.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            const modelId = e.currentTarget.dataset.modelId;
                            this.selectModel(modelId);
                        }
                    });
                });
            },
            
            selectModel(modelId) {
                const model = this.models.find(m => m.id === modelId);
                if (model) {
                    // UI 컨트롤러에 이벤트 전달
                    container.dispatchEvent(new CustomEvent('model:select', {
                        detail: { model }
                    }));
                }
            },
            
            t(key) {
                // 다국어 처리
                return getConfig(`i18n.${getConfig('ui.language')}.${key}`, key);
            }
        };
        
        return component;
    }
    
    /**
     * 로딩 스크린 컴포넌트
     */
    createLoadingScreen(container, props) {
        const component = {
            element: container,
            isVisible: false,
            
            show(message = '') {
                if (this.isVisible) return;
                
                this.element.innerHTML = `
                    <div class="loading-screen">
                        <div class="loading-spinner">
                            <div class="spinner"></div>
                        </div>
                        <div class="loading-message">${message}</div>
                        <div class="loading-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: 0%"></div>
                            </div>
                            <div class="progress-text">0%</div>
                        </div>
                    </div>
                `;
                
                this.element.style.display = 'flex';
                this.isVisible = true;
                
                // 애니메이션
                if (!getConfig('accessibility.reducedMotion')) {
                    this.element.style.opacity = '0';
                    this.element.style.transition = 'opacity 0.3s ease';
                    requestAnimationFrame(() => {
                        this.element.style.opacity = '1';
                    });
                }
            },
            
            hide() {
                if (!this.isVisible) return;
                
                if (!getConfig('accessibility.reducedMotion')) {
                    this.element.style.transition = 'opacity 0.3s ease';
                    this.element.style.opacity = '0';
                    setTimeout(() => {
                        this.element.style.display = 'none';
                        this.isVisible = false;
                    }, 300);
                } else {
                    this.element.style.display = 'none';
                    this.isVisible = false;
                }
            },
            
            updateProgress(progress, message = '') {
                if (!this.isVisible) return;
                
                const progressFill = this.element.querySelector('.progress-fill');
                const progressText = this.element.querySelector('.progress-text');
                const messageEl = this.element.querySelector('.loading-message');
                
                if (progressFill) {
                    progressFill.style.width = `${progress}%`;
                }
                if (progressText) {
                    progressText.textContent = `${Math.round(progress)}%`;
                }
                if (messageEl && message) {
                    messageEl.textContent = message;
                }
            }
        };
        
        return component;
    }
    
    /**
     * 정보 패널 컴포넌트
     */
    createInfoPanel(container, props) {
        const component = {
            element: container,
            data: {},
            
            render(data = {}) {
                this.data = { ...this.data, ...data };
                this.element.innerHTML = this.generateHTML();
            },
            
            generateHTML() {
                return `
                    <div class="info-panel">
                        <h3 class="info-panel__title">${this.t('model_info')}</h3>
                        <div class="info-panel__content">
                            ${this.renderInfoItems()}
                        </div>
                    </div>
                `;
            },
            
            renderInfoItems() {
                const items = [
                    { key: 'name', label: 'model_name', value: this.data.name || '-' },
                    { key: 'type', label: 'model_type', value: this.data.type || '-' },
                    { key: 'meshes', label: 'mesh_count', value: this.data.meshes || 0 },
                    { key: 'vertices', label: 'vertex_count', value: this.data.vertices || 0 },
                    { key: 'triangles', label: 'triangle_count', value: this.data.triangles || 0 },
                    { key: 'hotspots', label: 'hotspot_count', value: this.data.hotspots || 0 }
                ];
                
                return items.map(item => `
                    <div class="info-item">
                        <span class="info-item__label">${this.t(item.label)}:</span>
                        <span class="info-item__value">${this.formatValue(item.value, item.key)}</span>
                    </div>
                `).join('');
            },
            
            formatValue(value, key) {
                if (typeof value === 'number') {
                    return value.toLocaleString();
                }
                return value;
            },
            
            t(key) {
                return getConfig(`i18n.${getConfig('ui.language')}.${key}`, key);
            }
        };
        
        return component;
    }
    
    /**
     * 테마 시스템 초기화
     */
    initializeTheme() {
        const theme = this.state.theme;
        this.applyTheme(theme);
        
        // 테마 토글 버튼 설정
        const themeToggle = this.elements.get('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        
        console.log(`[UIController] ✓ 테마 초기화: ${theme}`);
    }
    
    /**
     * 테마 적용
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.state.theme = theme;
        setConfig('ui.theme', theme);
        
        this.emit('theme:changed', theme);
    }
    
    /**
     * 테마 토글
     */
    toggleTheme() {
        const currentTheme = this.state.theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    }
    
    /**
     * 다국어 시스템 초기화
     */
    initializeLocalization() {
        const language = this.state.language;
        this.applyLanguage(language);
        
        // 언어 선택기 설정
        const languageSelector = this.elements.get('languageSelector');
        if (languageSelector) {
            languageSelector.addEventListener('change', (e) => {
                this.applyLanguage(e.target.value);
            });
        }
        
        console.log(`[UIController] ✓ 다국어 초기화: ${language}`);
    }
    
    /**
     * 언어 적용
     */
    applyLanguage(language) {
        document.documentElement.setAttribute('lang', language);
        this.state.language = language;
        setConfig('ui.language', language);
        
        // 모든 텍스트 요소 업데이트
        this.updateTexts();
        
        this.emit('language:changed', language);
    }
    
    /**
     * 텍스트 업데이트
     */
    updateTexts() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.dataset.i18n;
            const text = this.t(key);
            if (text) {
                element.textContent = text;
            }
        });
    }
    
    /**
     * 다국어 텍스트 가져오기
     */
    t(key) {
        const language = this.state.language;
        return getConfig(`i18n.${language}.${key}`, key);
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
                this.switchToViewerUI(data.model);
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
            
            this.sceneManager.on('performance:update', (stats) => {
                this.updatePerformanceInfo(stats);
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
        }
        
        // HotspotManager 이벤트
        if (this.hotspotManager) {
            this.hotspotManager.on('hotspot:click', (data) => {
                this.showHotspotInfo(data.hotspot);
            });
        }
    }
    
    /**
     * 컴포넌트 이벤트 구독
     */
    subscribeToComponentEvents() {
        // 모델 선택 이벤트
        const modelSelector = this.components.get('ModelSelector');
        if (modelSelector) {
            modelSelector.element.addEventListener('model:select', (e) => {
                this.handleModelSelection(e.detail.model);
            });
        }
    }
    
    /**
     * 반응형 UI 설정
     */
    setupResponsiveUI() {
        // 브레이크포인트 감지
        Object.entries(this.breakpoints).forEach(([name, width]) => {
            const mediaQuery = window.matchMedia(`(max-width: ${width}px)`);
            mediaQuery.addEventListener('change', (e) => {
                this.handleBreakpointChange(name, e.matches);
            });
            
            // 초기 상태 설정
            this.handleBreakpointChange(name, mediaQuery.matches);
        });
        
        console.log('[UIController] ✓ 반응형 UI 설정됨');
    }
    
    /**
     * 브레이크포인트 변경 처리
     */
    handleBreakpointChange(breakpoint, matches) {
        const className = `is-${breakpoint}`;
        
        if (matches) {
            document.body.classList.add(className);
        } else {
            document.body.classList.remove(className);
        }
        
        // 모바일에서는 사이드바 자동 축소
        if (breakpoint === 'mobile' && matches) {
            this.state.sidebarCollapsed = true;
            this.applySidebarState();
        }
        
        this.emit('breakpoint:change', { breakpoint, matches });
    }
    
    /**
     * 초기 UI 상태 설정
     */
    initializeUIState() {
        // 뷰 상태 적용
        this.applyViewState();
        
        // 패널 상태 적용
        this.applyPanelStates();
        
        // 사이드바 상태 적용
        this.applySidebarState();
        
        // 모델 선택기 렌더링
        this.renderModelSelector();
        
        console.log('[UIController] ✓ 초기 UI 상태 설정됨');
    }
    
    /**
     * 뷰 상태 적용
     */
    applyViewState() {
        const views = ['model-selector', 'viewer'];
        views.forEach(view => {
            const element = this.elements.get(view);
            if (element) {
                element.style.display = view === this.state.currentView ? 'block' : 'none';
            }
        });
    }
    
    /**
     * 패널 상태 적용
     */
    applyPanelStates() {
        Object.entries(this.state.panelsVisible).forEach(([panel, visible]) => {
            this.setPanelVisibility(panel, visible, false);
        });
    }
    
    /**
     * 사이드바 상태 적용
     */
    applySidebarState() {
        const sidebar = this.elements.get('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('collapsed', this.state.sidebarCollapsed);
        }
    }
    
    /**
     * 모델 선택기 렌더링
     */
    renderModelSelector() {
        const modelSelector = this.components.get('ModelSelector');
        if (modelSelector) {
            modelSelector.render();
        }
    }
    
    /**
     * 성능 모니터링 시작
     */
    startPerformanceMonitoring() {
        const updatePerformance = () => {
            const currentTime = performance.now();
            const deltaTime = currentTime - this.performance.lastTime;
            
            this.performance.frameCount++;
            
            // FPS 계산 (1초마다)
            if (this.performance.frameCount % 60 === 0) {
                this.performance.fps = Math.round(1000 / deltaTime);
                this.queueUIUpdate('performance');
            }
            
            this.performance.lastTime = currentTime;
            requestAnimationFrame(updatePerformance);
        };
        
        updatePerformance();
    }
    
    /**
     * UI 업데이트 루프 시작
     */
    startUIUpdateLoop() {
        this.uiUpdateId = setInterval(() => {
            if (this.uiUpdateQueue.size > 0) {
                this.updateUI();
            }
        }, getConfig('ui.updateInterval', 16)); // ~60fps
    }
    
    /**
     * UI 업데이트 큐에 추가
     */
    queueUIUpdate(type) {
        this.uiUpdateQueue.add(type);
    }
    
    /**
     * UI 업데이트 실행
     */
    updateUI() {
        this.uiUpdateQueue.forEach(type => {
            switch (type) {
                case 'performance':
                    this.updatePerformanceDisplay();
                    break;
                case 'loading':
                    this.updateLoadingDisplay();
                    break;
                case 'animation':
                    this.updateAnimationDisplay();
                    break;
            }
        });
        
        this.uiUpdateQueue.clear();
    }
    
    /**
     * 성능 표시 업데이트
     */
    updatePerformanceDisplay() {
        const fpsElement = this.elements.get('fpsCounter');
        if (fpsElement) {
            fpsElement.textContent = `${this.performance.fps} FPS`;
        }
        
        // 상태바 업데이트
        const statusBar = this.components.get('StatusBar');
        if (statusBar) {
            statusBar.updatePerformance(this.performance);
        }
    }
    
    /**
     * 모델 선택 처리
     */
    async handleModelSelection(model) {
        try {
            this.state.currentModel = model;
            this.showLoadingScreen(`${model.name} 로딩 중...`);
            
            // ModelLoader에 모델 로드 요청
            if (this.modelLoader) {
                await this.modelLoader.loadModel(model);
            }
            
        } catch (error) {
            this.hideLoadingScreen();
            this.showErrorModal(`모델 로드 실패: ${error.message}`);
        }
    }
    
    /**
     * 뷰어 UI로 전환
     */
    switchToViewerUI(model) {
        this.state.currentView = 'viewer';
        this.applyViewState();
        
        // 뷰어 컴포넌트들 활성화
        this.activateViewerComponents();
        
        this.emit('view:changed', 'viewer');
    }
    
    /**
     * 뷰어 컴포넌트들 활성화
     */
    activateViewerComponents() {
        // 정보 패널 활성화
        const infoPanel = this.components.get('InfoPanel');
        if (infoPanel) {
            infoPanel.render();
        }
        
        // 컨트롤 패널 활성화
        const controlPanel = this.components.get('ControlPanel');
        if (controlPanel) {
            controlPanel.activate();
        }
        
        // 상태바 활성화
        const statusBar = this.components.get('StatusBar');
        if (statusBar) {
            statusBar.show();
        }
    }
    
    /**
     * 로딩 스크린 표시
     */
    showLoadingScreen(message = '') {
        const loadingScreen = this.components.get('LoadingScreen');
        if (loadingScreen) {
            loadingScreen.show(message);
        }
    }
    
    /**
     * 로딩 스크린 숨김
     */
    hideLoadingScreen() {
        const loadingScreen = this.components.get('LoadingScreen');
        if (loadingScreen) {
            loadingScreen.hide();
        }
    }
    
    /**
     * 로딩 진행률 업데이트
     */
    updateLoadingProgress(progress, message = '') {
        const loadingScreen = this.components.get('LoadingScreen');
        if (loadingScreen) {
            loadingScreen.updateProgress(progress, message);
        }
    }
    
    /**
     * 패널 가시성 설정
     */
    setPanelVisibility(panel, visible, animate = true) {
        const panelElement = this.elements.get(`${panel}Panel`);
        const toggleBtn = this.elements.get(`${panel}PanelToggle`);
        
        if (panelElement) {
            if (animate && !this.accessibility.reducedMotion) {
                panelElement.style.transition = 'transform 0.3s ease';
            }
            
            panelElement.style.display = visible ? 'block' : 'none';
            panelElement.classList.toggle('visible', visible);
        }
        
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', visible);
            toggleBtn.setAttribute('aria-expanded', visible);
        }
        
        this.state.panelsVisible[panel] = visible;
        this.emit('panel:toggle', { panel, visible });
    }
    
    /**
     * 에러 모달 표시
     */
    showErrorModal(message) {
        const modal = this.components.get('Modal');
        if (modal) {
            modal.show({
                title: this.t('error'),
                content: message,
                type: 'error',
                buttons: [
                    {
                        text: this.t('ok'),
                        action: () => modal.hide()
                    }
                ]
            });
        } else {
            // 폴백: 브라우저 alert
            alert(`Error: ${message}`);
        }
    }
    
    /**
     * 이벤트 핸들러들
     */
    handleResize() {
        // 뷰포트 크기 정보 업데이트
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        this.emit('resize', viewport);
    }
    
    handleKeyDown(e) {
        // 글로벌 키보드 단축키
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'm':
                    e.preventDefault();
                    this.showModelSelector();
                    break;
                case 'f':
                    e.preventDefault();
                    this.toggleFullscreen();
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                    e.preventDefault();
                    const panelIndex = parseInt(e.key) - 1;
                    const panels = ['left', 'right', 'bottom', 'top'];
                    if (panels[panelIndex]) {
                        this.togglePanel(panels[panelIndex]);
                    }
                    break;
            }
        }
        
        // ESC 키
        if (e.key === 'Escape') {
            this.handleEscapeKey();
        }
    }
    
    handleVisibilityChange() {
        if (document.hidden) {
            this.emit('visibility:hidden');
        } else {
            this.emit('visibility:visible');
        }
    }
    
    handleEscapeKey() {
        // 모달이 열려있으면 닫기
        const modal = this.components.get('Modal');
        if (modal && modal.isVisible) {
            modal.hide();
            return;
        }
        
        // 풀스크린 모드면 해제
        if (this.state.fullscreen) {
            this.toggleFullscreen();
            return;
        }
        
        // 모델 선택기로 돌아가기
        this.showModelSelector();
    }
    
    /**
     * 유틸리티 메서드들
     */
    togglePanel(panel) {
        const currentVisibility = this.state.panelsVisible[panel];
        this.setPanelVisibility(panel, !currentVisibility);
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            this.state.fullscreen = true;
        } else {
            document.exitFullscreen();
            this.state.fullscreen = false;
        }
        
        this.emit('fullscreen:toggle', this.state.fullscreen);
    }
    
    showModelSelector() {
        this.state.currentView = 'model-selector';
        this.applyViewState();
        this.renderModelSelector();
        
        this.emit('view:changed', 'model-selector');
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