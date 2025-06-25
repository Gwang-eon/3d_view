// viewer-main.js - 수정된 3D 뷰어 메인 애플리케이션
'use strict';

import { CONFIG } from './config.js';
import { CONFIG_MANAGER, getConfig, setConfig } from './core/ConfigManager.js';
import SceneManager from './SceneManager.js';
import ModelLoader from './ModelLoader.js';
import UIController from './UIController.js';
import { HotspotManager } from './HotspotManager.js';
import { AnimationController } from './AnimationController.js';

/**
 * 3D 뷰어 애플리케이션
 * - 모듈식 구조
 * - 이벤트 기반 통신
 * - 향상된 에러 처리
 * - URL 파라미터 지원
 */
class ViewerApplication {
    constructor() {
        // 모듈 인스턴스
        this.sceneManager = null;
        this.modelLoader = null;
        this.uiController = null;
        this.hotspotManager = null;
        this.animationController = null;
        
        // 상태
        this.isInitialized = false;
        this.currentModelIndex = null;
        this.urlParams = new URLSearchParams(window.location.search);
        
        // 성능 모니터링
        this.stats = {
            fps: 0,
            frameCount: 0,
            lastTime: performance.now()
        };
        
        console.log('[ViewerApp] 생성됨');
    }
    
    /**
     * 애플리케이션 초기화
     */
    async init() {
        console.log('[ViewerApp] === 3D 뷰어 초기화 시작 ===');
        
        try {
            // 1. 환경 설정
            this.setupEnvironment();
            
            // 2. DOM 준비 확인
            await this.waitForDOM();
            console.log('[ViewerApp] ✓ DOM 준비 완료');
            
            // 3. 의존성 확인
            await this.checkDependencies();
            console.log('[ViewerApp] ✓ 의존성 확인 완료');
            
            // 4. 모듈 초기화
            await this.initializeModules();
            console.log('[ViewerApp] ✓ 모듈 초기화 완료');
            
            // 5. 모듈 간 연결 설정
            this.setupModuleConnections();
            console.log('[ViewerApp] ✓ 모듈 연결 완료');
            
            // 6. UI 설정
            this.setupUI();
            console.log('[ViewerApp] ✓ UI 설정 완료');
            
            // 7. URL 파라미터 처리
            await this.handleURLParameters();
            
            // 8. 초기화 완료
            this.isInitialized = true;
            this.emit('initialized');
            
            console.log('[ViewerApp] === 초기화 완료 ===');
            
            // 초기 상태 UI 표시
            this.showInitialUI();
            
        } catch (error) {
            console.error('[ViewerApp] 초기화 실패:', error);
            this.showError('애플리케이션을 초기화할 수 없습니다: ' + error.message);
            throw error;
        }
    }
    
    /**
     * 환경 설정
     */
    setupEnvironment() {
        // Three.js 전역 설정
        if (window.THREE) {
            THREE.Cache.enabled = getConfig('app.enableCache', true);
        }
        
        // 디버그 모드 설정
        if (getConfig('app.debug')) {
            window.viewerDebug = {
                app: this,
                getModule: (name) => this[name],
                getConfig: (path) => getConfig(path),
                setConfig: (path, value) => setConfig(path, value)
            };
        }
    }
    
    /**
     * DOM 준비 대기
     */
    async waitForDOM() {
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // 필수 DOM 요소 확인
        const requiredElements = [
            'canvas-container',
            'ui-container',
            'loading',
            'error'
        ];
        
        for (const id of requiredElements) {
            if (!document.getElementById(id)) {
                throw new Error(`필수 DOM 요소가 없습니다: #${id}`);
            }
        }
    }
    
    /**
     * 의존성 확인
     */
    async checkDependencies() {
        // CONFIG 확인
        if (!window.CONFIG) {
            throw new Error('CONFIG가 정의되지 않았습니다. config.js를 확인하세요.');
        }
        
        // Three.js 확인
        const maxAttempts = getConfig('timing.maxRetryAttempts', 20);
        const retryDelay = getConfig('timing.retryDelay', 100);
        
        for (let i = 0; i < maxAttempts; i++) {
            if (window.THREE && window.THREE.GLTFLoader && window.THREE.OrbitControls) {
                return true;
            }
            await this.sleep(retryDelay);
        }
        
        throw new Error('Three.js 라이브러리를 로드할 수 없습니다.');
    }
    
    /**
     * 모듈 초기화
     */
    async initializeModules() {
        // SceneManager
        this.sceneManager = new SceneManager();
        await this.sceneManager.init();
        console.log('[ViewerApp] ✓ SceneManager 초기화');
        
        // AnimationController
        this.animationController = new AnimationController();
        console.log('[ViewerApp] ✓ AnimationController 생성');
        
        // HotspotManager
        this.hotspotManager = new HotspotManager(this.sceneManager);
        console.log('[ViewerApp] ✓ HotspotManager 생성');
        
        // ModelLoader - 기본 모델 설정 포함
        this.modelLoader = new ModelLoader(this.sceneManager, this.animationController);
        await this.modelLoader.init();
        
        // 기본 모델 설정
        const models = getConfig('models.defaultModels', []);
        if (models && models.length > 0) {
            const defaultModelIndex = getConfig('models.defaultModel', 0);
            this.modelLoader.setDefaultModel(defaultModelIndex);
        }
        console.log('[ViewerApp] ✓ ModelLoader 초기화');
        
        // UIController
        this.uiController = new UIController(
            this.sceneManager,
            this.modelLoader,
            this.animationController,
            this.hotspotManager
        );
        await this.uiController.init();
        console.log('[ViewerApp] ✓ UIController 초기화');
        
        // 전역 참조 (디버깅용)
        if (getConfig('app.debug')) {
            window.viewerApp = this;
            window.modules = {
                sceneManager: this.sceneManager,
                modelLoader: this.modelLoader,
                uiController: this.uiController,
                animationController: this.animationController,
                hotspotManager: this.hotspotManager
            };
        }
    }
    
    /**
     * 모듈 간 연결 설정
     */
    setupModuleConnections() {
        // ModelLoader -> UIController 이벤트 연결
        this.modelLoader.on('loading:start', (data) => {
            this.uiController.showLoadingScreen(data.message || '모델 로딩 중...');
        });
        
        this.modelLoader.on('loading:progress', (data) => {
            this.uiController.updateLoadingProgress(data.progress, data.message);
        });
        
        this.modelLoader.on('loading:complete', (data) => {
            this.uiController.hideLoadingScreen();
            this.uiController.switchToViewerUI(data.modelInfo);
        });
        
        this.modelLoader.on('loading:error', (error) => {
            this.uiController.hideLoadingScreen();
            this.uiController.showErrorModal(error.message || '모델 로딩 실패');
        });
        
        // SceneManager -> UIController 이벤트 연결
        this.sceneManager.on('stats:updated', (stats) => {
            this.uiController.updateStats(stats);
        });
        
        this.sceneManager.on('camera:change', (data) => {
            this.uiController.updateCameraInfo(data);
        });
        
        // AnimationController -> UIController 이벤트 연결
        this.animationController.on('animation:start', () => {
            this.uiController.updateAnimationControls('playing');
        });
        
        this.animationController.on('animation:pause', () => {
            this.uiController.updateAnimationControls('paused');
        });
        
        this.animationController.on('animation:progress', (progress) => {
            this.uiController.updateAnimationProgress(progress);
        });
    }
    
    /**
     * UI 설정
     */
    setupUI() {
        // 홈 버튼
        const homeBtn = document.getElementById('home-btn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }
        
        // 전체화면 버튼
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }
        
        // 설정 버튼
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.uiController.toggleSettings();
            });
        }
        
        // 정보 버튼
        const infoBtn = document.getElementById('info-btn');
        if (infoBtn) {
            infoBtn.addEventListener('click', () => {
                this.uiController.toggleInfo();
            });
        }
        
        // 카메라 버튼
        const cameraBtn = document.getElementById('camera-btn');
        if (cameraBtn) {
            cameraBtn.addEventListener('click', () => {
                this.uiController.showCameraMenu();
            });
        }
        
        // 모델 선택 버튼
        const modelBtn = document.getElementById('model-btn');
        if (modelBtn) {
            modelBtn.addEventListener('click', () => {
                this.uiController.toggleModelSelector();
            });
        }
        
        // 키보드 단축키
        this.setupKeyboardShortcuts();
    }
    
    /**
     * 키보드 단축키 설정
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd 키가 눌려있을 때만
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'h': // 홈
                        e.preventDefault();
                        window.location.href = 'index.html';
                        break;
                    case 'f': // 전체화면
                        e.preventDefault();
                        this.toggleFullscreen();
                        break;
                    case 's': // 스크린샷
                        e.preventDefault();
                        this.sceneManager.takeScreenshot();
                        break;
                    case 'g': // 그리드 토글
                        e.preventDefault();
                        this.sceneManager.toggleHelpers();
                        break;
                }
            }
            
            // 단독 키
            switch(e.key) {
                case 'Escape':
                    this.uiController.closeAllModals();
                    break;
                case ' ': // 스페이스바 - 애니메이션 재생/일시정지
                    e.preventDefault();
                    this.animationController.togglePlayPause();
                    break;
                case 'r': // 카메라 리셋
                    this.sceneManager.resetCamera();
                    break;
            }
        });
    }
    
    /**
     * URL 파라미터 처리
     */
    async handleURLParameters() {
        // 모델 파라미터 확인
        const modelParam = this.urlParams.get('model');
        if (modelParam !== null) {
            const modelIndex = parseInt(modelParam);
            const models = getConfig('models.defaultModels', []);
            
            if (!isNaN(modelIndex) && modelIndex >= 0 && modelIndex < models.length) {
                console.log(`[ViewerApp] URL 파라미터로 모델 로드: ${modelIndex}`);
                this.currentModelIndex = modelIndex;
                
                try {
                    await this.modelLoader.loadModel(modelIndex);
                } catch (error) {
                    console.error('[ViewerApp] URL 모델 로드 실패:', error);
                    this.showError('요청한 모델을 로드할 수 없습니다.');
                }
            }
        }
        
        // 카메라 파라미터
        const cameraParam = this.urlParams.get('camera');
        if (cameraParam !== null) {
            const cameraIndex = parseInt(cameraParam);
            if (!isNaN(cameraIndex)) {
                setTimeout(() => {
                    this.sceneManager.switchToGLTFCamera(cameraIndex);
                }, 1000);
            }
        }
        
        // 자동 재생 파라미터
        const autoplayParam = this.urlParams.get('autoplay');
        if (autoplayParam === 'true') {
            setTimeout(() => {
                this.animationController.play();
            }, 1500);
        }
    }
    
    /**
     * 초기 UI 표시
     */
    showInitialUI() {
        // 로딩 화면 숨기기
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
        
        // 모델이 로드되지 않은 경우 모델 선택 UI 표시
        if (this.currentModelIndex === null) {
            this.uiController.showModelSelector();
        }
    }
    
    /**
     * 전체화면 토글
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('[ViewerApp] 전체화면 진입 실패:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * 에러 표시
     */
    showError(message) {
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
            
            // 5초 후 자동 숨김
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, 5000);
        }
        
        console.error('[ViewerApp] 에러:', message);
    }
    
    /**
     * 유틸리티: sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 이벤트 에미터 (간단한 구현)
     */
    emit(event, data) {
        window.dispatchEvent(new CustomEvent(`viewer:${event}`, { detail: data }));
    }
    
    /**
     * 정리
     */
    destroy() {
        console.log('[ViewerApp] 정리 시작');
        
        // 모듈 정리
        if (this.hotspotManager) this.hotspotManager.cleanup?.();
        if (this.animationController) this.animationController.cleanup?.();
        if (this.modelLoader) this.modelLoader.dispose?.();
        if (this.uiController) this.uiController.dispose?.();
        if (this.sceneManager) this.sceneManager.dispose?.();
        
        // 전역 참조 제거
        if (window.viewerApp === this) {
            delete window.viewerApp;
            delete window.modules;
            delete window.viewerDebug;
        }
        
        this.isInitialized = false;
        console.log('[ViewerApp] 정리 완료');
    }
}

/**
 * 애플리케이션 시작
 */
async function startViewer() {
    console.log('[Viewer] ===== 3D 뷰어 시작 =====');
    
    const app = new ViewerApplication();
    
    try {
        await app.init();
        return app;
    } catch (error) {
        console.error('[Viewer] 시작 실패:', error);
        
        // 에러 메시지 표시
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.innerHTML = `
                <h3>애플리케이션 시작 실패</h3>
                <p>${error.message}</p>
                <button onclick="location.reload()">다시 시도</button>
            `;
            errorEl.style.display = 'block';
        }
        
        throw error;
    }
}

// DOM 로드 후 자동 시작
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startViewer);
} else {
    // 약간의 지연 후 시작 (다른 스크립트 로드 대기)
    setTimeout(startViewer, 100);
}

// 전역 에러 처리
window.addEventListener('error', (event) => {
    console.error('[Viewer] 전역 오류:', event.error);
    console.error('파일:', event.filename);
    console.error('위치:', `${event.lineno}:${event.colno}`);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[Viewer] 처리되지 않은 Promise 거부:', event.reason);
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.viewerApp) {
        window.viewerApp.destroy();
    }
});

// 개발자 콘솔 안내
console.log('%c옹벽 3D 뷰어', 'font-size: 20px; color: #007bff; font-weight: bold;');
console.log('버전: 2.0.0');
console.log('Three.js: r128');
console.log('문제 발생 시 F12로 콘솔을 확인하세요.');

// 내보내기
export { ViewerApplication, startViewer };