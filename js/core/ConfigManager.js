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
            maxRetryAttempts: this.environment === 'development' ? 50 : 10,
            retryDelay: this.environment === 'development' ? 200 : 100,
            loadingTimeout: 30000,
            animationDelay: 16,
            transitionDuration: 1000,
            debounceDelay: 300
        });
        
        // === DOM 셀렉터 설정 (하드코딩 제거) ===
        this.setConfig('selectors', {
            modelSelector: '#model-selector',
            modelList: '#model-list',
            canvasContainer: '#canvas-container',
            loadingScreen: '#loading',
            progressBar: '#progress-fill',
            progressText: '#progress-text',
            changeModelBtn: '#changeModel',
            meshCount: '#mesh-count',
            vertexCount: '#vertex-count',
            triangleCount: '#triangle-count',
            hotspotCount: '#hotspot-count',
            fpsDisplay: '#fps',
            loadTime: '#load-time',
            controlPanel: '#control-panel',
            leftPanel: '#left-panel',
            rightPanel: '#right-panel',
            animationControls: '#animation-controls',
            timelineContainer: '#timeline-container',
            cameraView: '#camera-view',
            cameraSpeed: '#camera-speed',
            cameraEasing: '#camera-easing',
            error: '#error',
            loading: '#loading'
        });
        
        // === 3D 씬 설정 ===
        this.setConfig('scene', {
            camera: {
                fov: 75,
                near: 0.1,
                far: 1000,
                position: { x: 10, y: 8, z: 15 },
                target: { x: 0, y: 0, z: 0 }
            },
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
                    shadowMapSize: this.environment === 'development' ? 2048 : 1024
                }
            },
            renderer: {
                antialias: this.environment === 'development',
                pixelRatio: window.devicePixelRatio || 1,
                shadowMap: true,
                toneMapping: true,
                exposure: 1.0
            },
            material: {
                roughness: 0.5,
                metalness: 0.5,
                envMapIntensity: 1.0
            }
        });
        
        // === UI 설정 ===
        this.setConfig('ui', {
            theme: 'dark',
            language: 'ko',
            showFPS: this.environment === 'development',
            showStats: this.environment === 'development',
            errorMessageDuration: 5000,
            successMessageDuration: 3000,
            animationSpeed: 300,
            rememberLastModel: true
        });
        
        // === 성능 설정 ===
        this.setConfig('performance', {
            targetFPS: 60,
            minAcceptableFPS: 20,
            adaptiveQuality: true,
            enableMonitoring: true,
            logMetrics: this.environment === 'development'
        });
        
        // === 핫스팟 설정 ===
        this.setConfig('hotspots', {
            enabled: true,
            showLabels: true,
            showTooltips: true,
            labelMaxDistance: 50,
            defaultColor: '#007bff',
            hoverColor: '#0056b3',
            activeColor: '#28a745'
        });
        
        // === 모델 설정 ===
        this.setConfig('models', {
            basePath: './gltf/',
            checkFileExists: true,
            loadingTimeout: 30000,
            maxFileSize: 50, // MB
            preloadList: [],
            defaultModels: [] // config.js에서 설정
        });
        
        // === 개발 도구 ===
        this.setConfig('devTools', {
            gridSize: 100,
            gridDivisions: 100,
            axesSize: 5,
            showHelpers: this.environment === 'development'
        });
    }
    
    /**
     * 설정값 가져오기
     * @param {string} key - 설정 키 (점 표기법 지원)
     * @param {any} defaultValue - 기본값
     * @returns {any} 설정값
     */
    get(key, defaultValue = undefined) {
        const keys = key.split('.');
        let config = this.configs.get(keys[0]);
        
        if (!config && defaultValue !== undefined) {
            return defaultValue;
        }
        
        if (keys.length === 1) {
            return config !== undefined ? config : defaultValue;
        }
        
        // 중첩된 키 탐색
        for (let i = 1; i < keys.length; i++) {
            if (!config || typeof config !== 'object') {
                return defaultValue;
            }
            config = config[keys[i]];
        }
        
        return config !== undefined ? config : defaultValue;
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
        
        if (this.get('app.verbose', false)) {
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
     * @returns {function} unsubscribe 함수
     */
    onChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
    
    /**
     * 변경 알림
     * @private
     */
    notifyChange(key, value) {
        this.listeners.forEach(listener => {
            try {
                listener(key, value);
            } catch (error) {
                console.error('[ConfigManager] 리스너 오류:', error);
            }
        });
    }
    
    /**
     * 전체 설정 가져오기
     * @returns {object} 전체 설정 객체
     */
    getAll() {
        const result = {};
        this.configs.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
    
    /**
     * 설정 재설정
     * @param {string} category - 카테고리명
     */
    reset(category) {
        if (category) {
            this.configs.delete(category);
        } else {
            this.configs.clear();
            this.loadDefaultConfigs();
        }
    }
    
    /**
     * 설정 검증
     * @param {string} key - 설정 키
     * @param {any} value - 검증할 값
     * @returns {boolean} 유효성 여부
     */
    validate(key, value) {
        // 간단한 타입 검증 예시
        const expectedTypes = {
            'app.debug': 'boolean',
            'performance.targetFPS': 'number',
            'ui.theme': 'string'
        };
        
        const expectedType = expectedTypes[key];
        if (expectedType) {
            return typeof value === expectedType;
        }
        
        return true;
    }
    
    /**
     * 설정을 로컬 스토리지에 저장
     * @param {string} prefix - 저장 키 접두사
     */
    saveToLocalStorage(prefix = 'app_config') {
        try {
            const config = this.getAll();
            localStorage.setItem(prefix, JSON.stringify(config));
            return true;
        } catch (error) {
            console.error('[ConfigManager] 로컬 스토리지 저장 실패:', error);
            return false;
        }
    }
    
    /**
     * 로컬 스토리지에서 설정 로드
     * @param {string} prefix - 저장 키 접두사
     */
    loadFromLocalStorage(prefix = 'app_config') {
        try {
            const saved = localStorage.getItem(prefix);
            if (saved) {
                const config = JSON.parse(saved);
                Object.entries(config).forEach(([key, value]) => {
                    this.setConfig(key, value);
                });
                return true;
            }
        } catch (error) {
            console.error('[ConfigManager] 로컬 스토리지 로드 실패:', error);
        }
        return false;
    }
    
    /**
     * 디버그 정보 출력
     */
    debug() {
        console.group('[ConfigManager] 설정 정보');
        console.log('환경:', this.environment);
        console.log('설정 카테고리:', Array.from(this.configs.keys()));
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