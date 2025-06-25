// js/ModelLoader.js
// ConfigManager 기반 완전 개선 버전 - 모든 하드코딩 제거

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 모델 로더 클래스
 * - ConfigManager 기반 설정 관리
 * - 자동 에러 복구 시스템
 * - 진행률 추적 및 최적화
 * - 캐싱 및 메모리 관리
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
        
        // 로딩 상태 관리
        this.loadingState = {
            isLoading: false,
            currentModel: null,
            progress: 0,
            loadStartTime: 0,
            retryCount: 0
        };
        
        // 캐시 시스템
        this.modelCache = new Map();
        this.textureCache = new Map();
        this.enableCaching = getConfig('models.enableCaching', true);
        
        // 통계 및 성능
        this.stats = {
            totalLoaded: 0,
            totalErrors: 0,
            averageLoadTime: 0,
            loadTimes: []
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // 초기화
        this.init();
        
        console.log('[ModelLoader] 초기화 완료');
    }
    
    /**
     * 초기화
     */
    init() {
        try {
            this.setupLoadingManager();
            this.setupLoaders();
            this.validateConfiguration();
            
            this.emit('initialized');
            
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
        this.loadingManager = new THREE.LoadingManager();
        
        // 로딩 시작
        this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
            console.log(`[ModelLoader] 로딩 시작: ${url}`);
            this.handleLoadingStart(url, itemsLoaded, itemsTotal);
        };
        
        // 진행률 업데이트
        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal) * 100;
            this.updateProgress(progress, url);
        };
        
        // 로딩 완료
        this.loadingManager.onLoad = () => {
            console.log('[ModelLoader] 모든 리소스 로딩 완료');
            this.handleLoadingComplete();
        };
        
        // 로딩 에러
        this.loadingManager.onError = (url) => {
            console.error(`[ModelLoader] 리소스 로딩 실패: ${url}`);
            this.handleLoadingError(url);
        };
    }
    
    /**
     * 로더들 설정
     */
    setupLoaders() {
        // GLTF 로더
        this.gltfLoader = new THREE.GLTFLoader(this.loadingManager);
        
        // DRACOLoader 설정 (선택적)
        if (getConfig('models.enableDraco', false)) {
            this.setupDracoLoader();
        }
        
        // KTX2Loader 설정 (선택적)
        if (getConfig('models.enableKTX2', false)) {
            this.setupKTX2Loader();
        }
        
        // 텍스처 로더
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        
        // 로딩 옵션 설정
        const loadingOptions = getConfig('models.loadingOptions', {});
        if (loadingOptions.crossOrigin) {
            this.textureLoader.setCrossOrigin(loadingOptions.crossOrigin);
        }
        
        console.log('[ModelLoader] ✓ 로더 설정 완료');
    }
    
    /**
     * DRACO 로더 설정
     */
    setupDracoLoader() {
        try {
            if (THREE.DRACOLoader) {
                const dracoLoader = new THREE.DRACOLoader();
                const dracoPath = getConfig('models.dracoPath', 'lib/draco/');
                dracoLoader.setDecoderPath(dracoPath);
                this.gltfLoader.setDRACOLoader(dracoLoader);
                
                console.log('[ModelLoader] ✓ DRACO 로더 활성화');
            }
        } catch (error) {
            console.warn('[ModelLoader] DRACO 로더 설정 실패:', error);
        }
    }
    
    /**
     * KTX2 로더 설정
     */
    setupKTX2Loader() {
        try {
            if (THREE.KTX2Loader) {
                const ktx2Loader = new THREE.KTX2Loader();
                const ktx2Path = getConfig('models.ktx2Path', 'lib/ktx2/');
                ktx2Loader.setTranscoderPath(ktx2Path);
                ktx2Loader.detectSupport(this.sceneManager.renderer);
                this.gltfLoader.setKTX2Loader(ktx2Loader);
                
                console.log('[ModelLoader] ✓ KTX2 로더 활성화');
            }
        } catch (error) {
            console.warn('[ModelLoader] KTX2 로더 설정 실패:', error);
        }
    }
    
    /**
     * 설정 검증
     */
    validateConfiguration() {
        const models = getConfig('models.defaultModels', []);
        const basePath = getConfig('models.basePath', 'gltf/');
        
        if (models.length === 0) {
            console.warn('[ModelLoader] 기본 모델이 설정되지 않았습니다.');
        }
        
        if (!basePath.endsWith('/')) {
            setConfig('models.basePath', basePath + '/');
        }
        
        // 지원되는 파일 형식 확인
        const supportedFormats = ['.gltf', '.glb'];
        models.forEach(model => {
            const hasValidFormat = supportedFormats.some(format => 
                model.fileName.toLowerCase().endsWith(format)
            );
            
            if (!hasValidFormat) {
                console.warn(`[ModelLoader] 지원되지 않는 파일 형식: ${model.fileName}`);
            }
        });
    }
    
    /**
     * 모델 로드 (인덱스 기반)
     */
    async loadModel(modelIndex) {
        const models = getConfig('models.defaultModels', []);
        
        if (modelIndex < 0 || modelIndex >= models.length) {
            throw new Error(`잘못된 모델 인덱스: ${modelIndex}`);
        }
        
        const model = models[modelIndex];
        return await this.loadModelByData(model, modelIndex);
    }
    
    /**
     * 모델 로드 (데이터 기반)
     */
    async loadModelByData(modelData, index = null) {
        // 중복 로딩 방지
        if (this.loadingState.isLoading) {
            console.warn('[ModelLoader] 이미 로딩 중입니다.');
            return { success: false, error: '이미 로딩 중입니다.' };
        }
        
        // 로딩 상태 설정
        this.setLoadingState(true, modelData);
        
        try {
            // 캐시 확인
            const cacheKey = this.generateCacheKey(modelData);
            if (this.enableCaching && this.modelCache.has(cacheKey)) {
                console.log('[ModelLoader] 캐시에서 모델 로드:', modelData.name);
                return await this.loadFromCache(cacheKey, modelData, index);
            }
            
            // 실제 파일 로드
            return await this.loadFromFile(modelData, index, cacheKey);
            
        } catch (error) {
            return await this.handleLoadError(error, modelData, index);
        } finally {
            this.setLoadingState(false);
        }
    }
    
    /**
     * 파일에서 로드
     */
    async loadFromFile(modelData, index, cacheKey) {
        const basePath = getConfig('models.basePath');
        const modelPath = `${basePath}${modelData.folder}/${modelData.fileName}`;
        
        console.log(`[ModelLoader] 파일에서 로드: ${modelPath}`);
        this.emit('loading:start', modelData, index);
        
        // 로딩 시작 시간 기록
        const startTime = performance.now();
        this.loadingState.loadStartTime = startTime;
        
        try {
            // GLTF 로드
            const gltf = await this.loadGLTF(modelPath);
            
            // 로드 시간 계산
            const loadTime = (performance.now() - startTime) / 1000;
            
            // 모델 정보 생성
            const modelInfo = await this.generateModelInfo(gltf, modelData, loadTime);
            
            // 모델 처리
            await this.processLoadedModel(gltf, modelInfo);
            
            // 캐시에 저장
            if (this.enableCaching) {
                this.saveToCache(cacheKey, gltf, modelInfo);
            }
            
            // 통계 업데이트
            this.updateStats(loadTime, true);
            
            // 씬에 추가
            if (this.sceneManager) {
                this.sceneManager.addModel(gltf, modelInfo);
            }
            
            this.emit('loading:complete', gltf, modelInfo);
            
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
        
        // 캐시된 모델 복제
        const clonedGltf = this.cloneGLTF(cached.gltf);
        const modelInfo = { ...cached.modelInfo };
        
        const loadTime = (performance.now() - startTime) / 1000;
        
        // 씬에 추가
        if (this.sceneManager) {
            this.sceneManager.addModel(clonedGltf, modelInfo);
        }
        
        this.emit('loading:complete', clonedGltf, modelInfo);
        
        return {
            success: true,
            gltf: clonedGltf,
            modelInfo: modelInfo,
            loadTime: loadTime,
            fromCache: true
        };
    }
    
    /**
     * GLTF 파일 로드 (Promise 기반)
     */
    loadGLTF(path) {
        return new Promise((resolve, reject) => {
            const timeout = getConfig('timing.loadingTimeout', 30000);
            
            // 타임아웃 설정
            const timeoutId = setTimeout(() => {
                reject(new Error(`로딩 타임아웃: ${path}`));
            }, timeout);
            
            this.gltfLoader.load(
                path,
                (gltf) => {
                    clearTimeout(timeoutId);
                    resolve(gltf);
                },
                (progress) => {
                    // 진행률 업데이트는 LoadingManager에서 처리
                },
                (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * 모델 정보 생성
     */
    async generateModelInfo(gltf, modelData, loadTime) {
        const modelInfo = {
            name: modelData.name,
            description: modelData.description || '',
            icon: modelData.icon || '🏗️',
            folder: modelData.folder,
            fileName: modelData.fileName,
            loadTime: loadTime,
            
            // 통계 정보
            stats: this.calculateModelStats(gltf),
            
            // 애니메이션 정보
            animations: this.extractAnimationInfo(gltf),
            
            // 카메라 정보
            cameras: this.extractCameraInfo(gltf),
            
            // 핫스팟 정보
            hotspots: this.extractHotspotInfo(gltf),
            
            // 메타데이터
            metadata: await this.loadModelMetadata(modelData.folder)
        };
        
        return modelInfo;
    }
    
    /**
     * 모델 통계 계산
     */
    calculateModelStats(gltf) {
        let triangles = 0;
        let vertices = 0;
        let meshes = 0;
        let materials = new Set();
        let textures = new Set();
        
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                meshes++;
                
                // 지오메트리 정보
                if (child.geometry) {
                    const positionAttribute = child.geometry.attributes.position;
                    if (positionAttribute) {
                        vertices += positionAttribute.count;
                        
                        if (child.geometry.index) {
                            triangles += child.geometry.index.count / 3;
                        } else {
                            triangles += positionAttribute.count / 3;
                        }
                    }
                }
                
                // 재질 정보
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => materials.add(mat.uuid));
                    } else {
                        materials.add(child.material.uuid);
                        
                        // 텍스처 정보
                        this.extractTexturesFromMaterial(child.material, textures);
                    }
                }
            }
        });
        
        return {
            triangles: Math.round(triangles),
            vertices,
            meshes,
            materials: materials.size,
            textures: textures.size
        };
    }
    
    /**
     * 재질에서 텍스처 추출
     */
    extractTexturesFromMaterial(material, textureSet) {
        const textureProperties = [
            'map', 'normalMap', 'roughnessMap', 'metalnessMap',
            'emissiveMap', 'aoMap', 'envMap', 'lightMap'
        ];
        
        textureProperties.forEach(prop => {
            if (material[prop] && material[prop].uuid) {
                textureSet.add(material[prop].uuid);
            }
        });
    }
    
    /**
     * 애니메이션 정보 추출
     */
    extractAnimationInfo(gltf) {
        if (!gltf.animations || gltf.animations.length === 0) {
            return [];
        }
        
        return gltf.animations.map((animation, index) => ({
            name: animation.name || `Animation ${index + 1}`,
            duration: animation.duration,
            tracks: animation.tracks.length,
            index: index
        }));
    }
    
    /**
     * 카메라 정보 추출
     */
    extractCameraInfo(gltf) {
        if (!gltf.cameras || gltf.cameras.length === 0) {
            return [];
        }
        
        return gltf.cameras.map((camera, index) => ({
            name: camera.name || `Camera ${index + 1}`,
            type: camera.type,
            fov: camera.fov,
            near: camera.near,
            far: camera.far,
            index: index
        }));
    }
    
    /**
     * 핫스팟 정보 추출
     */
    extractHotspotInfo(gltf) {
        const hotspots = [];
        const hotspotPrefix = getConfig('hotspots.prefix', 'HS_');
        
        gltf.scene.traverse((child) => {
            if (child.name.startsWith(hotspotPrefix)) {
                hotspots.push({
                    name: child.name,
                    position: child.position.clone(),
                    userData: child.userData || {},
                    object: child
                });
            }
        });
        
        return hotspots;
    }
    
    /**
     * 모델 메타데이터 로드
     */
    async loadModelMetadata(folder) {
        try {
            const basePath = getConfig('models.basePath');
            const metadataPath = `${basePath}${folder}/info.json`;
            
            const response = await fetch(metadataPath);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            // 메타데이터 파일이 없는 것은 정상적인 상황
        }
        
        return null;
    }
    
    /**
     * 로드된 모델 처리
     */
    async processLoadedModel(gltf, modelInfo) {
        // 모델 최적화
        await this.optimizeModel(gltf);
        
        // 애니메이션 설정
        if (gltf.animations.length > 0 && this.animationController) {
            this.animationController.setAnimations(gltf.animations, gltf.scene);
        }
        
        // 사용자 정의 처리 실행
        await this.executeCustomProcessing(gltf, modelInfo);
    }
    
    /**
     * 모델 최적화
     */
    async optimizeModel(gltf) {
        const maxTriangles = getConfig('performance.maxTriangles', 1000000);
        const maxTextureSize = getConfig('performance.maxTextureSize', 2048);
        const enableOptimization = getConfig('models.enableOptimization', true);
        
        if (!enableOptimization) return;
        
        console.log('[ModelLoader] 모델 최적화 시작...');
        
        let optimized = false;
        
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                // 지오메트리 최적화
                if (child.geometry) {
                    this.optimizeGeometry(child.geometry);
                }
                
                // 재질 최적화
                if (child.material) {
                    optimized = this.optimizeMaterial(child.material, maxTextureSize) || optimized;
                }
                
                // 그림자 설정
                child.castShadow = getConfig('scene.renderer.shadowMapEnabled', true);
                child.receiveShadow = true;
            }
        });
        
        if (optimized) {
            console.log('[ModelLoader] ✓ 모델 최적화 완료');
        }
    }
    
    /**
     * 지오메트리 최적화
     */
    optimizeGeometry(geometry) {
        // 바운딩 박스 계산
        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        
        // 법선 벡터 계산
        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
        }
        
        // 접선 벡터 계산 (필요시)
        if (geometry.attributes.uv && !geometry.attributes.tangent) {
            // geometry.computeTangents(); // 필요한 경우에만
        }
    }
    
    /**
     * 재질 최적화
     */
    optimizeMaterial(material, maxTextureSize) {
        let optimized = false;
        
        if (material.isMeshStandardMaterial) {
            // 환경 매핑 강도 조절
            if (material.envMapIntensity === undefined) {
                material.envMapIntensity = getConfig('scene.material.envMapIntensity', 0.5);
                optimized = true;
            }
            
            // PBR 속성 기본값 설정
            if (material.roughness === undefined) {
                material.roughness = 0.7;
                optimized = true;
            }
            
            if (material.metalness === undefined) {
                material.metalness = 0.0;
                optimized = true;
            }
        }
        
        // 텍스처 최적화
        const textureProperties = ['map', 'normalMap', 'roughnessMap', 'metalnessMap'];
        textureProperties.forEach(prop => {
            if (material[prop]) {
                optimized = this.optimizeTexture(material[prop], maxTextureSize) || optimized;
            }
        });
        
        return optimized;
    }
    
    /**
     * 텍스처 최적화
     */
    optimizeTexture(texture, maxSize) {
        let optimized = false;
        
        // 필터링 설정
        if (texture.generateMipmaps === undefined) {
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            optimized = true;
        }
        
        // 래핑 설정
        if (texture.wrapS === undefined) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            optimized = true;
        }
        
        // 이미지 크기 확인 및 조정 (실제 구현은 서버측에서 처리 권장)
        if (texture.image && (texture.image.width > maxSize || texture.image.height > maxSize)) {
            console.warn(`[ModelLoader] 텍스처 크기가 최대값을 초과: ${texture.image.width}x${texture.image.height}`);
        }
        
        return optimized;
    }
    
    /**
     * 사용자 정의 처리 실행
     */
    async executeCustomProcessing(gltf, modelInfo) {
        // 플러그인 시스템을 통한 확장 가능
        this.emit('model:process', gltf, modelInfo);
        
        // 커스텀 처리 로직 (필요시 확장)
        const customProcessors = getConfig('models.customProcessors', []);
        
        for (const processorName of customProcessors) {
            try {
                const processor = await this.loadCustomProcessor(processorName);
                await processor.process(gltf, modelInfo);
            } catch (error) {
                console.warn(`[ModelLoader] 커스텀 프로세서 실행 실패: ${processorName}`, error);
            }
        }
    }
    
    /**
     * 커스텀 프로세서 로드
     */
    async loadCustomProcessor(processorName) {
        const processorPath = `./processors/${processorName}.js`;
        const module = await import(processorPath);
        return new module.default();
    }
    
    /**
     * 캐시 관련 메서드들
     */
    generateCacheKey(modelData) {
        return `${modelData.folder}_${modelData.fileName}`;
    }
    
    saveToCache(cacheKey, gltf, modelInfo) {
        if (!this.enableCaching) return;
        
        const maxCacheSize = getConfig('models.maxCacheSize', 10);
        
        // 캐시 크기 확인
        if (this.modelCache.size >= maxCacheSize) {
            this.clearOldestCache();
        }
        
        // 캐시에 저장
        this.modelCache.set(cacheKey, {
            gltf: gltf,
            modelInfo: modelInfo,
            timestamp: Date.now()
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
        console.log('[ModelLoader] 캐시 전체 삭제');
    }
    
    /**
     * GLTF 복제
     */
    cloneGLTF(gltf) {
        const cloned = {
            scene: gltf.scene.clone(),
            animations: gltf.animations,
            cameras: gltf.cameras,
            asset: gltf.asset,
            parser: gltf.parser,
            userData: gltf.userData
        };
        
        return cloned;
    }
    
    /**
     * 로딩 상태 관리
     */
    setLoadingState(loading, model = null) {
        this.loadingState.isLoading = loading;
        this.loadingState.currentModel = model;
        this.loadingState.progress = 0;
        
        if (loading) {
            this.loadingState.loadStartTime = performance.now();
            this.loadingState.retryCount = 0;
        }
    }
    
    /**
     * 진행률 업데이트
     */
    updateProgress(progress, url = null) {
        this.loadingState.progress = progress;
        this.emit('loading:progress', progress, url);
    }
    
    /**
     * 통계 업데이트
     */
    updateStats(loadTime, success) {
        if (success) {
            this.stats.totalLoaded++;
            this.stats.loadTimes.push(loadTime);
            
            // 평균 로드 시간 계산
            const sum = this.stats.loadTimes.reduce((a, b) => a + b, 0);
            this.stats.averageLoadTime = sum / this.stats.loadTimes.length;
            
            // 최근 10개만 유지
            if (this.stats.loadTimes.length > 10) {
                this.stats.loadTimes.shift();
            }
        } else {
            this.stats.totalErrors++;
        }
        
        this.emit('stats:updated', { ...this.stats });
    }
    
    /**
     * 에러 처리
     */
    async handleLoadError(error, modelData, index) {
        console.error('[ModelLoader] 로드 에러:', error);
        
        this.loadingState.retryCount++;
        const maxRetries = getConfig('timing.maxRetryAttempts', 3);
        const autoRecovery = getConfig('errors.autoRecovery', true);
        
        // 자동 재시도
        if (autoRecovery && this.loadingState.retryCount < maxRetries) {
            console.log(`[ModelLoader] 재시도 ${this.loadingState.retryCount}/${maxRetries}`);
            
            const retryDelay = getConfig('timing.retryDelay', 1000) * this.loadingState.retryCount;
            await this.sleep(retryDelay);
            
            return this.loadModelByData(modelData, index);
        }
        
        // 최종 실패
        this.updateStats(0, false);
        this.emit('loading:error', error, modelData, index);
        
        return {
            success: false,
            error: error.message || '모델 로드 실패',
            retryCount: this.loadingState.retryCount
        };
    }
    
    /**
     * 로딩 이벤트 핸들러들
     */
    handleLoadingStart(url, itemsLoaded, itemsTotal) {
        this.emit('loading:start', url, itemsLoaded, itemsTotal);
    }
    
    handleLoadingComplete() {
        this.emit('loading:manager:complete');
    }
    
    handleLoadingError(url) {
        this.emit('loading:manager:error', url);
    }
    
    /**
     * 모델 목록 가져오기
     */
    getAvailableModels() {
        return getConfig('models.defaultModels', []);
    }
    
    /**
     * 현재 로딩 상태 가져오기
     */
    getLoadingState() {
        return { ...this.loadingState };
    }
    
    /**
     * 통계 정보 가져오기
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * 캐시 정보 가져오기
     */
    getCacheInfo() {
        return {
            enabled: this.enableCaching,
            size: this.modelCache.size,
            maxSize: getConfig('models.maxCacheSize', 10),
            keys: Array.from(this.modelCache.keys())
        };
    }
    
    /**
     * 유틸리티 메서드들
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
    }
    
    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
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
    }
    
    /**
     * 정리
     */
    destroy() {
        console.log('[ModelLoader] 정리 중...');
        
        // 캐시 정리
        this.clearCache();
        
        // 로더 정리
        if (this.gltfLoader) {
            // DRACO 로더 정리
            const dracoLoader = this.gltfLoader.dracoLoader;
            if (dracoLoader && typeof dracoLoader.dispose === 'function') {
                dracoLoader.dispose();
            }
            
            // KTX2 로더 정리
            const ktx2Loader = this.gltfLoader.ktx2Loader;
            if (ktx2Loader && typeof ktx2Loader.dispose === 'function') {
                ktx2Loader.dispose();
            }
        }
        
        // 이벤트 정리
        this.events.clear();
        
        this.emit('destroyed');
        console.log('[ModelLoader] 정리 완료');
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[ModelLoader] 디버그 정보');
        console.log('로딩 상태:', this.loadingState);
        console.log('통계:', this.stats);
        console.log('캐시 정보:', this.getCacheInfo());
        console.log('사용 가능한 모델:', this.getAvailableModels().map(m => m.name));
        console.log('등록된 이벤트:', Array.from(this.events.keys()));
        console.groupEnd();
    }
}

export default ModelLoader;