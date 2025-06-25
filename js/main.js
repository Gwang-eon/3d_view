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
            
            // 9. 초기 모델 로드 (URL 파라미터 확인)
            await this.loadInitialModel();
            
            // 10. 초기화 완료
            this.initialized = true;
            this.performanceMonitor.initTime = performance.now() - this.startTime;
            
            console.log(`[WallViewer] ===== 초기화 완료 (${this.performanceMonitor.initTime.toFixed(2)}ms) =====`);
            
            // 성공 리포트
            this.reportInitializationSuccess();
            
            return this.app;
            
        } catch (error) {
            console.error('[WallViewer] 초기화 실패:', error);
            
            // 재시도 로직
            if (this.initializationAttempts < this.maxInitAttempts) {
                console.log(`[WallViewer] ${getConfig('timing.retryDelay')}ms 후 재시도...`);
                await this.sleep(getConfig('timing.retryDelay'));
                return this.initialize();
            }
            
            // 최종 실패
            this.handleCriticalError(error);
            throw error;
        }
    }
    
    /**
     * 사전 초기화 검증
     */
    async preInitializationChecks() {
        // 브라우저 호환성 확인
        if (!this.checkBrowserCompatibility()) {
            throw new Error('지원하지 않는 브라우저입니다.');
        }
        
        // 필수 API 확인
        const requiredAPIs = ['fetch', 'Promise', 'requestAnimationFrame'];
        for (const api of requiredAPIs) {
            if (!(api in window)) {
                throw new Error(`필수 API가 없습니다: ${api}`);
            }
        }
    }
    
    /**
     * 브라우저 호환성 확인
     */
    checkBrowserCompatibility() {
        // WebGL 지원 확인
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            console.error('[WallViewer] WebGL을 지원하지 않는 브라우저입니다.');
            return false;
        }
        
        return true;
    }
    
    /**
     * 환경별 최적화 설정
     */
    optimizeForEnvironment() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLowEnd = navigator.hardwareConcurrency <= 2;
        
        if (isMobile || isLowEnd) {
            console.log('[WallViewer] 모바일/저사양 디바이스 감지 - 성능 최적화 적용');
            
            // 성능 설정 조정
            setConfig('performance.targetFPS', 30);
            setConfig('scene.renderer.antialias', false);
            setConfig('scene.renderer.shadows', false);
            setConfig('scene.renderer.pixelRatio', Math.min(window.devicePixelRatio, 1.5));
        }
        
        // 네트워크 상태 기반 최적화
        if ('connection' in navigator) {
            const connection = navigator.connection;
            if (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                console.log('[WallViewer] 느린 네트워크 감지 - 리소스 최적화 적용');
                setConfig('models.autoLoadTextures', false);
            }
        }
    }
    
    /**
     * DOM 준비 대기
     */
    async waitForDOM() {
        return new Promise((resolve) => {
            const checkReady = () => {
                if (document.readyState === 'complete' || 
                    (document.readyState === 'interactive' && document.body)) {
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
            this.saveLastModel(modelIndex);
        });
        
        // 성능 이벤트
        this.app.on('performance:warning', (data) => {
            console.warn('[WallViewer] 성능 경고:', data);
            this.handlePerformanceWarning(data);
        });
    }
    
    /**
     * 성능 모니터링 시작
     */
    startPerformanceMonitoring() {
        if (!getConfig('performance.enableMonitoring', true)) return;
        
        let frameCount = 0;
        let lastTime = performance.now();
        
        const monitor = () => {
            frameCount++;
            const currentTime = performance.now();
            
            // 1초마다 FPS 계산
            if (currentTime - lastTime >= 1000) {
                this.performanceMonitor.fps = frameCount;
                frameCount = 0;
                lastTime = currentTime;
                
                // 메모리 사용량 (가능한 경우)
                if (performance.memory) {
                    this.performanceMonitor.memoryUsage = performance.memory.usedJSHeapSize / 1048576; // MB
                }
                
                // 성능 임계값 체크
                if (this.performanceMonitor.fps < getConfig('performance.minAcceptableFPS', 20)) {
                    this.app.emit('performance:warning', {
                        fps: this.performanceMonitor.fps,
                        memory: this.performanceMonitor.memoryUsage
                    });
                }
                
                // 디버그 모드에서 콘솔 출력
                if (getConfig('app.debug') && getConfig('performance.logMetrics', false)) {
                    console.log(`[Performance] FPS: ${this.performanceMonitor.fps}, Memory: ${this.performanceMonitor.memoryUsage.toFixed(2)}MB`);
                }
            }
            
            requestAnimationFrame(monitor);
        };
        
        requestAnimationFrame(monitor);
    }
    
    /**
     * 초기 모델 로드
     */
    async loadInitialModel() {
        const params = new URLSearchParams(window.location.search);
        const modelParam = params.get('model');
        
        if (modelParam !== null) {
            // URL 파라미터로 지정된 모델 로드
            const modelIndex = parseInt(modelParam, 10);
            if (!isNaN(modelIndex)) {
                console.log(`[WallViewer] URL 파라미터로 모델 ${modelIndex} 로드 시도`);
                try {
                    await this.app.loadModel(modelIndex);
                } catch (error) {
                    console.error('[WallViewer] 초기 모델 로드 실패:', error);
                }
            }
        } else {
            // 마지막으로 사용한 모델 로드
            const lastModel = this.loadFromLocalStorage('wall_viewer_last_model');
            if (lastModel !== null && getConfig('ui.rememberLastModel', true)) {
                console.log(`[WallViewer] 마지막 사용 모델 ${lastModel} 로드 시도`);
                try {
                    await this.app.loadModel(lastModel);
                } catch (error) {
                    console.error('[WallViewer] 마지막 모델 로드 실패:', error);
                }
            }
        }
    }
    
    /**
     * 마지막 모델 저장
     */
    saveLastModel(modelIndex) {
        try {
            localStorage.setItem('wall_viewer_last_model', modelIndex.toString());
        } catch (error) {
            console.warn('[WallViewer] 마지막 모델 저장 실패:', error);
        }
    }
    
    /**
     * 글로벌 에러 핸들링 설정
     */
    setupGlobalErrorHandling() {
        // 전역 에러 핸들러
        window.addEventListener('error', (event) => {
            console.error('[WallViewer] 전역 에러:', event.error);
            this.errorHistory.push({
                type: 'error',
                message: event.message,
                stack: event.error?.stack,
                timestamp: Date.now()
            });
            
            // 치명적 에러 판단
            if (this.isCriticalError(event.error)) {
                this.criticalErrors.push(event.error);
                this.handleCriticalError(event.error);
            }
        });
        
        // Promise rejection 핸들러
        window.addEventListener('unhandledrejection', (event) => {
            console.error('[WallViewer] 처리되지 않은 Promise 거부:', event.reason);
            this.errorHistory.push({
                type: 'unhandledRejection',
                reason: event.reason,
                timestamp: Date.now()
            });
            
            // 개발 모드에서는 거부 방지 (디버깅 용이)
            if (getConfig('app.debug')) {
                event.preventDefault();
            }
        });
    }
    
    /**
     * 치명적 에러 판단
     */
    isCriticalError(error) {
        if (!error) return false;
        
        const criticalPatterns = [
            /WebGL/i,
            /THREE\./,
            /Cannot read prop/,
            /undefined is not/,
            /Maximum call stack/
        ];
        
        return criticalPatterns.some(pattern => pattern.test(error.message || error.toString()));
    }
    
    /**
     * 치명적 에러 처리
     */
    handleCriticalError(error) {
        console.error('[WallViewer] 치명적 에러 발생:', error);
        
        // 에러 화면 표시
        this.showErrorScreen(error);
        
        // 에러 리포팅 (프로덕션)
        if (CONFIG_MANAGER.environment === 'production') {
            this.reportError(error);
        }
        
        // 복구 시도
        if (getConfig('app.autoRecover', true)) {
            this.attemptRecovery();
        }
    }
    
    /**
     * 애플리케이션 에러 처리
     */
    handleApplicationError(error) {
        console.error('[WallViewer] 애플리케이션 에러:', error);
        
        // 에러 메시지 표시
        this.showErrorMessage(error.message || '알 수 없는 오류가 발생했습니다.');
        
        // 에러 기록
        this.errorHistory.push({
            type: 'application',
            error: error,
            timestamp: Date.now()
        });
    }
    
    /**
     * 성능 경고 처리
     */
    handlePerformanceWarning(data) {
        if (getConfig('performance.autoOptimize', true)) {
            console.log('[WallViewer] 자동 성능 최적화 실행');
            
            // 렌더링 품질 조정
            if (data.fps < 15) {
                setConfig('scene.renderer.pixelRatio', 1);
                setConfig('scene.renderer.antialias', false);
                this.app.updateRendererSettings();
            }
            
            // 메모리 정리
            if (data.memory > 500) { // 500MB 이상
                this.app.clearUnusedResources();
            }
        }
    }
    
    /**
     * 복구 시도
     */
    async attemptRecovery() {
        console.log('[WallViewer] 자동 복구 시도...');
        
        try {
            // 현재 상태 저장
            const currentState = this.app?.getState();
            
            // 앱 정리
            if (this.app) {
                this.app.destroy();
                this.app = null;
            }
            
            // 짧은 대기
            await this.sleep(1000);
            
            // 재초기화
            await this.initialize();
            
            // 상태 복원
            if (currentState && this.app) {
                this.app.restoreState(currentState);
            }
            
            console.log('[WallViewer] 복구 성공');
            
        } catch (error) {
            console.error('[WallViewer] 복구 실패:', error);
            this.showFatalErrorScreen();
        }
    }
    
    /**
     * 개발 도구 설정
     */
    setupDevelopmentTools() {
        // 개발자 콘솔 명령어
        window.wallViewer = {
            // 상태 정보
            getState: () => ({
                app: this.app?.getState(),
                performance: this.performanceMonitor,
                errors: this.errorHistory,
                config: CONFIG_MANAGER.getAll()
            }),
            
            // 설정 변경
            setConfig: (key, value) => setConfig(key, value),
            getConfig: (key) => getConfig(key),
            
            // 디버그 명령
            debug: {
                showConfig: () => CONFIG_MANAGER.debug(),
                showServices: () => this.app?.debug(),
                clearErrors: () => { this.errorHistory = []; },
                triggerError: () => { throw new Error('Test error'); }
            },
            
            // 성능 명령
            performance: {
                getMetrics: () => this.performanceMonitor,
                runBenchmark: () => this.runPerformanceBenchmark()
            },
            
            // 모델 관련
            models: {
                list: () => getConfig('models', []),
                load: (index) => this.app?.loadModel(index),
                reload: () => this.app?.reloadCurrentModel()
            }
        };
        
        console.log('[WallViewer] 개발 도구 활성화. window.wallViewer로 접근 가능');
        console.log('사용 가능한 명령어: wallViewer.debug.showConfig(), wallViewer.models.list() 등');
    }
    
    /**
     * 성능 벤치마크
     */
    async runPerformanceBenchmark() {
        console.log('[WallViewer] 성능 벤치마크 시작...');
        
        const results = {
            renderTime: [],
            frameTime: [],
            memoryUsage: []
        };
        
        const startTime = performance.now();
        const duration = 5000; // 5초간 테스트
        
        while (performance.now() - startTime < duration) {
            const frameStart = performance.now();
            
            // 강제 렌더링
            if (this.app?.sceneManager) {
                this.app.sceneManager.render();
            }
            
            const frameEnd = performance.now();
            results.frameTime.push(frameEnd - frameStart);
            
            if (performance.memory) {
                results.memoryUsage.push(performance.memory.usedJSHeapSize / 1048576);
            }
            
            await this.sleep(16); // 약 60fps
        }
        
        // 결과 분석
        const avgFrameTime = results.frameTime.reduce((a, b) => a + b, 0) / results.frameTime.length;
        const avgFPS = 1000 / avgFrameTime;
        const avgMemory = results.memoryUsage.length > 0 ? 
            results.memoryUsage.reduce((a, b) => a + b, 0) / results.memoryUsage.length : 0;
        
        const benchmarkResults = {
            avgFPS: avgFPS.toFixed(2),
            avgFrameTime: avgFrameTime.toFixed(2) + 'ms',
            avgMemory: avgMemory.toFixed(2) + 'MB',
            samples: results.frameTime.length
        };
        
        console.log('[WallViewer] 벤치마크 완료:', benchmarkResults);
        return benchmarkResults;
    }
    
    /**
     * UI 헬퍼 메서드들
     */
    showLoadingIndicator() {
        const loadingEl = document.querySelector(getConfig('selectors.loading', '#loading'));
        if (loadingEl) {
            loadingEl.style.display = 'flex';
        }
    }
    
    hideLoadingIndicator() {
        const loadingEl = document.querySelector(getConfig('selectors.loading', '#loading'));
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
    
    showErrorMessage(message) {
        const errorEl = document.querySelector(getConfig('selectors.error', '#error'));
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            
            // 자동 숨김
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, getConfig('ui.errorMessageDuration', 5000));
        }
    }
    
    showErrorScreen(error) {
        // 에러 화면 생성 또는 표시
        let errorScreen = document.getElementById('critical-error-screen');
        if (!errorScreen) {
            errorScreen = document.createElement('div');
            errorScreen.id = 'critical-error-screen';
            errorScreen.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: monospace;
                padding: 20px;
            `;
            
            errorScreen.innerHTML = `
                <div style="max-width: 600px; text-align: center;">
                    <h1 style="color: #ff6b6b; margin-bottom: 20px;">오류 발생</h1>
                    <p style="margin-bottom: 20px;">${error.message || '알 수 없는 오류가 발생했습니다.'}</p>
                    <button onclick="location.reload()" style="
                        padding: 10px 20px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                    ">페이지 새로고침</button>
                </div>
            `;
            
            document.body.appendChild(errorScreen);
        }
    }
    
    showFatalErrorScreen() {
        document.body.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                background: #1a1a1a;
                color: white;
                font-family: monospace;
                text-align: center;
                padding: 20px;
            ">
                <div>
                    <h1 style="color: #ff6b6b; margin-bottom: 20px;">치명적 오류</h1>
                    <p style="margin-bottom: 20px;">애플리케이션을 복구할 수 없습니다.</p>
                    <p style="margin-bottom: 30px; color: #888;">페이지를 새로고침하거나 브라우저 캐시를 삭제해주세요.</p>
                    <button onclick="location.reload(true)" style="
                        padding: 10px 20px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                        margin-right: 10px;
                    ">강제 새로고침</button>
                    <button onclick="window.wallViewer?.debug?.showConfig?.()" style="
                        padding: 10px 20px;
                        background: #666;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                    ">디버그 정보</button>
                </div>
            </div>
        `;
    }
    
    /**
     * 유틸리티 메서드
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 초기화 성공 리포트
     */
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