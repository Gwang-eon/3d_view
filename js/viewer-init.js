// js/viewer-init.js
// 뷰어 초기화 헬퍼 - viewer-main.js를 보조하는 역할

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
    
    hideLoading() {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }
    
    showError(message) {
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }
}

// 전역 헬퍼 함수
export function initializeViewer() {
    console.log('[ViewerInit] 뷰어 초기화 지원');
    return new ViewerInitializer();
}

// 자동 실행 방지 (viewer-main.js에서 처리)
export default ViewerInitializer;