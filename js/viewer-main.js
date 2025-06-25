// viewer-main.js - 오류 수정된 버전
'use strict';

import { CONFIG } from './config.js';
import { SceneManager } from './SceneManager.js';
import { ModelLoader } from './ModelLoader.js';
import { UIController } from './UIController.js';
import { HotspotManager } from './HotspotManager.js';
import { AnimationController } from './AnimationController.js';
import { ViewerInitializer } from './viewer-init.js';
import { setupCameraControls, setupHotspotHandler } from './camera-controls-setup.js';


// 전역 변수
let app = {};
let viewerInit;
let isInitialized = false;

// 초기화
async function init() {
    console.log('[Viewer] 3D 뷰어 초기화 시작...');
    
    try {
        // CONFIG 확인
        if (!CONFIG) {
            throw new Error('CONFIG를 로드할 수 없습니다.');
        }
        
        // 브라우저 호환성 체크
        checkCompatibility();
        
        // DOM 준비 대기
        await waitForDOM();
        
        // 모듈 초기화
        console.log('[Viewer] 모듈 초기화 시작');
        
        app.sceneManager = new SceneManager();
        console.log('[Viewer] SceneManager 생성 완료');
        
        app.animationController = new AnimationController();
        console.log('[Viewer] AnimationController 생성 완료');
        
        app.hotspotManager = new HotspotManager(app.sceneManager);
        console.log('[Viewer] HotspotManager 생성 완료');
        
        app.modelLoader = new ModelLoader(app.sceneManager, app.animationController);
        console.log('[Viewer] ModelLoader 생성 완료');
        
        app.uiController = new UIController(
            app.sceneManager,
            app.modelLoader,
            app.animationController,
            app.hotspotManager
        );
        console.log('[Viewer] UIController 생성 완료');
        
        // 카메라 컨트롤 설정 - setupCameraControls가 있는 경우에만 호출
        if (typeof app.uiController.setupCameraControls === 'function') {
            app.uiController.setupCameraControls();
            console.log('[Viewer] 카메라 컨트롤 설정 완료');
        }
        
        // ViewerInitializer 생성 및 실행
        viewerInit = new ViewerInitializer(app.uiController);
        
        // 홈 버튼 추가 시도 - 에러 방지
        try {
            viewerInit.addHomeButton();
        } catch (e) {
            console.warn('[Viewer] 홈 버튼 추가 실패:', e);
        }
        
        // URL 파라미터 확인 및 자동 로드
        await viewerInit.initialize();
        
        // 애니메이션 루프 시작
        animate();
        
        isInitialized = true;
        console.log('[Viewer] 초기화 완료');
        
        // 추가 UI 설정
        setupAdditionalUI();
        
        // 디버그 모드
        if (CONFIG.debug) {
            window.viewerApp = app;
            window.viewerInit = viewerInit;
            console.log('%c디버그 모드 활성화', 'color: #00ff88;');
            console.log('전역 객체: window.viewerApp');
        }
        
    } catch (error) {
        console.error('[Viewer] 초기화 오류:', error);
        showError(error.message);
    }
}

// DOM 준비 대기
function waitForDOM() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            resolve();
        } else {
            document.addEventListener('DOMContentLoaded', resolve);
        }
    });
}

// 브라우저 호환성 체크
function checkCompatibility() {
    const errors = [];
    
    if (!window.THREE) {
        errors.push('Three.js가 로드되지 않았습니다.');
    }
    if (!window.THREE?.GLTFLoader) {
        errors.push('GLTFLoader가 로드되지 않았습니다.');
    }
    if (!window.THREE?.OrbitControls) {
        errors.push('OrbitControls가 로드되지 않았습니다.');
    }
    
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        errors.push('WebGL을 지원하지 않는 브라우저입니다.');
    }
    
    if (errors.length > 0) {
        throw new Error(errors.join('\n'));
    }
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    
    if (!isInitialized) return;
    
    try {
        // FPS 업데이트
        app.uiController.updateFPS();
        
        // 애니메이션 업데이트
        app.animationController.update();
        const frame = app.animationController.getCurrentFrame();
        app.uiController.updateAnimationFrame(frame);
        
        // 핫스팟 위치 업데이트
        app.hotspotManager.updatePositions();
        
        // 렌더링
        app.sceneManager.render();
    } catch (error) {
        console.error('[Viewer] 애니메이션 루프 오류:', error);
    }
}

// 추가 UI 설정
function setupAdditionalUI() {
    // 모델 토글 버튼 이벤트
    setupModelToggleButtons();
    
    // 설정 버튼
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            console.log('[Viewer] 설정 패널 열기');
            // TODO: 설정 패널 구현
        });
    }
    
    // 모델 정보 버튼
    const modelInfoBtn = document.getElementById('model-info-btn');
    if (modelInfoBtn) {
        modelInfoBtn.addEventListener('click', () => {
            console.log('[Viewer] 모델 정보 표시');
            showModelInfo();
        });
    }
    
    // 패널 토글 버튼들 - NULL 체크
    const rightPanelToggle = document.getElementById('right-panel-toggle');
    if (rightPanelToggle) {
        rightPanelToggle.addEventListener('click', () => {
            const panel = document.getElementById('right-panel');
            if (panel) {
                panel.classList.toggle('collapsed');
                rightPanelToggle.textContent = panel.classList.contains('collapsed') ? '◀' : '▶';
            }
        });
    }
    
    // 스크린샷 버튼
    const screenshotBtn = document.getElementById('screenshot-btn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', takeScreenshot);
    }
}

// 모델 토글 버튼 이벤트 설정
function setupModelToggleButtons() {
    const toggleBtns = document.querySelectorAll('.model-toggle-btn');
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modelType = btn.dataset.model;
            const modelIndex = { 'block': 0, 'cantilever': 1, 'mse': 2 }[modelType];
            
            if (modelIndex !== undefined && CONFIG.models[modelIndex]) {
                // 직접 모델 로드
                const model = CONFIG.models[modelIndex];
                app.uiController.selectModel(model);
                
                // 버튼 활성화 상태 업데이트
                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        });
    });
}

// 모델 정보 표시
function showModelInfo() {
    if (!app.uiController.currentModel) {
        alert('로드된 모델이 없습니다.');
        return;
    }
    
    // 간단한 모달로 정보 표시 (실제로는 더 나은 UI 필요)
    const info = `
모델: ${app.uiController.currentModel.name}
설명: ${app.uiController.currentModel.description || '정보 없음'}
    `;
    alert(info);
}

// 스크린샷 촬영
function takeScreenshot() {
    if (!app.sceneManager?.renderer) {
        console.error('[Viewer] 렌더러가 준비되지 않았습니다.');
        return;
    }
    
    try {
        app.sceneManager.render(); // 최신 프레임 렌더링
        const dataURL = app.sceneManager.renderer.domElement.toDataURL('image/png');
        
        // 다운로드 링크 생성
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = `wall-viewer-${Date.now()}.png`;
        link.click();
        
        console.log('[Viewer] 스크린샷 저장됨');
    } catch (error) {
        console.error('[Viewer] 스크린샷 오류:', error);
    }
}

// 에러 표시
function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // 5초 후 자동 숨김
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        // 폴백: alert 사용
        alert(`오류: ${message}`);
    }
}

// DOM 로드 완료 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // 이미 로드된 경우 바로 실행
    init();
}

// 전역 에러 처리
window.addEventListener('error', (event) => {
    console.error('[Viewer] 전역 오류:', event.error);
    console.error('파일:', event.filename);
    console.error('위치:', event.lineno, ':', event.colno);
    
    // 개발 모드에서만 에러 표시
    if (CONFIG.debug) {
        showError(`오류: ${event.error?.message || '알 수 없는 오류'}`);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[Viewer] 처리되지 않은 Promise 거부:', event.reason);
    
    if (CONFIG.debug) {
        showError(`Promise 오류: ${event.reason?.message || event.reason}`);
    }
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (app.sceneManager) {
        try {
            app.sceneManager.cleanup?.();
        } catch (e) {
            console.error('[Viewer] 정리 중 오류:', e);
        }
    }
});