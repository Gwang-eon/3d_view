// js/viewer-init.js
// Viewer 초기화 헬퍼 - viewer-main.js를 보조하는 역할

import { CONFIG } from './config.js';

export class ViewerInitializer {
    constructor() {
        console.log('[ViewerInit] 초기화 헬퍼 생성');
        this.urlParams = new URLSearchParams(window.location.search);
    }
    
    getModelIdFromURL() {
        return this.urlParams.get('model');
    }
    
    getModelById(modelId) {
        const id = parseInt(modelId);
        if (isNaN(id) || id < 0 || id >= CONFIG.models.length) {
            return null;
        }
        return CONFIG.models[id];
    }
    
    async initialize() {
        console.log('[ViewerInit] 초기화 시작');
        const modelId = this.getModelIdFromURL();
        
        if (modelId !== null) {
            const model = this.getModelById(modelId);
            
            if (model) {
                console.log(`[ViewerInit] URL 파라미터로 모델 자동 로드: ${model.name}`);
                this.showLoadingMessage(`${model.name} 로드 중...`);
                
                try {
                    const modelSelector = document.getElementById('model-selector');
                    if (modelSelector) {
                        modelSelector.style.display = 'none';
                    }
                    
                    await this.uiController.selectModel(model);
                    this.activateToggleButton(modelId);
                } catch (error) {
                    console.error('[ViewerInit] 모델 로드 실패:', error);
                    this.showError('모델을 로드할 수 없습니다.');
                }
            } else {
                console.warn(`[ViewerInit] 잘못된 모델 ID: ${modelId}`);
                this.showError('잘못된 모델 ID입니다.');
            }
        } else {
            console.log('[ViewerInit] URL 파라미터 없음 - 모델 선택 화면 표시');
            this.uiController.showModelSelector();
        }
    }
    
    addHomeButton() {
        const homeButton = document.createElement('button');
        homeButton.id = 'home-btn';
        homeButton.className = 'header-btn';
        homeButton.title = '홈으로';
        homeButton.innerHTML = '<span>🏠</span>';
        homeButton.onclick = () => {
            window.location.href = 'index.html';
        };
        
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            headerRight.insertBefore(homeButton, headerRight.firstChild);
        } else {
            console.error('[ViewerInit] 헤더를 찾을 수 없습니다.');
        }
    }
    
    showLoadingMessage(message) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            const messageEl = loadingEl.querySelector('div:nth-child(2)');
            if (messageEl) {
                messageEl.textContent = message;
            }
            loadingEl.style.display = 'flex';
        }
    }
}