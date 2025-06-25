// js/main.js
// 완전 통합된 메인 애플리케이션 - 새로운 아키텍처 기반
// ConfigManager, ServiceRegistry, AppCore를 활용한 현대적 웹 애플리케이션

import { CONFIG_MANAGER, getConfig, setConfig } from './core/ConfigManager.js';
import { AppCore } from './core/AppCore.js';

/**
 * 옹벽 3D 뷰어 메인 애플리케이션
 * - ConfigManager 기반 설정 관리
 * - AppCore를 통한 생명주기 관리
 * - 자동 에러 복구 시스템
 * - 개발 도구 통합
 * - 성능 모니터링
 */
class WallViewerApplication {
    constructor() {
        // 애플리케이션 상태
        this.app = null;
        this.initialized = false;
        this.startTime = performance.now();
        this.initializationAttempts = 0;
        this.maxInitAttempts = 3;
        
        // 성능 모니터링
        this.performanceMonitor = {
            startTime: this.startTime,
            initTime: 0,
            memoryUsage: 0,
            fps: 0,
            lastUpdate: 0
        };
        
        // 에러 추적
        this.errorHistory = [];
        this.criticalErrors = [];
        
        console.log(`[WallViewer] 애플리케이션 생성 - 환경: ${CONFIG_MANAGER.environment}`);
        
        // 글로벌 에러 핸들러 설정
        this.setupGlobalErrorHandling();
        
        // 개발 도구 설정 (디버그 모드)
        if (getConfig('app.debug')) {
            this.setupDevelopmentTools();
        }
    }
    
    /**
     * 메인 초기화 함수
     */
    async initialize() {
        try {
            this.initializationAttempts++;
            console.log(`[WallViewer] 초기화 시작 (시도 ${this.initializationAttempts}/${this.maxInitAttempts})`);
            
            // 1. 사전 검증
            await this.preInitializationChecks();
            
            // 2. 환경별 최적화
            this.optimizeForEnvironment();
            
            // 3. DOM 준비 대기
            await this.waitForDOM();
            console.log('[WallViewer] ✓ DOM 준비 완료');
            
            // 4. 의존성 검증
            await this.validateDependencies();
            console.log('[WallViewer] ✓ 의존성 검증 완료');
            
            // 5. 사용자 설정 로드
            await this.loadUserConfigurations();
            console.log('[WallViewer] ✓ 사용자 설정 로드 완료');
            
            // 6. AppCore 생성 및 초기화
            await this.createAndInitializeApp();
            console.log('[WallViewer] ✓ AppCore 초기화 완료');
            
            // 7. 애플리케이션 이벤트 구독
            this.subscribeToAppEvents();
            
            // 8. 성능 모니터링 시작
            this.startPerformanceMonitoring();
            
            // 9. 후처리 작업
            await this.postInitializationTasks();
            
            // 초기화 완료
            this.initialized = true;
            this.performanceMonitor.initTime = performance.now() - this.startTime;
            
            console.log(`[WallViewer] ✅ 초기화 완료 (${this.performanceMonitor.initTime.toFixed(2)}ms)`);
            
            // 성공 통계 전송 (선택적)
            this.reportInitializationSuccess();
            
        } catch (error) {
            await this.handleInitializationError(error);
        }
    }
    
    /**
     * 사전 초기화 검증
     */
    async preInitializationChecks() {
        const checks = [
            {
                name: '브라우저 호환성',
                test: () => this.checkBrowserCompatibility(),
                critical: true
            },
            {
                name: 'WebGL 지원',
                test: () => this.checkWebGLSupport(),
                critical: true
            },
            {
                name: 'ES6+ 지원',
                test: () => this.checkES6Support(),
                critical: true
            },
            {
                name: '로컬 스토리지',
                test: () => this.checkLocalStorage(),
                critical: false
            },
            {
                name: '네트워크 연결',
                test: () => this.checkNetworkConnection(),
                critical: false
            }
        ];
        
        for (const check of checks) {
            try {
                const result = await check.test();
                if (!result && check.critical) {
                    throw new Error(`필수 요구사항 실패: ${check.name}`);
                }
                console.log(`[WallViewer] ✓ ${check.name} 검증 완료`);
            } catch (error) {
                if (check.critical) {
                    throw new Error(`${check.name} 검증 실패: ${error.message}`);
                } else {
                    console.warn(`[WallViewer] ⚠️ ${check.name} 검증 실패 (무시됨): ${error.message}`);
                }
            }
        }
    }
    
    /**
     * 브라우저 호환성 검증
     */
    checkBrowserCompatibility() {
        const requiredFeatures = [
            'Promise',
            'fetch',
            'Map',
            'Set',
            'Symbol',
            'requestAnimationFrame',
            'WebGLRenderingContext'
        ];
        
        for (const feature of requiredFeatures) {
            if (!(feature in window)) {
                throw new Error(`지원되지 않는 브라우저: ${feature} 없음`);
            }
        }
        
        return true;
    }
    
    /**
     * WebGL 지원 확인
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                throw new Error('WebGL을 지원하지 않는 브라우저입니다.');
            }
            
            // WebGL 정보 수집 (디버그용)
            if (getConfig('app.debug')) {
                const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    console.log('[WallViewer] WebGL 정보:', {
                        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
                        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
                        version: gl.getParameter(gl.VERSION)
                    });
                }
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * ES6+ 지원 확인
     */
    checkES6Support() {
        try {
            // ES6 기능들 테스트
            eval(`
                const test = () => {};
                const [a, b] = [1, 2];
                const {x, y} = {x: 1, y: 2};
                const template = \`\${a}\`;
                class TestClass {}
            `);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 로컬 스토리지 확인
     */
    checkLocalStorage() {
        try {
            const testKey = '__wall_viewer_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 네트워크 연결 확인
     */
    async checkNetworkConnection() {
        if ('navigator' in window && 'onLine' in navigator) {
            return navigator.onLine;
        }
        
        try {
            const response = await fetch('data:text/plain;base64,', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 환경별 최적화
     */
    optimizeForEnvironment() {
        const environment = CONFIG_MANAGER.environment;
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isLowEnd = this.detectLowEndDevice();
        
        console.log(`[WallViewer] 환경 감지: ${environment}, 모바일: ${isMobile}, 저사양: ${isLowEnd}`);
        
        // 환경별 설정 오버라이드
        if (environment === 'development') {
            setConfig('app.debug', true);
            setConfig('app.verbose', true);
            setConfig('performance.targetFPS', 60);
        } else {
            setConfig('app.debug', false);
            setConfig('app.verbose', false);
        }
        
        // 모바일 최적화
        if (isMobile) {
            setConfig('performance.targetFPS', 30);
            setConfig('scene.renderer.pixelRatio', Math.min(window.devicePixelRatio, 2));
            setConfig('models.maxCacheSize', 3);
            setConfig('hotspots.updateInterval', 32); // 30fps
        }
        
        // 저사양 기기 최적화
        if (isLowEnd) {
            setConfig('performance.targetFPS', 24);
            setConfig('scene.lighting.enableShadows', false);
            setConfig('scene.renderer.antialias', false);
            setConfig('models.textureOptimization', true);
            setConfig('hotspots.enableOcclusion', false);
        }
        
        // 메모리 제한 설정
        const memoryLimit = this.estimateAvailableMemory();
        if (memoryLimit < 1000) { // 1GB 미만
            setConfig('models.maxCacheSize', 2);
            setConfig('models.maxFileSize', 20); // 20MB
        }
    }
    
    /**
     * 저사양 기기 감지
     */
    detectLowEndDevice() {
        // CPU 코어 수
        const cores = navigator.hardwareConcurrency || 2;
        
        // 메모리 (대략적)
        const memory = navigator.deviceMemory || 2;
        
        // GPU 성능 추정 (WebGL 확장)
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        let lowEndGPU = false;
        
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
                lowEndGPU = renderer.includes('intel') && (
                    renderer.includes('hd 3000') ||
                    renderer.includes('hd 4000') ||
                    renderer.includes('uhd')
                );
            }
        }
        
        return cores <= 2 || memory <= 2 || lowEndGPU;
    }
    
    /**
     * 메모리 추정
     */
    estimateAvailableMemory() {
        if ('deviceMemory' in navigator) {
            return navigator.deviceMemory * 1024; // GB to MB
        }
        
        // 폴백: 브라우저별 추정
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome')) {
            return 4096; // 4GB 추정
        } else if (userAgent.includes('Firefox')) {
            return 3072; // 3GB 추정
        } else {
            return 2048; // 2GB 추정
        }
    }
    
    /**
     * DOM 준비 대기
     */
    async waitForDOM() {
        if (document.readyState === 'complete') {
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            const checkReady = () => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    setTimeout(checkReady, 10);
                }
            };
            
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
            window.addEventListener('load', resolve, { once: true });
            
            checkReady();
        });
    }
    
    /**
     * 의존성 검증
     */
    async validateDependencies() {
        const dependencies = [
            { name: 'Three.js', check: () => window.THREE !== undefined },
            { name: 'OrbitControls', check: () => window.THREE?.OrbitControls !== undefined }
        ];
        
        const missingDeps = [];
        
        for (const dep of dependencies) {
            if (!dep.check()) {
                missingDeps.push(dep.name);
            }
        }
        
        if (missingDeps.length > 0) {
            throw new Error(`누락된 의존성: ${missingDeps.join(', ')}`);
        }
    }
    
    /**
     * 사용자 설정 로드
     */
    async loadUserConfigurations() {
        try {
            // 로컬 스토리지에서 사용자 설정 로드
            const userSettings = this.loadFromLocalStorage('wall_viewer_settings');
            if (userSettings) {
                // 안전한 설정만 병합
                const safeSettings = this.sanitizeUserSettings(userSettings);
                CONFIG_MANAGER.merge('user', safeSettings);
                console.log('[WallViewer] 사용자 설정 로드됨');
            }
            
            // URL 파라미터에서 설정 오버라이드
            this.applyURLParameters();
            
        } catch (error) {
            console.warn('[WallViewer] 사용자 설정 로드 실패:', error);
        }
    }
    
    /**
     * 로컬 스토리지에서 안전하게 로드
     */
    loadFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn(`[WallViewer] 로컬 스토리지 읽기 실패 (${key}):`, error);
            return null;
        }
    }
    
    /**
     * 사용자 설정 검증
     */
    sanitizeUserSettings(settings) {
        const allowedKeys = [
            'ui.theme',
            'ui.language',
            'performance.targetFPS',
            'hotspots.showLabels',
            'scene.camera.fov'
        ];
        
        const sanitized = {};
        for (const key of allowedKeys) {
            if (key in settings) {
                sanitized[key] = settings[key];
            }
        }
        
        return sanitized;
    }
    
    /**
     * URL 파라미터 적용
     */
    applyURLParameters() {
        const params = new URLSearchParams(window.location.search);
        
        // 디버그 모드
        if (params.has('debug')) {
            setConfig('app.debug', params.get('debug') !== 'false');
        }
        
        // 성능 모드
        if (params.has('performance')) {
            const perfMode = params.get('performance');
            if (perfMode === 'low') {
                setConfig('performance.targetFPS', 24);
                setConfig('scene.renderer.antialias', false);
            } else if (perfMode === 'high') {
                setConfig('performance.targetFPS', 60);
                setConfig('scene.renderer.antialias', true);
            }
        }
        
        // 테마
        if (params.has('theme')) {
            setConfig('ui.theme', params.get('theme'));
        }
        
        // 언어
        if (params.has('lang')) {
            setConfig('ui.language', params.get('lang'));
        }
    }
    
    /**
     * AppCore 생성 및 초기화
     */
    async createAndInitializeApp() {
        try {
            // 컨테이너 요소 확인
            const containerId = getConfig('selectors.canvasContainer', '#canvas-container');
            const container = document.querySelector(containerId);
            
            if (!container) {
                throw new Error(`컨테이너 요소를 찾을 수 없습니다: ${containerId}`);
            }
            
            // AppCore 생성
            this.app = new AppCore(containerId, {
                autoStart: true,
                enablePlugins: true,
                enableDebug: getConfig('app.debug')
            });
            
            // AppCore 초기화
            await this.app.init();
            
            // 전역 접근 설정 (디버그 모드)
            if (getConfig('app.debug')) {
                window.wallViewerApp = this;
                window.app = this.app;
                console.log('[WallViewer] 전역 접근 활성화: window.wallViewerApp, window.app');
            }
            
        } catch (error) {
            throw new Error(`AppCore 초기화 실패: ${error.message}`);
        }
    }
    
    /**
     * 애플리케이션 이벤트 구독
     */
    subscribeToAppEvents() {
        if (!this.app) return;
        
        // 로딩 이벤트
        this.app.on('loading:start', () => {
            this.showLoadingIndicator();
        });
        
        this.app.on('loading:complete', () => {
            this.hideLoadingIndicator();
        });
        
        // 에러 이벤트
        this.app.on('error', (error) => {
            this.handleApplicationError(error);
        });
        
        // 모델 이벤트
        this.app.on('model:loaded', (modelIndex, result) => {
            console.log(`[WallViewer] 모델 로드 완료: ${modelIndex}`);
            this.updatePerformanceStats();
        });
        
        // 성능 이벤트
        this.app.on('performance:warning', (warning) => {
            console.warn('[WallViewer] 성능 경고:', warning);
            this.handlePerformanceWarning(warning);
        });
        
        console.log('[WallViewer] ✓ 애플리케이션 이벤트 구독 완료');
    }
    
    /**
     * 성능 모니터링 시작
     */
    startPerformanceMonitoring() {
        if (!getConfig('performance.enableMonitoring', true)) return;
        
        const updateInterval = getConfig('performance.monitoringInterval', 1000);
        
        setInterval(() => {
            this.updatePerformanceStats();
        }, updateInterval);
        
        // 메모리 모니터링 (지원하는 브라우저에서)
        if ('memory' in performance) {
            setInterval(() => {
                this.monitorMemoryUsage();
            }, 5000);
        }
        
        console.log('[WallViewer] ✓ 성능 모니터링 시작');
    }
    
    /**
     * 성능 통계 업데이트
     */
    updatePerformanceStats() {
        const now = performance.now();
        
        // FPS 계산 (대략적)
        const deltaTime = now - this.performanceMonitor.lastUpdate;
        if (deltaTime > 0) {
            this.performanceMonitor.fps = Math.round(1000 / deltaTime);
        }
        this.performanceMonitor.lastUpdate = now;
        
        // 메모리 사용량 (사용 가능한 경우)
        if ('memory' in performance) {
            this.performanceMonitor.memoryUsage = Math.round(
                performance.memory.usedJSHeapSize / 1024 / 1024
            );
        }
        
        // 성능 경고 확인
        this.checkPerformanceThresholds();
    }
    
    /**
     * 메모리 사용량 모니터링
     */
    monitorMemoryUsage() {
        if (!('memory' in performance)) return;
        
        const memory = performance.memory;
        const usedMB = memory.usedJSHeapSize / 1024 / 1024;
        const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
        const usagePercent = (usedMB / limitMB) * 100;
        
        if (usagePercent > 80) {
            console.warn(`[WallViewer] 높은 메모리 사용량: ${usedMB.toFixed(1)}MB (${usagePercent.toFixed(1)}%)`);
            
            // 자동 정리 시도
            if (this.app && typeof this.app.cleanup === 'function') {
                this.app.cleanup();
            }
        }
    }
    
    /**
     * 성능 임계값 확인
     */
    checkPerformanceThresholds() {
        const targetFPS = getConfig('performance.targetFPS', 30);
        const warningThreshold = targetFPS * 0.7;
        
        if (this.performanceMonitor.fps < warningThreshold) {
            this.app?.emit('performance:warning', {
                type: 'low_fps',
                current: this.performanceMonitor.fps,
                target: targetFPS
            });
        }
    }
    
    /**
     * 후처리 작업
     */
    async postInitializationTasks() {
        // 스플래시 화면 숨김
        this.hideSplashScreen();
        
        // 초기 데이터 프리로드
        await this.preloadInitialData();
        
        // 사용자 가이드 표시 (처음 방문자)
        this.checkAndShowUserGuide();
        
        // 업데이트 확인
        this.checkForUpdates();
        
        console.log('[WallViewer] ✓ 후처리 작업 완료');
    }
    
    /**
     * 스플래시 화면 숨김
     */
    hideSplashScreen() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.transition = 'opacity 0.5s ease';
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500);
        }
    }
    
    /**
     * 초기 데이터 프리로드
     */
    async preloadInitialData() {
        try {
            const preloadList = getConfig('models.preloadList', []);
            if (preloadList.length > 0 && this.app?.modelLoader) {
                console.log(`[WallViewer] 초기 데이터 프리로드: ${preloadList.length}개 모델`);
                // 프리로드는 백그라운드에서 실행
                this.app.modelLoader.preloadModels(preloadList).catch(error => {
                    console.warn('[WallViewer] 프리로드 실패:', error);
                });
            }
        } catch (error) {
            console.warn('[WallViewer] 초기 데이터 프리로드 실패:', error);
        }
    }
    
    /**
     * 사용자 가이드 확인
     */
    checkAndShowUserGuide() {
        const isFirstVisit = !this.loadFromLocalStorage('wall_viewer_visited');
        if (isFirstVisit && getConfig('ui.showUserGuide', true)) {
            // 사용자 가이드 표시 로직
            setTimeout(() => {
                this.showUserGuide();
            }, 2000);
            
            // 방문 기록 저장
            try {
                localStorage.setItem('wall_viewer_visited', JSON.stringify({
                    timestamp: Date.now(),
                    version: getConfig('app.version')
                }));
            } catch (error) {
                console.warn('[WallViewer] 방문 기록 저장 실패:', error);
            }
        }
    }
    
    /**
     * 업데이트 확인
     */
    async checkForUpdates() {
        if (!getConfig('app.checkUpdates', false)) return;
        
        try {
            // 서버에서 버전 정보 확인 (구현 필요)
            const currentVersion = getConfig('app.version');
            console.log(`[WallViewer] 현재 버전: ${currentVersion}`);
        } catch (error) {
            console.warn('[WallViewer] 업데이트 확인 실패:', error);
        }
    }
    
    /**
     * 글로벌 에러 핸들링 설정
     */
    setupGlobalErrorHandling() {
        // JavaScript 에러
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error, 'script', event.filename, event.lineno);
        });
        
        // Promise rejection
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason, 'promise');
        });
        
        // 리소스 로드 에러
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleResourceError(event.target, event);
            }
        }, true);
    }
    
    /**
     * 개발 도구 설정
     */
    setupDevelopmentTools() {
        // 개발자 도구 단축키
        document.addEventListener('keydown', (event) => {
            // Ctrl+Shift+D: 디버그 정보
            if (event.ctrlKey && event.shiftKey && event.key === 'D') {
                this.showDebugInfo();
            }
            
            // Ctrl+Shift+P: 성능 정보
            if (event.ctrlKey && event.shiftKey && event.key === 'P') {
                this.showPerformanceInfo();
            }
            
            // Ctrl+Shift+R: 강제 새로고침
            if (event.ctrlKey && event.shiftKey && event.key === 'R') {
                this.forceReload();
            }
        });
        
        // 개발자 메뉴 생성
        this.createDeveloperMenu();
        
        console.log('[WallViewer] ✓ 개발 도구 활성화');
    }
    
    /**
     * 개발자 메뉴 생성
     */
    createDeveloperMenu() {
        const menu = document.createElement('div');
        menu.id = 'developer-menu';
        menu.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            max-width: 300px;
        `;
        
        menu.innerHTML = `
            <div><strong>개발자 도구</strong></div>
            <div>환경: ${CONFIG_MANAGER.environment}</div>
            <div>버전: ${getConfig('app.version', '1.0.0')}</div>
            <div>FPS: <span id="dev-fps">-</span></div>
            <div>메모리: <span id="dev-memory">-</span>MB</div>
            <div style="margin-top: 5px;">
                <button onclick="window.wallViewerApp.showDebugInfo()">디버그</button>
                <button onclick="window.wallViewerApp.showPerformanceInfo()">성능</button>
                <button onclick="window.wallViewerApp.forceReload()">새로고침</button>
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // 실시간 업데이트
        setInterval(() => {
            document.getElementById('dev-fps').textContent = this.performanceMonitor.fps;
            document.getElementById('dev-memory').textContent = this.performanceMonitor.memoryUsage;
        }, 1000);
    }
    
    /**
     * 에러 핸들러들
     */
    handleInitializationError(error) {
        console.error('[WallViewer] 초기화 에러:', error);
        this.errorHistory.push({
            type: 'initialization',
            error: error.message,
            timestamp: Date.now(),
            attempt: this.initializationAttempts
        });
        
        // 재시도 로직
        if (this.initializationAttempts < this.maxInitAttempts) {
            const delay = Math.pow(2, this.initializationAttempts) * 1000; // 지수 백오프
            console.log(`[WallViewer] ${delay}ms 후 재시도...`);
            
            setTimeout(() => {
                this.initialize();
            }, delay);
        } else {
            // 최종 실패
            this.showFatalError(error);
        }
    }
    
    handleGlobalError(error, type, filename = '', lineno = 0) {
        console.error(`[WallViewer] 글로벌 에러 (${type}):`, error);
        
        this.errorHistory.push({
            type: 'global',
            subtype: type,
            error: error.toString(),
            filename,
            lineno,
            timestamp: Date.now()
        });
        
        // 치명적 에러 확인
        if (this.isCriticalError(error)) {
            this.criticalErrors.push(error);
            this.handleCriticalError(error);
        }
    }
    
    handleResourceError(element, event) {
        console.warn('[WallViewer] 리소스 로드 에러:', element.src || element.href);
        
        // 중요 리소스 실패 시 폴백 시도
        if (element.tagName === 'SCRIPT' && element.src.includes('three')) {
            this.loadThreeJSFallback();
        }
    }
    
    handleApplicationError(error) {
        console.error('[WallViewer] 애플리케이션 에러:', error);
        
        // 에러 리포팅 (선택적)
        if (getConfig('app.enableErrorReporting', false)) {
            this.reportError(error);
        }
    }
    
    handlePerformanceWarning(warning) {
        console.warn('[WallViewer] 성능 경고:', warning);
        
        // 자동 최적화 시도
        if (warning.type === 'low_fps') {
            this.autoOptimizePerformance();
        }
    }
    
    /**
     * 유틸리티 메서드들
     */
    isCriticalError(error) {
        const criticalPatterns = [
            'webgl',
            'three',
            'shader',
            'memory',
            'security'
        ];
        
        const errorString = error.toString().toLowerCase();
        return criticalPatterns.some(pattern => errorString.includes(pattern));
    }
    
    autoOptimizePerformance() {
        console.log('[WallViewer] 자동 성능 최적화 시작...');
        
        // FPS 타겟 감소
        const currentFPS = getConfig('performance.targetFPS');
        setConfig('performance.targetFPS', Math.max(20, currentFPS - 5));
        
        // 그래픽 품질 감소
        setConfig('scene.renderer.antialias', false);
        setConfig('scene.lighting.enableShadows', false);
        
        console.log('[WallViewer] 성능 최적화 적용됨');
    }
    
    showDebugInfo() {
        const info = {
            앱상태: this.app?.getState(),
            성능: this.performanceMonitor,
            에러기록: this.errorHistory.slice(-5),
            설정: {
                환경: CONFIG_MANAGER.environment,
                디버그: getConfig('app.debug'),
                버전: getConfig('app.version')
            }
        };
        
        console.group('[WallViewer] 디버그 정보');
        console.log(info);
        console.groupEnd();
        
        // 비주얼 표시
        alert(JSON.stringify(info, null, 2));
    }
    
    showPerformanceInfo() {
        const perf = this.performanceMonitor;
        const info = `
성능 정보:
- 초기화 시간: ${perf.initTime.toFixed(2)}ms
- 현재 FPS: ${perf.fps}
- 메모리 사용량: ${perf.memoryUsage}MB
- 업타임: ${((performance.now() - perf.startTime) / 1000 / 60).toFixed(1)}분
        `;
        
        console.log('[WallViewer] 성능 정보:', perf);
        alert(info);
    }
    
    forceReload() {
        if (confirm('애플리케이션을 다시 로드하시겠습니까?')) {
            window.location.reload(true);
        }
    }
    
    showLoadingIndicator() {
        // 로딩 인디케이터 표시 로직
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.style.display = 'flex';
        }
    }
    
    hideLoadingIndicator() {
        // 로딩 인디케이터 숨김 로직
        const loading = document.getElementById('loading-screen');
        if (loading) {
            loading.style.display = 'none';
        }
    }
    
    showUserGuide() {
        // 사용자 가이드 표시 로직 (구현 필요)
        console.log('[WallViewer] 사용자 가이드 표시');
    }
    
    showFatalError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #f44336;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            font-family: Arial, sans-serif;
        `;
        
        errorDiv.innerHTML = `
            <div style="text-align: center; max-width: 500px; padding: 20px;">
                <h1>애플리케이션 시작 실패</h1>
                <p>옹벽 3D 뷰어를 시작할 수 없습니다.</p>
                <p><strong>오류:</strong> ${error.message}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; font-size: 16px;">
                    다시 시도
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }
    
    handleCriticalError(error) {
        console.error('[WallViewer] 치명적 에러:', error);
        
        // 긴급 정리
        if (this.app) {
            try {
                this.app.destroy();
            } catch (cleanupError) {
                console.error('[WallViewer] 정리 중 에러:', cleanupError);
            }
        }
    }
    
    loadThreeJSFallback() {
        console.log('[WallViewer] Three.js 폴백 로드 시도...');
        // 폴백 CDN에서 Three.js 로드 시도
    }
    
    reportInitializationSuccess() {
        if (getConfig('app.enableAnalytics', false)) {
            // 성공 통계 전송 (구현 필요)
            console.log('[WallViewer] 초기화 성공 리포트');
        }
    }
    
    reportError(error) {
        if (getConfig('app.enableErrorReporting', false)) {
            // 에러 리포팅 서비스로 전송 (구현 필요)
            console.log('[WallViewer] 에러 리포트:', error);
        }
    }
}

/**
 * 애플리케이션 시작점
 */
async function startApplication() {
    console.log('[WallViewer] ===== 옹벽 3D 뷰어 시작 =====');
    
    const app = new WallViewerApplication();
    
    try {
        await app.initialize();
        console.log('[WallViewer] ===== 시작 완료 =====');
    } catch (error) {
        console.error('[WallViewer] ===== 시작 실패 =====', error);
    }
    
    return app;
}

// DOM 로드 완료 후 시작
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
}

// ES 모듈로 내보내기
export { WallViewerApplication, startApplication };