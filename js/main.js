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

// 디버깅 헬퍼
function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
        console.log(`[${timestamp}] ${message}`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}

// 초기화 함수
async function init() {
    debugLog('옹벽 3D 뷰어 초기화 시작...');
    
    try {
        // CONFIG 로드 확인
        await waitForConfig();
        
        // 브라우저 호환성 체크
        checkCompatibility();
        
        // DOM 준비 확인
        await checkDOMReady();
        
        // 모듈 초기화
        debugLog('모듈 초기화 시작');
        
        sceneManager = new SceneManager();
        debugLog('SceneManager 생성 완료');
        
        animationController = new AnimationController();
        debugLog('AnimationController 생성 완료');
        
        hotspotManager = new HotspotManager(sceneManager);
        debugLog('HotspotManager 생성 완료');
        
        modelLoader = new ModelLoader(sceneManager, animationController);
        debugLog('ModelLoader 생성 완료');
        
        uiController = new UIController(
            sceneManager, 
            modelLoader, 
            animationController, 
            hotspotManager
        );
        debugLog('UIController 생성 완료');
        
        // 애니메이션 루프 시작
        animate();
        
        isInitialized = true;
        debugLog('옹벽 3D 뷰어 초기화 완료');
        
        // 디버그 모드에서 전역 접근 가능하도록
        if (CONFIG.debug) {
            window.wallViewer = {
                sceneManager,
                modelLoader,
                uiController,
                hotspotManager,
                animationController,
                config: CONFIG,
                // 디버그 함수들
                debug: {
                    showModelSelector: () => {
                        const selector = document.getElementById('model-selector');
                        if (selector) selector.style.display = 'flex';
                    },
                    loadModelList: () => {
                        uiController.loadModelList();
                    },
                    checkElements: () => {
                        const elements = [
                            'model-selector',
                            'model-list',
                            'control-panel',
                            'info-panel',
                            'canvas-container'
                        ];
                        elements.forEach(id => {
                            const el = document.getElementById(id);
                            console.log(`${id}: ${el ? '✓ 존재' : '✗ 없음'}`);
                        });
                    }
                }
            };
            
            console.log('%c디버그 모드 활성화', 'color: #00ff88; font-size: 16px;');
            console.log('전역 객체: window.wallViewer');
            console.log('모델 선택화면 강제 표시: wallViewer.debug.showModelSelector()');
            console.log('DOM 요소 체크: wallViewer.debug.checkElements()');
        }
        
    } catch (error) {
        console.error('초기화 중 오류 발생:', error);
        showInitError(error.message);
    }
}

// DOM 준비 확인
async function checkDOMReady() {
    const requiredElements = [
        'model-selector',
        'model-list',
        'canvas-container',
        'loading',
        'error'
    ];
    
    for (const id of requiredElements) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`필수 요소 '${id}'를 찾을 수 없습니다.`);
        }
    }
}

// 브라우저 호환성 체크
function checkCompatibility() {
    const issues = [];
    
    if (!window.THREE) {
        issues.push('Three.js가 로드되지 않았습니다.');
    }
    if (!window.THREE?.GLTFLoader) {
        issues.push('GLTFLoader가 로드되지 않았습니다.');
    }
    if (!window.THREE?.OrbitControls) {
        issues.push('OrbitControls가 로드되지 않았습니다.');
    }
    
    // WebGL 지원 체크
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        issues.push('WebGL을 지원하지 않는 브라우저입니다.');
    }
    
    if (issues.length > 0) {
        throw new Error('호환성 문제:\n' + issues.join('\n'));
    }
    
    debugLog('브라우저 호환성 체크 통과');
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    
    if (!isInitialized) return;
    
    // FPS 업데이트
    uiController.updateFPS();
    
    // 애니메이션 업데이트
    animationController.update();
    const frame = animationController.getCurrentFrame();
    uiController.updateAnimationFrame(frame);
    
    // 핫스팟 위치 업데이트
    hotspotManager.updatePositions();
    
    // 렌더링
    sceneManager.render();
}

// 초기화 에러 표시
function showInitError(message) {
    console.error('초기화 오류:', message);
    
    // 에러 요소 찾기 또는 생성
    let errorDiv = document.getElementById('error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error';
        errorDiv.className = 'error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(220, 53, 69, 0.95);
            color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            z-index: 9999;
            max-width: 80%;
            text-align: center;
        `;
        document.body.appendChild(errorDiv);
    }
    
    errorDiv.innerHTML = `
        <h2 style="margin: 0 0 15px 0;">초기화 오류</h2>
        <p style="margin: 0 0 20px 0;">${message}</p>
        <button onclick="location.reload()" style="
            background: white;
            color: #dc3545;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        ">새로고침</button>
    `;
    errorDiv.style.display = 'block';
}

// 페이지 로드 완료 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        debugLog('DOMContentLoaded 이벤트 발생');
        await init();
    });
} else {
    debugLog('DOM 이미 로드됨, 즉시 초기화');
    init();
}

// 개발자 콘솔 환영 메시지
console.log('%c옹벽 3D 뷰어', 'font-size: 24px; color: #007bff; font-weight: bold;');
console.log('%c문제가 발생했나요? F12 콘솔에서 에러를 확인하세요.', 'color: #ff6b6b;');

// 전역 오류 처리
window.addEventListener('error', function(event) {
    console.error('전역 오류:', event.error);
    console.error('파일:', event.filename);
    console.error('라인:', event.lineno, '컬럼:', event.colno);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('처리되지 않은 Promise 거부:', event.reason);
});