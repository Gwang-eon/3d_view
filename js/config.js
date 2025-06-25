// js/config.js
// 통합 설정 파일 - CONFIG 구조 통일 버전

import { CONFIG_MANAGER, getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 기본 설정 정의
 * - ConfigManager에 등록
 * - 환경별 설정 자동 적용
 * - CONFIG 구조 통일
 */
const initializeConfig = () => {
    // === 애플리케이션 기본 설정 ===
    CONFIG_MANAGER.setConfig('app', {
        name: 'Wall 3D Viewer',
        version: '2.0.0',
        debug: CONFIG_MANAGER.environment === 'development',
        enableCache: true
    });
    
    // === 타이밍 설정 ===
    CONFIG_MANAGER.setConfig('timing', {
        maxRetryAttempts: 20,
        retryDelay: 100
    });
    
    // === 모델 설정 ===
    CONFIG_MANAGER.setConfig('models', {
        defaultModel: 0,
        enableCaching: true,
        maxCacheSize: 5,
        maxRetries: 3,
        retryDelay: 1000,
        fallbackModels: [],
        enableFallback: true,
        enableStreaming: false,
        enablePreloading: true,
        maxConcurrentLoads: 3,
        textureOptimization: true,
        enableDracoLoader: true,
        dracoDecoderPath: './libs/draco/',
        enableKTX2Loader: false,
        ktx2TranscoderPath: './libs/basis/',
        enableShadows: true,
        enableLOD: false,
        maxAnisotropy: 4,
        defaultModels: [
            {
                name: '블록 옹벽',
                folder: 'Block_Retaining_Wall',
                fileName: 'Block_Retaining_Wall.gltf',
                icon: '🧱',
                description: '콘크리트 블록을 이용한 조립식 옹벽'
            },
            {
                name: '캔틸레버 옹벽',
                folder: 'Cantilever_Retaining_Wall',
                fileName: 'Cantilever_Retaining_Wall.gltf',
                icon: '🏗️',
                description: '철근 콘크리트 일체형 옹벽'
            },
            {
                name: 'MSE 옹벽',
                folder: 'mse_Retaining_Wall',
                fileName: 'mse_Retaining_Wall.gltf',
                icon: '🔧',
                description: '보강토 옹벽 (Mechanically Stabilized Earth)'
            }
        ]
    });
    
    // === 경로 설정 ===
    CONFIG_MANAGER.setConfig('paths', {
        modelsPath: './gltf/',
        texturesPath: './textures/',
        pluginsPath: './js/plugins/'
    });
    
    // === 씬 설정 ===
    CONFIG_MANAGER.setConfig('scene', {
        backgroundColor: 0x1a1a1a,
        fogEnabled: true,
        fogColor: 0x1a1a1a,
        fogNear: 10,
        fogFar: 100
    });
    
    // === 카메라 설정 ===
    CONFIG_MANAGER.setConfig('camera', {
        fov: 45,
        near: 0.1,
        far: 1000,
        position: { x: 5, y: 5, z: 10 },
        lookAt: { x: 0, y: 0, z: 0 }
    });
    
    // === 컨트롤 설정 ===
    CONFIG_MANAGER.setConfig('controls', {
        enabled: true,
        enableDamping: true,
        dampingFactor: 0.1,
        
        // 회전 설정
        rotateSpeed: 0.5,
        autoRotate: false,
        autoRotateSpeed: 2.0,
        
        // 줌 설정
        enableZoom: true,
        zoomSpeed: 0.5,
        minDistance: 2,
        maxDistance: 100,
        
        // 팬 설정
        enablePan: true,
        panSpeed: 0.5,
        screenSpacePanning: true,
        
        // 제한 설정
        minPolarAngle: 0,
        maxPolarAngle: Math.PI * 0.9
    });
    
    // === 렌더러 설정 - CONFIG 구조 통일 ===
    CONFIG_MANAGER.setConfig('renderer', {
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance",
        
        // shadowMap을 객체로 설정
        shadowMap: {
            enabled: true,
            type: 'PCFSoftShadowMap',
            autoUpdate: true
        },
        
        // 톤매핑 설정
        toneMapping: 'ACESFilmicToneMapping',
        toneMappingExposure: 1.0,
        
        // 색상 공간
        outputEncoding: 'sRGBEncoding',
        
        // 픽셀 비율
        pixelRatio: window.devicePixelRatio || 1,
        
        // 물리 기반 렌더링
        physicallyCorrectLights: true
    });
    
    // === 조명 설정 - CONFIG 구조 통일 ===
    CONFIG_MANAGER.setConfig('lights', {
        ambient: {
            color: 0x404040,
            intensity: CONFIG_MANAGER.environment === 'development' ? 0.8 : 0.6
        },
        directional: {
            color: 0xffffff,
            intensity: CONFIG_MANAGER.environment === 'development' ? 1.2 : 1.0,
            position: { x: 10, y: 10, z: 5 },
            castShadow: true,
            shadowMapSize: CONFIG_MANAGER.environment === 'development' ? 2048 : 1024,
            shadowCamera: {
                near: 0.5,
                far: 50,
                size: 20,
                left: -20,
                right: 20,
                top: 20,
                bottom: -20
            }
        },
        hemisphere: {
            skyColor: 0x87CEEB,
            groundColor: 0x362907,
            intensity: 0.6
        }
    });
    
    // === 헬퍼 설정 ===
    CONFIG_MANAGER.setConfig('helpers', {
        grid: {
            enabled: true,
            visible: true,
            size: 50,
            divisions: 50,
            colorCenterLine: 0x444444,
            colorGrid: 0x222222
        },
        axes: {
            enabled: true,
            visible: CONFIG_MANAGER.environment === 'development',
            size: 10
        }
    });
    
    // === 환경 설정 ===
    CONFIG_MANAGER.setConfig('environment', {
        showFloor: true,
        floorSize: 100,
        floorColor: 0x202020,
        floorOpacity: 0.3,
        floorPosition: { x: 0, y: -0.001, z: 0 }
    });
    
    // === 애니메이션 설정 ===
    CONFIG_MANAGER.setConfig('animation', {
        defaultDuration: 3.0,
        defaultEasing: 'easeInOutQuad',
        enabledByDefault: true,
        showControls: true,
        loop: true
    });
    
    // === 핫스팟 설정 ===
    CONFIG_MANAGER.setConfig('hotspots', {
        enabled: true,
        showLabels: true,
        labelMaxDistance: 50,
        defaultColor: '#007bff',
        hoverColor: '#0056b3',
        activeColor: '#28a745',
        animationDuration: 300,
        minScale: 0.5,
        maxScale: 1.5
    });
    
    // === UI 설정 ===
    CONFIG_MANAGER.setConfig('ui', {
        theme: 'dark',
        language: 'ko',
        showFPS: CONFIG_MANAGER.environment === 'development',
        showStats: CONFIG_MANAGER.environment === 'development',
        errorMessageDuration: 5000,
        successMessageDuration: 3000,
        animationSpeed: 300,
        rememberLastModel: true,
        updateInterval: 100,
        enablePerformanceMonitoring: true,
        elementDefaults: {},
        accessibility: {},
        parentMapping: {},
        components: {}
    });
    
    // === 성능 설정 ===
    const performanceSettings = CONFIG_MANAGER.environment === 'production' ? {
        targetFPS: 60,
        minAcceptableFPS: 20,
        adaptiveQuality: true,
        enableMonitoring: true,
        logMetrics: false,
        maxTextureSize: 2048,
        enablePostProcessing: false,
        powerPreference: 'high-performance',
        LOD: {
            enabled: true,
            levels: [10, 30, 50]
        }
    } : {
        targetFPS: 60,
        minAcceptableFPS: 20,
        adaptiveQuality: false,
        enableMonitoring: true,
        logMetrics: true,
        maxTextureSize: 4096,
        enablePostProcessing: true,
        powerPreference: 'high-performance',
        LOD: {
            enabled: false,
            levels: []
        }
    };
    
    CONFIG_MANAGER.setConfig('performance', performanceSettings);
    
    // === 플러그인 설정 ===
    CONFIG_MANAGER.setConfig('plugins', {
        enabled: true,
        autoLoad: ['LightingControl', 'MeasurementTool'],
        allowThirdParty: CONFIG_MANAGER.environment === 'development'
    });
    
    // === 개발 도구 설정 ===
    CONFIG_MANAGER.setConfig('devTools', {
        enabled: CONFIG_MANAGER.environment === 'development',
        showAxesHelper: true,
        showGridHelper: true,
        showLightHelpers: false,
        enableHotReload: true,
        logLevel: CONFIG_MANAGER.environment === 'development' ? 'debug' : 'error',
        gridSize: 100,
        gridDivisions: 100,
        axesSize: 5,
        showHelpers: CONFIG_MANAGER.environment === 'development'
    });
    
    // === 객체 가시성 설정 ===
    CONFIG_MANAGER.setConfig('objectVisibility', {
        enableAnimations: true,
        animationDuration: 300,
        fadeInEasing: 'easeOut',
        fadeOutEasing: 'easeIn',
        enableGrouping: true,
        enableLayers: true,
        enableMaterialPreservation: true,
        enableHighlight: true,
        highlightColor: '#ffff00',
        highlightEmissive: 0.3
    });
    
    // === 에러 처리 설정 ===
    CONFIG_MANAGER.setConfig('errors', {
        autoRecovery: true,
        maxAutoRecoveryAttempts: 3,
        showUserErrors: true,
        logToConsole: CONFIG_MANAGER.environment === 'development',
        reportToServer: CONFIG_MANAGER.environment === 'production'
    });
};

// 설정 초기화 실행
initializeConfig();

/**
 * 기존 CONFIG 객체 생성 (하위 호환성)
 * - 기존 코드는 이 객체를 계속 사용 가능
 * - 내부적으로는 ConfigManager의 설정을 참조
 */
export const CONFIG = new Proxy({}, {
    get(target, prop) {
        // 직접 매핑되는 최상위 속성들
        const directMappings = {
            'modelsPath': 'paths.modelsPath',
            'debug': 'app.debug',
            'camera': 'camera',
            'controls': 'controls',
            'renderer': 'renderer',
            'lights': 'lights',
            'helpers': 'helpers',
            'environment': 'environment',
            'scene': 'scene',
            'animation': 'animation',
            'hotspots': 'hotspots',
            'ui': 'ui',
            'performance': 'performance',
            'models': 'models.defaultModels'
        };
        
        if (directMappings[prop]) {
            return getConfig(directMappings[prop]);
        }
        
        // 일반적인 경우
        const value = getConfig(prop);
        if (value !== undefined) {
            return value;
        }
        
        // 중첩된 객체 처리
        return new Proxy({}, {
            get(subTarget, subProp) {
                return getConfig(`${prop}.${subProp}`);
            }
        });
    },
    
    set(target, prop, value) {
        setConfig(prop, value);
        return true;
    }
});

/**
 * 런타임 설정 변경 헬퍼 함수들
 */

// 디버그 모드 토글
export function toggleDebug() {
    const currentDebug = getConfig('app.debug');
    setConfig('app.debug', !currentDebug);
    console.log(`디버그 모드: ${!currentDebug ? '활성화' : '비활성화'}`);
}

// 성능 모드 설정
export function setPerformanceMode(mode) {
    switch(mode) {
        case 'low':
            setConfig('performance.targetFPS', 30);
            setConfig('renderer.antialias', false);
            setConfig('renderer.shadowMap.enabled', false);
            break;
        case 'medium':
            setConfig('performance.targetFPS', 45);
            setConfig('renderer.antialias', true);
            setConfig('renderer.shadowMap.enabled', true);
            setConfig('lights.directional.shadowMapSize', 1024);
            break;
        case 'high':
            setConfig('performance.targetFPS', 60);
            setConfig('renderer.antialias', true);
            setConfig('renderer.shadowMap.enabled', true);
            setConfig('lights.directional.shadowMapSize', 2048);
            break;
    }
}

// 테마 변경
export function setTheme(theme) {
    setConfig('ui.theme', theme);
    document.body.className = `theme-${theme}`;
}

// 언어 변경
export function setLanguage(lang) {
    setConfig('ui.language', lang);
    // 언어 변경 로직 추가 가능
}

/**
 * 설정 저장/복원 (로컬 스토리지)
 */
export function saveSettings() {
    const settings = {
        ui: getConfig('ui'),
        performance: getConfig('performance'),
        controls: getConfig('controls')
    };
    
    try {
        localStorage.setItem('wall_viewer_settings', JSON.stringify(settings));
        console.log('설정이 저장되었습니다.');
        return true;
    } catch (error) {
        console.error('설정 저장 실패:', error);
        return false;
    }
}

export function loadSettings() {
    try {
        const saved = localStorage.getItem('wall_viewer_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            
            // 저장된 설정 적용
            if (settings.ui) {
                Object.entries(settings.ui).forEach(([key, value]) => {
                    setConfig(`ui.${key}`, value);
                });
            }
            
            if (settings.performance) {
                Object.entries(settings.performance).forEach(([key, value]) => {
                    setConfig(`performance.${key}`, value);
                });
            }
            
            if (settings.controls) {
                Object.entries(settings.controls).forEach(([key, value]) => {
                    setConfig(`controls.${key}`, value);
                });
            }
            
            console.log('설정이 복원되었습니다.');
            return true;
        }
    } catch (error) {
        console.error('설정 복원 실패:', error);
    }
    return false;
}

// 설정 초기화
export function resetSettings() {
    localStorage.removeItem('wall_viewer_settings');
    CONFIG_MANAGER.resetToDefaults();
    console.log('설정이 초기화되었습니다.');
}

// 자동 설정 로드
if (getConfig('ui.rememberLastModel', true)) {
    loadSettings();
}

console.log('[Config] 설정 초기화 완료');
console.log(`[Config] 환경: ${CONFIG_MANAGER.environment}`);
console.log(`[Config] 디버그 모드: ${getConfig('app.debug') ? '활성' : '비활성'}`);