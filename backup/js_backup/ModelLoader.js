// ModelLoader.js - 완전한 모델 로더
import { CONFIG } from './config.js';

export class ModelLoader {
    constructor(sceneManager, animationController) {
        this.sceneManager = sceneManager;
        this.animationController = animationController;
        
        this.loader = new THREE.GLTFLoader();
        this.loadingManager = new THREE.LoadingManager();
        this.currentModel = null;
        this.gltfCameras = [];
        
        this.setupLoadingManager();
        console.log('[ModelLoader] 초기화 완료');
    }

    setupLoadingManager() {
        this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
            console.log(`[ModelLoader] 로딩 시작: ${url}`);
            this.showLoading();
        };
        
        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal) * 100;
            console.log(`[ModelLoader] 로딩 진행: ${url}, ${Math.round(progress)}%`);
            this.updateProgress(progress);
        };
        
        this.loadingManager.onLoad = () => {
            console.log('[ModelLoader] 모든 리소스 로딩 완료');
            this.hideLoading();
        };
        
        this.loadingManager.onError = (url) => {
            console.error(`[ModelLoader] 리소스 로딩 실패: ${url}`);
            this.hideLoading();
            this.showError(`리소스 로딩 실패: ${url}`);
        };
        
        this.loader.manager = this.loadingManager;
    }
    
    // 모델 로드 메서드 (인덱스 사용) - 호환성을 위해 추가
    async loadModel(index) {
        const model = CONFIG.models[index];
        if (!model) {
            throw new Error(`모델 인덱스 ${index}가 존재하지 않습니다.`);
        }
        
        const modelPath = `${CONFIG.modelsPath}${model.folder}/${model.fileName}`;
        console.log(`[ModelLoader] 모델 로드 시작 - 인덱스: ${index}, 경로: ${modelPath}`);
        
        const startTime = performance.now();
        
        try {
            const gltf = await this.loadGLTF(modelPath);
            const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
            
            return {
                success: true,
                info: gltf.userData.modelInfo,
                loadTime: loadTime
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // GLTF 파일 로드
    loadGLTF(url) {
        console.log(`[ModelLoader] GLTF 로드 시도: ${url}`);
        
        return new Promise((resolve, reject) => {
            // 먼저 파일 존재 여부 확인
            fetch(url, { method: 'HEAD' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`파일을 찾을 수 없습니다: ${url} (상태: ${response.status})`);
                    }
                    console.log(`[ModelLoader] 파일 확인 성공: ${url}`);
                    
                    // GLTF 로드
                    this.loader.load(
                        url,
                        (gltf) => {
                            console.log(`[ModelLoader] GLTF 로드 성공:`, gltf);
                            const modelInfo = this.processGLTF(gltf);
                            gltf.userData.modelInfo = modelInfo;
                            resolve(gltf);
                        },
                        (xhr) => {
                            if (xhr.lengthComputable) {
                                const percentComplete = (xhr.loaded / xhr.total) * 100;
                                this.updateProgress(percentComplete);
                            }
                        },
                        (error) => {
                            console.error(`[ModelLoader] GLTF 로드 실패:`, error);
                            reject(new Error(`모델 로드 실패: ${error.message}`));
                        }
                    );
                })
                .catch(error => {
                    console.error(`[ModelLoader] 파일 확인 실패:`, error);
                    this.hideLoading();
                    this.showError(error.message);
                    reject(error);
                });
        });
    }
    
    // GLTF 처리
    processGLTF(gltf) {
        console.log('[ModelLoader] GLTF 처리 시작');
        
        // 이전 모델 제거
        if (this.currentModel) {
            this.sceneManager.removeModel(this.currentModel);
        }
        
        this.currentModel = gltf.scene;
        this.gltfCameras = gltf.cameras || [];
        
        // 모델 중앙 정렬 및 설정
        this.centerModel(this.currentModel);
        this.setupShadows(this.currentModel);
        
        // 모델 분석
        const modelInfo = this.analyzeModel(this.currentModel);
        
        // 씬에 모델 추가
        this.sceneManager.setModel(this.currentModel, this.gltfCameras);
        
        // 애니메이션 설정
        if (gltf.animations && gltf.animations.length > 0) {
            this.animationController.setupAnimations(gltf.animations, this.currentModel);
        }
        
        console.log('[ModelLoader] GLTF 처리 완료:', modelInfo);
        return modelInfo;
    }
    
    // 모델 중앙 정렬
    centerModel(model) {
        console.log('[ModelLoader] 모델 중앙 정렬 시작');
        
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        console.log('[ModelLoader] 모델 크기:', size);
        console.log('[ModelLoader] 모델 중심점:', center);
        
        // 모델을 원점으로 이동
        model.position.sub(center);
        
        // 카메라 위치 조정
        const maxDim = Math.max(size.x, size.y, size.z);
        const camera = this.sceneManager.camera;
        const distance = maxDim * 2.5; // 모델 크기에 따른 카메라 거리
        
        camera.position.set(distance * 0.5, distance * 0.5, distance);
        camera.lookAt(0, 0, 0);
        
        // 컨트롤 업데이트
        if (this.sceneManager.controls) {
            this.sceneManager.controls.target.set(0, 0, 0);
            this.sceneManager.controls.minDistance = maxDim * 0.5;
            this.sceneManager.controls.maxDistance = maxDim * 5;
            this.sceneManager.controls.update();
        }
        
        console.log('[ModelLoader] 모델 중앙 정렬 완료');
    }
    
    // 그림자 설정
    setupShadows(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // 재질 설정
                if (child.material) {
                    // 양면 렌더링이 필요한 경우
                    if (child.material.transparent || child.material.opacity < 1) {
                        child.material.side = THREE.DoubleSide;
                    }
                    
                    // 그림자 설정
                    child.material.shadowSide = THREE.FrontSide;
                }
            }
        });
    }
    
    // 모델 분석
    analyzeModel(model) {
        const info = {
            meshCount: 0,
            vertexCount: 0,
            triangleCount: 0,
            materialCount: 0,
            textureCount: 0,
            hotspots: [],
            animations: this.animationController.getAnimationNames(),
            cameras: this.gltfCameras.length
        };
        
        const materials = new Set();
        const textures = new Set();
        
        model.traverse((child) => {
            if (child.isMesh) {
                info.meshCount++;
                
                // 지오메트리 정보
                if (child.geometry) {
                    const positionAttribute = child.geometry.attributes.position;
                    if (positionAttribute) {
                        info.vertexCount += positionAttribute.count;
                    }
                    
                    if (child.geometry.index) {
                        info.triangleCount += child.geometry.index.count / 3;
                    } else if (positionAttribute) {
                        info.triangleCount += positionAttribute.count / 3;
                    }
                }
                
                // 재질 정보
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => materials.add(mat.uuid));
                    } else {
                        materials.add(child.material.uuid);
                    }
                    
                    // 텍스처 정보
                    const collectTextures = (material) => {
                        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(mapType => {
                            if (material[mapType]) {
                                textures.add(material[mapType].uuid);
                            }
                        });
                    };
                    
                    if (Array.isArray(child.material)) {
                        child.material.forEach(collectTextures);
                    } else {
                        collectTextures(child.material);
                    }
                }
            }
            
            // 핫스팟 감지 (이름이 HS_로 시작하는 오브젝트)
            if (child.name && child.name.startsWith('HS_')) {
                info.hotspots.push({
                    name: child.name,
                    position: child.position.clone(),
                    userData: child.userData || {}
                });
            }
        });
        
        info.materialCount = materials.size;
        info.textureCount = textures.size;
        
        return info;
    }
    
    // UI 헬퍼 메서드들
    showLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'flex';
        }
        this.updateProgress(0);
    }
    
    hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
    
    updateProgress(percent) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.textContent = `${Math.round(percent)}%`;
        }
    }
    
    showError(message) {
        console.error('[ModelLoader] 에러:', message);
        
        // 기존 에러 요소가 있으면 제거
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // 새 에러 메시지 생성
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 500px;
            text-align: center;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        // 5초 후 자동 제거
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }
    
    // 카메라 정보 가져오기
    getCameras() {
        return this.gltfCameras;
    }
    
    // 현재 모델 가져오기
    getCurrentModel() {
        return this.currentModel;
    }
    
    // 리소스 정리
    dispose() {
        if (this.currentModel) {
            this.sceneManager.removeModel(this.currentModel);
            this.currentModel = null;
        }
        
        this.gltfCameras = [];
        
        console.log('[ModelLoader] 리소스 정리 완료');
    }
}