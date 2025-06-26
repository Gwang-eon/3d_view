// js/ModelLoader.js
// 모델 로더 - 원본 버전

import { getConfig, setConfig } from './core/ConfigManager.js';

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
            phase: 'idle',
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
        
        console.log('[ModelLoader] 생성됨');
    }
    
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
    
    setupLoadingManager() {
        this.loadingManager = new THREE.LoadingManager(
            () => { console.log('[ModelLoader] 모든 리소스 로드 완료'); },
            (url, itemsLoaded, itemsTotal) => {
                const progress = (itemsLoaded / itemsTotal) * 100;
                this.loadingState.progress = progress;
                this.emit('loading:progress', { url, itemsLoaded, itemsTotal, progress });
            },
            (url) => {
                console.error(`[ModelLoader] 로드 에러: ${url}`);
                this.stats.totalErrors++;
            }
        );
    }
    
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
    
    validateConfiguration() {
        if (!this.models || this.models.length === 0) {
            console.warn('[ModelLoader] 모델 목록이 비어있습니다.');
            return false;
        }
        
        this.models.forEach((model, index) => {
            if (!model.folder || !model.fileName) {
                console.warn(`[ModelLoader] 모델 ${index}의 설정이 올바르지 않습니다.`);
            }
        });
        
        return true;
    }
    
    setDefaultModel(index) {
        if (index >= 0 && index < this.models.length) {
            this.defaultModelIndex = index;
            console.log(`[ModelLoader] 기본 모델 설정: ${index} - ${this.models[index].name}`);
        } else {
            console.warn(`[ModelLoader] 잘못된 모델 인덱스: ${index}`);
        }
    }
    
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
            
            // ⚠️ 수정 필요: scene 파라미터 추가
            // 애니메이션 설정
            if (this.animationController && gltf.animations?.length > 0) {
                this.animationController.setAnimations(gltf.animations, gltf.scene);  // ← 여기에 , gltf.scene 추가
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
        
        // ⚠️ 수정 필요: scene 파라미터 추가
        // 애니메이션 설정
        if (this.animationController && clonedGltf.animations?.length > 0) {
            this.animationController.setAnimations(clonedGltf.animations, clonedGltf.scene);  // ← 여기에 , clonedGltf.scene 추가
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
                
                if (child.geometry) {
                    const geo = child.geometry;
                    stats.vertices += geo.attributes.position?.count || 0;
                    
                    if (geo.index) {
                        stats.triangles += geo.index.count / 3;
                    } else {
                        stats.triangles += (geo.attributes.position?.count || 0) / 3;
                    }
                }
                
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        stats.materials.add(mat.uuid);
                        
                        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach(mapName => {
                            if (mat[mapName]) {
                                stats.textures.add(mat[mapName].uuid);
                            }
                        });
                    });
                }
            }
            
            if (child.isBone) {
                stats.bones++;
            }
        });
        
        return {
            ...stats,
            materials: stats.materials.size,
            textures: stats.textures.size
        };
    }
    
    estimateMemoryUsage(stats) {
        const vertexSize = 32;
        const indexSize = 4;
        const textureSize = 4;
        
        const memory = (
            (stats.vertices * vertexSize) +
            (stats.triangles * 3 * indexSize) +
            (stats.textures * textureSize * 1024 * 1024)
        ) / (1024 * 1024);
        
        return Math.round(memory * 100) / 100;
    }
    
    async processLoadedModel(gltf, modelInfo) {
        // 그림자 설정
        if (getConfig('renderer.shadowMap', true)) {
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        }
        
        // 머티리얼 최적화
        this.optimizeMaterials(gltf.scene);
        
        // 텍스처 최적화
        this.optimizeTextures(gltf.scene);
        
        // 애니메이션 최적화
        if (gltf.animations?.length > 0) {
            this.optimizeAnimations(gltf.animations);
        }
    }
    
    optimizeMaterials(scene) {
        scene.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(mat => {
                    if (mat.isMeshStandardMaterial) {
                        mat.envMapIntensity = getConfig('models.envMapIntensity', 1);
                    }
                });
            }
        });
    }
    
    optimizeTextures(scene) {
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
            texture.anisotropy = Math.min(
                getConfig('models.maxAnisotropy', 4),
                this.sceneManager.renderer.capabilities.getMaxAnisotropy()
            );
            
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            
            if (this.sceneManager.renderer.capabilities.isWebGL2) {
                texture.format = THREE.RGBAFormat;
                texture.type = THREE.UnsignedByteType;
            }
        });
    }
    
    optimizeAnimations(animations) {
        animations.forEach(animation => {
            animation.optimize();
        });
    }
    
    cloneGLTF(gltf) {
        const cloned = {
            scene: gltf.scene.clone(true),
            animations: gltf.animations ? [...gltf.animations] : [],
            cameras: gltf.cameras ? [...gltf.cameras] : [],
            asset: gltf.asset ? { ...gltf.asset } : {},
            userData: gltf.userData ? { ...gltf.userData } : {}
        };
        
        return cloned;
    }
    
    generateCacheKey(modelData) {
        return `${modelData.folder}_${modelData.fileName}`;
    }
    
    saveToCache(cacheKey, gltf, modelInfo) {
        if (!this.enableCaching) return;
        
        if (this.modelCache.size >= this.maxCacheSize) {
            this.clearOldestCache();
        }
        
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
    
    async retryLoading(index, previousError) {
        this.loadingState.retryCount++;
        console.log(`[ModelLoader] 재시도 ${this.loadingState.retryCount}/${this.errorRecovery.maxRetries}`);
        
        await this.sleep(this.errorRecovery.retryDelay);
        
        try {
            return await this.loadModel(index);
        } catch (error) {
            throw error;
        }
    }
    
    async loadFallbackModel(originalError) {
        console.log('[ModelLoader] 폴백 모델 로드 시도');
        
        for (const fallbackIndex of this.errorRecovery.fallbackModels) {
            try {
                return await this.loadModel(fallbackIndex);
            } catch (error) {
                console.warn(`[ModelLoader] 폴백 모델 ${fallbackIndex} 로드 실패`);
            }
        }
        
        throw originalError;
    }
    
    setLoadingState(isLoading, modelIndex = null, modelData = null) {
        this.loadingState.isLoading = isLoading;
        
        if (isLoading) {
            this.loadingState.currentModel = modelIndex;
            this.loadingState.currentModelData = modelData;
            this.loadingState.loadStartTime = performance.now();
        } else {
            this.loadingState.progress = 0;
            this.loadingState.phase = 'idle';
            this.loadingState.retryCount = 0;
        }
    }
    
    updateStats(loadTime, success, modelInfo = null) {
        if (success) {
            this.stats.totalLoaded++;
            this.stats.loadTimes.push(loadTime);
            
            const sum = this.stats.loadTimes.reduce((a, b) => a + b, 0);
            this.stats.averageLoadTime = sum / this.stats.loadTimes.length;
            
            if (this.stats.loadTimes.length > 10) {
                this.stats.loadTimes.shift();
            }
            
            if (modelInfo) {
                this.stats.memoryUsage = modelInfo.stats.memoryEstimate;
                this.stats.lastLoadInfo = modelInfo;
            }
        } else {
            this.stats.totalErrors++;
        }
    }
    
    validateModelIndex(index) {
        if (typeof index !== 'number' || index < 0 || index >= this.models.length) {
            console.error(`[ModelLoader] 잘못된 모델 인덱스: ${index}`);
            return false;
        }
        return true;
    }
    
    startPreloading() {
        if (!this.optimization.enablePreloading) return;
        
        console.log('[ModelLoader] 프리로딩 시작');
        
        const preloadIndices = [];
        
        if (this.defaultModelIndex !== null) {
            if (this.defaultModelIndex > 0) {
                preloadIndices.push(this.defaultModelIndex - 1);
            }
            if (this.defaultModelIndex < this.models.length - 1) {
                preloadIndices.push(this.defaultModelIndex + 1);
            }
        }
        
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
        
        if (this.modelCache.has(cacheKey)) return;
        
        console.log(`[ModelLoader] 프리로드 시작: ${modelData.name}`);
        
        try {
            const result = await this.loadFromFile(modelData, index);
            console.log(`[ModelLoader] 프리로드 완료: ${modelData.name}`);
        } catch (error) {
            console.warn(`[ModelLoader] 프리로드 실패: ${modelData.name}`, error);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 이벤트 시스템
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
        return this;
    }
    
    off(event, callback) {
        if (this.events.has(event)) {
            const callbacks = this.events.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
        return this;
    }
    
    emit(event, data = {}) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[ModelLoader] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
        return this;
    }
    
    dispose() {
        console.log('[ModelLoader] 정리 중...');
        
        if (this.loadingState.isLoading) {
            this.setLoadingState(false);
        }
        
        this.clearCache();
        
        if (this.dracoLoader) {
            this.dracoLoader.dispose();
        }
        if (this.ktx2Loader) {
            this.ktx2Loader.dispose();
        }
        
        this.events.clear();
        
        this.emit('disposed');
        console.log('[ModelLoader] 정리 완료');
    }
    
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