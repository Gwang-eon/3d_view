// HotspotManager.js - 완전한 핫스팟 관리자
import { CONFIG } from './config.js';

export class HotspotManager {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.hotspots = [];
        this.hotspotsVisible = true;
        this.container = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // 핫스팟 클릭 콜백
        this.onHotspotClick = null;
        
        this.init();
    }
    
    init() {
        console.log('[HotspotManager] 초기화 시작');
        
        // 핫스팟 컨테이너 생성
        this.container = document.getElementById('hotspot-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'hotspot-container';
            this.container.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 100;
            `;
            document.getElementById('canvas-container').appendChild(this.container);
        }
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        console.log('[HotspotManager] 초기화 완료');
    }
    
    setupEventListeners() {
        // 마우스 클릭 이벤트
        const canvas = this.sceneManager.renderer.domElement;
        canvas.addEventListener('click', (event) => this.onMouseClick(event));
    }
    
    createHotspot(name, position, userData = {}) {
        console.log(`[HotspotManager] 핫스팟 생성: ${name}`);
        
        // 핫스팟 DOM 요소 생성
        const hotspotDiv = document.createElement('div');
        hotspotDiv.className = 'hotspot';
        hotspotDiv.id = `hotspot-${name}`;
        
        // 기본 아이콘 및 정보 설정
        const icon = userData.icon || '📍';
        const title = userData.title || name;
        const description = userData.description || '';
        
        hotspotDiv.innerHTML = `
            <div class="hotspot-icon">${icon}</div>
            <div class="hotspot-tooltip">
                <strong>${title}</strong>
                ${description ? `<br><span>${description}</span>` : ''}
            </div>
        `;
        
        // 스타일 설정
        hotspotDiv.style.cssText = `
            position: absolute;
            cursor: pointer;
            pointer-events: auto;
            transform: translate(-50%, -50%);
            z-index: 101;
        `;
        
        this.container.appendChild(hotspotDiv);
        
        // 3D 마커 생성 (선택적)
        const marker3D = this.create3DMarker(position, userData);
        
        // 핫스팟 객체 생성
        const hotspot = {
            name,
            element: hotspotDiv,
            position: position.clone(),
            userData,
            marker3D,
            visible: true
        };
        
        this.hotspots.push(hotspot);
        
        // 클릭 이벤트 설정
        hotspotDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleHotspotClick(hotspot);
        });
        
        // 호버 효과
        hotspotDiv.addEventListener('mouseenter', () => {
            hotspotDiv.classList.add('hover');
        });
        
        hotspotDiv.addEventListener('mouseleave', () => {
            hotspotDiv.classList.remove('hover');
        });
        
        return hotspot;
    }
    
    create3DMarker(position, userData) {
        // 3D 마커 생성 (구체)
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.8
        });
        
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);
        marker.userData = { ...userData, isHotspot: true };
        
        // 씬에 추가
        if (this.sceneManager.currentModel) {
            this.sceneManager.currentModel.add(marker);
        }
        
        return marker;
    }
    
    updatePositions() {
        if (!this.sceneManager.camera || !this.sceneManager.renderer) return;
        
        const camera = this.sceneManager.camera;
        const renderer = this.sceneManager.renderer;
        const model = this.sceneManager.currentModel;
        
        this.hotspots.forEach(hotspot => {
            if (!this.hotspotsVisible || !hotspot.visible) {
                hotspot.element.style.display = 'none';
                return;
            }
            
            // 월드 좌표 계산
            const worldPosition = hotspot.position.clone();
            if (model) {
                worldPosition.applyMatrix4(model.matrixWorld);
            }
            
            // 스크린 좌표로 변환
            const screenPosition = this.toScreenPosition(worldPosition, camera, renderer);
            
            // 카메라 방향 확인 (뒤에 있는지)
            const toHotspot = worldPosition.clone().sub(camera.position);
            const cameraDirection = new THREE.Vector3();
            camera.getWorldDirection(cameraDirection);
            
            if (toHotspot.dot(cameraDirection) > 0) {
                // 화면에 표시
                hotspot.element.style.display = 'block';
                hotspot.element.style.left = `${screenPosition.x}px`;
                hotspot.element.style.top = `${screenPosition.y}px`;
                
                // 거리에 따른 크기 조절
                const distance = camera.position.distanceTo(worldPosition);
                const scale = Math.max(0.5, Math.min(1.5, 20 / distance));
                hotspot.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
            } else {
                // 카메라 뒤에 있으면 숨김
                hotspot.element.style.display = 'none';
            }
        });
    }
    
    toScreenPosition(worldPosition, camera, renderer) {
        const vector = worldPosition.clone();
        vector.project(camera);
        
        const canvas = renderer.domElement;
        const widthHalf = canvas.width / 2;
        const heightHalf = canvas.height / 2;
        
        vector.x = (vector.x * widthHalf) + widthHalf;
        vector.y = -(vector.y * heightHalf) + heightHalf;
        
        return {
            x: vector.x,
            y: vector.y
        };
    }
    
    handleHotspotClick(hotspot) {
        console.log(`[HotspotManager] 핫스팟 클릭: ${hotspot.name}`);
        
        // 커스텀 콜백 실행
        if (this.onHotspotClick) {
            this.onHotspotClick(hotspot);
        }
        
        // 기본 동작: 정보 표시
        this.showHotspotInfo(hotspot);
    }
    
    showHotspotInfo(hotspot) {
        // 기존 정보 패널 제거
        const existingPanel = document.querySelector('.hotspot-info-panel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // 정보 패널 생성
        const infoPanel = document.createElement('div');
        infoPanel.className = 'hotspot-info-panel';
        infoPanel.innerHTML = `
            <div class="hotspot-info-header">
                <h3>${hotspot.userData.title || hotspot.name}</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="hotspot-info-body">
                ${hotspot.userData.description ? `<p>${hotspot.userData.description}</p>` : ''}
                ${this.generateInfoContent(hotspot.userData)}
            </div>
        `;
        
        // 스타일 설정
        infoPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid #00ff88;
            border-radius: 8px;
            padding: 20px;
            max-width: 400px;
            z-index: 1000;
            color: white;
        `;
        
        document.body.appendChild(infoPanel);
        
        // 닫기 버튼 이벤트
        infoPanel.querySelector('.close-btn').addEventListener('click', () => {
            infoPanel.remove();
        });
        
        // ESC 키로 닫기
        const closeOnEsc = (e) => {
            if (e.key === 'Escape') {
                infoPanel.remove();
                document.removeEventListener('keydown', closeOnEsc);
            }
        };
        document.addEventListener('keydown', closeOnEsc);
    }
    
    generateInfoContent(userData) {
        let content = '<div class="hotspot-info-details">';
        
        // 추가 정보 표시
        const skipKeys = ['icon', 'title', 'description'];
        Object.entries(userData).forEach(([key, value]) => {
            if (!skipKeys.includes(key) && value) {
                const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
                content += `
                    <div class="info-row">
                        <span class="info-label">${label}:</span>
                        <span class="info-value">${value}</span>
                    </div>
                `;
            }
        });
        
        content += '</div>';
        return content;
    }
    
    onMouseClick(event) {
        // 3D 핫스팟 클릭 감지
        const canvas = this.sceneManager.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
        
        // 3D 마커와의 교차 검사
        const markers = this.hotspots.map(h => h.marker3D).filter(m => m);
        const intersects = this.raycaster.intersectObjects(markers);
        
        if (intersects.length > 0) {
            const clickedMarker = intersects[0].object;
            const hotspot = this.hotspots.find(h => h.marker3D === clickedMarker);
            if (hotspot) {
                this.handleHotspotClick(hotspot);
            }
        }
    }
    
    toggleVisibility() {
        this.hotspotsVisible = !this.hotspotsVisible;
        
        this.hotspots.forEach(hotspot => {
            hotspot.element.style.display = this.hotspotsVisible ? 'block' : 'none';
            if (hotspot.marker3D) {
                hotspot.marker3D.visible = this.hotspotsVisible;
            }
        });
        
        console.log(`[HotspotManager] 핫스팟 표시: ${this.hotspotsVisible ? '켜짐' : '꺼짐'}`);
    }
    
    showHotspot(name) {
        const hotspot = this.hotspots.find(h => h.name === name);
        if (hotspot) {
            hotspot.visible = true;
            if (hotspot.marker3D) {
                hotspot.marker3D.visible = true;
            }
        }
    }
    
    hideHotspot(name) {
        const hotspot = this.hotspots.find(h => h.name === name);
        if (hotspot) {
            hotspot.visible = false;
            hotspot.element.style.display = 'none';
            if (hotspot.marker3D) {
                hotspot.marker3D.visible = false;
            }
        }
    }
    
    clearHotspots() {
        console.log('[HotspotManager] 모든 핫스팟 제거');
        
        this.hotspots.forEach(hotspot => {
            // DOM 요소 제거
            if (hotspot.element && hotspot.element.parentNode) {
                hotspot.element.remove();
            }
            
            // 3D 마커 제거
            if (hotspot.marker3D && hotspot.marker3D.parent) {
                hotspot.marker3D.parent.remove(hotspot.marker3D);
                hotspot.marker3D.geometry.dispose();
                hotspot.marker3D.material.dispose();
            }
        });
        
        this.hotspots = [];
    }
    
    getHotspot(name) {
        return this.hotspots.find(h => h.name === name);
    }
    
    getAllHotspots() {
        return this.hotspots;
    }
    
    dispose() {
        this.clearHotspots();
        
        if (this.container && this.container.parentNode) {
            this.container.remove();
        }
        
        console.log('[HotspotManager] 리소스 해제 완료');
    }
}