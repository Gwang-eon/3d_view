// js/core/AppCore.js
// 메인 애플리케이션 클래스 - 모든 하드코딩 제거 및 모듈화

import { CONFIG_MANAGER, getConfig } from './ConfigManager.js';

/**
 * 월 뷰어 메인 애플리케이션 클래스
 * - 의존성 주입 기반 모듈 관리
 * - ConfigManager 기반 설정 관리
 * - 자동 에러 복구 시스템
 * - 플러그인 시스템 지원
 */
export class AppCore {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = null;
        this.options = { ...options };
        
        // 서비스 컨테이너
        this.services = new Map();
        this.plugins = new Map();
        
        // 상태 관리
        this.state = {
            initialized: false,
            loading: false,
            error: null,
            currentModel: null
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 애니메이션 루프 관리
        this.animationId = null;
        this.isRunning = false;
        
        console.log('[AppCore] 애플리케이션 생성됨');
    }
    
    /**
     * 애플리케이션 초기화
     */
    async init() {
        try {
            this.state.loading = true;
            this.emit('loading:start');
            
            console.log('[AppCore] 초기화 시작...');
            
            // 1. 기본 검증
            await this.validateEnvironment();
            
            // 2. DOM 준비
            await this.initializeDOM();
            
            // 3. 의존성 로드
            await this.loadDependencies();
            
            // 4. 서비스 초기화
            await this.initializeServices();
            
            // 5. 플러그인 로드
            await this.loadPlugins();
            
            // 6. 이벤트 바인딩
            this.bindEvents();
            
            // 7. 애니메이션 루프 시작
            this.startAnimationLoop();
            
            // 8. URL 파라미터 처리
            await this.handleUrlParameters();
            
            this.state.initialized = true;
            this.state.loading = false;
            this.emit('initialized');
            
            console.log('[AppCore] 초기화 완료');
            
            // 개발 모드에서 전역 접근 허용
            if (getConfig('app.debug')) {
                window.wallViewerApp = this;
                console.log('[AppCore] 전역 접근 활성화: window.wallViewerApp');
            }
            
        } catch (error) {
            this.state.loading = false;
            this.state.error = error;
            this.emit('error', error);
            
            console.error('[AppCore] 초기화 실패:', error);
            await this.handleInitializationError(error);
        }
    }
    
    /**
     * 환경 검증
     */
    async validateEnvironment() {
        const checks = [
            { name: 'WebGL', test: () => this.checkWebGL() },
            { name: 'Three.js', test: () => this.checkThreeJS() },
            { name: 'Required APIs', test: () => this.checkRequiredAPIs() }
        ];
        
        for (const check of checks) {
            try {
                const result = await check.test();
                if (!result) {
                    throw new Error(`${check.name} 검증 실패`);
                }
                console.log(`[AppCore] ✓ ${check.name} 검증 통과`);
            } catch (error) {
                console.error(`[AppCore] ✗ ${check.name} 검증 실패:`, error);
                throw new Error(`시스템 요구사항 미충족: ${check.name}`);
            }
        }
    }
    
    /**
     * WebGL 지원 확인
     */
    checkWebGL() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            return false;
        }
        
        // WebGL 확장 기능 확인
        const requiredExtensions = ['WEBGL_depth_texture', 'OES_texture_float'];
        const supportedExtensions = gl.getSupportedExtensions();
        
        return requiredExtensions.some(ext => 
            supportedExtensions.includes(ext)
        );
    }
    
    /**
     * Three.js 로드 확인
     */
    async checkThreeJS() {
        const maxAttempts = getConfig('timing.maxRetryAttempts');
        const delay = getConfig('timing.retryDelay');
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (window.THREE && 
                window.THREE.GLTFLoader && 
                window.THREE.OrbitControls) {
                return true;
            }
            
            console.log(`[AppCore] Three.js 로딩 대기... (${attempt + 1}/${maxAttempts})`);
            await this.sleep(delay);
        }
        
        return false;
    }
    
    /**
     * 필수 API 확인
     */
    checkRequiredAPIs() {
        const requiredAPIs = [
            'requestAnimationFrame',
            'fetch',
            'Promise',
            'Map',
            'Set'
        ];
        
        return requiredAPIs.every(api => typeof window[api] !== 'undefined');
    }
    
    /**
     * DOM 초기화
     */
    async initializeDOM() {
        // 컨테이너 요소 찾기
        this.container = typeof this.containerId === 'string' 
            ? document.querySelector(this.containerId)
            : this.containerId;
            
        if (!this.container) {
            throw new Error(`컨테이너를 찾을 수 없습니다: ${this.containerId}`);
        }
        
        // 필수 DOM 요소 확인
        const requiredSelectors = [
            'selectors.modelSelector',
            'selectors.modelList',
            'selectors.canvasContainer'
        ];
        
        const missingElements = [];
        
        for (const selector of requiredSelectors) {
            const selectorValue = getConfig(selector, null);
            if (selectorValue && !document.querySelector(selectorValue)) {
                missingElements.push(selectorValue);
            }
        }
        
        if (missingElements.length > 0) {
            console.warn('[AppCore] 일부 DOM 요소가 없습니다:', missingElements);
            
            // 자동 생성 시도
            if (getConfig('app.debug')) {
                await this.createMissingElements(missingElements);
            }
        }
        
        console.log('[AppCore] ✓ DOM 초기화 완료');
    }
    
    /**
     * 누락된 DOM 요소 자동 생성
     */
    async createMissingElements(missingSelectors) {
        console.log('[AppCore] 누락된 요소 자동 생성 시도...');
        
        for (const selector of missingSelectors) {
            try {
                const element = document.createElement('div');
                element.id = selector.replace('#', '');
                
                // 기본 스타일 적용
                if (selector.includes('model-selector')) {
                    element.style.display = 'flex';
                    element.style.justifyContent = 'center';
                    element.style.alignItems = 'center';
                    element.style.minHeight = '100vh';
                }
                
                this.container.appendChild(element);
                console.log(`[AppCore] 요소 생성: ${selector}`);
            } catch (error) {
                console.error(`[AppCore] 요소 생성 실패: ${selector}`, error);
            }
        }
    }
    
    /**
     * 의존성 로드
     */
    async loadDependencies() {
        console.log('[AppCore] 의존성 로드 중...');
        
        // Three.js 재확인
        if (!await this.checkThreeJS()) {
            throw new Error('Three.js 로드 실패');
        }
        
        // 추가 의존성들 (동적 로드)
        const dependencies = [
            { name: 'SceneManager', path: '../SceneManager.js' },
            { name: 'ModelLoader', path: '../ModelLoader.js' },
            { name: 'UIController', path: '../UIController.js' },
            { name: 'HotspotManager', path: '../HotspotManager.js' },
            { name: 'AnimationController', path: '../AnimationController.js' }
        ];
        
        for (const dep of dependencies) {
            try {
                const module = await import(dep.path);
                this.services.set(dep.name, module[dep.name]);
                console.log(`[AppCore] ✓ ${dep.name} 로드됨`);
            } catch (error) {
                console.error(`[AppCore] ${dep.name} 로드 실패:`, error);
                // 선택적 의존성인 경우 계속 진행
                if (!this.isOptionalDependency(dep.name)) {
                    throw error;
                }
            }
        }
    }
    
    /**
     * 선택적 의존성 확인
     */
    isOptionalDependency(name) {
        const optionalDeps = ['AnimationController', 'HotspotManager'];
        return optionalDeps.includes(name);
    }
    
    /**
     * 서비스 초기화
     */
    async initializeServices() {
        console.log('[AppCore] 서비스 초기화 중...');
        
        // 서비스 인스턴스 생성 순서 (의존성 고려)
        const serviceOrder = [
            'SceneManager',
            'AnimationController',
            'HotspotManager',
            'ModelLoader',
            'UIController'
        ];
        
        const instances = new Map();
        
        for (const serviceName of serviceOrder) {
            try {
                const ServiceClass = this.services.get(serviceName);
                if (!ServiceClass) {
                    if (this.isOptionalDependency(serviceName)) {
                        console.warn(`[AppCore] 선택적 서비스 누락: ${serviceName}`);
                        continue;
                    }
                    throw new Error(`필수 서비스를 찾을 수 없습니다: ${serviceName}`);
                }
                
                // 의존성 주입
                let instance;
                switch (serviceName) {
                    case 'SceneManager':
                        instance = new ServiceClass(this.container);
                        break;
                    case 'AnimationController':
                        instance = new ServiceClass();
                        break;
                    case 'HotspotManager':
                        instance = new ServiceClass(instances.get('SceneManager'));
                        break;
                    case 'ModelLoader':
                        instance = new ServiceClass(
                            instances.get('SceneManager'),
                            instances.get('AnimationController')
                        );
                        break;
                    case 'UIController':
                        instance = new ServiceClass(
                            instances.get('SceneManager'),
                            instances.get('ModelLoader'),
                            instances.get('AnimationController'),
                            instances.get('HotspotManager')
                        );
                        break;
                    default:
                        instance = new ServiceClass();
                }
                
                // 서비스에 앱 참조 주입
                if (instance && typeof instance.setApp === 'function') {
                    instance.setApp(this);
                }
                
                instances.set(serviceName, instance);
                console.log(`[AppCore] ✓ ${serviceName} 초기화됨`);
                
            } catch (error) {
                console.error(`[AppCore] ${serviceName} 초기화 실패:`, error);
                if (!this.isOptionalDependency(serviceName)) {
                    throw error;
                }
            }
        }
        
        // 인스턴스를 서비스 맵에 저장
        instances.forEach((instance, name) => {
            this.services.set(name, instance);
        });
        
        // 편의 접근자 생성
        this.sceneManager = instances.get('SceneManager');
        this.modelLoader = instances.get('ModelLoader');
        this.uiController = instances.get('UIController');
        this.hotspotManager = instances.get('HotspotManager');
        this.animationController = instances.get('AnimationController');
    }
    
    /**
     * 플러그인 로드
     */
    async loadPlugins() {
        const enabledPlugins = getConfig('plugins.enabled', {});
        const autoLoadPlugins = getConfig('plugins.autoLoad', []);
        
        console.log('[AppCore] 플러그인 로드 중...');
        
        for (const pluginPath of autoLoadPlugins) {
            try {
                const module = await import(pluginPath);
                const PluginClass = module.default || module[Object.keys(module)[0]];
                
                if (PluginClass) {
                    const plugin = new PluginClass();
                    await plugin.init(this);
                    this.plugins.set(plugin.name, plugin);
                    console.log(`[AppCore] ✓ 플러그인 로드됨: ${plugin.name}`);
                }
            } catch (error) {
                console.warn(`[AppCore] 플러그인 로드 실패: ${pluginPath}`, error);
            }
        }
    }
    
    /**
     * 이벤트 바인딩
     */
    bindEvents() {
        // 윈도우 이벤트
        window.addEventListener('resize', this.handleResize.bind(this));
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        
        // 에러 핸들링
        window.addEventListener('error', this.handleGlobalError.bind(this));
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
        
        console.log('[AppCore] ✓ 이벤트 바인딩 완료');
    }
    
    /**
     * 애니메이션 루프 시작
     */
    startAnimationLoop() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        const targetFPS = getConfig('performance.targetFPS');
        const frameInterval = 1000 / targetFPS;
        let lastTime = 0;
        
        const animate = (currentTime) => {
            if (!this.isRunning) return;
            
            this.animationId = requestAnimationFrame(animate);
            
            // FPS 제한
            if (currentTime - lastTime >= frameInterval) {
                this.update(currentTime);
                this.render();
                lastTime = currentTime;
            }
        };
        
        animate(0);
        console.log('[AppCore] ✓ 애니메이션 루프 시작됨');
    }
    
    /**
     * 업데이트 로직
     */
    update(deltaTime) {
        // 서비스 업데이트
        if (this.sceneManager && this.sceneManager.controls) {
            this.sceneManager.controls.update();
        }
        
        if (this.animationController) {
            this.animationController.update(deltaTime);
        }
        
        if (this.hotspotManager) {
            this.hotspotManager.updatePositions();
        }
        
        // 플러그인 업데이트
        this.plugins.forEach(plugin => {
            if (plugin.enabled && typeof plugin.update === 'function') {
                plugin.update(deltaTime);
            }
        });
        
        // UI 업데이트
        if (this.uiController) {
            this.uiController.updateFPS(deltaTime);
        }
    }
    
    /**
     * 렌더링
     */
    render() {
        if (this.sceneManager) {
            this.sceneManager.render();
        }
    }
    
    /**
     * URL 파라미터 처리
     */
    async handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // 모델 자동 로드
        const modelId = urlParams.get('model');
        if (modelId !== null && this.modelLoader) {
            const modelIndex = parseInt(modelId);
            const models = getConfig('models.defaultModels');
            
            if (!isNaN(modelIndex) && modelIndex >= 0 && modelIndex < models.length) {
                console.log(`[AppCore] URL 파라미터로 모델 ${modelIndex} 자동 로드`);
                
                // UI가 준비될 때까지 대기
                setTimeout(async () => {
                    try {
                        await this.loadModel(modelIndex);
                    } catch (error) {
                        console.error('[AppCore] URL 모델 로드 실패:', error);
                    }
                }, getConfig('timing.debounceDelay'));
            }
        }
        
        // 설정 파라미터 적용
        const configKeys = ['scene.camera.fov', 'animation.speed', 'ui.theme'];
        CONFIG_MANAGER.importFromQuery(configKeys);
    }
    
    /**
     * 모델 로드
     */
    async loadModel(modelIndex) {
        if (!this.modelLoader) {
            throw new Error('ModelLoader가 초기화되지 않았습니다.');
        }
        
        try {
            this.state.loading = true;
            this.emit('model:loading', modelIndex);
            
            const result = await this.modelLoader.loadModel(modelIndex);
            
            if (result.success) {
                this.state.currentModel = modelIndex;
                this.emit('model:loaded', modelIndex, result);
                console.log(`[AppCore] 모델 로드 완료: ${modelIndex}`);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.emit('model:error', modelIndex, error);
            throw error;
        } finally {
            this.state.loading = false;
        }
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
                    console.error(`[AppCore] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
    }
    
    /**
     * 에러 핸들링
     */
    async handleInitializationError(error) {
        console.error('[AppCore] 초기화 오류:', error);
        
        const autoRecovery = getConfig('errors.autoRecovery');
        const maxAttempts = getConfig('errors.maxAutoRecoveryAttempts');
        
        if (autoRecovery && this.recoveryAttempts < maxAttempts) {
            this.recoveryAttempts = (this.recoveryAttempts || 0) + 1;
            console.log(`[AppCore] 자동 복구 시도 ${this.recoveryAttempts}/${maxAttempts}`);
            
            await this.sleep(getConfig('timing.retryDelay') * this.recoveryAttempts);
            return this.init();
        }
        
        // 사용자 친화적 오류 메시지 표시
        if (getConfig('errors.showUserFriendlyMessages')) {
            this.showErrorMessage(error);
        }
    }
    
    /**
     * 사용자 친화적 오류 메시지 표시
     */
    showErrorMessage(error) {
        const container = this.container;
        if (!container) return;
        
        container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100vh;
                background: #1a1a1a;
                color: #fff;
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 20px;
            ">
                <h2 style="color: #ff6b6b; margin-bottom: 20px;">
                    ⚠️ 애플리케이션 로드 실패
                </h2>
                <p style="margin-bottom: 10px; opacity: 0.8;">
                    브라우저 호환성 또는 네트워크 연결을 확인해주세요.
                </p>
                <details style="margin-top: 20px; opacity: 0.6;">
                    <summary style="cursor: pointer;">기술적 세부사항</summary>
                    <pre style="background: #2a2a2a; padding: 10px; margin-top: 10px; border-radius: 4px; text-align: left;">
${error.message}
${error.stack || ''}
                    </pre>
                </details>
                <button onclick="location.reload()" style="
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">
                    🔄 다시 시도
                </button>
            </div>
        `;
    }
    
    /**
     * 이벤트 핸들러들
     */
    handleResize() {
        if (this.sceneManager) {
            this.sceneManager.handleResize();
        }
    }
    
    handleBeforeUnload() {
        this.destroy();
    }
    
    handleGlobalError(event) {
        console.error('[AppCore] 전역 오류:', event.error);
        this.emit('error', event.error);
    }
    
    handleUnhandledRejection(event) {
        console.error('[AppCore] 처리되지 않은 Promise 거부:', event.reason);
        this.emit('error', event.reason);
    }
    
    /**
     * 정리
     */
    destroy() {
        console.log('[AppCore] 정리 중...');
        
        // 애니메이션 루프 중지
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // 서비스 정리
        this.services.forEach(service => {
            if (service && typeof service.destroy === 'function') {
                service.destroy();
            }
        });
        
        // 플러그인 정리
        this.plugins.forEach(plugin => {
            if (plugin && typeof plugin.destroy === 'function') {
                plugin.destroy();
            }
        });
        
        // 이벤트 리스너 제거
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        
        this.state.initialized = false;
        console.log('[AppCore] 정리 완료');
    }
    
    /**
     * 유틸리티 메서드들
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 서비스 접근자
     */
    getService(name) {
        return this.services.get(name);
    }
    
    /**
     * 플러그인 접근자
     */
    getPlugin(name) {
        return this.plugins.get(name);
    }
    
    /**
     * 상태 접근자
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[AppCore] 디버그 정보');
        console.log('상태:', this.state);
        console.log('서비스:', Array.from(this.services.keys()));
        console.log('플러그인:', Array.from(this.plugins.keys()));
        console.log('이벤트:', Array.from(this.events.keys()));
        console.groupEnd();
    }
}

export default AppCore;