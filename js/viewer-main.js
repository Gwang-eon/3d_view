// js/viewer-main.js
// 3D 뷰어 메인 애플리케이션 - 기존 기능 유지 + 새 아키텍처 통합
'use strict';

import { CONFIG } from './config.js';
import { CONFIG_MANAGER, getConfig, setConfig } from './core/ConfigManager.js';
import { SceneManager } from './SceneManager.js';
import { ModelLoader } from './ModelLoader.js';
import { UIController } from './UIController.js';
import { HotspotManager } from './HotspotManager.js';
import { AnimationController } from './AnimationController.js';

/**
 * 3D 뷰어 애플리케이션
 * - 기존 모듈 구조 유지
 * - ConfigManager 통합
 * - 향상된 에러 처리
 * - URL 파라미터 자동 처리
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
            
            // 5. UI 설정
            this.setupUI();
            console.log('[ViewerApp] ✓ UI 설정 완료');
            
            // 6. 애니메이션 루프 시작
            this.startAnimationLoop();
            console.log('[ViewerApp] ✓ 애니메이션 루프 시작');
            
            // 7. URL 파라미터 처리
            await this.handleURLParameters();
            
            // 8. 초기화 완료
            this.isInitialized = true;
            console.log('[ViewerApp] === 초기화 완료 ===');
            
            // 디버그 정보
            if (getConfig('app.debug')) {
                this.showDebugInfo();
            }
            
        } catch (error) {
            console.error('[ViewerApp] 초기화 실패:', error);
            this.handleInitError(error);
            throw error;
        }
    }
    
    /**
     * 환경 설정
     */
    setupEnvironment() {
        // ConfigManager에 기존 CONFIG 병합
        if (CONFIG) {
            CONFIG_MANAGER.merge('viewer', CONFIG);
        }
        
        // 개발/운영 환경별 설정
        if (CONFIG_MANAGER.environment === 'development') {
            setConfig('app.debug', true);
            setConfig('app.verbose', true);
        }
    }
    
    /**
     * DOM 준비 확인
     */
    async waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                resolve();
            } else {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            }
        });
    }
    
    /**
     * 의존성 확인
     */
    async checkDependencies() {
        // CONFIG 확인
        if (typeof CONFIG === 'undefined') {
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
        console.log('[ViewerApp] ✓ SceneManager 생성');
        
        // AnimationController
        this.animationController = new AnimationController();
        console.log('[ViewerApp] ✓ AnimationController 생성');
        
        // HotspotManager
        this.hotspotManager = new HotspotManager(this.sceneManager);
        console.log('[ViewerApp] ✓ HotspotManager 생성');
        
        // ModelLoader
        this.modelLoader = new ModelLoader(this.sceneManager, this.animationController);
        console.log('[ViewerApp] ✓ ModelLoader 생성');
        
        // UIController
        this.uiController = new UIController(
            this.sceneManager,
            this.modelLoader,
            this.animationController,
            this.hotspotManager
        );
        console.log('[ViewerApp] ✓ UIController 생성');
        
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
                this.showSettings();
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
            if (!this.isInitialized) return;
            
            switch(e.key) {
                case 'f':
                case 'F':
                    if (!e.ctrlKey && !e.metaKey) {
                        this.toggleFullscreen();
                    }
                    break;
                    
                case ' ':
                    if (this.animationController) {
                        e.preventDefault();
                        this.animationController.togglePlayPause();
                    }
                    break;
                    
                case 'Escape':
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    }
                    break;
                    
                case 'h':
                case 'H':
                    this.toggleHotspots();
                    break;
                    
                case 'd':
                case 'D':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.toggleDebug();
                    }
                    break;
            }
        });
    }
    
    /**
     * 애니메이션 루프
     */
    startAnimationLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            
            // FPS 계산
            this.updateFPS();
            
            // 컨트롤 업데이트
            if (this.sceneManager?.controls) {
                this.sceneManager.controls.update();
            }
            
            // 애니메이션 업데이트
            if (this.animationController) {
                this.animationController.update();
            }
            
            // 핫스팟 업데이트
            if (this.hotspotManager) {
                this.hotspotManager.updatePositions();
            }
            
            // 렌더링
            if (this.sceneManager) {
                this.sceneManager.render();
            }
        };
        
        animate();
    }
    
    /**
     * FPS 업데이트
     */
    updateFPS() {
        this.stats.frameCount++;
        const currentTime = performance.now();
        
        if (currentTime - this.stats.lastTime >= 1000) {
            this.stats.fps = this.stats.frameCount;
            this.stats.frameCount = 0;
            this.stats.lastTime = currentTime;
            
            // FPS 표시 업데이트
            const fpsElement = document.getElementById('fps-counter');
            if (fpsElement) {
                fpsElement.textContent = `FPS: ${this.stats.fps}`;
            }
        }
    }
    
    /**
     * URL 파라미터 처리
     */
    async handleURLParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const modelId = urlParams.get('model');
        
        if (modelId !== null) {
            const index = parseInt(modelId, 10);
            if (!isNaN(index) && index >= 0 && index < CONFIG.models.length) {
                console.log(`[ViewerApp] URL 파라미터로 모델 ${index} 로드`);
                
                // 모델 선택 화면 숨기기
                const modelSelector = document.getElementById('model-selector');
                if (modelSelector) {
                    modelSelector.style.display = 'none';
                }
                
                // 약간의 지연 후 모델 로드
                await this.sleep(300);
                await this.loadModel(index);
                
                // 상단 토글 버튼 활성화
                this.activateModelToggle(index);
            } else {
                console.warn(`[ViewerApp] 잘못된 모델 인덱스: ${index}`);
                this.showModelSelector();
            }
        } else {
            // URL 파라미터가 없으면 모델 선택 화면 표시
            this.showModelSelector();
        }
    }
    
    /**
     * 모델 로드
     */
    async loadModel(index) {
        try {
            this.currentModelIndex = index;
            
            // UI 컨트롤러를 통해 모델 선택
            if (this.uiController) {
                await this.uiController.selectModel(index);
            }
            
            // URL 업데이트 (히스토리에 추가)
            const newUrl = `${window.location.pathname}?model=${index}`;
            window.history.pushState({ model: index }, '', newUrl);
            
        } catch (error) {
            console.error('[ViewerApp] 모델 로드 실패:', error);
            this.showError(`모델을 로드할 수 없습니다: ${error.message}`);
        }
    }
    
    /**
     * 모델 토글 버튼 활성화
     */
    activateModelToggle(index) {
        const modelTypes = ['block', 'cantilever', 'mse'];
        const modelType = modelTypes[index];
        
        if (modelType) {
            const buttons = document.querySelectorAll('.model-toggle-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            
            const activeBtn = document.querySelector(`[data-model="${modelType}"]`);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }
    }
    
    /**
     * 모델 선택 화면 표시
     */
    showModelSelector() {
        const modelSelector = document.getElementById('model-selector');
        if (modelSelector && this.uiController) {
            modelSelector.style.display = 'flex';
            this.uiController.loadModelList();
        }
    }
    
    /**
     * 전체화면 토글
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            const container = document.getElementById('viewer-container');
            if (container.requestFullscreen) {
                container.requestFullscreen();
            }
        } else {
            document.exitFullscreen();
        }
    }
    
    /**
     * 핫스팟 토글
     */
    toggleHotspots() {
        const checkbox = document.getElementById('show-hotspots');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    }
    
    /**
     * 디버그 모드 토글
     */
    toggleDebug() {
        const currentDebug = getConfig('app.debug');
        setConfig('app.debug', !currentDebug);
        
        if (!currentDebug) {
            this.showDebugInfo();
        } else {
            this.hideDebugInfo();
        }
    }
    
    /**
     * 설정 표시
     */
    showSettings() {
        // 설정 패널 토글
        const rightPanel = document.getElementById('right-panel');
        if (rightPanel) {
            rightPanel.classList.toggle('collapsed');
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
        } else {
            alert(`오류: ${message}`);
        }
    }
    
    /**
     * 초기화 에러 처리
     */
    handleInitError(error) {
        const errorMessage = `초기화 오류: ${error.message}`;
        
        // 에러 표시
        this.showError(errorMessage);
        
        // 로딩 화면 숨기기
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
        
        // 모델 선택 화면 표시
        this.showModelSelector();
        
        // 콘솔에 상세 정보 출력
        console.group('[ViewerApp] 초기화 에러 상세 정보');
        console.error('에러:', error);
        console.log('CONFIG:', typeof CONFIG);
        console.log('THREE:', typeof THREE);
        console.log('DOM Ready:', document.readyState);
        console.groupEnd();
    }
    
    /**
     * 디버그 정보 표시
     */
    showDebugInfo() {
        console.group('[ViewerApp] 디버그 정보');
        console.log('버전:', getConfig('app.version'));
        console.log('환경:', CONFIG_MANAGER.environment);
        console.log('모듈 상태:', {
            sceneManager: !!this.sceneManager,
            modelLoader: !!this.modelLoader,
            uiController: !!this.uiController,
            animationController: !!this.animationController,
            hotspotManager: !!this.hotspotManager
        });
        console.log('전역 객체: window.viewerApp');
        console.log('사용 가능한 명령어:');
        console.log('- viewerApp.loadModel(0)');
        console.log('- viewerApp.toggleDebug()');
        console.log('- viewerApp.showModelSelector()');
        console.groupEnd();
        
        // 화면에 디버그 패널 표시
        this.createDebugPanel();
    }
    
    /**
     * 디버그 패널 생성
     */
    createDebugPanel() {
        let debugPanel = document.getElementById('debug-panel');
        if (!debugPanel) {
            debugPanel = document.createElement('div');
            debugPanel.id = 'debug-panel';
            debugPanel.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: #0f0;
                padding: 10px;
                font-family: monospace;
                font-size: 12px;
                border-radius: 4px;
                z-index: 10000;
                min-width: 200px;
            `;
            document.body.appendChild(debugPanel);
        }
        
        // 업데이트 함수
        const updateDebugPanel = () => {
            if (!document.getElementById('debug-panel')) return;
            
            debugPanel.innerHTML = `
                <div>FPS: ${this.stats.fps}</div>
                <div>모델: ${this.currentModelIndex !== null ? CONFIG.models[this.currentModelIndex]?.name : 'None'}</div>
                <div>메모리: ${performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + 'MB' : 'N/A'}</div>
                <div>환경: ${CONFIG_MANAGER.environment}</div>
                <div style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #0f0;">
                    <small>Ctrl+D: 디버그 토글</small><br>
                    <small>F: 전체화면</small><br>
                    <small>H: 핫스팟 토글</small><br>
                    <small>Space: 재생/일시정지</small>
                </div>
            `;
        };
        
        // 주기적 업데이트
        setInterval(updateDebugPanel, 1000);
        updateDebugPanel();
    }
    
    /**
     * 디버그 정보 숨기기
     */
    hideDebugInfo() {
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            debugPanel.remove();
        }
        console.log('[ViewerApp] 디버그 모드 비활성화');
    }
    
    /**
     * 유틸리티: sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 정리 (cleanup)
     */
    destroy() {
        console.log('[ViewerApp] 정리 시작...');
        
        // 애니메이션 루프 중지는 별도로 처리 필요
        
        // 모듈 정리
        if (this.hotspotManager) this.hotspotManager.cleanup?.();
        if (this.animationController) this.animationController.cleanup?.();
        if (this.modelLoader) this.modelLoader.cleanup?.();
        if (this.uiController) this.uiController.cleanup?.();
        if (this.sceneManager) this.sceneManager.cleanup?.();
        
        // 전역 참조 제거
        if (window.viewerApp === this) {
            delete window.viewerApp;
            delete window.modules;
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