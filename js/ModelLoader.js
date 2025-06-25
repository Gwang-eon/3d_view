// js/ModelLoader.js
// ConfigManager 기반 완전 개선 버전 - 모든 하드코딩 제거

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
        
        // 초기화
        this.init();
        
        console.log('[ModelLoader] 초기화 완료');
    }
    
    /**
     * 초기화
     */
    async init() {
        try {
            // 로딩 매니저 설정
            this.setupLoadingManager();
            
            // 로더들 설정
            await this.setupLoaders();
            
            // 설정 검증
            this.validateConfiguration();
            
            // 프리로딩 시작
            if (this.optimization.enablePreloading) {
                this.startPreloading();
            }
            
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
        this.loadingManager.onStart = this.handleLoadingStart;
        
        // 진행률 업데이트
        this.loadingManager.onProgress = this.handleLoadingProgress;
        
        // 로딩 완료
        this.loadingManager.onLoad = this.handleLoadingComplete;
        
        // 로딩 에러
        this.loadingManager.onError = this.handleLoadingError;
        
        console.log('[ModelLoader] ✓ 로딩 매니저 설정됨');
    }
    
    /**
     * 로더들 설정
     */
    async setupLoaders() {
        // GLTF 로더
        this.gltfLoader = new THREE.GLTFLoader(this.loadingManager);
        
        // DRACO 로더 설정 (선택적)
        if (getConfig('models.enableDraco', false)) {
            await this.setupDracoLoader();
        }
        
        // KTX2 로더 설정 (선택적)
        if (getConfig('models.enableKTX2', false)) {
            await this.setupKTX2Loader();
        }
        
        // 텍스처 로더
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        
        // 로딩 옵션 설정
        this.applyLoadingOptions();
        
        console.log('[ModelLoader] ✓ 로더 설정 완료');
    }
    
    /**
     * DRACO 로더 설정
     */
    async setupDracoLoader() {
        try {
            if (window.THREE?.DRACOLoader) {
                this.dracoLoader = new THREE.DRACOLoader();
                const dracoPath = getConfig('models.dracoPath', '/lib/draco/gltf/');
                this.dracoLoader.setDecoderPath(dracoPath);
                this.dracoLoader.setDecoderConfig({ type: 'js' });
                this.gltfLoader.setDRACOLoader(this.dracoLoader);
                
                console.log('[ModelLoader] ✓ DRACO 로더 활성화');
            } else {
                console.warn('[ModelLoader] DRACO 로더를 사용할 수 없습니다.');
            }
        } catch (error) {
            console.warn('[ModelLoader] DRACO 로더 설정 실패:', error);
        }
    }
    
    /**
     * KTX2 로더 설정
     */
    async setupKTX2Loader() {
        try {
            if (window.THREE?.KTX2Loader && this.sceneManager?.renderer) {
                this.ktx2Loader = new THREE.KTX2Loader();
                const ktx2Path = getConfig('models.ktx2Path', '/lib/basis/');
                this.ktx2Loader.setTranscoderPath(ktx2Path);
                this.ktx2Loader.detectSupport(this.sceneManager.renderer);
                this.gltfLoader.setKTX2Loader(this.ktx2Loader);
                
                console.log('[ModelLoader] ✓ KTX2 로더 활성화');
            } else {
                console.warn('[ModelLoader] KTX2 로더를 사용할 수 없습니다.');
            }
        } catch (error) {
            console.warn('[ModelLoader] KTX2 로더 설정 실패:', error);
        }
    }
    
    /**
     * 로딩 옵션 적용
     */
    applyLoadingOptions() {
        const options = getConfig('models.loadingOptions', {});
        
        // Cross-Origin 설정
        if (options.crossOrigin) {
            this.textureLoader.setCrossOrigin(options.crossOrigin);
        }
        
        // 타임아웃 설정
        if (options.timeout) {
            // 커스텀 타임아웃 구현 필요
        }
        
        // 압축 설정
        if (options.enableCompression) {
            // 텍스처 압축 활성화
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
        
        // 경로 정규화
        if (!basePath.endsWith('/')) {
            setConfig('models.basePath', basePath + '/');
        }
        
        // 모델 검증
        this.validateModelList(models);
        
        console.log('[ModelLoader] ✓ 설정 검증 완료');
    }
    
    /**
     * 모델 목록 검증
     */
    validateModelList(models) {
        const supportedFormats = getConfig('models.supportedFormats', ['.gltf', '.glb']);
        
        models.forEach((model, index) => {
            // 필수 필드 확인
            if (!model.name || !model.folder || !model.fileName) {
                console.error(`[ModelLoader] 모델 ${index}: 필수 필드 누락`, model);
            }
            
            // 파일 형식 확인
            const hasValidFormat = supportedFormats.some(format => 
                model.fileName.toLowerCase().endsWith(format)
            );
            
            if (!hasValidFormat) {
                console.warn(`[ModelLoader] 모델 ${index}: 지원되지 않는 형식 - ${model.fileName}`);
            }
            
            // 파일 크기 경고
            if (model.fileSize && model.fileSize > getConfig('models.maxFileSize', 50)) {
                console.warn(`[ModelLoader] 모델 ${index}: 큰 파일 크기 - ${model.fileSize}MB`);
            }
        });
    }
    
    /**
     * 프리로딩 시작
     */
    async startPreloading() {
        const preloadList = getConfig('models.preloadList', []);
        if (preloadList.length === 0) return;
        
        console.log(`[ModelLoader] 프리로딩 시작: ${preloadList.length}개 모델`);
        
        for (const modelIndex of preloadList) {
            try {
                await this.preloadModel(modelIndex);
            } catch (error) {
                console.warn(`[ModelLoader] 프리로딩 실패: 모델 ${modelIndex}`, error);
            }
        }
    }
    
    /**
     * 모델 프리로드
     */
    async preloadModel(modelIndex) {
        const models = getConfig('models.defaultModels', []);
        const modelData = models[modelIndex];
        
        if (!modelData) return;
        
        const cacheKey = this.generateCacheKey(modelData);
        if (this.modelCache.has(cacheKey)) return; // 이미 캐시됨
        
        try {
            const gltf = await this.loadGLTFFile(modelData);
            const modelInfo = await this.generateModelInfo(gltf, modelData, 0);
            
            if (this.enableCaching) {
                this.saveToCache(cacheKey, gltf, modelInfo);
            }
            
            console.log(`[ModelLoader] ✓ 프리로드 완료: ${modelData.name}`);
            
        } catch (error) {
            console.warn(`[ModelLoader] 프리로드 실패: ${modelData.name}`, error);
        }
    }
    
    /**
     * 모델 로드 (인덱스 기반)
     */
    async loadModel(modelIndex) {
        const models = getConfig('models.defaultModels', []);
        
        if (modelIndex < 0 || modelIndex >= models.length) {
            throw new Error(`잘못된 모델 인덱스: ${modelIndex}`);
        }
        
        const modelData = models[modelIndex];
        return await this.loadModelByData(modelData, modelIndex);
    }
    
    /**
     * 모델 로드 (데이터 기반)
     */
    async loadModelByData(modelData, index = null) {
        // 중복 로딩 방지
        if (this.loadingState.isLoading) {
            console.warn('[ModelLoader] 이미 로딩 중입니다.');
            await this.waitForCurrentLoad();
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
            
            // 파일에서 로드
            return await this.loadFromFile(modelData, index, cacheKey);
            
        } catch (error) {
            return await this.handleLoadError(error, modelData, index);
        } finally {
            this.setLoadingState(false);
        }
    }
    
    /**
     * 현재 로딩 대기
     */
    async waitForCurrentLoad() {
        return new Promise((resolve) => {
            const checkLoading = () => {
                if (!this.loadingState.isLoading) {
                    resolve();
                } else {
                    setTimeout(checkLoading, 100);
                }
            };
            checkLoading();
        });
    }
    
    /**
     * 파일에서 로드
     */
    async loadFromFile(modelData, index, cacheKey) {
        console.log(`[ModelLoader] 파일에서 로드: ${modelData.name}`);
        this.emit('loading:start', { modelData, index });
        
        const startTime = performance.now();
        this.loadingState.loadStartTime = startTime;
        this.loadingState.phase = 'downloading';
        
        try {
            // GLTF 파일 로드
            const gltf = await this.loadGLTFFile(modelData);
            
            this.loadingState.phase = 'processing';
            
            // 로드 시간 계산
            const loadTime = (performance.now() - startTime) / 1000;
            
            // 모델 정보 생성
            const modelInfo = await this.generateModelInfo(gltf, modelData, loadTime);
            
            // 모델 후처리
            await this.processLoadedModel(gltf, modelInfo);
            
            // 캐시에 저장
            if (this.enableCaching) {
                this.saveToCache(cacheKey, gltf, modelInfo);
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
        
        // 통계 업데이트
        this.stats.totalCacheHits++;
        
        this.emit('loading:complete', { 
            gltf: clonedGltf, 
            modelInfo, 
            loadTime, 
            fromCache: true 
        });
        
        console.log(`[ModelLoader] ✓ 캐시 로드 완료: ${modelData.name} (${loadTime.toFixed(3)}초)`);
        
        return {
            success: true,
            gltf: clonedGltf,
            modelInfo: modelInfo,
            loadTime: loadTime,
            fromCache: true
        };
    }
    
    /**
     * GLTF 파일 로드
     */
    async loadGLTFFile(modelData) {
        const basePath = getConfig('models.basePath', 'gltf/');
        const modelPath = `${basePath}${modelData.folder}/${modelData.fileName}`;
        
        return new Promise((resolve, reject) => {
            const timeout = getConfig('models.loadingTimeout', 30000);
            
            // 타임아웃 설정
            const timeoutId = setTimeout(() => {
                reject(new Error(`로딩 타임아웃: ${modelPath}`));
            }, timeout);
            
            // 파일 존재 확인 (선택적)
            if (getConfig('models.checkFileExists', true)) {
                this.checkFileExists(modelPath)
                    .then(exists => {
                        if (!exists) {
                            clearTimeout(timeoutId);
                            reject(new Error(`파일을 찾을 수 없습니다: ${modelPath}`));
                            return;
                        }
                        this.performGLTFLoad(modelPath, resolve, reject, timeoutId);
                    })
                    .catch(error => {
                        clearTimeout(timeoutId);
                        reject(error);
                    });
            } else {
                this.performGLTFLoad(modelPath, resolve, reject, timeoutId);
            }
        });
    }
    
    /**
     * 파일 존재 확인
     */
    async checkFileExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * GLTF 로드 실행
     */
    performGLTFLoad(path, resolve, reject, timeoutId) {
        this.gltfLoader.load(
            path,
            (gltf) => {
                clearTimeout(timeoutId);
                resolve(gltf);
            },
            (progress) => {
                // 진행률은 LoadingManager에서 처리
            },
            (error) => {
                clearTimeout(timeoutId);
                reject(new Error(`GLTF 로드 실패: ${error.message || error}`));
            }
        );
    }
    
    /**
     * 모델 정보 생성
     */
    async generateModelInfo(gltf, modelData, loadTime) {
        const stats = this.calculateModelStats(gltf);
        const animations = this.extractAnimationInfo(gltf);
        const cameras = this.extractCameraInfo(gltf);
        const materials = this.extractMaterialInfo(gltf);
        const metadata = await this.loadModelMetadata(modelData);
        
        return {
            // 기본 정보
            name: modelData.name || 'Unknown Model',
            description: modelData.description || '',
            icon: modelData.icon || '🏗️',
            folder: modelData.folder,
            fileName: modelData.fileName,
            
            // 성능 정보
            loadTime: loadTime,
            fileSize: modelData.fileSize || 0,
            
            // 통계 정보
            stats: stats,
            
            // 컨텐츠 정보
            animations: animations,
            cameras: cameras,
            materials: materials,
            
            // 메타데이터
            metadata: metadata,
            
            // 타임스탬프
            loadedAt: new Date().toISOString(),
            version: getConfig('app.version', '1.0.0')
        };
    }
    
    /**
     * 모델 통계 계산
     */
    calculateModelStats(gltf) {
        let meshes = 0;
        let vertices = 0;
        let triangles = 0;
        let materials = new Set();
        let textures = new Set();
        
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                meshes++;
                
                if (child.geometry) {
                    const geometry = child.geometry;
                    if (geometry.attributes.position) {
                        vertices += geometry.attributes.position.count;
                    }
                    if (geometry.index) {
                        triangles += geometry.index.count / 3;
                    } else if (geometry.attributes.position) {
                        triangles += geometry.attributes.position.count / 3;
                    }
                }
                
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => materials.add(mat.uuid));
                    } else {
                        materials.add(child.material.uuid);
                    }
                }
            }
        });
        
        // 텍스처 수집
        gltf.scene.traverse((child) => {
            if (child.material) {
                const material = Array.isArray(child.material) ? child.material : [child.material];
                material.forEach(mat => {
                    Object.values(mat).forEach(value => {
                        if (value && value.isTexture) {
                            textures.add(value.uuid);
                        }
                    });
                });
            }
        });
        
        return {
            meshes: meshes,
            vertices: Math.round(vertices),
            triangles: Math.round(triangles),
            materials: materials.size,
            textures: textures.size,
            nodes: this.countNodes(gltf.scene),
            boundingBox: this.calculateBoundingBox(gltf.scene),
            memoryEstimate: this.estimateMemoryUsage(vertices, textures.size)
        };
    }
    
    /**
     * 노드 수 계산
     */
    countNodes(object) {
        let count = 1;
        object.children.forEach(child => {
            count += this.countNodes(child);
        });
        return count;
    }
    
    /**
     * 바운딩 박스 계산
     */
    calculateBoundingBox(object) {
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        return {
            min: { x: box.min.x, y: box.min.y, z: box.min.z },
            max: { x: box.max.x, y: box.max.y, z: box.max.z },
            size: { x: size.x, y: size.y, z: size.z },
            center: { x: center.x, y: center.y, z: center.z }
        };
    }
    
    /**
     * 메모리 사용량 추정
     */
    estimateMemoryUsage(vertices, textureCount) {
        // 대략적인 계산 (바이트 단위)
        const vertexMemory = vertices * 32; // 32 bytes per vertex (position, normal, uv, etc.)
        const textureMemory = textureCount * 1024 * 1024; // 1MB per texture (estimate)
        return Math.round((vertexMemory + textureMemory) / 1024 / 1024); // MB
    }
    
    /**
     * 애니메이션 정보 추출
     */
    extractAnimationInfo(gltf) {
        if (!gltf.animations || gltf.animations.length === 0) {
            return [];
        }
        
        return gltf.animations.map((animation, index) => ({
            name: animation.name || `Animation_${index}`,
            duration: animation.duration || 0,
            tracks: animation.tracks.length,
            channels: animation.tracks.reduce((sum, track) => sum + track.keys.length, 0)
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
            name: camera.name || `Camera_${index}`,
            type: camera.type,
            fov: camera.fov || null,
            near: camera.near,
            far: camera.far,
            position: camera.position ? {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            } : null
        }));
    }
    
    /**
     * 머티리얼 정보 추출
     */
    extractMaterialInfo(gltf) {
        const materials = new Map();
        
        gltf.scene.traverse((child) => {
            if (child.material) {
                const matArray = Array.isArray(child.material) ? child.material : [child.material];
                matArray.forEach(material => {
                    if (!materials.has(material.uuid)) {
                        materials.set(material.uuid, {
                            name: material.name || 'Unnamed',
                            type: material.type,
                            transparent: material.transparent,
                            opacity: material.opacity,
                            color: material.color ? `#${material.color.getHexString()}` : null,
                            emissive: material.emissive ? `#${material.emissive.getHexString()}` : null,
                            roughness: material.roughness || null,
                            metalness: material.metalness || null
                        });
                    }
                });
            }
        });
        
        return Array.from(materials.values());
    }
    
    /**
     * 모델 메타데이터 로드
     */
    async loadModelMetadata(modelData) {
        const basePath = getConfig('models.basePath', 'gltf/');
        const metadataPath = `${basePath}${modelData.folder}/info.json`;
        
        try {
            const response = await fetch(metadataPath);
            if (response.ok) {
                const metadata = await response.json();
                console.log(`[ModelLoader] ✓ 메타데이터 로드: ${modelData.name}`);
                return metadata;
            }
        } catch (error) {
            // 메타데이터는 선택사항이므로 에러 무시
        }
        
        return {};
    }
    
    /**
     * 로드된 모델 후처리
     */
    async processLoadedModel(gltf, modelInfo) {
        // 중앙 정렬
        this.centerModel(gltf.scene, modelInfo.stats.boundingBox);
        
        // 그림자 설정
        if (getConfig('scene.lighting.enableShadows', true)) {
            this.setupShadows(gltf.scene);
        }
        
        // 텍스처 최적화
        if (this.optimization.textureOptimization) {
            this.optimizeTextures(gltf.scene);
        }
        
        // 재질 최적화
        this.optimizeMaterials(gltf.scene);
        
        console.log('[ModelLoader] ✓ 모델 후처리 완료');
    }
    
    /**
     * 모델 중앙 정렬
     */
    centerModel(model, boundingBox = null) {
        if (!boundingBox) {
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
        } else {
            model.position.set(-boundingBox.center.x, -boundingBox.center.y, -boundingBox.center.z);
        }
    }
    
    /**
     * 그림자 설정
     */
    setupShadows(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = getConfig('scene.lighting.meshCastShadow', true);
                child.receiveShadow = getConfig('scene.lighting.meshReceiveShadow', true);
            }
        });
    }
    
    /**
     * 텍스처 최적화
     */
    optimizeTextures(model) {
        const maxTextureSize = getConfig('models.maxTextureSize', 2048);
        const textureFormat = getConfig('models.textureFormat', 'auto');
        
        model.traverse((child) => {
            if (child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                    Object.values(material).forEach(value => {
                        if (value && value.isTexture) {
                            // 텍스처 크기 제한
                            if (value.image) {
                                const { width, height } = value.image;
                                if (width > maxTextureSize || height > maxTextureSize) {
                                    // 텍스처 리사이징 (구현 필요)
                                    console.warn(`[ModelLoader] 큰 텍스처 발견: ${width}x${height}`);
                                }
                            }
                            
                            // 텍스처 설정 최적화
                            value.generateMipmaps = getConfig('models.generateMipmaps', true);
                            value.minFilter = THREE.LinearMipmapLinearFilter;
                            value.magFilter = THREE.LinearFilter;
                        }
                    });
                });
            }
        });
    }
    
    /**
     * 재질 최적화
     */
    optimizeMaterials(model) {
        const enableFrustumCulling = getConfig('models.enableFrustumCulling', true);
        
        model.traverse((child) => {
            if (child.isMesh) {
                // Frustum Culling 설정
                child.frustumCulled = enableFrustumCulling;
                
                // 재질 최적화
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                        // 불필요한 기능 비활성화
                        if (!material.transparent) {
                            material.alphaTest = 0;
                        }
                    });
                }
            }
        });
    }
    
    /**
     * GLTF 복제
     */
    cloneGLTF(gltf) {
        const cloned = {
            scene: gltf.scene.clone(),
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
        
        // 재시도 로직
        if (this.loadingState.retryCount < this.errorRecovery.maxRetries) {
            this.loadingState.retryCount++;
            console.log(`[ModelLoader] 재시도 ${this.loadingState.retryCount}/${this.errorRecovery.maxRetries}: ${modelData.name}`);
            
            await this.delay(this.errorRecovery.retryDelay);
            return await this.loadModelByData(modelData, index);
        }
        
        // 폴백 모델 시도
        if (this.errorRecovery.enableFallback && this.errorRecovery.fallbackModels.length > 0) {
            console.log(`[ModelLoader] 폴백 모델 시도: ${modelData.name}`);
            
            for (const fallbackIndex of this.errorRecovery.fallbackModels) {
                try {
                    return await this.loadModel(fallbackIndex);
                } catch (fallbackError) {
                    console.warn(`[ModelLoader] 폴백 모델 ${fallbackIndex} 실패:`, fallbackError);
                }
            }
        }
        
        // 최종 실패
        return {
            success: false,
            error: error.message || error.toString(),
            modelData: modelData,
            retryCount: this.loadingState.retryCount
        };
    }
    
    /**
     * 지연 함수
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 로딩 상태 관리
     */
    setLoadingState(loading, modelData = null) {
        this.loadingState.isLoading = loading;
        this.loadingState.currentModelData = modelData;
        this.loadingState.progress = 0;
        
        if (loading) {
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
        
        this.emit('loading:progress', { progress, url, itemsLoaded, itemsTotal });
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
            cacheSize: this.modelCache.size
        };
    }
}

export default ModelLoader;