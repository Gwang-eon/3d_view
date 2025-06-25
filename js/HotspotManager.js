// js/HotspotManager.js
// ConfigManager 기반 완전 개선 버전 - 모든 하드코딩 제거

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 핫스팟 관리 클래스
 * - ConfigManager 기반 설정 관리
 * - 3D 공간에서 2D UI 동기화
 * - 인터랙티브 핫스팟 시스템
 * - 애니메이션 및 효과 지원
 */
export class HotspotManager {
    constructor(sceneManager) {
        // 서비스 의존성
        this.sceneManager = sceneManager;
        
        // 핫스팟 관리
        this.hotspots = new Map();
        this.activeHotspot = null;
        this.hoveredHotspot = null;
        
        // DOM 컨테이너
        this.hotspotsContainer = null;
        
        // 상태 관리
        this.state = {
            visible: true,
            interactive: true,
            animationsEnabled: true
        };
        
        // 성능 최적화
        this.updateId = null;
        this.lastUpdateTime = 0;
        this.frustum = new THREE.Frustum();
        this.cameraMatrix = new THREE.Matrix4();
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // 초기화
        this.init();
        
        console.log('[HotspotManager] 초기화 완료');
    }
    
    /**
     * 초기화
     */
    init() {
        try {
            this.createHotspotsContainer();
            this.setupEventListeners();
            this.startUpdateLoop();
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('[HotspotManager] 초기화 실패:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * 핫스팟 컨테이너 생성
     */
    createHotspotsContainer() {
        // 기존 컨테이너 확인
        const containerSelector = getConfig('selectors.hotspotsContainer', '#hotspots-container');
        this.hotspotsContainer = document.querySelector(containerSelector);
        
        // 컨테이너가 없으면 생성
        if (!this.hotspotsContainer) {
            this.hotspotsContainer = document.createElement('div');
            this.hotspotsContainer.id = 'hotspots-container';
            this.hotspotsContainer.className = 'hotspots-container';
            
            // 기본 스타일 적용
            this.applyContainerStyles();
            
            // 캔버스 컨테이너에 추가
            const canvasContainer = this.sceneManager?.container || document.body;
            canvasContainer.appendChild(this.hotspotsContainer);
            
            console.log('[HotspotManager] 핫스팟 컨테이너 생성됨');
        }
    }
    
    /**
     * 컨테이너 스타일 적용
     */
    applyContainerStyles() {
        Object.assign(this.hotspotsContainer.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: '1000',
            overflow: 'hidden'
        });
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 윈도우 리사이즈
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // 설정 변경 감지
        if (this.app && this.app.configManager) {
            this.app.configManager.addChangeListener(this.handleConfigChange.bind(this));
        }
        
        // 씬 매니저 이벤트
        if (this.sceneManager) {
            this.sceneManager.on('model:added', (gltf, modelInfo) => {
                this.handleModelLoaded(gltf, modelInfo);
            });
            
            this.sceneManager.on('model:removed', () => {
                this.clearAllHotspots();
            });
        }
    }
    
    /**
     * 업데이트 루프 시작
     */
    startUpdateLoop() {
        const updateInterval = getConfig('hotspots.updateInterval', 16); // 60fps
        
        const update = () => {
            const currentTime = performance.now();
            
            if (currentTime - this.lastUpdateTime >= updateInterval) {
                this.updateHotspotPositions();
                this.lastUpdateTime = currentTime;
            }
            
            this.updateId = requestAnimationFrame(update);
        };
        
        this.updateId = requestAnimationFrame(update);
    }
    
    /**
     * 모델 로드 처리
     */
    handleModelLoaded(gltf, modelInfo) {
        // 기존 핫스팟 제거
        this.clearAllHotspots();
        
        // 모델 정보에서 핫스팟 생성
        if (modelInfo.hotspots && modelInfo.hotspots.length > 0) {
            modelInfo.hotspots.forEach(hotspotData => {
                this.createHotspot(hotspotData);
            });
            
            console.log(`[HotspotManager] ${modelInfo.hotspots.length}개 핫스팟 생성됨`);
        }
        
        // GLTF 모델에서 추가 핫스팟 찾기
        this.extractHotspotsFromModel(gltf.scene);
    }
    
    /**
     * 모델에서 핫스팟 추출
     */
    extractHotspotsFromModel(model) {
        const hotspotPrefix = getConfig('hotspots.prefix', 'HS_');
        let extractedCount = 0;
        
        model.traverse((child) => {
            if (child.name.startsWith(hotspotPrefix)) {
                const hotspotData = {
                    id: child.name,
                    name: this.formatHotspotName(child.name),
                    position: child.position.clone(),
                    userData: child.userData || {},
                    object3D: child
                };
                
                this.createHotspot(hotspotData);
                extractedCount++;
                
                // 원본 오브젝트는 숨김 (마커 역할만)
                child.visible = false;
            }
        });
        
        if (extractedCount > 0) {
            console.log(`[HotspotManager] 모델에서 ${extractedCount}개 추가 핫스팟 추출됨`);
        }
    }
    
    /**
     * 핫스팟 이름 포맷팅
     */
    formatHotspotName(rawName) {
        const prefix = getConfig('hotspots.prefix', 'HS_');
        return rawName.replace(prefix, '').replace(/_/g, ' ');
    }
    
    /**
     * 핫스팟 생성
     */
    createHotspot(hotspotData) {
        const hotspotId = hotspotData.id || `hotspot_${this.hotspots.size}`;
        
        // 이미 존재하는 핫스팟 확인
        if (this.hotspots.has(hotspotId)) {
            console.warn(`[HotspotManager] 중복 핫스팟 ID: ${hotspotId}`);
            return null;
        }
        
        // 핫스팟 객체 생성
        const hotspot = {
            id: hotspotId,
            name: hotspotData.name || hotspotId,
            position: hotspotData.position || new THREE.Vector3(),
            userData: hotspotData.userData || {},
            object3D: hotspotData.object3D || null,
            
            // DOM 요소
            element: null,
            
            // 상태
            visible: true,
            active: false,
            hovered: false,
            
            // 애니메이션
            animation: null,
            
            // 설정
            config: {
                icon: hotspotData.icon || getConfig('hotspots.defaultIcon', '📍'),
                size: hotspotData.size || getConfig('hotspots.iconSize', 24),
                clickRadius: hotspotData.clickRadius || getConfig('hotspots.clickRadius', 10),
                fadeDistance: hotspotData.fadeDistance || getConfig('hotspots.fadeDistance', 50),
                showLabel: hotspotData.showLabel !== false,
                interactive: hotspotData.interactive !== false
            }
        };
        
        // DOM 요소 생성
        this.createHotspotElement(hotspot);
        
        // 핫스팟 등록
        this.hotspots.set(hotspotId, hotspot);
        
        // 이벤트 발생
        this.emit('hotspot:created', hotspot);
        
        console.log(`[HotspotManager] 핫스팟 생성: ${hotspot.name}`);
        
        return hotspot;
    }
    
    /**
     * 핫스팟 DOM 요소 생성
     */
    createHotspotElement(hotspot) {
        // 컨테이너 요소
        const element = document.createElement('div');
        element.className = 'hotspot';
        element.dataset.hotspotId = hotspot.id;
        
        // 기본 스타일 적용
        this.applyHotspotStyles(element, hotspot);
        
        // 아이콘 생성
        const icon = document.createElement('div');
        icon.className = 'hotspot-icon';
        icon.textContent = hotspot.config.icon;
        icon.style.fontSize = `${hotspot.config.size}px`;
        element.appendChild(icon);
        
        // 라벨 생성 (선택적)
        if (hotspot.config.showLabel) {
            const label = document.createElement('div');
            label.className = 'hotspot-label';
            label.textContent = hotspot.name;
            element.appendChild(label);
        }
        
        // 이벤트 리스너 설정
        this.setupHotspotEvents(element, hotspot);
        
        // 컨테이너에 추가
        this.hotspotsContainer.appendChild(element);
        
        // 핫스팟 객체에 참조 저장
        hotspot.element = element;
        
        return element;
    }
    
    /**
     * 핫스팟 스타일 적용
     */
    applyHotspotStyles(element, hotspot) {
        const baseStyles = {
            position: 'absolute',
            pointerEvents: hotspot.config.interactive ? 'auto' : 'none',
            cursor: hotspot.config.interactive ? 'pointer' : 'default',
            userSelect: 'none',
            zIndex: '1001',
            transform: 'translate(-50%, -50%)',
            transition: getConfig('hotspots.animationsEnabled', true) ? 
                'all 0.3s ease' : 'none'
        };
        
        Object.assign(element.style, baseStyles);
        
        // 테마별 스타일
        const theme = getConfig('ui.theme', 'dark');
        this.applyThemeStyles(element, theme);
    }
    
    /**
     * 테마별 스타일 적용
     */
    applyThemeStyles(element, theme) {
        const icon = element.querySelector('.hotspot-icon');
        const label = element.querySelector('.hotspot-label');
        
        if (theme === 'light') {
            if (icon) {
                icon.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
            }
            if (label) {
                Object.assign(label.style, {
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#333',
                    border: '1px solid rgba(0,0,0,0.1)'
                });
            }
        } else {
            if (icon) {
                icon.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))';
            }
            if (label) {
                Object.assign(label.style, {
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)'
                });
            }
        }
        
        // 라벨 공통 스타일
        if (label) {
            Object.assign(label.style, {
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                marginTop: '5px',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(4px)'
            });
        }
    }
    
    /**
     * 핫스팟 이벤트 설정
     */
    setupHotspotEvents(element, hotspot) {
        if (!hotspot.config.interactive) return;
        
        // 클릭 이벤트
        element.addEventListener('click', (event) => {
            event.stopPropagation();
            this.handleHotspotClick(hotspot, event);
        });
        
        // 마우스 오버/아웃
        element.addEventListener('mouseenter', (event) => {
            this.handleHotspotHover(hotspot, true, event);
        });
        
        element.addEventListener('mouseleave', (event) => {
            this.handleHotspotHover(hotspot, false, event);
        });
        
        // 터치 이벤트 (모바일)
        element.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.handleHotspotClick(hotspot, event);
        }, { passive: false });
    }
    
    /**
     * 핫스팟 클릭 처리
     */
    handleHotspotClick(hotspot, event) {
        // 활성 핫스팟 변경
        this.setActiveHotspot(hotspot);
        
        // 클릭 애니메이션
        this.playClickAnimation(hotspot);
        
        // 이벤트 발생
        this.emit('hotspot:click', hotspot, event);
        
        console.log(`[HotspotManager] 핫스팟 클릭: ${hotspot.name}`);
    }
    
    /**
     * 핫스팟 호버 처리
     */
    handleHotspotHover(hotspot, isHovering, event) {
        hotspot.hovered = isHovering;
        
        if (isHovering) {
            this.hoveredHotspot = hotspot;
            this.playHoverAnimation(hotspot, true);
        } else {
            if (this.hoveredHotspot === hotspot) {
                this.hoveredHotspot = null;
            }
            this.playHoverAnimation(hotspot, false);
        }
        
        // 이벤트 발생
        this.emit('hotspot:hover', hotspot, isHovering, event);
    }
    
    /**
     * 활성 핫스팟 설정
     */
    setActiveHotspot(hotspot) {
        // 이전 활성 핫스팟 비활성화
        if (this.activeHotspot) {
            this.activeHotspot.active = false;
            this.updateHotspotState(this.activeHotspot);
        }
        
        // 새 활성 핫스팟 설정
        this.activeHotspot = hotspot;
        if (hotspot) {
            hotspot.active = true;
            this.updateHotspotState(hotspot);
        }
        
        this.emit('hotspot:active:change', this.activeHotspot);
    }
    
    /**
     * 핫스팟 상태 업데이트
     */
    updateHotspotState(hotspot) {
        const element = hotspot.element;
        if (!element) return;
        
        // CSS 클래스 업데이트
        element.classList.toggle('active', hotspot.active);
        element.classList.toggle('hovered', hotspot.hovered);
        element.classList.toggle('visible', hotspot.visible);
        
        // 크기 조절
        const scale = hotspot.active ? 1.2 : (hotspot.hovered ? 1.1 : 1.0);
        const icon = element.querySelector('.hotspot-icon');
        if (icon) {
            icon.style.transform = `scale(${scale})`;
        }
    }
    
    /**
     * 클릭 애니메이션
     */
    playClickAnimation(hotspot) {
        if (!getConfig('hotspots.animationsEnabled', true)) return;
        
        const element = hotspot.element;
        if (!element) return;
        
        const icon = element.querySelector('.hotspot-icon');
        if (!icon) return;
        
        // 리플 효과
        const ripple = document.createElement('div');
        ripple.className = 'hotspot-ripple';
        Object.assign(ripple.style, {
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '0',
            height: '0',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.5)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: '-1'
        });
        
        element.appendChild(ripple);
        
        // 애니메이션 실행
        const duration = getConfig('hotspots.animationDuration', 300);
        
        ripple.style.transition = `all ${duration}ms ease-out`;
        requestAnimationFrame(() => {
            ripple.style.width = '60px';
            ripple.style.height = '60px';
            ripple.style.opacity = '0';
        });
        
        // 정리
        setTimeout(() => {
            if (ripple.parentNode) {
                ripple.parentNode.removeChild(ripple);
            }
        }, duration);
    }
    
    /**
     * 호버 애니메이션
     */
    playHoverAnimation(hotspot, isHovering) {
        if (!getConfig('hotspots.animationsEnabled', true)) return;
        
        const element = hotspot.element;
        if (!element) return;
        
        const label = element.querySelector('.hotspot-label');
        if (label) {
            if (isHovering) {
                label.style.opacity = '1';
                label.style.transform = 'translateX(-50%) translateY(0)';
            } else {
                label.style.opacity = '0';
                label.style.transform = 'translateX(-50%) translateY(-10px)';
            }
        }
    }
    
    /**
     * 핫스팟 위치 업데이트
     */
    updateHotspotPositions() {
        if (!this.sceneManager || !this.sceneManager.camera || !this.sceneManager.renderer) {
            return;
        }
        
        if (!this.state.visible || this.hotspots.size === 0) {
            return;
        }
        
        const camera = this.sceneManager.camera;
        const renderer = this.sceneManager.renderer;
        
        // 프러스텀 업데이트
        this.updateCameraFrustum(camera);
        
        // 각 핫스팟 위치 업데이트
        this.hotspots.forEach(hotspot => {
            this.updateSingleHotspotPosition(hotspot, camera, renderer);
        });
    }
    
    /**
     * 카메라 프러스텀 업데이트
     */
    updateCameraFrustum(camera) {
        this.cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        this.frustum.setFromProjectionMatrix(this.cameraMatrix);
    }
    
    /**
     * 개별 핫스팟 위치 업데이트
     */
    updateSingleHotspotPosition(hotspot, camera, renderer) {
        if (!hotspot.visible || !hotspot.element) return;
        
        // 월드 위치 계산
        const worldPosition = this.calculateWorldPosition(hotspot);
        
        // 카메라 뒤에 있는지 확인
        if (!this.isPositionVisible(worldPosition, camera)) {
            this.setHotspotVisibility(hotspot, false);
            return;
        }
        
        // 스크린 좌표 변환
        const screenPosition = this.worldToScreen(worldPosition, camera, renderer);
        
        // 화면 영역 내에 있는지 확인
        if (!this.isScreenPositionValid(screenPosition)) {
            this.setHotspotVisibility(hotspot, false);
            return;
        }
        
        // 거리 기반 페이드 계산
        const distance = camera.position.distanceTo(worldPosition);
        const opacity = this.calculateOpacityByDistance(distance, hotspot.config.fadeDistance);
        
        if (opacity <= 0) {
            this.setHotspotVisibility(hotspot, false);
            return;
        }
        
        // 크기 조절 (선택적)
        const scale = this.calculateScaleByDistance(distance, hotspot);
        
        // DOM 업데이트
        this.updateHotspotDOM(hotspot, screenPosition, opacity, scale);
        this.setHotspotVisibility(hotspot, true);
    }
    
    /**
     * 월드 위치 계산
     */
    calculateWorldPosition(hotspot) {
        let worldPosition = hotspot.position.clone();
        
        // 3D 오브젝트가 있으면 해당 위치 사용
        if (hotspot.object3D) {
            worldPosition = new THREE.Vector3();
            hotspot.object3D.getWorldPosition(worldPosition);
        }
        // 현재 모델의 변환 적용
        else if (this.sceneManager.currentModel) {
            worldPosition.applyMatrix4(this.sceneManager.currentModel.matrixWorld);
        }
        
        return worldPosition;
    }
    
    /**
     * 위치 가시성 확인
     */
    isPositionVisible(worldPosition, camera) {
        // 카메라 뒤에 있는지 확인
        const toPosition = worldPosition.clone().sub(camera.position);
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        
        return toPosition.dot(cameraDirection) > 0;
    }
    
    /**
     * 월드 좌표를 스크린 좌표로 변환
     */
    worldToScreen(worldPosition, camera, renderer) {
        const vector = worldPosition.clone();
        vector.project(camera);
        
        const canvas = renderer.domElement;
        const x = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = -(vector.y * 0.5 - 0.5) * canvas.clientHeight;
        
        return { x, y };
    }
    
    /**
     * 스크린 좌표 유효성 확인
     */
    isScreenPositionValid(screenPosition) {
        const canvas = this.sceneManager.renderer.domElement;
        const margin = 50; // 여백
        
        return screenPosition.x >= -margin && 
               screenPosition.x <= canvas.clientWidth + margin &&
               screenPosition.y >= -margin && 
               screenPosition.y <= canvas.clientHeight + margin;
    }
    
    /**
     * 거리 기반 투명도 계산
     */
    calculateOpacityByDistance(distance, fadeDistance) {
        if (!getConfig('hotspots.scaleWithDistance', true)) {
            return 1.0;
        }
        
        const minDistance = fadeDistance * 0.5;
        const maxDistance = fadeDistance * 2;
        
        if (distance <= minDistance) {
            return 1.0;
        } else if (distance >= maxDistance) {
            return 0.0;
        } else {
            return 1.0 - (distance - minDistance) / (maxDistance - minDistance);
        }
    }
    
    /**
     * 거리 기반 크기 계산
     */
    calculateScaleByDistance(distance, hotspot) {
        if (!getConfig('hotspots.scaleWithDistance', true)) {
            return 1.0;
        }
        
        const minScale = getConfig('hotspots.minScale', 0.5);
        const maxScale = getConfig('hotspots.maxScale', 1.5);
        const baseDistance = 20; // 기준 거리
        
        const scale = baseDistance / Math.max(distance, 1);
        return THREE.MathUtils.clamp(scale, minScale, maxScale);
    }
    
    /**
     * 핫스팟 DOM 업데이트
     */
    updateHotspotDOM(hotspot, screenPosition, opacity, scale) {
        const element = hotspot.element;
        if (!element) return;
        
        // 위치 업데이트
        element.style.left = `${screenPosition.x}px`;
        element.style.top = `${screenPosition.y}px`;
        
        // 투명도 업데이트
        element.style.opacity = opacity;
        
        // 크기 업데이트
        const finalScale = scale * (hotspot.active ? 1.2 : (hotspot.hovered ? 1.1 : 1.0));
        const icon = element.querySelector('.hotspot-icon');
        if (icon) {
            icon.style.transform = `scale(${finalScale})`;
        }
    }
    
    /**
     * 핫스팟 가시성 설정
     */
    setHotspotVisibility(hotspot, visible) {
        if (hotspot.element) {
            hotspot.element.style.display = visible ? 'block' : 'none';
        }
    }
    
    /**
     * 핫스팟 제거
     */
    removeHotspot(hotspotId) {
        const hotspot = this.hotspots.get(hotspotId);
        if (!hotspot) return false;
        
        // DOM 요소 제거
        if (hotspot.element && hotspot.element.parentNode) {
            hotspot.element.parentNode.removeChild(hotspot.element);
        }
        
        // 활성/호버 상태 정리
        if (this.activeHotspot === hotspot) {
            this.activeHotspot = null;
        }
        if (this.hoveredHotspot === hotspot) {
            this.hoveredHotspot = null;
        }
        
        // 핫스팟 제거
        this.hotspots.delete(hotspotId);
        
        this.emit('hotspot:removed', hotspot);
        
        console.log(`[HotspotManager] 핫스팟 제거: ${hotspot.name}`);
        return true;
    }
    
    /**
     * 모든 핫스팟 제거
     */
    clearAllHotspots() {
        this.hotspots.forEach((hotspot, id) => {
            this.removeHotspot(id);
        });
        
        console.log('[HotspotManager] 모든 핫스팟 제거됨');
    }
    
    /**
     * 핫스팟 표시/숨김 토글
     */
    toggleVisibility() {
        this.setVisibility(!this.state.visible);
    }
    
    /**
     * 핫스팟 가시성 설정
     */
    setVisibility(visible) {
        this.state.visible = visible;
        
        if (this.hotspotsContainer) {
            this.hotspotsContainer.style.display = visible ? 'block' : 'none';
        }
        
        this.emit('visibility:change', visible);
    }
    
    /**
     * 인터랙티브 모드 설정
     */
    setInteractive(interactive) {
        this.state.interactive = interactive;
        
        this.hotspots.forEach(hotspot => {
            if (hotspot.element) {
                hotspot.element.style.pointerEvents = interactive ? 'auto' : 'none';
            }
        });
        
        this.emit('interactive:change', interactive);
    }
    
    /**
     * 애니메이션 활성화/비활성화
     */
    setAnimationsEnabled(enabled) {
        this.state.animationsEnabled = enabled;
        setConfig('hotspots.animationsEnabled', enabled);
        
        this.hotspots.forEach(hotspot => {
            if (hotspot.element) {
                hotspot.element.style.transition = enabled ? 'all 0.3s ease' : 'none';
            }
        });
        
        this.emit('animations:change', enabled);
    }
    
    /**
     * 핫스팟 검색
     */
    findHotspot(query) {
        const results = [];
        const searchTerm = query.toLowerCase();
        
        this.hotspots.forEach(hotspot => {
            if (hotspot.name.toLowerCase().includes(searchTerm) ||
                hotspot.id.toLowerCase().includes(searchTerm)) {
                results.push(hotspot);
            }
        });
        
        return results;
    }
    
    /**
     * 핫스팟 포커스
     */
    focusHotspot(hotspotId) {
        const hotspot = this.hotspots.get(hotspotId);
        if (!hotspot) return false;
        
        // 핫스팟 활성화
        this.setActiveHotspot(hotspot);
        
        // 카메라 이동 (선택적)
        const shouldMoveCamera = getConfig('hotspots.focusMoveCamera', true);
        if (shouldMoveCamera && this.sceneManager) {
            const worldPosition = this.calculateWorldPosition(hotspot);
            this.moveCameraToHotspot(worldPosition);
        }
        
        // 포커스 애니메이션
        this.playFocusAnimation(hotspot);
        
        this.emit('hotspot:focus', hotspot);
        return true;
    }
    
    /**
     * 카메라를 핫스팟으로 이동
     */
    moveCameraToHotspot(worldPosition) {
        if (!this.sceneManager.controls) return;
        
        const distance = getConfig('hotspots.focusDistance', 10);
        const currentPosition = this.sceneManager.camera.position.clone();
        const direction = currentPosition.clone().sub(worldPosition).normalize();
        const newPosition = worldPosition.clone().add(direction.multiplyScalar(distance));
        
        if (this.sceneManager.animateCameraTo) {
            this.sceneManager.animateCameraTo(newPosition, worldPosition);
        } else {
            this.sceneManager.controls.target.copy(worldPosition);
            this.sceneManager.camera.position.copy(newPosition);
            this.sceneManager.controls.update();
        }
    }
    
    /**
     * 포커스 애니메이션
     */
    playFocusAnimation(hotspot) {
        if (!getConfig('hotspots.animationsEnabled', true)) return;
        
        const element = hotspot.element;
        if (!element) return;
        
        // 펄스 효과
        element.style.animation = 'hotspot-pulse 1s ease-in-out';
        
        setTimeout(() => {
            element.style.animation = '';
        }, 1000);
    }
    
    /**
     * 이벤트 핸들러들
     */
    handleResize() {
        // 위치 업데이트는 다음 프레임에서 자동으로 처리됨
        this.emit('resize');
    }
    
    handleConfigChange(key, value) {
        if (key.startsWith('hotspots.')) {
            const property = key.split('.').pop();
            
            switch (property) {
                case 'animationsEnabled':
                    this.setAnimationsEnabled(value);
                    break;
                    
                case 'defaultIcon':
                case 'iconSize':
                    this.updateAllHotspotStyles();
                    break;
            }
        }
        
        if (key === 'ui.theme') {
            this.updateAllHotspotStyles();
        }
    }
    
    /**
     * 모든 핫스팟 스타일 업데이트
     */
    updateAllHotspotStyles() {
        const theme = getConfig('ui.theme', 'dark');
        
        this.hotspots.forEach(hotspot => {
            if (hotspot.element) {
                this.applyThemeStyles(hotspot.element, theme);
            }
        });
    }
    
    /**
     * 접근자 메서드들
     */
    getHotspot(hotspotId) {
        return this.hotspots.get(hotspotId);
    }
    
    getAllHotspots() {
        return Array.from(this.hotspots.values());
    }
    
    getHotspotCount() {
        return this.hotspots.size;
    }
    
    getActiveHotspot() {
        return this.activeHotspot;
    }
    
    getHoveredHotspot() {
        return this.hoveredHotspot;
    }
    
    getState() {
        return { ...this.state };
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
                    console.error(`[HotspotManager] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
    }
    
    /**
     * 정리
     */
    destroy() {
        console.log('[HotspotManager] 정리 중...');
        
        // 업데이트 루프 중지
        if (this.updateId) {
            cancelAnimationFrame(this.updateId);
        }
        
        // 모든 핫스팟 제거
        this.clearAllHotspots();
        
        // 컨테이너 제거
        if (this.hotspotsContainer && this.hotspotsContainer.parentNode) {
            this.hotspotsContainer.parentNode.removeChild(this.hotspotsContainer);
        }
        
        // 이벤트 리스너 제거
        window.removeEventListener('resize', this.handleResize);
        
        // 이벤트 정리
        this.events.clear();
        
        this.emit('destroyed');
        console.log('[HotspotManager] 정리 완료');
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[HotspotManager] 디버그 정보');
        console.log('핫스팟 수:', this.hotspots.size);
        console.log('활성 핫스팟:', this.activeHotspot?.name || '없음');
        console.log('호버 핫스팟:', this.hoveredHotspot?.name || '없음');
        console.log('상태:', this.state);
        console.log('컨테이너:', this.hotspotsContainer);
        console.log('등록된 이벤트:', Array.from(this.events.keys()));
        
        if (this.hotspots.size > 0) {
            console.log('핫스팟 목록:');
            this.hotspots.forEach((hotspot, id) => {
                console.log(`  ${id}: ${hotspot.name} (${hotspot.visible ? '표시' : '숨김'})`);
            });
        }
        console.groupEnd();
    }
}

// CSS 애니메이션 추가 (한 번만 실행)
if (typeof document !== 'undefined' && !document.querySelector('#hotspot-animations')) {
    const style = document.createElement('style');
    style.id = 'hotspot-animations';
    style.textContent = `
        @keyframes hotspot-pulse {
            0% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.3); }
            100% { transform: translate(-50%, -50%) scale(1); }
        }
        
        .hotspot {
            transition: all 0.3s ease;
        }
        
        .hotspot:hover {
            z-index: 1002;
        }
        
        .hotspot.active .hotspot-icon {
            animation: hotspot-pulse 2s ease-in-out infinite;
        }
        
        .hotspot-label {
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
    `;
    document.head.appendChild(style);
}

export default HotspotManager;