// MSE Wall Viewer - 개선된 메인 구조
'use strict';

import { CONFIG } from './config.js';
import { SceneManager } from './SceneManager.js';
import { ModelLoader } from './ModelLoader.js';
import { UIController } from './UIController.js';
import { HotspotManager } from './HotspotManager.js';
import { AnimationController } from './AnimationController.js';
import { PluginManager } from './PluginSystem.js';
import { LightingControlPlugin, MeasurementPlugin } from './PluginSystem.js';

class WallViewerApp {
    constructor() {
        this.modules = {};
        this.pluginManager = null;
        this.isInitialized = false;
    }
    
    async init() {
        console.log('옹벽 3D 뷰어 초기화 시작...');
        
        try {
            // 브라우저 호환성 체크
            this.checkCompatibility();
            
            // 핵심 모듈 초기화
            await this.initCoreModules();
            
            // 플러그인 시스템 초기화
            await this.initPlugins();
            
            // 애니메이션 루프 시작
            this.startAnimationLoop();
            
            this.isInitialized = true;
            console.log('옹벽 3D 뷰어 초기화 완료');
            
        } catch (error) {
            console.error('초기화 중 오류 발생:', error);
            this.showInitError(error.message);
        }
    }
    
    async initCoreModules() {
        // 핵심 모듈 생성
        this.modules.sceneManager = new SceneManager();
        this.modules.animationController = new AnimationController();
        this.modules.hotspotManager = new HotspotManager(this.modules.sceneManager);
        this.modules.modelLoader = new ModelLoader(
            this.modules.sceneManager, 
            this.modules.animationController
        );
        this.modules.uiController = new UIController(
            this.modules.sceneManager,
            this.modules.modelLoader,
            this.modules.animationController,
            this.modules.hotspotManager
        );
        
        // 전역 접근을 위한 참조 (선택적)
        Object.assign(this, this.modules);
    }
    
    async initPlugins() {
        // 플러그인 매니저 생성
        this.pluginManager = new PluginManager(this);
        
        // 기본 플러그인 등록
        await this.pluginManager.register(LightingControlPlugin);
        await this.pluginManager.register(MeasurementPlugin);
        
        // 플러그인 UI 생성
        this.createPluginUI();
        
        // 사용자 정의 플러그인 로드 (설정에서)
        if (CONFIG.plugins && CONFIG.plugins.autoLoad) {
            await this.loadUserPlugins(CONFIG.plugins.autoLoad);
        }
    }
    
    createPluginUI() {
        // 플러그인 UI 컨테이너 생성
        const pluginContainer = document.createElement('div');
        pluginContainer.id = 'plugin-controls';
        pluginContainer.className = 'plugin-controls';
        
        const controlPanel = document.getElementById('control-panel');
        controlPanel.appendChild(pluginContainer);
        
        // 각 플러그인의 UI 생성
        this.pluginManager.plugins.forEach(plugin => {
            const pluginSection = document.createElement('div');
            pluginSection.className = 'plugin-section';
            pluginSection.innerHTML = `<h4>${plugin.name}</h4>`;
            plugin.createUI(pluginSection);
            pluginContainer.appendChild(pluginSection);
        });
    }
    
    async loadUserPlugins(pluginList) {
        for (const pluginPath of pluginList) {
            try {
                const module = await import(pluginPath);
                if (module.default && module.default.prototype instanceof Plugin) {
                    await this.pluginManager.register(module.default);
                }
            } catch (error) {
                console.error(`플러그인 로드 실패: ${pluginPath}`, error);
            }
        }
    }
    
    startAnimationLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            
            if (!this.isInitialized) return;
            
            // FPS 업데이트
            this.uiController.updateFPS();
            
            // 애니메이션 업데이트
            this.animationController.update();
            const frame = this.animationController.getCurrentFrame();
            this.uiController.updateAnimationFrame(frame);
            
            // 핫스팟 위치 업데이트
            this.hotspotManager.updatePositions();
            
            // 플러그인 업데이트
            this.pluginManager.updateAll();
            
            // 렌더링
            this.sceneManager.render();
        };
        
        animate();
    }
    
    checkCompatibility() {
        if (!window.THREE) throw new Error('Three.js가 로드되지 않았습니다.');
        if (!THREE.GLTFLoader) throw new Error('GLTFLoader가 로드되지 않았습니다.');
        if (!THREE.OrbitControls) throw new Error('OrbitControls가 로드되지 않았습니다.');
        
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) {
            throw new Error('WebGL을 초기화할 수 없습니다.');
        }
    }
    
    showInitError(message) {
        const errorDiv = document.getElementById('error') || document.createElement('div');
        errorDiv.id = 'error';
        errorDiv.className = 'error';
        errorDiv.style.display = 'block';
        errorDiv.style.position = 'fixed';
        errorDiv.innerHTML = `<h2>초기화 오류</h2><p>${message}</p>`;
        if (!document.getElementById('error')) {
            document.body.appendChild(errorDiv);
        }
    }
    
    // 외부에서 접근 가능한 API
    getPlugin(name) {
        return this.pluginManager.get(name);
    }
    
    async addPlugin(PluginClass) {
        const plugin = await this.pluginManager.register(PluginClass);
        
        // UI 업데이트
        const pluginSection = document.createElement('div');
        pluginSection.className = 'plugin-section';
        pluginSection.innerHTML = `<h4>${plugin.name}</h4>`;
        plugin.createUI(pluginSection);
        document.getElementById('plugin-controls').appendChild(pluginSection);
        
        return plugin;
    }
    
    removePlugin(name) {
        this.pluginManager.unregister(name);
        // UI에서도 제거
    }
}

// 전역 앱 인스턴스
let app;

// 초기화
async function init() {
    app = new WallViewerApp();
    await app.init();
    
    // 전역 접근 (디버깅용)
    if (CONFIG.debug) {
        window.wallViewerApp = app;
    }
}

// 페이지 로드 완료 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// 개발자 콘솔 환영 메시지
console.log('%c옹벽 3D 뷰어', 'font-size: 20px; color: #007bff; font-weight: bold;');
if (CONFIG.debug) {
    console.log('%c디버그 모드 활성화됨', 'color: #00ff88;');
    console.log('앱 인스턴스: window.wallViewerApp');
    console.log('플러그인 추가: wallViewerApp.addPlugin(YourPlugin)');
}

// 전역 오류 처리
window.addEventListener('error', function(event) {
    console.error('전역 오류 발생:', event.error);
    if (app) {
        app.showInitError(`예상치 못한 오류: ${event.error?.message || '알 수 없는 오류'}`);
    }
});

export { WallViewerApp };