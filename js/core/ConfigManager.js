// js/core/ConfigManager.js
// 완전한 설정 관리 시스템 - 모든 하드코딩 제거

/**
 * 설정 관리 클래스
 * - 환경별 설정 (development/production)
 * - 런타임 설정 변경 지원
 * - 설정 검증 및 기본값 제공
 * - 타입 안전성 보장
 */
export class ConfigManager {
    constructor() {
        this.configs = new Map();
        this.environment = this.detectEnvironment();
        this.listeners = new Set();
        
        // 기본 설정 로드
        this.loadDefaultConfigs();
        
        console.log(`[ConfigManager] 환경: ${this.environment}`);
    }
    
    /**
     * 환경 감지 (자동)
     */
    detectEnvironment() {
        // URL 기반 환경 감지
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            return 'development';
        }
        
        // 쿼리 파라미터로 강제 설정 가능
        const urlParams = new URLSearchParams(location.search);
        const envParam = urlParams.get('env');
        if (envParam && ['development', 'production'].includes(envParam)) {
            return envParam;
        }
        
        return 'production';
    }
    
    /**
     * 기본 설정 로드
     */
    loadDefaultConfigs() {
        // === 애플리케이션 기본 설정 ===
        this.setConfig('app', {
            name: 'Wall 3D Viewer',
            version: '2.0.0',
            debug: this.environment === 'development',
            verbose: this.environment === 'development'
        });
        
        // === 타이밍 관련 설정 (하드코딩 제거) ===
        this.setConfig('timing', {
            // 기존 하드코딩: 20, 100
            maxRetryAttempts: this.environment === 'development' ? 50 : 10,
            retryDelay: this.environment === 'development' ? 200 : 100,
            loadingTimeout: 30000, // 30초
            animationDelay: 16, // 60fps
            transitionDuration: 1000,
            debounceDelay: 300
        });
        
        // === DOM 셀렉터 설정 (하드코딩 제거) ===
        this.setConfig('selectors', {
            // 필수 요소들
            modelSelector: '#model-selector',
            modelList: '#model-list',
            canvasContainer: '#canvas-container',
            loadingScreen: '#loading',
            
            // 뷰어 전용 요소들
            progressBar: '#progress-fill',
            progressText: '#progress-text',
            changeModelBtn: '#changeModel',
            
            // 정보 표시 요소들
            meshCount: '#mesh-count',
            vertexCount: '#vertex-count',
            triangleCount: '#triangle-count',
            hotspotCount: '#hotspot-count',
            fpsDisplay: '#fps',
            loadTime: '#load-time',
            
            // 컨트롤 요소들
            controlPanel: '#control-panel',
            leftPanel: '#left-panel',
            rightPanel: '#right-panel',
            animationControls: '#animation-controls',
            timelineContainer: '#timeline-container',
            
            // 카메라 관련
            cameraView: '#camera-view',
            cameraSpeed: '#camera-speed',
            cameraEasing: '#camera-easing'
        });
        
        // === 3D 씬 설정 ===
        this.setConfig('scene', {
            // 카메라 설정
            camera: {
                fov: 75,
                near: 0.1,
                far: 1000,
                position: { x: 10, y: 8, z: 15 },
                target: { x: 0, y: 0, z: 0 }
            },
            
            // 조명 설정
            lighting: {
                ambient: {
                    color: 0x404040,
                    intensity: 0.8
                },
                directional: {
                    color: 0xffffff,
                    intensity: 1.2,
                    position: { x: 10, y: 10, z: 5 },
                    castShadow: true,
                    shadowMapSize: this.environment === 'development' ? 1024 : 2048
                }
            },
            
            // 렌더러 설정
            renderer: {
                antialias: true,
                shadowMapEnabled: true,
                shadowMapType: 'PCFSoftShadowMap', // THREE.PCFSoftShadowMap
                pixelRatio: Math.min(window.devicePixelRatio, 2),
                backgroundColor: 0x000000,
                alpha: true
            },
            
            // 컨트롤 설정
            controls: {
                enableDamping: true,
                dampingFactor: 0.05,
                enableZoom: true,
                enableRotate: true,
                enablePan: true,
                maxDistance: 100,
                minDistance: 1,
                maxPolarAngle: Math.PI * 0.8
            }
        });
        
        // === 모델 관련 설정 ===
        this.setConfig('models', {
            basePath: 'gltf/',
            defaultModels: [
                {
                    name: '블록 옹벽',
                    folder: 'Block_Retaining_Wall',
                    fileName: 'Block_Retaining_Wall.gltf',
                    icon: '🧱',
                    description: '프리캐스트 블록을 활용한 옹벽 구조'
                },
                {
                    name: '캔틸레버 옹벽',
                    folder: 'Cantilever_Retaining_Wall',
                    fileName: 'Cantilever_Retaining_Wall.gltf',
                    icon: '🏗️',
                    description: '캔틸레버식 옹벽 구조'
                },
                {
                    name: 'MSE 옹벽',
                    folder: 'mse_Retaining_Wall',
                    fileName: 'mse_Retaining_Wall.gltf',
                    icon: '🏛️',
                    description: 'Mechanically Stabilized Earth 옹벽'
                }
            ],
            loadingOptions: {
                crossOrigin: 'anonymous',
                withCredentials: false
            }
        });
        
        // === 핫스팟 설정 ===
        this.setConfig('hotspots', {
            prefix: 'HS_', // 핫스팟 오브젝트 이름 접두사
            defaultIcon: '📍',
            iconSize: 24,
            clickRadius: 10,
            fadeDistance: 50,
            scaleWithDistance: true,
            minScale: 0.5,
            maxScale: 1.5,
            animationDuration: 300
        });
        
        // === 애니메이션 설정 ===
        this.setConfig('animation', {
            defaultSpeed: 1.0,
            minSpeed: 0.1,
            maxSpeed: 3.0,
            speedStep: 0.1,
            autoPlay: false,
            loop: true,
            frameRate: 30
        });
        
        // === UI 설정 ===
        this.setConfig('ui', {
            panelWidth: 300,
            panelAnimationDuration: 300,
            tooltipDelay: 500,
            notificationDuration: 3000,
            fpsUpdateInterval: 1000,
            theme: 'dark', // 'dark' | 'light'
            language: 'ko' // 'ko' | 'en'
        });
        
        // === 성능 설정 ===
        this.setConfig('performance', {
            maxTriangles: 1000000, // 100만개
            maxTextureSize: 2048,
            enableLOD: this.environment === 'production',
            enableOcclusion: this.environment === 'production',
            targetFPS: 60,
            adaptiveQuality: true
        });
        
        // === 개발 도구 설정 ===
        if (this.environment === 'development') {
            this.setConfig('devTools', {
                showStats: true,
                showGrid: true,
                showAxes: true,
                enableHotReload: true,
                verbose: true,
                showBoundingBoxes: false,
                showWireframe: false
            });
        }
        
        // === 플러그인 설정 ===
        this.setConfig('plugins', {
            autoLoad: [
                // 기본 플러그인들
                './plugins/LightingControlPlugin.js',
                './plugins/MeasurementPlugin.js'
            ],
            enabled: {
                lighting: true,
                measurement: true,
                objectVisibility: true
            }
        });
        
        // === 에러 처리 설정 ===
        this.setConfig('errors', {
            showUserFriendlyMessages: true,
            autoRecovery: this.environment === 'production',
            maxAutoRecoveryAttempts: 3,
            logLevel: this.environment === 'development' ? 'debug' : 'error',
            reportErrors: this.environment === 'production'
        });
    }
    
    /**
     * 설정값 가져오기
     * @param {string} key - 설정 키 ('app.debug' 또는 'app' 형태)
     * @param {any} defaultValue - 기본값
     * @returns {any} 설정값
     */
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let config = this.configs.get(keys[0]);
        
        if (!config) {
            if (defaultValue !== null) {
                console.warn(`[ConfigManager] 설정 키 '${key}' 를 찾을 수 없습니다. 기본값 사용: ${defaultValue}`);
                return defaultValue;
            }
            throw new Error(`설정 키 '${key}' 를 찾을 수 없습니다.`);
        }
        
        // 중첩된 키 처리
        for (let i = 1; i < keys.length; i++) {
            if (config && typeof config === 'object' && keys[i] in config) {
                config = config[keys[i]];
            } else {
                if (defaultValue !== null) {
                    console.warn(`[ConfigManager] 설정 키 '${key}' 를 찾을 수 없습니다. 기본값 사용: ${defaultValue}`);
                    return defaultValue;
                }
                throw new Error(`설정 키 '${key}' 를 찾을 수 없습니다.`);
            }
        }
        
        return config;
    }
    
    /**
     * 설정값 설정
     * @param {string} key - 설정 키
     * @param {any} value - 설정값
     */
    set(key, value) {
        const keys = key.split('.');
        const mainKey = keys[0];
        
        if (keys.length === 1) {
            this.configs.set(mainKey, value);
        } else {
            let config = this.configs.get(mainKey) || {};
            let current = config;
            
            // 중첩된 키 생성
            for (let i = 1; i < keys.length - 1; i++) {
                if (!current[keys[i]]) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            this.configs.set(mainKey, config);
        }
        
        // 변경 알림
        this.notifyChange(key, value);
        
        if (this.get('app.verbose')) {
            console.log(`[ConfigManager] 설정 변경: ${key} = ${value}`);
        }
    }
    
    /**
     * 전체 설정 카테고리 설정
     * @param {string} category - 카테고리명
     * @param {object} config - 설정 객체
     */
    setConfig(category, config) {
        this.configs.set(category, { ...config });
    }
    
    /**
     * 설정값 병합
     * @param {string} key - 설정 키
     * @param {object} values - 병합할 값들
     */
    merge(key, values) {
        const existing = this.get(key, {});
        const merged = { ...existing, ...values };
        this.set(key, merged);
    }
    
    /**
     * 환경별 설정 적용
     * @param {object} envConfigs - 환경별 설정
     */
    applyEnvironmentConfig(envConfigs) {
        const envConfig = envConfigs[this.environment];
        if (envConfig) {
            Object.entries(envConfig).forEach(([key, value]) => {
                this.merge(key, value);
            });
        }
    }
    
    /**
     * 설정 변경 리스너 등록
     * @param {function} callback - 콜백 함수
     */
    addChangeListener(callback) {
        this.listeners.add(callback);
    }
    
    /**
     * 설정 변경 리스너 제거
     * @param {function} callback - 콜백 함수
     */
    removeChangeListener(callback) {
        this.listeners.delete(callback);
    }
    
    /**
     * 설정 변경 알림
     * @param {string} key - 변경된 키
     * @param {any} value - 새 값
     */
    notifyChange(key, value) {
        this.listeners.forEach(callback => {
            try {
                callback(key, value);
            } catch (error) {
                console.error('[ConfigManager] 리스너 콜백 오류:', error);
            }
        });
    }
    
    /**
     * 설정 검증
     * @param {string} key - 검증할 키
     * @param {function} validator - 검증 함수
     * @returns {boolean} 검증 결과
     */
    validate(key, validator) {
        try {
            const value = this.get(key);
            return validator(value);
        } catch (error) {
            console.error(`[ConfigManager] 설정 검증 실패: ${key}`, error);
            return false;
        }
    }
    
    /**
     * 설정 백업
     * @returns {object} 백업된 설정
     */
    backup() {
        const backup = {};
        this.configs.forEach((value, key) => {
            backup[key] = JSON.parse(JSON.stringify(value));
        });
        return backup;
    }
    
    /**
     * 설정 복원
     * @param {object} backup - 백업된 설정
     */
    restore(backup) {
        Object.entries(backup).forEach(([key, value]) => {
            this.setConfig(key, value);
        });
    }
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        if (!this.get('app.debug')) return;
        
        console.group('[ConfigManager] 현재 설정');
        this.configs.forEach((value, key) => {
            console.log(`${key}:`, value);
        });
        console.groupEnd();
    }
    
    /**
     * 설정을 URL 쿼리로 내보내기
     * @param {array} keys - 내보낼 설정 키들
     * @returns {string} 쿼리 문자열
     */
    exportToQuery(keys) {
        const params = new URLSearchParams();
        keys.forEach(key => {
            try {
                const value = this.get(key);
                params.set(key, JSON.stringify(value));
            } catch (error) {
                console.warn(`[ConfigManager] 쿼리 내보내기 실패: ${key}`);
            }
        });
        return params.toString();
    }
    
    /**
     * URL 쿼리에서 설정 가져오기
     * @param {array} keys - 가져올 설정 키들
     */
    importFromQuery(keys) {
        const params = new URLSearchParams(location.search);
        keys.forEach(key => {
            const value = params.get(key);
            if (value) {
                try {
                    this.set(key, JSON.parse(value));
                } catch (error) {
                    console.warn(`[ConfigManager] 쿼리 가져오기 실패: ${key}`, error);
                }
            }
        });
    }
}

/**
 * 전역 ConfigManager 인스턴스
 */
export const CONFIG_MANAGER = new ConfigManager();

/**
 * 편의 함수들
 */
export const getConfig = (key, defaultValue) => CONFIG_MANAGER.get(key, defaultValue);
export const setConfig = (key, value) => CONFIG_MANAGER.set(key, value);
export const mergeConfig = (key, value) => CONFIG_MANAGER.merge(key, value);

// 개발 모드에서 전역 접근 허용
if (typeof window !== 'undefined' && CONFIG_MANAGER.get('app.debug')) {
    window.CONFIG_MANAGER = CONFIG_MANAGER;
    window.getConfig = getConfig;
    window.setConfig = setConfig;
    console.log('[ConfigManager] 전역 접근 활성화 (개발 모드)');
}

export default CONFIG_MANAGER;