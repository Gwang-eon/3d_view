import { CONFIG } from './config.js';

export class HotspotManager {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.hotspots = [];
        this.visible = true;
        this.container = document.getElementById('container');
    }
    
    createHotspot(name, position, userData = {}) {
        const hotspotDiv = document.createElement('div');
        hotspotDiv.className = 'hotspot';
        
        const icon = userData.icon || CONFIG.hotspot.defaultIcon;
        const title = userData.title || name;
        const description = userData.description || '';
        
        hotspotDiv.innerHTML = `
            <div class="hotspot-icon">${icon}</div>
            <div class="hotspot-tooltip">
                <strong>${title}</strong>
                ${description ? `<br>${description}` : ''}
            </div>
        `;
        
        this.container.appendChild(hotspotDiv);
        
        const hotspot = { name, element: hotspotDiv, position, userData };
        this.hotspots.push(hotspot);
        
        hotspotDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showHotspotInfo(hotspot);
        });
    }
    
    updatePositions() {
        const camera = this.sceneManager.camera;
        const domElement = this.sceneManager.renderer.domElement;
        
        this.hotspots.forEach(hotspot => {
            if (!this.visible) {
                hotspot.element.style.display = 'none';
                return;
            }
            
            const worldPosition = hotspot.position.clone();
            const model = this.sceneManager.currentModel;
            if (model) {
                worldPosition.applyMatrix4(model.matrixWorld);
            }
            
            const screenPosition = this.toScreenPosition(worldPosition, camera, domElement);
            
            const toHotspot = worldPosition.clone().sub(camera.position);
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);

            if (toHotspot.dot(cameraDirection) > 0) { // Check if hotspot is in front of camera
                hotspot.element.style.display = 'block';
                hotspot.element.style.transform = `translate(${screenPosition.x}px, ${screenPosition.y}px) translate(-50%, -50%)`;
            } else {
                hotspot.element.style.display = 'none';
            }
        });
    }
    
    toScreenPosition(position, camera, domElement) {
        const vector = position.clone().project(camera);
        const widthHalf = domElement.clientWidth / 2;
        const heightHalf = domElement.clientHeight / 2;
        return {
            x: (vector.x * widthHalf) + widthHalf,
            y: -(vector.y * heightHalf) + heightHalf
        };
    }
    
    toggleVisibility() {
        this.visible = !this.visible;
        this.updatePositions(); // Apply visibility change immediately
    }
    
    showHotspotInfo(hotspot) {
        // 기존 팝업 제거
        const existingPanel = document.getElementById('hotspot-info-panel');
        if (existingPanel) existingPanel.remove();
        
        const infoPanel = document.createElement('div');
        infoPanel.id = 'hotspot-info-panel';
        // (스타일링은 CSS로 분리하는 것이 더 좋으나, 편의상 JS에 유지)
        infoPanel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9); border: 1px solid #007bff; border-radius: 10px;
            padding: 20px; min-width: 300px; z-index: 1001; color: white;
        `;
        
        let content = `<h3>${hotspot.name}</h3>`;
        Object.entries(hotspot.userData).forEach(([key, value]) => {
            content += `<p><strong>${key}:</strong> ${value}</p>`;
        });
        
        const closeButton = document.createElement('button');
        closeButton.textContent = '닫기';
        closeButton.style.cssText = `margin-top: 15px; width: 100%; padding: 8px; background: #007bff; border: none; color: white; border-radius: 5px; cursor: pointer;`;
        closeButton.onclick = () => infoPanel.remove();
        
        infoPanel.innerHTML = content;
        infoPanel.appendChild(closeButton);
        document.body.appendChild(infoPanel);
    }
    
    clearHotspots() {
        this.hotspots.forEach(hotspot => hotspot.element.remove());
        this.hotspots = [];
    }
}