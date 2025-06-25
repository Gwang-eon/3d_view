// viewer-main.js - viewer.html용 메인 스크립트
'use strict';

import { CONFIG } from './config.js';
import { SceneManager } from './SceneManager.js';
import { ModelLoader } from './ModelLoader.js';
import { UIController } from './UIController.js';  // 기본 UIController 사용
import { HotspotManager } from './HotspotManager.js';
import { AnimationController } from './AnimationController.js';
import { ViewerInitializer } from './viewer-init.js';

// 전역 변수
let app = {};
let viewerInit;

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
        
        // 모듈 초기화
        app.sceneManager = new SceneManager();
        app.animationController = new AnimationController();
        app.hotspotManager = new HotspotManager(app.sceneManager);
        app.modelLoader = new ModelLoader(app.sceneManager, app.animationController);
        app.uiController = new UIController(
            app.sceneManager,
            app.modelLoader,
            app.animationController,
            app.hotspotManager
        );
        
        // ViewerInitializer 생성 및 실행
        viewerInit = new ViewerInitializer(app.uiController);
        viewerInit.addHomeButton(); // 홈 버튼 추가
        await viewerInit.initialize(); // URL 파라미터 확인 및 자동 로드
        
        // 애니메이션 루프 시작
        animate();
        
        console.log('[Viewer] 초기화 완료');
        
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

// 브라우저 호환성 체크
function checkCompatibility() {
    if (!window.THREE) throw new Error('Three.js가 로드되지 않았습니다.');
    if (!THREE.GLTFLoader) throw new Error('GLTFLoader가 로드되지 않았습니다.');
    if (!THREE.OrbitControls) throw new Error('OrbitControls가 로드되지 않았습니다.');
    
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL을 지원하지 않는 브라우저입니다.');
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    
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
}

// 에러 표시
function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // 3초 후 홈으로
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    }
}

// 모델 토글 버튼 이벤트 설정 (improved 버전용)
function setupModelToggleButtons() {
    const toggleBtns = document.querySelectorAll('.model-toggle-btn');
    
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const modelType = btn.dataset.model;
            const modelIndex = { 'block': 0, 'cantilever': 1, 'mse': 2 }[modelType];
            
            if (modelIndex !== undefined) {
                // URL 파라미터 업데이트하고 페이지 새로고침
                window.location.href = `viewer.html?model=${modelIndex}`;
            }
        });
    });
}

// DOM 로드 완료 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupModelToggleButtons();
        init();
    });
} else {
    setupModelToggleButtons();
    init();
}

// 전역 에러 처리
window.addEventListener('error', (event) => {
    console.error('전역 오류:', event.error);
});

// 브라우저 뒤로가기/앞으로가기 처리
window.addEventListener('popstate', (event) => {
    // URL이 변경되면 페이지 새로고침
    location.reload();
});