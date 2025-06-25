// js/main.js
// 새로운 메인 진입점 - 모든 하드코딩 제거 및 모듈화 완성
// 기존 main.js를 완전히 대체하는 개선된 버전

import { AppCore } from './core/AppCore.js';
import { CONFIG_MANAGER, getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 애플리케이션 초기화 및 실행
 * - 환경별 자동 설정
 * - 에러 복구 시스템
 * - 개발 도구 통합
 */
class WallViewerApplication {
    constructor() {
        this.app = null;
        this.initialized = false;
        this.startTime = performance.now();
        
        // 전역 에러 핸들러 설정
        this.setupGlobalErrorHandling();
        
        console.log(`[WallViewer] 애플리케이션 시작 - 환경: ${CONFIG_MANAGER.environment}`);
    }
    
    /**
     * 메인 초기화 함수
     */
    async initialize() {
        try {
            // 1. 환경 설정 최적화
            this.optimizeForEnvironment();
            
            // 2. DOM 준비 대기
            await this.waitForDOM();
            
            // 3. 추가 설정 로드 (사용자 정의)
            await this.loadUserConfigurations();
            
            // 4. AppCore 생성 및 초기화
            await this.createAndInitializeApp();
            
            // 5. 개발 도구 설정
            this.setupDevTools();
            
            // 6. 성능 모니터링 시작
            this.startPerformanceMonitoring();
            
            const initTime = ((performance.now() - this.startTime) / 1000).toFixed(2);
            console.log(`[WallViewer] 초기화 완료 (${initTime}초)`);
            
            this.initialized = true;
            
            // 초기화 완료 이벤트 발생
            this.dispatchCustomEvent('wallviewer:initialized', {
                app: this.app,
                initTime: parseFloat(initTime)
            });
            
        } catch (error) {
            console.error('[WallViewer] 초기화 실패:', error);
            await this.handleInitializationFailure(error);
        }
    }
    
    /**
     * 환경별 설정 최적화
     */
    optimizeForEnvironment() {
        const env = CONFIG_MANAGER.environment;
        
        console.log(`[WallViewer] 환경 최적화: ${env}`);
        
        if (env === 'development') {
            // 개발 환경 최적화
            setConfig('app.debug', true);
            setConfig('app.verbose', true);
            setConfig('timing.maxRetryAttempts', 50);
            setConfig('devTools.showStats', true);
            setConfig('errors.autoRecovery', false); // 개발 시 에러 확인용
            
            // 개발용 글로벌 참조
            window.CONFIG_MANAGER = CONFIG_MANAGER;
            window.getConfig = getConfig;
            window.setConfig = setConfig;
            
        } else {
            // 프로덕션 환경 최적화
            setConfig('app.debug', false);
            setConfig('app.verbose', false);
            setConfig('timing.maxRetryAttempts', 10);
            setConfig('performance.enableLOD', true);
            setConfig('errors.autoRecovery', true);
            setConfig('errors.reportErrors', true);
        }
        
        // 디바이스별 최적화
        this.optimizeForDevice();
    }
    
    /**
     * 디바이스별 최적화
     */
    optimizeForDevice() {
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLowEnd = navigator.hardwareConcurrency <= 2;
        
        if (isMobile || isLowEnd) {
            console.log('[WallViewer] 저사양 디바이스 감지 - 성능 최적화 적용');
            
            // 저사양 디바이스 최적화
            setConfig('scene.renderer.shadowMapSize', 512);
            setConfig('scene.renderer.pixelRatio', 1);
            setConfig('performance.maxTriangles', 500000);
            setConfig('performance.maxTextureSize', 1024);
            setConfig('performance.enableLOD', true);
            setConfig('performance.targetFPS', 30);
        }
    }
    
    /**
     * DOM 준비 대기
     */
    async waitForDOM() {
        const maxWaitTime = getConfig('timing.loadingTimeout');
        const checkInterval = 50;
        let waited = 0;
        
        return new Promise((resolve, reject) => {
            const checkDOM = () => {
                if (document.readyState === 'complete' || document.readyState === 'interactive') {
                    console.log('[WallViewer] ✓ DOM 준비 완료');
                    resolve();
                    return;
                }
                
                waited += checkInterval;
                if (waited >= maxWaitTime) {
                    reject(new Error('DOM 로딩 타임아웃'));
                    return;
                }
                
                setTimeout(checkDOM, checkInterval);
            };
            
            checkDOM();
        });
    }
    
    /**
     * 사용자 정의 설정 로드
     */
    async loadUserConfigurations() {
        try {
            // URL 파라미터에서 설정 가져오기
            const urlParams = new URLSearchParams(window.location.search);
            
            // 지원되는 URL 설정들
            const urlConfigs = {
                'debug': 'app.debug',
                'theme': 'ui.theme',
                'lang': 'ui.language',
                'quality': 'performance.targetFPS',
                'fov': 'scene.camera.fov'
            };
            
            Object.entries(urlConfigs).forEach(([param, configKey]) => {
                const value = urlParams.get(param);
                if (value !== null) {
                    try {
                        const parsedValue = this.parseConfigValue(value);
                        setConfig(configKey, parsedValue);
                        console.log(`[WallViewer] URL 설정 적용: ${configKey} = ${parsedValue}`);
                    } catch (error) {
                        console.warn(`[WallViewer] URL 설정 파싱 실패: ${param}=${value}`);
                    }
                }
            });
            
            // localStorage에서 사용자 설정 복원
            await this.loadUserPreferences();
            
        } catch (error) {
            console.warn('[WallViewer] 사용자 설정 로드 실패:', error);
        }
    }
    
    /**
     * 사용자 기본 설정 로드
     */
    async loadUserPreferences() {
        try {
            const saved = localStorage.getItem('wallviewer-preferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                
                // 허용된 설정만 적용
                const allowedKeys = [
                    'ui.theme',
                    'ui.language',
                    'animation.defaultSpeed',
                    'scene.camera.fov'
                ];
                
                allowedKeys.forEach(key => {
                    if (preferences[key] !== undefined) {
                        setConfig(key, preferences[key]);
                    }
                });
                
                console.log('[WallViewer] 사용자 기본 설정 복원됨');
            }
        } catch (error) {
            console.warn('[WallViewer] 기본 설정 복원 실패:', error);
        }
    }
    
    /**
     * 설정값 파싱
     */
    parseConfigValue(value) {
        // 불린값
        if (value === 'true') return true;
        if (value === 'false') return false;
        
        // 숫자값
        const num = parseFloat(value);
        if (!isNaN(num)) return num;
        
        // 문자열
        return value;
    }
    
    /**
     * AppCore 생성 및 초기화
     */
    async createAndInitializeApp() {
        // 컨테이너 결정
        const containerSelector = getConfig('selectors.canvasContainer', '#canvas-container');
        
        console.log(`[WallViewer] AppCore 생성 중... (컨테이너: ${containerSelector})`);
        
        // AppCore 인스턴스 생성
        this.app = new AppCore(containerSelector, {
            environment: CONFIG_MANAGER.environment,
            startTime: this.startTime
        });
        
        // 이벤트 리스너 설정
        this.setupAppEventListeners();
        
        // 초기화 실행
        await this.app.init();
        
        // 전역 접근 (디버깅용)
        if (getConfig('app.debug')) {
            window.wallViewerApp = this.app;
            window.wallViewer = this;
            console.log('[WallViewer] 전역 접근 활성화');
        }
    }
    
    /**
     * 앱 이벤트 리스너 설정
     */
    setupAppEventListeners() {
        this.app.on('loading:start', () => {
            console.log('[WallViewer] 로딩 시작');
            this.showLoadingIndicator();
        });
        
        this.app.on('loading:progress', (progress) => {
            this.updateLoadingProgress(progress);
        });
        
        this.app.on('model:loaded', (index, result) => {
            console.log(`[WallViewer] 모델 로드 완료: ${index} (${result.loadTime}초)`);
            this.hideLoadingIndicator();
            this.saveUserPreference('lastModel', index);
        });
        
        this.app.on('model:error', (index, error) => {
            console.error(`[WallViewer] 모델 로드 실패: ${index}`, error);
            this.showErrorNotification(`모델 로드 실패: ${error.message}`);
        });
        
        this.app.on('error', (error) => {
            console.error('[WallViewer] 앱 오류:', error);
            this.handleAppError(error);
        });
    }
    
    /**
     * 개발 도구 설정
     */
    setupDevTools() {
        if (!getConfig('app.debug')) return;
        
        console.log('[WallViewer] 개발 도구 설정 중...');
        
        // 통계 표시
        if (getConfig('devTools.showStats')) {
            this.setupStats();
        }
        
        // 키보드 단축키
        this.setupKeyboardShortcuts();
        
        // 성능 모니터링
        this.setupPerformanceMonitoring();
        
        // 개발자 콘솔 메시지
        this.showDevConsoleInfo();
    }
    
    /**
     * Stats.js 설정
     */
    setupStats() {
        try {
            if (typeof Stats !== 'undefined') {
                const stats = new Stats();
                stats.showPanel(0); // FPS 패널
                document.body.appendChild(stats.dom);
                
                // 애니메이션 루프에 연결
                this.app.on('render', () => {
                    stats.update();
                });
                
                console.log('[WallViewer] ✓ Stats.js 활성화');
            }
        } catch (error) {
            console.warn('[WallViewer] Stats.js 설정 실패:', error);
        }
    }
    
    /**
     * 키보드 단축키 설정
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + 조합키만 처리
            if (!event.ctrlKey && !event.metaKey) return;
            
            switch (event.code) {
                case 'KeyD': // Ctrl+D: 디버그 정보 토글
                    event.preventDefault();
                    this.toggleDebugInfo();
                    break;
                    
                case 'KeyR': // Ctrl+R: 앱 재시작 (개발 모드만)
                    if (event.shiftKey) {
                        event.preventDefault();
                        this.restartApp();
                    }
                    break;
                    
                case 'KeyS': // Ctrl+S: 스크린샷
                    event.preventDefault();
                    this.takeScreenshot();
                    break;
                    
                case 'KeyH': // Ctrl+H: 도움말
                    event.preventDefault();
                    this.showKeyboardHelp();
                    break;
            }
        });
        
        console.log('[WallViewer] ✓ 키보드 단축키 활성화');
    }
    
    /**
     * 성능 모니터링 시작
     */
    startPerformanceMonitoring() {
        if (!getConfig('performance.adaptiveQuality')) return;
        
        const targetFPS = getConfig('performance.targetFPS');
        let frameCount = 0;
        let lastTime = performance.now();
        let avgFPS = targetFPS;
        
        const monitor = () => {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - lastTime >= 1000) { // 1초마다 측정
                avgFPS = frameCount;
                frameCount = 0;
                lastTime = currentTime;
                
                // 성능 자동 조절
                this.adjustQualityBasedOnFPS(avgFPS, targetFPS);
            }
            
            if (this.app && this.app.isRunning) {
                requestAnimationFrame(monitor);
            }
        };
        
        requestAnimationFrame(monitor);
        console.log('[WallViewer] ✓ 성능 모니터링 시작');
    }
    
    /**
     * FPS 기반 품질 자동 조절
     */
    adjustQualityBasedOnFPS(currentFPS, targetFPS) {
        const fpsRatio = currentFPS / targetFPS;
        
        if (fpsRatio < 0.8) { // 80% 미만일 때 품질 하향
            const currentPixelRatio = getConfig('scene.renderer.pixelRatio');
            if (currentPixelRatio > 1) {
                setConfig('scene.renderer.pixelRatio', Math.max(1, currentPixelRatio - 0.1));
                console.log(`[WallViewer] 성능 최적화: pixelRatio 감소 → ${getConfig('scene.renderer.pixelRatio')}`);
            }
        } else if (fpsRatio > 1.2) { // 120% 초과일 때 품질 상향
            const currentPixelRatio = getConfig('scene.renderer.pixelRatio');
            const maxPixelRatio = Math.min(window.devicePixelRatio, 2);
            if (currentPixelRatio < maxPixelRatio) {
                setConfig('scene.renderer.pixelRatio', Math.min(maxPixelRatio, currentPixelRatio + 0.1));
                console.log(`[WallViewer] 품질 향상: pixelRatio 증가 → ${getConfig('scene.renderer.pixelRatio')}`);
            }
        }
    }
    
    /**
     * 전역 에러 핸들링 설정
     */
    setupGlobalErrorHandling() {
        // 개발 모드에서는 에러를 더 상세히 표시
        const showDetailedErrors = getConfig('app.debug', false);
        
        window.addEventListener('error', (event) => {
            console.error('[WallViewer] 전역 JavaScript 오류:', {
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error
            });
            
            if (showDetailedErrors) {
                this.showErrorNotification(`JavaScript 오류: ${event.message}`);
            }
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('[WallViewer] 처리되지 않은 Promise 거부:', event.reason);
            
            if (showDetailedErrors) {
                this.showErrorNotification(`Promise 오류: ${event.reason}`);
            }
        });
    }
    
    /**
     * 로딩 인디케이터 표시
     */
    showLoadingIndicator() {
        const loadingSelector = getConfig('selectors.loadingScreen');
        const loadingElement = document.querySelector(loadingSelector);
        
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
    }
    
    /**
     * 로딩 진행률 업데이트
     */
    updateLoadingProgress(progress) {
        const progressSelector = getConfig('selectors.progressBar');
        const textSelector = getConfig('selectors.progressText');
        
        const progressBar = document.querySelector(progressSelector);
        const progressText = document.querySelector(textSelector);
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
    }
    
    /**
     * 로딩 인디케이터 숨김
     */
    hideLoadingIndicator() {
        const loadingSelector = getConfig('selectors.loadingScreen');
        const loadingElement = document.querySelector(loadingSelector);
        
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
    
    /**
     * 에러 알림 표시
     */
    showErrorNotification(message) {
        console.error('[WallViewer] 오류:', message);
        
        // 간단한 토스트 알림
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            max-width: 400px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(toast);
        
        // 3초 후 자동 제거
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, getConfig('ui.notificationDuration'));
    }
    
    /**
     * 사용자 기본 설정 저장
     */
    saveUserPreference(key, value) {
        try {
            const saved = localStorage.getItem('wallviewer-preferences');
            const preferences = saved ? JSON.parse(saved) : {};
            preferences[key] = value;
            localStorage.setItem('wallviewer-preferences', JSON.stringify(preferences));
        } catch (error) {
            console.warn('[WallViewer] 기본 설정 저장 실패:', error);
        }
    }
    
    /**
     * 커스텀 이벤트 발생
     */
    dispatchCustomEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        window.dispatchEvent(event);
    }
    
    /**
     * 초기화 실패 처리
     */
    async handleInitializationFailure(error) {
        console.error('[WallViewer] 치명적 오류 - 애플리케이션을 시작할 수 없습니다:', error);
        
        // 사용자에게 친화적인 오류 메시지 표시
        const container = document.querySelector(getConfig('selectors.canvasContainer', 'body'));
        if (container) {
            container.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    background: linear-gradient(135deg, #1e1e1e, #2a2a2a);
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    text-align: center;
                    padding: 20px;
                ">
                    <div style="
                        background: rgba(255, 107, 107, 0.1);
                        border: 1px solid #ff6b6b;
                        border-radius: 12px;
                        padding: 30px;
                        max-width: 500px;
                        backdrop-filter: blur(10px);
                    ">
                        <h2 style="color: #ff6b6b; margin: 0 0 20px 0; font-weight: 600;">
                            ⚠️ 로딩 실패
                        </h2>
                        <p style="margin: 0 0 15px 0; opacity: 0.9; line-height: 1.5;">
                            3D 뷰어를 시작할 수 없습니다.<br>
                            브라우저 호환성을 확인하거나 페이지를 새로고침해주세요.
                        </p>
                        <div style="margin: 20px 0;">
                            <button onclick="location.reload()" style="
                                background: #007bff;
                                color: white;
                                border: none;
                                padding: 12px 24px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                                margin-right: 10px;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007bff'">
                                🔄 새로고침
                            </button>
                            <button onclick="this.parentElement.parentElement.querySelector('details').open = !this.parentElement.parentElement.querySelector('details').open" style="
                                background: transparent;
                                color: #ccc;
                                border: 1px solid #666;
                                padding: 12px 24px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 14px;
                            ">
                                🔍 자세히
                            </button>
                        </div>
                        <details style="margin-top: 20px; text-align: left;">
                            <summary style="cursor: pointer; opacity: 0.7; font-size: 13px;">기술적 세부사항</summary>
                            <pre style="
                                background: rgba(0,0,0,0.3);
                                padding: 15px;
                                margin-top: 10px;
                                border-radius: 6px;
                                font-size: 11px;
                                overflow: auto;
                                white-space: pre-wrap;
                                word-wrap: break-word;
                            ">${error.message}

${error.stack || 'Stack trace not available'}</pre>
                        </details>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * 개발자 콘솔 정보 표시
     */
    showDevConsoleInfo() {
        const styles = {
            title: 'font-size: 20px; font-weight: bold; color: #00ff88;',
            info: 'font-size: 14px; color: #00aaff;',
            command: 'font-size: 12px; color: #ffaa00; font-family: monospace;'
        };
        
        console.log('%c🏗️ Wall 3D Viewer - 개발 모드', styles.title);
        console.log('%c개발자 도구가 활성화되었습니다.', styles.info);
        console.log('%c\n사용 가능한 전역 객체:', styles.info);
        console.log('%c• window.wallViewerApp - 메인 앱 인스턴스', styles.command);
        console.log('%c• window.wallViewer - 애플리케이션 래퍼', styles.command);
        console.log('%c• window.CONFIG_MANAGER - 설정 매니저', styles.command);
        console.log('%c• getConfig(key) - 설정 가져오기', styles.command);
        console.log('%c• setConfig(key, value) - 설정 변경', styles.command);
        console.log('%c\n키보드 단축키:', styles.info);
        console.log('%c• Ctrl+D - 디버그 정보 토글', styles.command);
        console.log('%c• Ctrl+Shift+R - 앱 재시작', styles.command);
        console.log('%c• Ctrl+S - 스크린샷', styles.command);
        console.log('%c• Ctrl+H - 도움말', styles.command);
    }
    
    /**
     * 디버그 정보 토글
     */
    toggleDebugInfo() {
        if (this.app) {
            this.app.debug();
            CONFIG_MANAGER.debug();
        }
    }
    
    /**
     * 앱 재시작 (개발 모드)
     */
    async restartApp() {
        if (!getConfig('app.debug')) return;
        
        console.log('[WallViewer] 앱 재시작 중...');
        
        if (this.app) {
            this.app.destroy();
        }
        
        this.initialized = false;
        this.startTime = performance.now();
        
        await this.initialize();
    }
    
    /**
     * 스크린샷 촬영
     */
    takeScreenshot() {
        if (this.app && this.app.sceneManager) {
            this.app.sceneManager.takeScreenshot();
        }
    }
    
    /**
     * 키보드 도움말 표시
     */
    showKeyboardHelp() {
        console.group('🎮 키보드 단축키');
        console.log('Ctrl+D: 디버그 정보 출력');
        console.log('Ctrl+Shift+R: 앱 재시작 (개발 모드)');
        console.log('Ctrl+S: 스크린샷 촬영');
        console.log('Ctrl+H: 이 도움말');
        console.groupEnd();
    }
}

/**
 * 애플리케이션 시작 함수
 */
async function startWallViewer() {
    const viewer = new WallViewerApplication();
    await viewer.initialize();
    return viewer;
}

/**
 * DOM이 준비되면 자동 시작
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWallViewer);
} else {
    startWallViewer();
}

// ES 모듈 내보내기
export { WallViewerApplication, startWallViewer };
export default startWallViewer;