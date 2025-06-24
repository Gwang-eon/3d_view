// main.js 수정 버전
'use strict';

import { CONFIG } from './config.js';
import { SceneManager } from './SceneManager.js';
import { ModelLoader } from './ModelLoader.js';
// 기존 UIController 대신 개선된 버전 import
import { UIControllerImproved } from './UIController-improved.js';
// 기존 HotspotManager 대신 개선된 버전 import  
import { HotspotManager } from './HotspotManager-improved.js';
import { AnimationController } from './AnimationController.js';
import { PluginManager, LightingControlPlugin } from './PluginSystem.js';

// 모듈 스코프 변수
let sceneManager, modelLoader, uiController, hotspotManager, animationController;
let pluginManager;
let isInitialized = false;

// 디버깅 로그 함수
function debugLog(message, data = null) {
    if (CONFIG.debug) {
        if (data) {
            console.log(`[DEBUG] ${message}`, data);
        } else {
            console.log(`[DEBUG] ${message}`);
        }
    }
}

// 초기화 함수
async function init() {
    console.log('옹벽 3D 뷰어 초기화 시작...');
    
    try {
        // 의존성 주입을 사용한 모듈 인스턴스 생성
        sceneManager = new SceneManager();
        animationController = new AnimationController();
        hotspotManager = new HotspotManager(sceneManager);
        modelLoader = new ModelLoader(sceneManager, animationController);
        
        // 개선된 UIController 사용
        uiController = new UIControllerImproved(
            sceneManager, 
            modelLoader, 
            animationController, 
            hotspotManager
        );
        
        // 플러그인 시스템 초기화
        await initPluginSystem();
        
        // 애니메이션 루프 시작
        animate();
        
        isInitialized = true;
        console.log('옹벽 3D 뷰어 초기화 완료');
        
        // 디버그 모드에서 전역 접근 가능하도록
        if (CONFIG.debug) {
            window.wallViewer = {
                sceneManager,
                modelLoader,
                uiController,
                hotspotManager,
                animationController,
                pluginManager
            };
        }
        
    } catch (error) {
        console.error('초기화 중 오류 발생:', error);
        showInitError(error.message);
    }
}

// 플러그인 시스템 초기화
async function initPluginSystem() {
    const app = {
        sceneManager,
        modelLoader,
        animationController,
        hotspotManager,
        uiController
    };
    
    pluginManager = new PluginManager(app);
    
    // 기본 플러그인 등록 (필요한 경우만)
    // await pluginManager.register(LightingControlPlugin);
    
    window.createPluginUI = createPluginUI;
}

// 플러그인 UI 생성
function createPluginUI() {
    // 개선된 UI에서는 플러그인을 별도로 관리
    const pluginContainer = document.createElement('div');
    pluginContainer.id = 'plugin-controls';
    pluginContainer.className = 'plugin-controls';
    
    // 플러그인 UI는 설정 패널 등에서 관리
    console.log('[Plugin] UI 생성 준비 완료');
}

// 브라우저 호환성 체크
function checkCompatibility() {
    if (!window.THREE) throw new Error('Three.js가 로드되지 않았습니다.');
    if (!THREE.GLTFLoader) throw new Error('GLTFLoader가 로드되지 않았습니다.');
    if (!THREE.OrbitControls) throw new Error('OrbitControls가 로드되지 않았습니다.');
    
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        throw new Error('WebGL을 초기화할 수 없습니다.');
    }
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    
    if (!isInitialized) return;
    
    uiController.updateFPS();
    animationController.update();
    
    const frame = animationController.getCurrentFrame();
    uiController.updateAnimationFrame(frame);
    
    hotspotManager.updatePositions();
    
    if (pluginManager) {
        pluginManager.updateAll();
    }
    
    sceneManager.render();
}

// 초기화 에러 표시
function showInitError(message) {
    const errorDiv = document.getElementById('error') || document.createElement('div');
    errorDiv.id = 'error';
    errorDiv.className = 'error-message';
    errorDiv.style.display = 'block';
    errorDiv.style.position = 'fixed';
    errorDiv.innerHTML = `<h2>초기화 오류</h2><p>${message}</p>`;
    if (!document.getElementById('error')) {
        document.body.appendChild(errorDiv);
    }
}

// 페이지 로드 완료 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            checkCompatibility();
            await init();
        } catch (error) {
            showInitError(error.message);
        }
    });
} else {
    (async () => {
        try {
            checkCompatibility();
            await init();
        } catch (error) {
            showInitError(error.message);
        }
    })();
}

// 개발자 콘솔 환영 메시지
console.log('%c옹벽 3D 뷰어 v2.0', 'font-size: 20px; color: #007bff; font-weight: bold;');
if (CONFIG.debug) {
    console.log('%c디버그 모드 활성화됨', 'color: #00ff88;');
    console.log('전역 객체: window.wallViewer');
}

// 전역 오류 처리
window.addEventListener('error', function(event) {
    console.error('전역 오류 발생:', event.error);
    showInitError(`예상치 못한 오류: ${event.error?.message || '알 수 없는 오류'}`);
});