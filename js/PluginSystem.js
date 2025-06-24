// js/PluginSystem.js
import { UIComponent, SliderComponent, ButtonGroupComponent, SelectComponent } from './UIComponent.js';

// 플러그인 베이스 클래스
export class Plugin {
    constructor(name, version = '1.0.0') {
        this.name = name;
        this.version = version;
        this.enabled = true;
    }
    
    // 플러그인 초기화
    async init(context) {
        this.context = context;
        console.log(`[Plugin] ${this.name} v${this.version} 초기화`);
    }
    
    // UI 생성
    createUI(container) {
        // 서브클래스에서 구현
    }
    
    // 플러그인 활성화
    enable() {
        this.enabled = true;
        this.onEnable();
    }
    
    // 플러그인 비활성화
    disable() {
        this.enabled = false;
        this.onDisable();
    }
    
    // 오버라이드 가능한 메서드들
    onEnable() {}
    onDisable() {}
    onUpdate() {}
    destroy() {}
}

// 플러그인 매니저
export class PluginManager {
    constructor(app) {
        this.app = app;
        this.plugins = new Map();
        this.context = {
            sceneManager: app.sceneManager,
            modelLoader: app.modelLoader,
            animationController: app.animationController,
            hotspotManager: app.hotspotManager,
            uiController: app.uiController
        };
    }
    
    // 플러그인 등록
    async register(PluginClass) {
        const plugin = new PluginClass();
        await plugin.init(this.context);
        this.plugins.set(plugin.name, plugin);
        console.log(`[PluginManager] ${plugin.name} 플러그인 등록됨`);
        return plugin;
    }
    
    // 플러그인 제거
    unregister(name) {
        const plugin = this.plugins.get(name);
        if (plugin) {
            plugin.destroy();
            this.plugins.delete(name);
            console.log(`[PluginManager] ${name} 플러그인 제거됨`);
        }
    }
    
    // 플러그인 가져오기
    get(name) {
        return this.plugins.get(name);
    }
    
    // 모든 플러그인 업데이트
    updateAll() {
        this.plugins.forEach(plugin => {
            if (plugin.enabled) {
                plugin.onUpdate();
            }
        });
    }
}

// 예제 플러그인: 조명 컨트롤
export class LightingControlPlugin extends Plugin {
    constructor() {
        super('LightingControl', '1.0.0');
        this.ui = {};
    }
    
    async init(context) {
        await super.init(context);
        this.setupDefaultValues();
    }
    
    setupDefaultValues() {
        this.brightness = 1.2;
        this.mainLightIntensity = 1.2;
        this.ambientIntensity = 0.8;
    }
    
    createUI(container) {
        // SliderComponent를 사용한 UI 생성
        this.ui.brightnessSlider = new SliderComponent('brightness-slider', container, {
            label: '전체 밝기',
            min: 0.5,
            max: 2.0,
            step: 0.1,
            value: this.brightness,
            onChange: (value) => this.setBrightness(value)
        }).mount();
        
        this.ui.mainLightSlider = new SliderComponent('mainlight-slider', container, {
            label: '주 조명 강도',
            min: 0,
            max: 2.0,
            step: 0.1,
            value: this.mainLightIntensity,
            onChange: (value) => this.setMainLight(value)
        }).mount();
        
        this.ui.ambientSlider = new SliderComponent('ambient-slider', container, {
            label: '환경광 강도',
            min: 0,
            max: 1.5,
            step: 0.1,
            value: this.ambientIntensity,
            onChange: (value) => this.setAmbientLight(value)
        }).mount();
    }
    
    setBrightness(value) {
        this.brightness = value;
        this.context.sceneManager.renderer.toneMappingExposure = value;
    }
    
    setMainLight(value) {
        this.mainLightIntensity = value;
        if (this.context.sceneManager.lights.directional) {
            this.context.sceneManager.lights.directional.intensity = value;
        }
    }
    
    setAmbientLight(value) {
        this.ambientIntensity = value;
        if (this.context.sceneManager.lights.ambient) {
            this.context.sceneManager.lights.ambient.intensity = value;
        }
    }
    
    // 설정 저장/불러오기
    saveSettings() {
        return {
            brightness: this.brightness,
            mainLightIntensity: this.mainLightIntensity,
            ambientIntensity: this.ambientIntensity
        };
    }
    
    loadSettings(settings) {
        if (settings.brightness !== undefined) {
            this.setBrightness(settings.brightness);
            this.ui.brightnessSlider.setValue(settings.brightness);
        }
        if (settings.mainLightIntensity !== undefined) {
            this.setMainLight(settings.mainLightIntensity);
            this.ui.mainLightSlider.setValue(settings.mainLightIntensity);
        }
        if (settings.ambientIntensity !== undefined) {
            this.setAmbientLight(settings.ambientIntensity);
            this.ui.ambientSlider.setValue(settings.ambientIntensity);
        }
    }
}

// 예제 플러그인: 측정 도구
export class MeasurementPlugin extends Plugin {
    constructor() {
        super('Measurement', '1.0.0');
        this.measurementMode = false;
        this.points = [];
    }
    
    createUI(container) {
        this.ui = new ButtonGroupComponent('measurement-controls', container, [
            {
                id: 'measure-distance',
                text: '📏 거리 측정',
                onClick: () => this.toggleMeasurement()
            },
            {
                id: 'clear-measurements',
                text: '🗑️ 측정 지우기',
                onClick: () => this.clearMeasurements()
            }
        ]).mount();
    }
    
    toggleMeasurement() {
        this.measurementMode = !this.measurementMode;
        console.log(`측정 모드: ${this.measurementMode ? 'ON' : 'OFF'}`);
    }
    
    clearMeasurements() {
        this.points = [];
        console.log('측정 지점 초기화');
    }
}