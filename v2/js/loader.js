// js/loader.js - GLTF 모델 로더 모듈 (핫스팟 지원 포함)

// 전역 THREE 객체 확인
if (typeof THREE === 'undefined') {
    console.error('Three.js가 로드되지 않았습니다.');
}

export class ModelLoader {
    constructor(config = {}) {
        this.basePath = config.basePath || './gltf/';
        this.loadingManager = config.loadingManager || new THREE.LoadingManager();
        
        // GLTF 로더 생성
        this.loader = new THREE.GLTFLoader(this.loadingManager);
        
        // 캐시
        this.cache = new Map();
        this.enableCache = config.enableCache !== false;
    }
    
    /**
     * 모델 로드
     * @param {string} path - 모델 파일 경로
     * @returns {Promise<THREE.Group>} 로드된 모델 scene
     */
    async load(path) {
        const gltf = await this.loadGLTF(path);
        return gltf.scene;
    }
    
    /**
     * GLTF 전체 로드
     * @param {string} path - 모델 파일 경로
     * @returns {Promise<Object>} GLTF 객체 전체
     */
    async loadGLTF(path) {
        // 캐시 확인
        if (this.enableCache && this.cache.has(path)) {
            console.log('📦 캐시에서 모델 로드:', path);
            return this.cache.get(path);
        }
        
        try {
            console.log('📥 모델 로드 중:', path);
            
            const gltf = await new Promise((resolve, reject) => {
                this.loader.load(
                    path,
                    (gltf) => {
                        console.log('✅ GLTF 로드 성공');
                        resolve(gltf);
                    },
                    (progress) => {
                        // 진행률은 LoadingManager에서 처리
                        if (progress.lengthComputable) {
                            const percentComplete = (progress.loaded / progress.total) * 100;
                            console.log(`로딩: ${percentComplete.toFixed(0)}%`);
                        }
                    },
                    (error) => {
                        console.error('❌ GLTF 로드 실패:', error);
                        reject(new Error(`모델 로드 실패: ${path}`));
                    }
                );
            });
            
            // 모델 정보 출력
            this.logModelInfo(gltf);
            
            // 캐시에 저장
            if (this.enableCache) {
                this.cache.set(path, gltf);
            }
            
            // GLTF 객체 전체 반환
            return gltf;
            
        } catch (error) {
            console.error('모델 로드 오류:', error);
            throw error;
        }
    }
    
    /**
     * 모델과 핫스팟 데이터 함께 로드
     * @param {string} modelPath - 모델 파일 경로
     * @returns {Promise<{gltf: Object, hotspotsData: Object|null}>} GLTF와 핫스팟 데이터
     */
    async loadWithHotspots(modelPath) {
        try {
            // 1. GLTF 모델 로드
            const gltf = await this.loadGLTF(modelPath);
            
            // 2. 핫스팟 JSON 파일 경로 생성
            // 예: gltf/Block_Retaining_Wall/Block_Retaining_Wall.gltf
            // -> gltf/Block_Retaining_Wall/hotspots.json
            const pathParts = modelPath.split('/');
            const folderPath = pathParts.slice(0, -1).join('/');
            const hotspotsPath = `${folderPath}/hotspots.json`;
            
            console.log('🔍 핫스팟 데이터 확인:', hotspotsPath);
            
            // 3. 핫스팟 데이터 로드 시도
            let hotspotsData = null;
            try {
                const response = await fetch(hotspotsPath);
                if (response.ok) {
                    hotspotsData = await response.json();
                    console.log('✅ 핫스팟 데이터 로드 성공');
                    console.log('📍 핫스팟 개수:', Object.keys(hotspotsData.hotspots || {}).length);
                } else {
                    console.log('ℹ️ 핫스팟 데이터 없음 (404)');
                }
            } catch (error) {
                console.log('ℹ️ 핫스팟 데이터 로드 실패:', error.message);
                // 핫스팟 데이터가 없어도 모델은 정상 로드
            }
            
            // 4. 결과 반환
            return {
                gltf: gltf,
                hotspotsData: hotspotsData
            };
            
        } catch (error) {
            console.error('모델 로드 실패:', error);
            throw error;
        }
    }
    
    /**
     * 모델 정보 로깅
     */
    logModelInfo(gltf) {
        console.log('📊 모델 정보:');
        
        // 기본 정보
        if (gltf.asset) {
            console.log('  - 생성자:', gltf.asset.generator || '알 수 없음');
            console.log('  - 버전:', gltf.asset.version || '2.0');
        }
        
        // 씬 정보
        if (gltf.scenes) {
            console.log('  - 씬 개수:', gltf.scenes.length);
        }
        
        // 메시 카운트
        let meshCount = 0;
        let vertexCount = 0;
        let triangleCount = 0;
        
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                meshCount++;
                
                if (child.geometry) {
                    const geo = child.geometry;
                    if (geo.attributes.position) {
                        vertexCount += geo.attributes.position.count;
                    }
                    if (geo.index) {
                        triangleCount += geo.index.count / 3;
                    }
                }
            }
        });
        
        console.log('  - 메시 개수:', meshCount);
        console.log('  - 정점 개수:', vertexCount.toLocaleString());
        console.log('  - 삼각형 개수:', triangleCount.toLocaleString());
        
        // 애니메이션 정보
        if (gltf.animations && gltf.animations.length > 0) {
            console.log('  - 애니메이션:', gltf.animations.length + '개');
            gltf.animations.forEach((clip, index) => {
                console.log(`    ${index + 1}. ${clip.name} (${clip.duration.toFixed(2)}초)`);
            });
        }
        
        // 카메라 정보
        if (gltf.cameras && gltf.cameras.length > 0) {
            console.log('  - 카메라:', gltf.cameras.length + '개');
        }
        
        // Empty 오브젝트 확인 (핫스팟용)
        let emptyCount = 0;
        let hotspotCount = 0;
        gltf.scene.traverse((child) => {
            if (child.type === 'Object3D' || child.type === 'Group') {
                if (!child.geometry && child.children.length === 0) {
                    emptyCount++;
                    if (child.name && child.name.startsWith('HS_')) {
                        hotspotCount++;
                    }
                }
            }
        });
        
        if (emptyCount > 0) {
            console.log('  - Empty 오브젝트:', emptyCount + '개');
            console.log('  - 핫스팟(HS_):', hotspotCount + '개');
        }
    }
    
    /**
     * 모델 복제 (캐시용)
     */
    cloneModel(gltf) {
        // 씬만 복제하여 반환
        const cloned = gltf.scene.clone(true);
        
        // 애니메이션도 복제가 필요한 경우 처리
        if (gltf.animations && gltf.animations.length > 0) {
            cloned.animations = gltf.animations;
        }
        
        return cloned;
    }
    
    /**
     * 캐시 초기화
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ 모델 캐시 초기화됨');
    }
    
    /**
     * 특정 모델 캐시 제거
     */
    removeFromCache(path) {
        if (this.cache.has(path)) {
            this.cache.delete(path);
            console.log('🗑️ 캐시에서 제거:', path);
        }
    }
    
    /**
     * 캐시 크기 확인
     */
    getCacheSize() {
        return this.cache.size;
    }
    
    /**
     * 핫스팟 데이터 검증
     * @param {Object} hotspotsData - 핫스팟 JSON 데이터
     * @returns {boolean} 유효성 여부
     */
    validateHotspotsData(hotspotsData) {
        if (!hotspotsData || typeof hotspotsData !== 'object') {
            return false;
        }
        
        if (!hotspotsData.hotspots || typeof hotspotsData.hotspots !== 'object') {
            console.warn('핫스팟 데이터에 hotspots 속성이 없습니다.');
            return false;
        }
        
        // 각 핫스팟 검증
        for (const [key, hotspot] of Object.entries(hotspotsData.hotspots)) {
            if (!hotspot.type) {
                console.warn(`핫스팟 ${key}에 type이 없습니다.`);
            }
            if (!hotspot.info) {
                console.warn(`핫스팟 ${key}에 info가 없습니다.`);
            }
        }
        
        return true;
    }
}