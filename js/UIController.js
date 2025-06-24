import { CONFIG } from './config.js';

export class UIController {
    constructor(sceneManager, modelLoader, animationController, hotspotManager) {
        this.sceneManager = sceneManager;
        this.modelLoader = modelLoader;
        this.animationController = animationController;
        this.hotspotManager = hotspotManager;

        this.fps = 0;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        this.cacheDOMElements();
        this.init();
    }
    
    cacheDOMElements() {
        this.changeModelBtn = document.getElementById('changeModel');
        this.controlPanel = document.getElementById('control-panel');
        this.infoPanel = document.getElementById('info-panel');
        this.modelSelector = document.getElementById('model-selector');
        this.modelList = document.getElementById('model-list');
    }

    init() {
        this.createControlPanel();
        this.createInfoPanel();
        this.setupEventListeners();
        this.showModelSelector();
    }
    
    createControlPanel() {
        // 이 함수는 HTML에 하드코딩된 UI를 제어하므로 비워두거나 동적 생성 로직 추가
    }
    
    createInfoPanel() {
        // 이 함수는 HTML에 하드코딩된 UI를 제어하므로 비워두거나 동적 생성 로직 추가
    }
    
    setupEventListeners() {
        this.changeModelBtn.addEventListener('click', () => this.showModelSelector());
        
        this.controlPanel.addEventListener('click', (e) => {
            if (e.target.id === 'playBtn') this.animationController.play();
            if (e.target.id === 'pauseBtn') this.animationController.pause();
            if (e.target.id === 'resetBtn') this.animationController.reset();
            if (e.target.id === 'toggleHotspots') this.hotspotManager.toggleVisibility();
            if (e.target.id === 'toggleGrid') this.sceneManager.toggleGrid();
        });

        this.controlPanel.addEventListener('input', (e) => {
            if (e.target.id === 'frameSlider') {
                this.animationController.setFrame(parseInt(e.target.value));
            }
            
            // 밝기 조절
            if (e.target.id === 'brightnessSlider') {
                const brightness = parseFloat(e.target.value);
                document.getElementById('brightnessDisplay').textContent = brightness.toFixed(1);
                this.sceneManager.renderer.toneMappingExposure = brightness;
            }
            
            // 주 조명 강도 조절
            if (e.target.id === 'mainLightSlider') {
                const intensity = parseFloat(e.target.value);
                document.getElementById('mainLightDisplay').textContent = intensity.toFixed(1);
                if (this.sceneManager.lights.directional) {
                    this.sceneManager.lights.directional.intensity = intensity;
                }
            }
        });
        
        this.controlPanel.addEventListener('change', (e) => {
            if (e.target.id === 'cameraView') this.sceneManager.setCameraView(e.target.value);
        });
    }
    
    showModelSelector() {
        this.modelSelector.style.display = 'flex';
        this.controlPanel.style.display = 'none';
        this.infoPanel.style.display = 'none';
        this.changeModelBtn.style.display = 'none';
        this.loadModelList();
    }
    
    loadModelList() {
        if (!CONFIG.models || CONFIG.models.length === 0) {
            this.modelList.innerHTML = '<p style="color: #ff6b6b;">사용 가능한 모델이 없습니다.</p>';
            return;
        }
        
        this.modelList.innerHTML = '';
        CONFIG.models.forEach(model => {
            const card = document.createElement('div');
            card.className = 'model-card';
            card.innerHTML = `
                <div class="model-icon">${model.icon}</div>
                <div class="model-name">${model.name}</div>
                <div class="model-info">${model.description}</div>
            `;
            card.addEventListener('click', () => this.selectModel(model));
            this.modelList.appendChild(card);
        });
    }
    
    async selectModel(model) {
        this.modelSelector.style.display = 'none';
        
        try {
            if (!model.fileName) throw new Error(`'${model.name}' 모델의 fileName이 config.js에 지정되지 않았습니다.`);
            
            const modelPath = `${CONFIG.modelsPath}${model.folder}/${model.fileName}`;
            const gltf = await this.modelLoader.loadGLTF(modelPath);

            this.updateModelInfo(gltf.userData.modelInfo);

            this.controlPanel.style.display = 'block';
            this.infoPanel.style.display = 'block';
            this.changeModelBtn.style.display = 'block';
            
            // 🆕 플러그인 UI 생성 (처음 모델 선택 시)
            if (!document.getElementById('plugin-controls') && window.createPluginUI) {
                window.createPluginUI();
            }
            
        } catch (error) {
            console.error('모델 로드 실패:', error);
            this.modelLoader.showError(`모델 로드 실패: ${error.message}`);
            this.showModelSelector();
        }
    }

    updateModelInfo(info) {
        document.getElementById('meshCount').textContent = info.meshCount;
        document.getElementById('vertexCount').textContent = info.vertexCount.toLocaleString();
        document.getElementById('triangleCount').textContent = info.triangleCount.toLocaleString();
        document.getElementById('hotspotCount').textContent = info.hotspots.length;

        // 카메라 뷰 옵션 업데이트
        const cameraSelect = document.getElementById('cameraView');
        cameraSelect.innerHTML = '<option value="default">기본 뷰</option>';
        
        const gltfCameras = this.modelLoader.getCameras();
        if (gltfCameras && gltfCameras.length > 0) {
            gltfCameras.forEach((camera, index) => {
                const option = document.createElement('option');
                option.value = `gltf_${index}`;
                option.textContent = camera.name || `카메라 ${index + 1}`;
                cameraSelect.appendChild(option);
            });
            console.log(`[UIController] ${gltfCameras.length}개의 GLTF 카메라를 추가했습니다.`);
        }

        const animControls = document.getElementById('animation-controls');
        if (this.animationController.hasAnimations()) {
            if(animControls) animControls.style.display = 'block';
            document.getElementById('frame-controls').style.display = 'block';
        } else {
            if(animControls) animControls.style.display = 'none';
            document.getElementById('frame-controls').style.display = 'none';
        }

        this.hotspotManager.clearHotspots();
        info.hotspots.forEach(hotspot => {
            this.hotspotManager.createHotspot(hotspot.name, hotspot.position, hotspot.userData);
        });
    }
    
    updateFPS() {
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime >= this.lastTime + 1000) {
            this.fps = this.frameCount;
            document.getElementById('fps').textContent = this.fps;
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }
    
    updateAnimationFrame(frame) {
        document.getElementById('frameSlider').value = frame;
        document.getElementById('frameDisplay').textContent = frame;
    }
}