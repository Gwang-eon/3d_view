// ModelLoader.js - 기본 모델 설정과 개선사항이 포함된 완전한 버전

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 모델 로더 클래스
 * - ConfigManager 기반 설정 관리
 * - 자동 에러 복구 시스템
 * - 진행률 추적 및 최적화
 * - 캐싱 및 메모리 관리
 * - 성능 최적화
 * - 배치 로딩 지원
 * - 스트리밍 로딩
 */
export class ModelLoader {
    constructor(sceneManager, animationController) {
        // 서비스 의존성
        this.sceneManager = sceneManager;
        this.animationController = animationController;
        
        // Three.js 로더들
        this.gltfLoader = null;
        this.loadingManager = null;
        this.textureLoader = null;
        this.dracoLoader = null;
        this.ktx2Loader = null;
        
        // 기본 모델 설정
        this.defaultModelIndex = null;
        this.models = getConfig('models', []);
        
        // 로딩 상태 관리
        this.loadingState = {
            isLoading: false,
            currentModel: null,
            currentModelData: null,
            progress: 0,
            loadStartTime: 0,
            retryCount: 0,
            phase: 'idle', // 'idle', 'downloading', 'parsing', 'processing', 'complete'
            itemsLoaded: 0,
            itemsTotal: 0
        };
        
        // 캐시 시스템
        this.modelCache = new Map();
        this.textureCache = new Map();
        this.preloadQueue = [];
        this.enableCaching = getConfig('models.enableCaching', true);
        this.maxCacheSize = getConfig('models.maxCacheSize', 5);
        
        // 통계 및 성능
        this.stats = {
            totalLoaded: 0,
            totalErrors: 0,
            totalCacheHits: 0,
            averageLoadTime: 0,
            loadTimes: [],
            memoryUsage: 0,
            lastLoadInfo: null
        };
        
        // 에러 복구 시스템
        this.errorRecovery = {
            maxRetries: getConfig('models.maxRetries', 3),
            retryDelay: getConfig('models.retryDelay', 1000),
            fallbackModels: getConfig('models.fallbackModels', []),
            enableFallback: getConfig('models.enableFallback', true)
        };
        
        // 최적화 설정
        this.optimization = {
            enableStreaming: getConfig('models.enableStreaming', false),
            enablePreloading: getConfig('models.enablePreloading', true),
            maxConcurrentLoads: getConfig('models.maxConcurrentLoads', 3),
            textureOptimization: getConfig('models.textureOptimization', true)
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // 바인드된 메서드들
        this.handleLoadingStart = this.handleLoadingStart.bind(this);
        this.handleLoadingProgress = this.handleLoadingProgress.bind(this);
        this.handleLoadingComplete = this.handleLoadingComplete.bind(this);
        this.handleLoadingError = this.handleLoadingError.bind(this);
        
        console.log('[ModelLoader] 생성됨');
    }
    
    /**
     * 초기화
     */
    async init() {
        console.log('[ModelLoader] 초기화 시작');
        
        try {
            // 로딩 매니저 설정
            this.setupLoadingManager();
            
            // 로더들 설정
            await this.setupLoaders();
            
            // 설정 검증
            this.validateConfiguration();
            
            // 프리로딩 시작
            if (this.optimization.enablePreloading && this.defaultModelIndex !== null) {
                this.startPreloading();
            }
            
            this.emit('initialized');
            console.log('[ModelLoader] 초기화 완료');
            
        } catch (error) {
            console.error('[ModelLoader] 초기화 실패:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * 로딩 매니저 설정
     */
    setupLoadingManager() {
        this.loadingManager = new THREE.LoadingManager(
            this.handleLoadingComplete,
            this.handleLoadingProgress,
            this.handleLoadingError
        );
        
        this.loadingManager.onStart = this.handleLoadingStart;
    }
    
    /**
     * 로더들 설정
     */
    async setupLoaders() {
        // GLTF 로더
        this.gltfLoader = new THREE.GLTFLoader(this.loadingManager);
        
        // Draco 로더 설정 (압축된 모델용)
        if (getConfig('models.enableDracoLoader', true)) {
            this.dracoLoader = new THREE.DRACOLoader();
            this.dracoLoader.setDecoderPath(getConfig('models.dracoDecoderPath', './libs/draco/'));
            this.gltfLoader.setDRACOLoader(this.dracoLoader);
        }
        
        // KTX2 로더 설정 (압축된 텍스처용)
        if (getConfig('models.enableKTX2Loader', false)) {
            this.ktx2Loader = new THREE.KTX2Loader(this.loadingManager);
            this.ktx2Loader.setTranscoderPath(getConfig('models.ktx2TranscoderPath', './libs/basis/'));
            this.gltfLoader.setKTX2Loader(this.ktx2Loader);
        }
        
        // 텍스처 로더
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
    }
    
    /**
     * 설정 검증
     */
    validateConfiguration() {
        if (!this.models || this.models.length === 0) {
            console.warn('[ModelLoader] 모델 목록이 비어있습니다.');
            return false;
        }
        
        // 각 모델 설정 검증
        this.models.forEach((model, index) => {
            if (!model.folder || !model.fileName) {
                console.warn(`[ModelLoader] 모델 ${index}의 설정이 올바르지 않습니다.`);
            }
        });
        
        return true;
    }
    
    /**
     * 기본 모델 설정
     */
    setDefaultModel(index) {
        if (index >= 0 && index < this.models.length) {
            this.defaultModelIndex = index;
            console.log(`[ModelLoader] 기본 모델 설정: ${index} - ${this.models[index].name}`);
        } else {
            console.warn(`[ModelLoader] 잘못된 모델 인덱스: ${index}`);
        }
    }
    
    /**
     * 모델 로드
     */
    async loadModel(index) {
        if (!this.validateModelIndex(index)) {
            const error = new Error(`잘못된 모델 인덱스: ${index}`);
            this.emit('loading:error', { error, index });
            throw error;
        }
        
        const modelData = this.models[index];
        console.log(`[ModelLoader] 모델 로드 시작: ${modelData.name}`);
        
        try {
            this.setLoadingState(true, index, modelData);
            this.emit('loading:start', { 
                modelData, 
                index,
                message: `${modelData.name} 로딩 중...`
            });
            
            // 캐시 확인
            const cacheKey = this.generateCacheKey(modelData);
            if (this.enableCaching && this.modelCache.has(cacheKey)) {
                console.log(`[ModelLoader] 캐시에서 로드: ${modelData.name}`);
                this.stats.totalCacheHits++;
                return await this.loadFromCache(cacheKey, modelData, index);
            }
            
            // 새로 로드
            const result = await this.loadFromFile(modelData, index);
            
            this.setLoadingState(false);
            return result;
            
        } catch (error) {
            console.error(`[ModelLoader] 모델 로드 실패: ${modelData.name}`, error);
            
            // 에러 복구 시도
            if (this.loadingState.retryCount < this.errorRecovery.maxRetries) {
                return await this.retryLoading(index, error);
            } else if (this.errorRecovery.enableFallback && this.errorRecovery.fallbackModels.length > 0) {
                return await this.loadFallbackModel(error);
            }
            
            this.setLoadingState(false);
            this.emit('loading:error', { error, modelData, index });
            throw error;
        }
    }
    
    /**
     * 파일에서 모델 로드
     */
    async loadFromFile(modelData, index) {
        const modelPath = `${modelData.folder}/${modelData.fileName}`;
        const startTime = performance.now();
        
        try {
            this.loadingState.phase = 'downloading';
            
            const gltf = await new Promise((resolve, reject) => {
                this.gltfLoader.load(
                    modelPath,
                    (gltf) => {
                        this.loadingState.phase = 'parsing';
                        resolve(gltf);
                    },
                    (progress) => {
                        // LoadingManager에서 처리
                    },
                    (error) => {
                        reject(error);
                    }
                );
            });
            
            this.loadingState.phase = 'processing';
            
            // 모델 처리
            const loadTime = (performance.now() - startTime) / 1000;
            const modelInfo = await this.generateModelInfo(gltf, modelData, loadTime);
            
            // 모델 후처리
            await this.processLoadedModel(gltf, modelInfo);
            
            // 캐시에 저장
            if (this.enableCaching) {
                this.saveToCache(this.generateCacheKey(modelData), gltf, modelInfo);
            }
            
            // 통계 업데이트
            this.updateStats(loadTime, true, modelInfo);
            
            // 씬에 설정
            if (this.sceneManager) {
                this.sceneManager.setModel(gltf.scene, modelInfo);
            }
            
            // 애니메이션 설정
            if (this.animationController && gltf.animations?.length > 0) {
                this.animationController.setAnimations(gltf.animations);
            }
            
            this.loadingState.phase = 'complete';
            this.emit('loading:complete', { gltf, modelInfo, loadTime, fromCache: false });
            
            console.log(`[ModelLoader] ✓ 로드 완료: ${modelData.name} (${loadTime.toFixed(2)}초)`);
            
            return {
                success: true,
                gltf: gltf,
                modelInfo: modelInfo,
                loadTime: loadTime,
                fromCache: false
            };
            
        } catch (error) {
            this.updateStats(0, false);
            throw error;
        }
    }
    
    /**
     * 캐시에서 로드
     */
    async loadFromCache(cacheKey, modelData, index) {
        const cached = this.modelCache.get(cacheKey);
        const startTime = performance.now();
        
        console.log(`[ModelLoader] 캐시에서 로드: ${modelData.name}`);
        this.emit('loading:start', { modelData, index, fromCache: true });
        
        // 캐시된 모델 복제
        const clonedGltf = this.cloneGLTF(cached.gltf);
        const modelInfo = { ...cached.modelInfo };
        
        const loadTime = (performance.now() - startTime) / 1000;
        
        // 씬에 설정
        if (this.sceneManager) {
            this.sceneManager.setModel(clonedGltf.scene, modelInfo);
        }
        
        // 애니메이션 설정
        if (this.animationController && clonedGltf.animations?.length > 0) {
            this.animationController.setAnimations(clonedGltf.animations);
        }
        
        this.emit('loading:complete', { gltf: clonedGltf, modelInfo, loadTime, fromCache: true });
        
        return {
            success: true,
            gltf: clonedGltf,
            modelInfo: modelInfo,
            loadTime: loadTime,
            fromCache: true
        };
    }
    
    /**
     * 모델 정보 생성
     */
    async generateModelInfo(gltf, modelData, loadTime) {
        const info = {
            name: modelData.name,
            fileName: modelData.fileName,
            folder: modelData.folder,
            loadTime: loadTime,
            animations: gltf.animations || [],
            cameras: gltf.cameras || [],
            scene: gltf.scene,
            scenes: gltf.scenes || [],
            asset: gltf.asset || {},
            userData: gltf.userData || {},
            parser: gltf.parser || null,
            stats: {
                vertices: 0,
                triangles: 0,
                meshes: 0,
                materials: 0,
                textures: 0,
                animations: gltf.animations?.length || 0,
                bones: 0,
                memoryEstimate: 0
            }
        };
        
        // 통계 수집
        const stats = this.collectModelStats(gltf.scene);
        info.stats = { ...info.stats, ...stats };
        
        // 메모리 추정
        info.stats.memoryEstimate = this.estimateMemoryUsage(info.stats);
        
        // 경계 상자
        const box = new THREE.Box3().setFromObject(gltf.scene);
        info.boundingBox = box;
        info.boundingCenter = box.getCenter(new THREE.Vector3());
        info.boundingSize = box.getSize(new THREE.Vector3());
        
        return info;
    }
    
    /**
     * 모델 통계 수집
     */
    collectModelStats(object) {
        const stats = {
            vertices: 0,
            triangles: 0,
            meshes: 0,
            materials: new Set(),
            textures: new Set(),
            bones: 0
        };
        
        object.traverse((child) => {
            if (child.isMesh) {
                stats.meshes++;
                
                // 지오메트리 통계
                if (child.geometry) {
                    const geo = child.geometry;
                    stats.vertices += geo.attributes.position?.count || 0;
                    
                    if (geo.index) {
                        stats.triangles += geo.index.count / 3;
                    } else {
                        stats.triangles += (geo.attributes.position?.count || 0) / 3;
                    }
                }
                
                // 머티리얼 통계
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        stats.materials.add(mat.uuid);
                        
                        // 텍스처 수집
                        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach(mapName => {
                            if (mat[mapName]) {
                                stats.textures.add(mat[mapName].uuid);
                            }
                        });
                    });
                }
            } else if (child.isBone) {
                stats.bones++;
            }
        });
        
        return {
            ...stats,
            materials: stats.materials.size,
            textures: stats.textures.size
        };
    }
    
    /**
     * 메모리 사용량 추정
     */
    estimateMemoryUsage(stats) {
        // 대략적인 추정 (바이트 단위)
        const vertexSize = 3 * 4; // position (3 floats)
        const normalSize = 3 * 4; // normal (3 floats)
        const uvSize = 2 * 4; // uv (2 floats)
        const indexSize = 4; // uint32
        
        let memory = 0;
        memory += stats.vertices * (vertexSize + normalSize + uvSize);
        memory += stats.triangles * 3 * indexSize;
        memory += stats.textures * 1024 * 1024 * 4; // 1024x1024 RGBA 텍스처 가정
        
        return memory;
    }
    
    /**
     * 로드된 모델 후처리
     */
    async processLoadedModel(gltf, modelInfo) {
        const scene = gltf.scene;
        
        // 그림자 설정
        if (getConfig('models.enableShadows', true)) {
            scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
        
        // 텍스처 최적화
        if (this.optimization.textureOptimization) {
            await this.optimizeTextures(scene);
        }
        
        // LOD 설정
        if (getConfig('models.enableLOD', false)) {
            this.setupLOD(scene);
        }
        
        // 애니메이션 최적화
        if (gltf.animations?.length > 0) {
            this.optimizeAnimations(gltf.animations);
        }
    }
    
    /**
     * 텍스처 최적화
     */
    async optimizeTextures(scene) {
        const textures = new Set();
        
        scene.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach(mapName => {
                        if (mat[mapName]) {
                            textures.add(mat[mapName]);
                        }
                    });
                });
            }
        });
        
        textures.forEach(texture => {
            // 이방성 필터링
            texture.anisotropy = Math.min(
                getConfig('models.maxAnisotropy', 4),
                this.sceneManager.renderer.capabilities.getMaxAnisotropy()
            );
            
            // 밉맵 생성
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            
            // 텍스처 압축 (WebGL2)
            if (this.sceneManager.renderer.capabilities.isWebGL2) {
                texture.format = THREE.RGBAFormat;
                texture.type = THREE.UnsignedByteType;
            }
        });
    }
    
    /**
     * LOD 설정
     */
    setupLOD(scene) {
        // LOD 구현 (필요시 추가)
        console.log('[ModelLoader] LOD 설정은 아직 구현되지 않았습니다.');
    }
    
    /**
     * 애니메이션 최적화
     */
    optimizeAnimations(animations) {
        animations.forEach(animation => {
            animation.optimize();
        });
    }
    
    /**
     * GLTF 복제
     */
    cloneGLTF(gltf) {
        // 간단한 복제 (전체 deep clone은 복잡함)
        const cloned = {
            scene: gltf.scene.clone(true),
            animations: gltf.animations ? [...gltf.animations] : [],
            cameras: gltf.cameras ? [...gltf.cameras] : [],
            asset: gltf.asset ? { ...gltf.asset } : {},
            userData: gltf.userData ? { ...gltf.userData } : {}
        };
        
        return cloned;
    }
    
    /**
     * 캐시 관리
     */
    generateCacheKey(modelData) {
        return `${modelData.folder}_${modelData.fileName}`;
    }
    
    saveToCache(cacheKey, gltf, modelInfo) {
        if (!this.enableCaching) return;
        
        // 캐시 크기 제한
        if (this.modelCache.size >= this.maxCacheSize) {
            this.clearOldestCache();
        }
        
        // 캐시에 저장
        this.modelCache.set(cacheKey, {
            gltf: gltf,
            modelInfo: modelInfo,
            timestamp: Date.now(),
            accessCount: 1
        });
        
        console.log(`[ModelLoader] 모델 캐시됨: ${cacheKey}`);
    }
    
    clearOldestCache() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        this.modelCache.forEach((value, key) => {
            if (value.timestamp < oldestTime) {
                oldestTime = value.timestamp;
                oldestKey = key;
            }
        });
        
        if (oldestKey) {
            this.modelCache.delete(oldestKey);
            console.log(`[ModelLoader] 오래된 캐시 제거: ${oldestKey}`);
        }
    }
    
    clearCache() {
        this.modelCache.clear();
        this.textureCache.clear();
        console.log('[ModelLoader] 전체 캐시 초기화');
    }
    
    /**
     * 에러 처리
     */
    async handleLoadError(error, modelData, index) {
        console.error(`[ModelLoader] 로드 에러: ${modelData.name}`, error);
        
        this.stats.totalErrors++;
        this.emit('loading:error', { error, modelData, index });
        
        // 재시도 또는 폴백
        if (this.loadingState.retryCount < this.errorRecovery.maxRetries) {
            return await this.retryLoading(index, error);
        } else if (this.errorRecovery.enableFallback) {
            return await this.loadFallbackModel(error);
        }
        
        throw error;
    }
    
    async retryLoading(index, previousError) {
        this.loadingState.retryCount++;
        console.log(`[ModelLoader] 재시도 ${this.loadingState.retryCount}/${this.errorRecovery.maxRetries}`);
        
        await new Promise(resolve => setTimeout(resolve, this.errorRecovery.retryDelay));
        
        try {
            return await this.loadModel(index);
        } catch (error) {
            if (this.loadingState.retryCount >= this.errorRecovery.maxRetries) {
                throw previousError;
            }
            return await this.retryLoading(index, error);
        }
    }
    
    async loadFallbackModel(originalError) {
        if (this.errorRecovery.fallbackModels.length === 0) {
            throw originalError;
        }
        
        console.log('[ModelLoader] 폴백 모델 로드 시도');
        
        for (const fallbackIndex of this.errorRecovery.fallbackModels) {
            try {
                return await this.loadModel(fallbackIndex);
            } catch (error) {
                console.error(`[ModelLoader] 폴백 모델 ${fallbackIndex} 로드 실패:`, error);
            }
        }
        
        throw new Error('모든 폴백 모델 로드 실패');
    }
    
    /**
     * 프리로딩
     */
    startPreloading() {
        if (!this.optimization.enablePreloading) return;
        
        // 기본 모델 주변의 모델들을 미리 로드
        const preloadIndices = [];
        
        if (this.defaultModelIndex !== null) {
            // 기본 모델 전후 모델들 추가
            if (this.defaultModelIndex > 0) {
                preloadIndices.push(this.defaultModelIndex - 1);
            }
            if (this.defaultModelIndex < this.models.length - 1) {
                preloadIndices.push(this.defaultModelIndex + 1);
            }
        }
        
        // 백그라운드에서 로드
        preloadIndices.forEach(index => {
            if (index >= 0 && index < this.models.length) {
                this.preloadModel(index);
            }
        });
    }
    
    async preloadModel(index) {
        if (!this.validateModelIndex(index)) return;
        
        const modelData = this.models[index];
        const cacheKey = this.generateCacheKey(modelData);
        
        // 이미 캐시에 있으면 스킵
        if (this.modelCache.has(cacheKey)) return;
        
        console.log(`[ModelLoader] 프리로드 시작: ${modelData.name}`);
        
        try {
            // 낮은 우선순위로 로드
            const result = await this.loadFromFile(modelData, index);
            console.log(`[ModelLoader] 프리로드 완료: ${modelData.name}`);
        } catch (error) {
            console.warn(`[ModelLoader] 프리로드 실패: ${modelData.name}`, error);
        }
    }
    
    /**
     * 유효성 검사
     */
    validateModelIndex(index) {
        if (typeof index !== 'number' || index < 0 || index >= this.models.length) {
            console.error(`[ModelLoader] 잘못된 모델 인덱스: ${index}`);
            return false;
        }
        return true;
    }
    
    /**
     * 로딩 상태 설정
     */
    setLoadingState(isLoading, modelIndex = null, modelData = null) {
        this.loadingState.isLoading = isLoading;
        
        if (isLoading) {
            this.loadingState.currentModel = modelIndex;
            this.loadingState.currentModelData = modelData;
            this.loadingState.progress = 0;
            this.loadingState.loadStartTime = performance.now();
            this.loadingState.retryCount = 0;
            this.loadingState.phase = 'idle';
            this.loadingState.itemsLoaded = 0;
            this.loadingState.itemsTotal = 0;
        }
    }
    
    /**
     * 통계 업데이트
     */
    updateStats(loadTime, success, modelInfo = null) {
        if (success) {
            this.stats.totalLoaded++;
            this.stats.loadTimes.push(loadTime);
            this.stats.averageLoadTime = this.stats.loadTimes.reduce((a, b) => a + b, 0) / this.stats.loadTimes.length;
            this.stats.lastLoadInfo = modelInfo;
            
            if (modelInfo?.stats?.memoryEstimate) {
                this.stats.memoryUsage += modelInfo.stats.memoryEstimate;
            }
        } else {
            this.stats.totalErrors++;
        }
        
        // 배열 크기 제한
        if (this.stats.loadTimes.length > 100) {
            this.stats.loadTimes = this.stats.loadTimes.slice(-50);
        }
    }
    
    /**
     * 로딩 이벤트 핸들러들
     */
    handleLoadingStart(url, itemsLoaded, itemsTotal) {
        this.loadingState.phase = 'downloading';
        this.loadingState.itemsLoaded = itemsLoaded;
        this.loadingState.itemsTotal = itemsTotal;
        
        console.log(`[ModelLoader] 리소스 로딩 시작: ${url}`);
        this.emit('loading:resource:start', { url, itemsLoaded, itemsTotal });
    }
    
    handleLoadingProgress(url, itemsLoaded, itemsTotal) {
        this.loadingState.itemsLoaded = itemsLoaded;
        this.loadingState.itemsTotal = itemsTotal;
        
        const progress = itemsTotal > 0 ? (itemsLoaded / itemsTotal) * 100 : 0;
        this.loadingState.progress = progress;
        
        this.emit('loading:progress', { 
            progress, 
            url, 
            itemsLoaded, 
            itemsTotal,
            message: `로딩 중... ${Math.round(progress)}%`
        });
    }
    
    handleLoadingComplete() {
        console.log('[ModelLoader] 모든 리소스 로딩 완료');
        this.emit('loading:resource:complete');
    }
    
    handleLoadingError(url) {
        console.error(`[ModelLoader] 리소스 로딩 실패: ${url}`);
        this.emit('loading:resource:error', { url });
    }
    
    /**
     * 앱 참조 설정 (의존성 주입)
     */
    setApp(app) {
        this.app = app;
    }
    
    /**
     * 이벤트 시스템
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
        return this;
    }
    
    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
        return this;
    }
    
    once(event, callback) {
        const onceWrapper = (...args) => {
            callback(...args);
            this.off(event, onceWrapper);
        };
        this.on(event, onceWrapper);
        return this;
    }
    
    emit(event, ...args) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`[ModelLoader] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
        return this;
    }
    
    /**
     * 정리
     */
    dispose() {
        console.log('[ModelLoader] 정리 중...');
        
        // 로딩 중단
        if (this.loadingState.isLoading) {
            this.setLoadingState(false);
        }
        
        // 캐시 정리
        this.clearCache();
        
        // 로더 정리
        if (this.dracoLoader) {
            this.dracoLoader.dispose();
        }
        if (this.ktx2Loader) {
            this.ktx2Loader.dispose();
        }
        
        // 이벤트 정리
        this.events.clear();
        
        this.emit('disposed');
        console.log('[ModelLoader] 정리 완료');
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[ModelLoader] 디버그 정보');
        console.log('기본 모델:', this.defaultModelIndex);
        console.log('로딩 상태:', this.loadingState);
        console.log('캐시 상태:', {
            모델: this.modelCache.size,
            텍스처: this.textureCache.size,
            최대크기: this.maxCacheSize
        });
        console.log('통계:', this.stats);
        console.log('최적화 설정:', this.optimization);
        console.log('에러 복구 설정:', this.errorRecovery);
        console.groupEnd();
    }
    
    /**
     * 상태 정보 가져오기
     */
    getStatus() {
        return {
            isLoading: this.loadingState.isLoading,
            progress: this.loadingState.progress,
            phase: this.loadingState.phase,
            currentModel: this.loadingState.currentModelData?.name || null,
            stats: { ...this.stats },
            cacheSize: this.modelCache.size,
            defaultModel: this.defaultModelIndex
        };
    }
    
    /**
     * 모델 목록 가져오기
     */
    getModelList() {
        return this.models.map((model, index) => ({
            index: index,
            name: model.name,
            fileName: model.fileName,
            folder: model.folder,
            isDefault: index === this.defaultModelIndex,
            isCached: this.modelCache.has(this.generateCacheKey(model))
        }));
    }
}

export default ModelLoader;