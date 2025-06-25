// main.js - 즉시 수정 버전
'use strict';

import { CONFIG } from './config.js';
import { SceneManager } from './SceneManager.js';
import { ModelLoader } from './ModelLoader.js';
import { UIController } from './UIController.js';
import { HotspotManager } from './HotspotManager.js';
import { AnimationController } from './AnimationController.js';

// 모듈 스코프 변수
let sceneManager, modelLoader, uiController, hotspotManager, animationController;
let isInitialized = false;

// CONFIG 로드 확인
async function waitForConfig() {
    console.log('CONFIG 로드 대기 중...');
    let attempts = 0;
    
    while (typeof CONFIG === 'undefined' && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (typeof CONFIG === 'undefined') {
        throw new Error('CONFIG를 로드할 수 없습니다. config.js 파일을 확인하세요.');
    }
    
    console.log('CONFIG 로드 완료:', CONFIG);
    return CONFIG;
}

// Three.js 로드 확인
async function waitForThree() {
    console.log('Three.js 로드 대기 중...');
    let attempts = 0;
    
    while ((!window.THREE || !window.THREE.GLTFLoader || !window.THREE.OrbitControls) && attempts < 20) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    
    if (!window.THREE) {
        throw new Error('Three.js를 로드할 수 없습니다.');
    }
    
    console.log('Three.js 로드 완료');
    return true;
}

// DOM 요소 매핑 수정 - viewer.html의 improved DOM 구조에 맞춤
// 이 코드를 main.js 파일 상단에 추가하거나, 별도 파일로 만들어 먼저 로드하세요

// DOM 요소 ID 매핑 함수
function mapDOMElements() {
    console.log('DOM 요소 매핑 시작...');
    
    // viewer.html (improved)의 실제 구조에 맞춰 가상 요소 생성 또는 매핑
    const mappings = {
        'model-selector': () => {
            // 모델 선택 화면 생성
            const existing = document.getElementById('model-selector');
            if (existing) return existing;
            
            const selector = document.createElement('div');
            selector.id = 'model-selector';
            selector.className = 'model-selector';
            selector.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;
            
            selector.innerHTML = `
                <div class="selector-container" style="
                    text-align: center;
                    padding: 40px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    max-width: 800px;
                    width: 90%;
                ">
                    <h1 style="
                        margin-bottom: 20px;
                        font-size: 32px;
                        background: linear-gradient(45deg, #007bff, #00ff88);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    ">옹벽 3D 모니터링 시스템</h1>
                    <p style="margin-bottom: 30px; color: #aaa;">확인하실 옹벽 모델을 선택하세요</p>
                    <div id="model-list" class="model-list" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                        gap: 20px;
                        margin-top: 30px;
                    "></div>
                </div>
            `;
            
            document.body.appendChild(selector);
            return selector;
        },
        
        'model-list': () => {
            const existing = document.getElementById('model-list');
            if (existing) return existing;
            
            // model-selector가 먼저 생성되어야 함
            const selector = document.getElementById('model-selector') || mappings['model-selector']();
            const list = selector.querySelector('#model-list');
            return list;
        },
        
        'canvas-container': () => {
            // viewer.html에서는 실제로 canvas-container ID가 존재함
            let container = document.getElementById('canvas-container');
            if (container) return container;
            
            // viewer-container 내부의 canvas-container를 찾음
            const viewerContainer = document.getElementById('viewer-container');
            if (viewerContainer) {
                container = viewerContainer.querySelector('#canvas-container');
                if (container) return container;
            }
            
            // 없으면 생성
            container = document.createElement('div');
            container.id = 'canvas-container';
            container.style.cssText = 'width: 100%; height: 100%;';
            
            if (viewerContainer) {
                viewerContainer.appendChild(container);
            } else {
                document.body.appendChild(container);
            }
            
            return container;
        },
        
        'loading': () => {
            let loading = document.getElementById('loading');
            if (loading) return loading;
            
            loading = document.createElement('div');
            loading.id = 'loading';
            loading.className = 'loading-overlay';
            loading.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                flex-direction: column;
            `;
            loading.innerHTML = `
                <div class="loading-spinner" style="
                    width: 50px;
                    height: 50px;
                    border: 3px solid rgba(255, 255, 255, 0.1);
                    border-top: 3px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 20px;
                "></div>
                <div style="color: white; font-size: 18px;">모델을 로딩중입니다...</div>
                <div class="loading-progress" style="margin-top: 20px; text-align: center;">
                    <div class="progress-bar" style="
                        width: 200px;
                        height: 4px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 2px;
                        overflow: hidden;
                    ">
                        <div id="progress-fill" class="progress-fill" style="
                            width: 0%;
                            height: 100%;
                            background: #007bff;
                            transition: width 0.3s ease;
                        "></div>
                    </div>
                    <span id="progress-text" style="color: #aaa; font-size: 14px; margin-top: 10px; display: block;">0%</span>
                </div>
            `;
            
            // 애니메이션 추가
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(loading);
            return loading;
        },
        
        'error': () => {
            let error = document.getElementById('error');
            if (error) return error;
            
            error = document.createElement('div');
            error.id = 'error';
            error.className = 'error-message';
            error.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(255, 0, 0, 0.1);
                border: 1px solid rgba(255, 0, 0, 0.3);
                color: #ff6b6b;
                padding: 15px 20px;
                border-radius: 8px;
                display: none;
                z-index: 3000;
                max-width: 400px;
            `;
            
            document.body.appendChild(error);
            return error;
        },
        
        'bottom-controls': () => {
            // 기존 bottom-controls가 있으면 반환
            const existing = document.getElementById('bottom-controls');
            if (existing) return existing;
            
            // 없으면 null 반환 (optional element)
            return null;
        },
        
        'right-panel': () => {
            // 기존 right-panel이 있으면 반환
            const existing = document.getElementById('right-panel');
            if (existing) return existing;
            
            // 없으면 null 반환 (optional element)
            return null;
        }
    };
    
    // 모든 매핑 실행
    Object.keys(mappings).forEach(id => {
        const element = mappings[id]();
        if (element) {
            console.log(`✓ DOM 요소 매핑 완료: #${id}`);
        } else {
            console.log(`- DOM 요소 선택적: #${id}`);
        }
    });
    
    console.log('DOM 요소 매핑 완료!');
}

// DOMContentLoaded 이벤트에서 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mapDOMElements);
} else {
    // 이미 로드된 경우 즉시 실행
    mapDOMElements();
}

// 전역에서 접근 가능하도록 설정
window.mapDOMElements = mapDOMElements;

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
    console.log('=== 옹벽 3D 뷰어 초기화 시작 ===');
    
    try {
        // 1. DOM 준비 대기
        await waitForDOM();
        console.log('✓ DOM 준비 완료');
        
        // 2. CONFIG 로드 대기
        await waitForConfig();
        console.log('✓ CONFIG 로드 완료');
        
        // 3. Three.js 로드 대기
        await waitForThree();
        console.log('✓ Three.js 로드 완료');
        
        // 4. 필수 DOM 요소 확인
        const requiredElements = ['model-selector', 'model-list', 'canvas-container'];
        for (const id of requiredElements) {
            if (!document.getElementById(id)) {
                console.warn(`경고: #${id} 요소를 찾을 수 없습니다.`);
            }
        }
        
        // 5. 모듈 초기화
        console.log('모듈 초기화 시작...');
        
        // SceneManager
        sceneManager = new SceneManager();
        console.log('✓ SceneManager 생성 완료');
        
        // AnimationController
        animationController = new AnimationController();
        console.log('✓ AnimationController 생성 완료');
        
        // HotspotManager
        hotspotManager = new HotspotManager(sceneManager);
        console.log('✓ HotspotManager 생성 완료');
        
        // ModelLoader
        modelLoader = new ModelLoader(sceneManager, animationController);
        console.log('✓ ModelLoader 생성 완료');
        
        // UIController
        uiController = new UIController(sceneManager, modelLoader, animationController, hotspotManager);
        console.log('✓ UIController 생성 완료');
        
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
                hotspotManager.updateHotspots();
            }
            
            if (sceneManager) {
                sceneManager.render();
            }
        }
        
        animate();
        console.log('✓ 애니메이션 루프 시작됨');
        
        isInitialized = true;
        console.log('=== 초기화 완료 ===');
        
        // 8. URL 파라미터 확인 (viewer.html인 경우)
        const urlParams = new URLSearchParams(window.location.search);
        const modelId = urlParams.get('model');
        
        if (modelId !== null) {
            const index = parseInt(modelId);
            if (!isNaN(index) && index >= 0 && index < CONFIG.models.length) {
                console.log(`URL 파라미터로 모델 ${index} 자동 로드`);
                setTimeout(() => {
                    uiController.selectModel(CONFIG.models[index]);
                }, 500);
            }
        }
        
        // 9. 디버그 정보
        if (CONFIG.debug) {
            console.log('디버그 모드 활성화됨');
            console.log('전역 객체: window.viewerApp');
            console.log('사용 가능한 명령어:');
            console.log('- viewerApp.modelLoader.loadModel(0)');
            console.log('- viewerApp.uiController.selectModel(CONFIG.models[0])');
        }
        
    } catch (error) {
        console.error('초기화 중 오류 발생:', error);
        
        // 오류 표시
        const errorDiv = document.getElementById('error');
        if (errorDiv) {
            errorDiv.textContent = `초기화 오류: ${error.message}`;
            errorDiv.style.display = 'block';
        }
        
        // 디버그 정보 출력
        console.log('\n=== 디버그 정보 ===');
        console.log('CONFIG:', typeof CONFIG);
        console.log('THREE:', typeof THREE);
        console.log('DOM Ready:', document.readyState);
        
        throw error;
    }
}

// 전역 init 함수 노출
window.init = init;

// 자동 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // 이미 로드된 경우 약간의 지연 후 실행
    setTimeout(init, 100);
}

// 전역 에러 처리
window.addEventListener('error', function(event) {
    console.error('전역 오류:', event.error);
    console.error('파일:', event.filename);
    console.error('라인:', event.lineno, '컬럼:', event.colno);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('처리되지 않은 Promise 거부:', event.reason);
});

// 개발자 콘솔 안내
console.log('%c옹벽 3D 뷰어', 'font-size: 20px; color: #007bff; font-weight: bold;');
console.log('버전: 1.0.0');
console.log('Three.js 버전: r128');
console.log('문제가 발생하면 F12 콘솔에서 에러를 확인하세요.', 'color: #ff6b6b;');

export { sceneManager, modelLoader, uiController, animationController, hotspotManager };