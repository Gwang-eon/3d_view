// viewer-main.js - 오류 수정된 버전
'use strict';

import { CONFIG } from './config.js';
import { SceneManager } from './SceneManager.js';
import { ModelLoader } from './ModelLoader.js';
import { UIController } from './UIController.js';
import { HotspotManager } from './HotspotManager.js';
import { AnimationController } from './AnimationController.js';

// 전역 변수
let sceneManager, modelLoader, uiController, hotspotManager, animationController;
let isInitialized = false;

// CONFIG 로드 확인
async function waitForConfig() {
    console.log('[Viewer] CONFIG 로드 대기 중...');
    let attempts = 0;
    
    while (typeof CONFIG === 'undefined' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (typeof CONFIG === 'undefined') {
        throw new Error('CONFIG를 로드할 수 없습니다. config.js 파일을 확인하세요.');
    }
    
    console.log('[Viewer] CONFIG 로드 완료:', CONFIG);
    return CONFIG;
}

// Three.js 로드 확인
async function waitForThree() {
    console.log('[Viewer] Three.js 로드 대기 중...');
    let attempts = 0;
    
    while ((!window.THREE || !window.THREE.GLTFLoader || !window.THREE.OrbitControls) && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.THREE) {
        throw new Error('Three.js를 로드할 수 없습니다.');
    }
    
    console.log('[Viewer] Three.js 로드 완료');
    return true;
}

// DOM 준비 확인
function waitForDOM() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            resolve();
        } else {
            document.addEventListener('DOMContentLoaded', resolve);
        }
    });
}

// 초기화 함수
async function init() {
    console.log('[Viewer] === 3D 뷰어 초기화 시작 ===');
    
    try {
        // 1. DOM 준비 대기
        await waitForDOM();
        console.log('[Viewer] ✓ DOM 준비 완료');
        
        // 2. CONFIG 로드 대기
        await waitForConfig();
        console.log('[Viewer] ✓ CONFIG 로드 완료');
        
        // 3. Three.js 로드 대기
        await waitForThree();
        console.log('[Viewer] ✓ Three.js 로드 완료');
        
        // 4. 필수 DOM 요소 확인 (호환성 레이어가 생성한 요소들)
        const requiredElements = ['model-selector', 'model-list', 'canvas-container'];
        for (const id of requiredElements) {
            if (!document.getElementById(id)) {
                console.warn(`[Viewer] 경고: #${id} 요소를 찾을 수 없습니다.`);
            }
        }
        
        // 5. 모듈 초기화
        console.log('[Viewer] 모듈 초기화 시작...');
        
        // SceneManager
        sceneManager = new SceneManager();
        console.log('[Viewer] ✓ SceneManager 생성 완료');
        
        // AnimationController
        animationController = new AnimationController();
        console.log('[Viewer] ✓ AnimationController 생성 완료');
        
        // HotspotManager
        hotspotManager = new HotspotManager(sceneManager);
        console.log('[Viewer] ✓ HotspotManager 생성 완료');
        
        // ModelLoader
        modelLoader = new ModelLoader(sceneManager, animationController);
        console.log('[Viewer] ✓ ModelLoader 생성 완료');
        
        // UIController
        uiController = new UIController(sceneManager, modelLoader, animationController, hotspotManager);
        console.log('[Viewer] ✓ UIController 생성 완료');
        
        // 6. 전역 객체에 할당 (디버깅용)
        window.viewerApp = {
            sceneManager,
            modelLoader,
            uiController,
            animationController,
            hotspotManager,
            CONFIG
        };
        
        // 7. 애니메이션 루프 시작
        function animate() {
            requestAnimationFrame(animate);
            
            if (sceneManager && sceneManager.controls) {
                sceneManager.controls.update();
            }
            
            if (animationController) {
                animationController.update();
            }
            
            if (hotspotManager) {
                hotspotManager.updatePositions();
            }
            
            if (sceneManager) {
                sceneManager.render();
            }
        }
        
        animate();
        console.log('[Viewer] ✓ 애니메이션 루프 시작됨');
        
        // 8. URL 파라미터 처리
        handleURLParameters();
        
        // 9. 추가 UI 설정
        setupAdditionalUI();
        
        isInitialized = true;
        console.log('[Viewer] === 초기화 완료 ===');
        
        // 10. 디버그 정보
        if (CONFIG.debug) {
            console.log('[Viewer] 디버그 모드 활성화됨');
            console.log('[Viewer] 전역 객체: window.viewerApp');
            console.log('[Viewer] 사용 가능한 명령어:');
            console.log('[Viewer] - viewerApp.modelLoader.loadModel(0)');
            console.log('[Viewer] - viewerApp.uiController.selectModel(CONFIG.models[0])');
        }
        
    } catch (error) {
        console.error('[Viewer] 초기화 중 오류 발생:', error);
        showError(error.message);
        
        // 디버그 정보 출력
        console.log('\n[Viewer] === 디버그 정보 ===');
        console.log('[Viewer] CONFIG:', typeof CONFIG);
        console.log('[Viewer] THREE:', typeof THREE);
        console.log('[Viewer] DOM Ready:', document.readyState);
        
        throw error;
    }
}

// URL 파라미터 처리
function handleURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('model');
    
    if (modelId !== null) {
        const index = parseInt(modelId);
        if (!isNaN(index) && index >= 0 && index < CONFIG.models.length) {
            console.log(`[Viewer] URL 파라미터로 모델 ${index} 자동 로드`);
            
            // 모델 선택 화면 숨기기
            const modelSelector = document.getElementById('model-selector');
            if (modelSelector) {
                modelSelector.style.display = 'none';
            }
            
            // 모델 로드
            setTimeout(() => {
                uiController.selectModel(index);
                
                // 상단 토글 버튼 활성화
                const modelTypes = ['block', 'cantilever', 'mse'];
                const modelType = modelTypes[index];
                if (modelType) {
                    const btn = document.querySelector(`[data-model="${modelType}"]`);
                    if (btn) {
                        document.querySelectorAll('.model-toggle-btn').forEach(b => {
                            b.classList.remove('active');
                        });
                        btn.classList.add('active');
                    }
                }
            }, 500);
        }
    } else {
        // URL 파라미터가 없으면 모델 선택 화면 표시
        const modelSelector = document.getElementById('model-selector');
        if (modelSelector && uiController) {
            modelSelector.style.display = 'flex';
            uiController.loadModelList();
        }
    }
}

// 추가 UI 설정
function setupAdditionalUI() {
    // 홈 버튼
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // 모델 정보 버튼
    const modelInfoBtn = document.getElementById('model-info-btn');
    if (modelInfoBtn) {
        modelInfoBtn.addEventListener('click', showModelInfo);
    }
    
    // 스크린샷 버튼
    const screenshotBtn = document.getElementById('screenshot-btn');
    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', takeScreenshot);
    }
}

// 모델 정보 표시
function showModelInfo() {
    if (!uiController?.currentModel) {
        console.warn('[Viewer] 현재 로드된 모델이 없습니다.');
        return;
    }
    
    const info = `
모델: ${uiController.currentModel.name}
설명: ${uiController.currentModel.description || '정보 없음'}
    `;
    alert(info);
}

// 스크린샷 촬영
function takeScreenshot() {
    if (!sceneManager?.renderer) {
        console.error('[Viewer] 렌더러가 준비되지 않았습니다.');
        return;
    }
    
    try {
        sceneManager.render(); // 최신 프레임 렌더링
        const dataURL = sceneManager.renderer.domElement.toDataURL('image/png');
        
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

// 자동 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // 이미 로드된 경우 약간의 지연 후 실행
    setTimeout(init, 100);
}

// 전역 에러 처리
window.addEventListener('error', function(event) {
    console.error('[Viewer] 전역 오류:', event.error);
    console.error('[Viewer] 파일:', event.filename);
    console.error('[Viewer] 라인:', event.lineno, '컬럼:', event.colno);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('[Viewer] 처리되지 않은 Promise 거부:', event.reason);
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (sceneManager) {
        try {
            sceneManager.cleanup?.();
        } catch (e) {
            console.error('[Viewer] 정리 중 오류:', e);
        }
    }
});

// 개발자 콘솔 안내
console.log('%c옹벽 3D 뷰어 (Viewer Mode)', 'font-size: 20px; color: #007bff; font-weight: bold;');
console.log('버전: 1.0.0');
console.log('Three.js 버전: r128');
console.log('문제가 발생하면 F12 콘솔에서 에러를 확인하세요.');

// 내보내기
export { sceneManager, modelLoader, uiController, animationController, hotspotManager };