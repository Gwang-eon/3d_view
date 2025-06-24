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
        this.loadingManager.onStart = (url) => {
            console.log(`[ModelLoader] 로딩 시작: ${url}`);
            this.showLoading();
        };
        this.loadingManager.onProgress = (url, loaded, total) => {
            console.log(`[ModelLoader] 로딩 진행: ${url}, ${Math.round((loaded / total) * 100)}%`);
            this.updateProgress((loaded / total) * 100);
        };
        this.loadingManager.onLoad = () => {
            console.log('[ModelLoader] 로딩 완료');
            this.hideLoading();
        };
        this.loadingManager.onError = (url) => {
            console.error(`[ModelLoader] 리소스 로딩 실패: ${url}`);
            this.hideLoading();
            this.showError(`리소스 로딩 실패: ${url}`);
        };
        this.loader.manager = this.loadingManager;
    }
    
    loadGLTF(url) {
        console.log(`[ModelLoader] GLTF 로드 시도: ${url}`);
        
        // 파일 존재 여부 먼저 확인
        return fetch(url, { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`파일을 찾을 수 없습니다: ${url} (상태: ${response.status})`);
                }
                console.log(`[ModelLoader] 파일 확인 성공: ${url}`);
                
                return new Promise((resolve, reject) => {
                    this.loader.load(
                        url,
                        (gltf) => {
                            console.log(`[ModelLoader] GLTF 로드 성공: ${url}`, gltf);
                            const modelInfo = this.processGLTF(gltf);
                            gltf.userData.modelInfo = modelInfo;
                            resolve(gltf);
                        },
                        (xhr) => {
                            if (xhr.lengthComputable) {
                                this.updateProgress((xhr.loaded / xhr.total) * 100);
                            }
                        },
                        (error) => {
                            console.error(`[ModelLoader] 모델 로드 중 에러 발생: ${url}`, error);
                            reject(new Error(`'${url}' 파일을 로드할 수 없습니다: ${error.message}`));
                        }
                    );
                });
            })
            .catch(error => {
                console.error(`[ModelLoader] 파일 확인 실패: ${url}`, error);
                this.hideLoading();
                this.showError(`${error.message}`);
                throw error;
            });
    }
    
    processGLTF(gltf) {
        console.log('[ModelLoader] GLTF 처리 시작');
        
        if (this.currentModel) {
            this.sceneManager.removeModel(this.currentModel);
        }
        
        this.currentModel = gltf.scene;
        this.gltfCameras = gltf.cameras || [];
        
        this.centerModel(this.currentModel);
        this.setupShadows(this.currentModel);
        
        const modelInfo = this.analyzeModel(this.currentModel);
        this.sceneManager.addModel(this.currentModel);
        
        // GLTF 카메라 정보를 SceneManager에 전달
        this.sceneManager.setGLTFCameras(this.gltfCameras);
        
        this.animationController.setupAnimations(gltf.animations, this.currentModel);
        
        console.log('[ModelLoader] GLTF 처리 완료', modelInfo);
        return modelInfo;
    }
    
    centerModel(model) {
        console.log('[ModelLoader] 모델 중앙 정렬 시작');
        
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        console.log('[ModelLoader] 모델 크기:', size);
        console.log('[ModelLoader] 모델 중심점:', center);
        
        model.position.sub(center);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const camera = this.sceneManager.camera;
        camera.position.copy(this.sceneManager.defaultCameraPosition);
        camera.position.multiplyScalar(maxDim / 10); // Scale camera distance based on model size
        camera.lookAt(0, 0, 0);
        
        this.sceneManager.controls.target.set(0, 0, 0);
        this.sceneManager.controls.maxDistance = maxDim * 2;
        this.sceneManager.controls.update();
        
        console.log('[ModelLoader] 모델 중앙 정렬 완료');
    }
    
    setupShadows(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // 양면 렌더링 설정 (필요한 경우)
                if (child.material) {
                    child.material.shadowSide = THREE.FrontSide;
                }
            }
        });
    }
    
    analyzeModel(model) {
        const info = {
            meshCount: 0,
            vertexCount: 0,
            triangleCount: 0,
            hotspots: [],
            cameras: this.gltfCameras.length
        };
        
        model.traverse((child) => {
            if (child.isMesh) {
                info.meshCount++;
                if (child.geometry) {
                    info.vertexCount += child.geometry.attributes.position.count;
                    if (child.geometry.index) {
                        info.triangleCount += child.geometry.index.count / 3;
                    } else {
                        info.triangleCount += child.geometry.attributes.position.count / 3;
                    }
                }
            }
            if (child.name.startsWith('HS_')) {
                info.hotspots.push({
                    name: child.name,
                    position: child.position.clone(),
                    userData: child.userData
                });
            }
        });
        return info;
    }
    
    showLoading() {
        document.getElementById('loading').style.display = 'flex';
        this.updateProgress(0);
    }
    
    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
    
    updateProgress(percent) {
        document.getElementById('progress-fill').style.width = `${percent}%`;
        document.getElementById('progress-text').textContent = `${Math.round(percent)}%`;
    }
    
    showError(message) {
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => { errorDiv.style.display = 'none'; }, 100000); // 10초 동안 표시
    }
    
    getCameras() {
        return this.gltfCameras;
    }
}