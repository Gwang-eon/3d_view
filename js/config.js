// js/config.js
// 통합 설정 파일 - ConfigManager와 통합하면서도 하위 호환성 유지
// 기존 코드는 수정 없이 계속 사용 가능

import { CONFIG_MANAGER, getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 기본 설정 정의
 * - ConfigManager에 등록
 * - 환경별 설정 자동 적용
 * - 기존 CONFIG 객체로도 접근 가능
 */
const initializeConfig = () => {
    // === 애플리케이션 기본 설정 ===
    CONFIG_MANAGER.setConfig('app', {
        name: 'Wall 3D Viewer',
        version: '2.0.0',
        debug: CONFIG_MANAGER.environment === 'development'
    });
    
    // === 모델 설정 ===
    CONFIG_MANAGER.setConfig('models', [
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
    ]);
    
    // === 경로 설정 ===
    CONFIG_MANAGER.setConfig('paths', {
        modelsPath: './gltf/',
        texturesPath: './textures/',
        pluginsPath: './js/plugins/'
    });
    
    // === 씬 설정 ===
    CONFIG_MANAGER.setConfig('scene', {
        backgroundColor: 0x1a1a1a,
        fogColor: 0x1a1a1a,
        fogNear: 50,
        fogFar: 200,
        
        // 그리드 설정
        grid: {
            size: 50,
            divisions: 50,
            centerLineColor: 0x444444,
            gridColor: 0x222222,
            visible: true
        },
        
        // 축 헬퍼 설정
        axes: {
            size: 10,
            visible: true
        }
    });
    
    // === 카메라 설정 (scene 내부로 이동) ===
    CONFIG_MANAGER.merge('scene', {
        camera: {
            fov: 45,
            near: 0.1,
            far: 1000,
            position: { x: 5, y: 5, z: 10 },
            lookAt: { x: 0, y: 0, z: 0 }
        }
    });
    
    // === 컨트롤 설정 (scene 내부로 이동) ===
    CONFIG_MANAGER.merge('scene', {
        controls: {
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
        }
    });
    
    // === 렌더러 설정 (scene 내부로 이동) ===
    CONFIG_MANAGER.merge('scene', {
        renderer: {
            antialias: true,
            shadowMapEnabled: true,
            shadowMapType: THREE.PCFSoftShadowMap,
            toneMappingExposure: 1.0,
            powerPreference: "high-performance"
        }
    });
    
    // === 조명 설정 (scene 내부로 이동) ===
    CONFIG_MANAGER.merge('scene', {
        lights: {
            ambient: {
                color: 0x404040,
                intensity: CONFIG_MANAGER.environment === 'development' ? 0.8 : 0.6
            },
            directional: {
                color: 0xffffff,
                intensity: CONFIG_MANAGER.environment === 'development' ? 1.2 : 1.0,
                position: { x: 10, y: 10, z: 5 },
                castShadow: true,
                shadow: {
                    mapSize: CONFIG_MANAGER.environment === 'development' ? 2048 : 1024,
                    camera: {
                        near: 0.5,
                        far: 50,
                        left: -20,
                        right: 20,
                        top: 20,
                        bottom: -20
                    }
                }
            },
            hemisphere: {
                skyColor: 0x87CEEB,
                groundColor: 0x362907,
                intensity: 0.6
            }
        }
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
        rememberLastModel: true
    });
    
    // === 성능 설정 (환경별 자동 조정) ===
    const performanceSettings = CONFIG_MANAGER.environment === 'production' ? {
        targetFPS: 60,
        adaptiveQuality: true,
        maxTextureSize: 2048,
        enablePostProcessing: false,
        LOD: {
            enabled: true,
            levels: [10, 30, 50]
        }
    } : {
        targetFPS: 60,
        adaptiveQuality: false,
        maxTextureSize: 4096,
        enablePostProcessing: true,
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
        logLevel: CONFIG_MANAGER.environment === 'development' ? 'debug' : 'error'
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
        // 특별한 경우 처리
        if (prop === 'modelsPath') {
            return getConfig('paths.modelsPath', './gltf/');
        }
        if (prop === 'debug') {
            return getConfig('app.debug', false);
        }
        
        // scene 내부 설정들을 최상위로 노출 (하위 호환성)
        if (prop === 'camera') {
            return getConfig('scene.camera');
        }
        if (prop === 'controls') {
            return getConfig('scene.controls');
        }
        if (prop === 'renderer') {
            return getConfig('scene.renderer');
        }
        if (prop === 'lights') {
            return getConfig('scene.lights');
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
 * - 새로운 코드에서 사용 가능
 * - 기존 코드는 CONFIG 객체 계속 사용
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
            setConfig('renderer.shadowMapEnabled', false);
            break;
        case 'medium':
            setConfig('performance.targetFPS', 45);
            setConfig('renderer.antialias', true);
            setConfig('renderer.shadowMapEnabled', true);
            setConfig('lights.directional.shadow.mapSize', 1024);
            break;
        case 'high':
            setConfig('performance.targetFPS', 60);
            setConfig('renderer.antialias', true);
            setConfig('renderer.shadowMapEnabled', true);
            setConfig('lights.directional.shadow.mapSize', 2048);
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
            if (settings.ui) CONFIG_MANAGER.merge('ui', settings.ui);
            if (settings.performance) CONFIG_MANAGER.merge('performance', settings.performance);
            if (settings.controls) CONFIG_MANAGER.merge('controls', settings.controls);
            
            console.log('설정이 복원되었습니다.');
            return true;
        }
    } catch (error) {
        console.error('설정 복원 실패:', error);
    }
    return false;
}

/**
 * 설정 변경 리스너 (새 기능)
 * 주의: onChange 메서드는 ConfigManager에 구현 필요
 */
// CONFIG_MANAGER.onChange는 아직 구현되지 않음
// 필요시 아래 코드 활성화
/*
CONFIG_MANAGER.onChange((key, value) => {
    // 특정 설정 변경 시 자동 처리
    if (key === 'ui.theme') {
        document.body.className = `theme-${value}`;
    }
    
    if (key === 'app.debug') {
        console.log(`디버그 모드 ${value ? '활성화' : '비활성화'}`);
    }
});
*/

// 개발 환경에서 전역 접근 허용
if (CONFIG_MANAGER.environment === 'development') {
    window.CONFIG = CONFIG;
    window.CONFIG_MANAGER = CONFIG_MANAGER;
    window.getConfig = getConfig;
    window.setConfig = setConfig;
    
    console.log('[Config] 개발 모드 - 전역 접근 가능');
    console.log('사용 가능한 명령어:');
    console.log('- CONFIG.models');
    console.log('- getConfig("app.debug")');
    console.log('- setConfig("app.debug", true)');
    console.log('- toggleDebug()');
    console.log('- saveSettings()');
}

// 설정 자동 복원 (옵션)
if (getConfig('ui.rememberLastModel', true)) {
    loadSettings();
}

// modelsPath 호환성 추가
Object.defineProperty(CONFIG, 'modelsPath', {
    get() {
        return getConfig('paths.modelsPath', './gltf/');
    },
    set(value) {
        setConfig('paths.modelsPath', value);
    }
});

// 기본 내보내기
export default CONFIG;