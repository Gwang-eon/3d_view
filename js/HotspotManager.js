// js/HotspotManager.js
// ConfigManager 기반 완전 개선 버전 - 모든 하드코딩 제거

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 핫스팟 관리 클래스
 * - ConfigManager 기반 설정 관리
 * - 3D 공간에서 2D UI 완벽 동기화
 * - 인터랙티브 핫스팟 시스템
 * - 애니메이션 및 효과 지원
 * - 접근성 개선
 * - 성능 최적화
 * - 다양한 핫스팟 타입 지원
 */
export class HotspotManager {
    constructor(sceneManager) {
        // 서비스 의존성
        this.sceneManager = sceneManager;
        
        // 핫스팟 관리
        this.hotspots = new Map();
        this.hotspotGroups = new Map();
        this.activeHotspot = null;
        this.hoveredHotspot = null;
        this.focusedHotspot = null; // 키보드 포커스용
        
        // DOM 관리
        this.hotspotsContainer = null;
        this.tooltipContainer = null;
        this.infoPanel = null;
        
        // 상태 관리
        this.state = {
            visible: true,
            interactive: true,
            animationsEnabled: true,
            autoHide: false,
            keyboardNavigation: false
        };
        
        // 성능 최적화
        this.updateId = null;
        this.lastUpdateTime = 0;
        this.updateInterval = getConfig('hotspots.updateInterval', 16); // ~60fps
        this.frustum = new THREE.Frustum();
        this.cameraMatrix = new THREE.Matrix4();
        this.tempVector = new THREE.Vector3();
        this.tempVector2 = new THREE.Vector2();
        
        // 레이캐스팅
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.intersectionThreshold = getConfig('hotspots.intersectionThreshold', 1.0);
        
        // 애니메이션
        this.animations = new Map();
        this.animationQueue = [];
        
        // 접근성
        this.accessibility = {
            announcements: new Set(),
            focusHistory: [],
            tabIndex: 0
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 앱 참조 (의존성 주입용)
        this.app = null;
        
        // 바인드된 메서드들
        this.handleResize = this.handleResize.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseClick = this.handleMouseClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleConfigChange = this.handleConfigChange.bind(this);
        this.updateHotspots = this.updateHotspots.bind(this);
        
        // 초기화
        this.init();
        
        console.log('[HotspotManager] 초기화 완료');
    }
    
    /**
     * 초기화
     */
    async init() {
        try {
            // DOM 컨테이너 생성
            this.createContainers();
            
            // 스타일 적용
            this.createStyles();
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 업데이트 루프 시작
            this.startUpdateLoop();
            
            // 접근성 설정
            this.setupAccessibility();
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('[HotspotManager] 초기화 실패:', error);
            this.emit('error', error);
            throw error;
        }
    }
    
    /**
     * DOM 컨테이너 생성
     */
    createContainers() {
        // 메인 핫스팟 컨테이너
        const containerSelector = getConfig('selectors.hotspotsContainer', '#hotspots-container');
        this.hotspotsContainer = document.querySelector(containerSelector);
        
        if (!this.hotspotsContainer) {
            this.hotspotsContainer = document.createElement('div');
            this.hotspotsContainer.id = 'hotspots-container';
            this.hotspotsContainer.className = 'hotspots-container';
            
            // 캔버스 컨테이너에 추가
            const canvasContainer = this.findCanvasContainer();
            canvasContainer.appendChild(this.hotspotsContainer);
        }
        
        // 툴팁 컨테이너
        this.tooltipContainer = document.createElement('div');
        this.tooltipContainer.id = 'hotspot-tooltip-container';
        this.tooltipContainer.className = 'hotspot-tooltip-container';
        this.hotspotsContainer.appendChild(this.tooltipContainer);
        
        // 정보 패널 컨테이너
        this.infoPanel = document.createElement('div');
        this.infoPanel.id = 'hotspot-info-panel';
        this.infoPanel.className = 'hotspot-info-panel';
        this.hotspotsContainer.appendChild(this.infoPanel);
        
        console.log('[HotspotManager] ✓ DOM 컨테이너 생성됨');
    }
    
    /**
     * 캔버스 컨테이너 찾기
     */
    findCanvasContainer() {
        const candidates = [
            getConfig('selectors.canvasContainer', '#canvas-container'),
            '#viewer-container',
            '#main-container',
            'body'
        ];
        
        for (const selector of candidates) {
            const container = document.querySelector(selector);
            if (container) return container;
        }
        
        return document.body;
    }
    
    /**
     * 스타일 생성
     */
    createStyles() {
        if (document.getElementById('hotspot-manager-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'hotspot-manager-styles';
        style.textContent = this.generateCSS();
        document.head.appendChild(style);
        
        console.log('[HotspotManager] ✓ 스타일 적용됨');
    }
    
    /**
     * CSS 생성
     */
    generateCSS() {
        const theme = getConfig('ui.theme', 'dark');
        const primaryColor = getConfig('hotspots.primaryColor', '#64b5f6');
        const backgroundColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)';
        const textColor = theme === 'dark' ? '#ffffff' : '#000000';
        
        return `
            .hotspots-container {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1000;
                overflow: hidden;
            }
            
            .hotspot {
                position: absolute;
                width: 32px;
                height: 32px;
                pointer-events: auto;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                transform-origin: center;
                z-index: 1001;
            }
            
            .hotspot:focus {
                outline: 2px solid ${primaryColor};
                outline-offset: 2px;
            }
            
            .hotspot-icon {
                width: 100%;
                height: 100%;
                background: ${primaryColor};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                color: white;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                transition: inherit;
                position: relative;
                overflow: hidden;
            }
            
            .hotspot-icon::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .hotspot:hover .hotspot-icon::before {
                opacity: 1;
            }
            
            .hotspot:hover {
                transform: scale(1.2);
                z-index: 1002;
            }
            
            .hotspot.active {
                transform: scale(1.3);
                z-index: 1003;
            }
            
            .hotspot.active .hotspot-icon {
                background: #ff6b6b;
                box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
            }
            
            .hotspot-pulse {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 32px;
                height: 32px;
                border: 2px solid ${primaryColor};
                border-radius: 50%;
                transform: translate(-50%, -50%);
                animation: hotspot-pulse-animation 2s infinite;
                pointer-events: none;
            }
            
            @keyframes hotspot-pulse-animation {
                0% {
                    transform: translate(-50%, -50%) scale(1);
                    opacity: 1;
                }
                100% {
                    transform: translate(-50%, -50%) scale(2);
                    opacity: 0;
                }
            }
            
            .hotspot-label {
                position: absolute;
                top: -40px;
                left: 50%;
                transform: translateX(-50%);
                background: ${backgroundColor};
                color: ${textColor};
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
                backdrop-filter: blur(4px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }
            
            .hotspot:hover .hotspot-label,
            .hotspot.active .hotspot-label {
                opacity: 1;
            }
            
            .hotspot-tooltip-container {
                position: absolute;
                pointer-events: none;
                z-index: 1004;
            }
            
            .hotspot-tooltip {
                background: ${backgroundColor};
                color: ${textColor};
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
                max-width: 300px;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
            }
            
            .hotspot-tooltip.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .hotspot-tooltip-title {
                font-weight: bold;
                margin-bottom: 4px;
                font-size: 14px;
            }
            
            .hotspot-tooltip-description {
                font-size: 12px;
                line-height: 1.4;
                opacity: 0.8;
            }
            
            .hotspot-info-panel {
                position: absolute;
                top: 20px;
                right: 20px;
                width: 320px;
                background: ${backgroundColor};
                color: ${textColor};
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(16px);
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
                z-index: 1005;
            }
            
            .hotspot-info-panel.visible {
                opacity: 1;
                transform: translateX(0);
            }
            
            .hotspot-info-header {
                padding: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .hotspot-info-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 8px;
            }
            
            .hotspot-info-subtitle {
                font-size: 14px;
                opacity: 0.7;
            }
            
            .hotspot-info-content {
                padding: 20px;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .hotspot-info-close {
                position: absolute;
                top: 15px;
                right: 15px;
                background: none;
                border: none;
                color: ${textColor};
                font-size: 20px;
                cursor: pointer;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s ease;
            }
            
            .hotspot-info-close:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .hotspot.type-info .hotspot-icon {
                background: #2196f3;
            }
            
            .hotspot.type-warning .hotspot-icon {
                background: #ff9800;
            }
            
            .hotspot.type-error .hotspot-icon {
                background: #f44336;
            }
            
            .hotspot.type-success .hotspot-icon {
                background: #4caf50;
            }
            
            .hotspot.hidden {
                opacity: 0;
                pointer-events: none;
            }
            
            @media (max-width: 768px) {
                .hotspot-info-panel {
                    width: calc(100vw - 40px);
                    max-width: 400px;
                    top: auto;
                    bottom: 20px;
                    right: 20px;
                    transform: translateY(100%);
                }
                
                .hotspot-info-panel.visible {
                    transform: translateY(0);
                }
                
                .hotspot-tooltip {
                    max-width: 250px;
                    font-size: 11px;
                }
            }
            
            @media (prefers-reduced-motion: reduce) {
                .hotspot,
                .hotspot-icon,
                .hotspot-label,
                .hotspot-tooltip,
                .hotspot-info-panel {
                    transition: none !important;
                    animation: none !important;
                }
            }
        `;
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 윈도우 이벤트
        window.addEventListener('resize', this.handleResize);
        
        // 마우스 이벤트
        const canvas = this.sceneManager?.renderer?.domElement;
        if (canvas) {
            canvas.addEventListener('mousemove', this.handleMouseMove);
            canvas.addEventListener('click', this.handleMouseClick);
        }
        
        // 키보드 이벤트
        document.addEventListener('keydown', this.handleKeyDown);
        
        // 설정 변경 이벤트
        if (getConfig.addChangeListener) {
            getConfig.addChangeListener(this.handleConfigChange);
        }
        
        console.log('[HotspotManager] ✓ 이벤트 리스너 설정됨');
    }
    
    /**
     * 업데이트 루프 시작
     */
    startUpdateLoop() {
        const update = () => {
            this.updateId = requestAnimationFrame(update);
            
            const currentTime = performance.now();
            if (currentTime - this.lastUpdateTime >= this.updateInterval) {
                this.updateHotspots();
                this.lastUpdateTime = currentTime;
            }
        };
        
        update();
        console.log('[HotspotManager] ✓ 업데이트 루프 시작됨');
    }
    
    /**
     * 접근성 설정
     */
    setupAccessibility() {
        // ARIA 라이브 리전 생성
        const liveRegion = document.createElement('div');
        liveRegion.id = 'hotspot-announcements';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        document.body.appendChild(liveRegion);
        
        console.log('[HotspotManager] ✓ 접근성 설정됨');
    }
    
    /**
     * 핫스팟 생성
     */
    createHotspot(config) {
        // 설정 병합
        const hotspotConfig = {
            id: config.id || `hotspot_${Date.now()}`,
            name: config.name || 'Unnamed Hotspot',
            position: config.position || { x: 0, y: 0, z: 0 },
            worldObject: config.worldObject || null,
            type: config.type || 'info',
            icon: config.icon || this.getDefaultIcon(config.type),
            title: config.title || config.name,
            description: config.description || '',
            content: config.content || '',
            visible: config.visible !== false,
            interactive: config.interactive !== false,
            autoShow: config.autoShow !== false,
            priority: config.priority || 0,
            groupId: config.groupId || null,
            metadata: config.metadata || {},
            animations: config.animations || {},
            ...getConfig('hotspots.defaultConfig', {})
        };
        
        // 핫스팟 객체 생성
        const hotspot = {
            ...hotspotConfig,
            element: null,
            labelElement: null,
            pulseElement: null,
            screenPosition: new THREE.Vector2(),
            worldPosition: new THREE.Vector3(
                hotspotConfig.position.x,
                hotspotConfig.position.y,
                hotspotConfig.position.z
            ),
            visible: hotspotConfig.visible,
            active: false,
            hovered: false,
            focused: false,
            distance: 0,
            scale: 1,
            opacity: 1,
            lastUpdate: 0
        };
        
        // DOM 요소 생성
        this.createHotspotElement(hotspot);
        
        // 핫스팟 등록
        this.hotspots.set(hotspot.id, hotspot);
        
        // 그룹에 추가
        if (hotspot.groupId) {
            this.addToGroup(hotspot.id, hotspot.groupId);
        }
        
        this.emit('hotspot:created', hotspot);
        console.log(`[HotspotManager] 핫스팟 생성: ${hotspot.name}`);
        
        return hotspot;
    }
    
    /**
     * 기본 아이콘 가져오기
     */
    getDefaultIcon(type) {
        const icons = getConfig('hotspots.typeIcons', {
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌',
            success: '✅',
            help: '❓',
            location: '📍',
            camera: '📷',
            tool: '🔧'
        });
        
        return icons[type] || icons.info;
    }
    
    /**
     * 핫스팟 DOM 요소 생성
     */
    createHotspotElement(hotspot) {
        // 메인 컨테이너
        const element = document.createElement('div');
        element.className = `hotspot type-${hotspot.type}`;
        element.id = hotspot.id;
        element.dataset.hotspotId = hotspot.id;
        element.tabIndex = 0;
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', `${hotspot.title}: ${hotspot.description}`);
        
        // 아이콘
        const iconElement = document.createElement('div');
        iconElement.className = 'hotspot-icon';
        iconElement.textContent = hotspot.icon;
        element.appendChild(iconElement);
        
        // 펄스 효과
        if (getConfig('hotspots.enablePulse', true)) {
            const pulseElement = document.createElement('div');
            pulseElement.className = 'hotspot-pulse';
            element.appendChild(pulseElement);
            hotspot.pulseElement = pulseElement;
        }
        
        // 라벨
        if (hotspot.title && getConfig('hotspots.showLabels', true)) {
            const labelElement = document.createElement('div');
            labelElement.className = 'hotspot-label';
            labelElement.textContent = hotspot.title;
            element.appendChild(labelElement);
            hotspot.labelElement = labelElement;
        }
        
        // 이벤트 설정
        this.setupHotspotEvents(element, hotspot);
        
        // 컨테이너에 추가
        this.hotspotsContainer.appendChild(element);
        
        hotspot.element = element;
    }
    
    /**
     * 핫스팟 이벤트 설정
     */
    setupHotspotEvents(element, hotspot) {
        // 클릭 이벤트
        element.addEventListener('click', (event) => {
            event.stopPropagation();
            this.handleHotspotClick(hotspot, event);
        });
        
        // 마우스 이벤트
        element.addEventListener('mouseenter', (event) => {
            this.handleHotspotHover(hotspot, true, event);
        });
        
        element.addEventListener('mouseleave', (event) => {
            this.handleHotspotHover(hotspot, false, event);
        });
        
        // 키보드 이벤트
        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.handleHotspotClick(hotspot, event);
            }
        });
        
        element.addEventListener('focus', (event) => {
            this.handleHotspotFocus(hotspot, true, event);
        });
        
        element.addEventListener('blur', (event) => {
            this.handleHotspotFocus(hotspot, false, event);
        });
        
        // 터치 이벤트 (모바일)
        element.addEventListener('touchstart', (event) => {
            event.preventDefault();
            this.handleHotspotClick(hotspot, event);
        }, { passive: false });
    }
    
    /**
     * 모델에서 핫스팟 스캔
     */
    scanModelForHotspots(model) {
        if (!model) return;
        
        console.log('[HotspotManager] 모델에서 핫스팟 스캔 중...');
        
        const hotspotPrefix = getConfig('hotspots.prefix', 'HS_');
        let hotspotCount = 0;
        
        model.traverse((child) => {
            if (child.name && child.name.startsWith(hotspotPrefix)) {
                const hotspotData = this.parseHotspotFromObject(child);
                if (hotspotData) {
                    this.createHotspot(hotspotData);
                    hotspotCount++;
                }
            }
        });
        
        console.log(`[HotspotManager] ✓ ${hotspotCount}개 핫스팟 발견됨`);
        this.emit('hotspots:scanned', { count: hotspotCount, model });
    }
    
    /**
     * 3D 객체에서 핫스팟 데이터 파싱
     */
    parseHotspotFromObject(object) {
        const name = object.name;
        const prefix = getConfig('hotspots.prefix', 'HS_');
        const hotspotName = name.substring(prefix.length);
        
        // 월드 포지션 계산
        const worldPosition = new THREE.Vector3();
        object.getWorldPosition(worldPosition);
        
        // 사용자 데이터에서 추가 정보 추출
        const userData = object.userData || {};
        
        return {
            id: `model_${hotspotName}`,
            name: hotspotName,
            position: {
                x: worldPosition.x,
                y: worldPosition.y,
                z: worldPosition.z
            },
            worldObject: object,
            type: userData.type || 'info',
            title: userData.title || hotspotName,
            description: userData.description || '',
            content: userData.content || '',
            icon: userData.icon || null,
            metadata: userData
        };
    }
    
    /**
     * 핫스팟 위치 업데이트
     */
    updateHotspots() {
        if (!this.state.visible || !this.sceneManager?.camera) return;
        
        // Frustum 계산
        this.cameraMatrix.multiplyMatrices(
            this.sceneManager.camera.projectionMatrix,
            this.sceneManager.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.cameraMatrix);
        
        // 각 핫스팟 업데이트
        this.hotspots.forEach(hotspot => {
            this.updateHotspotPosition(hotspot);
            this.updateHotspotVisibility(hotspot);
            this.updateHotspotScale(hotspot);
        });
        
        // 애니메이션 업데이트
        this.updateAnimations();
    }
    
    /**
     * 핫스팟 위치 업데이트
     */
    updateHotspotPosition(hotspot) {
        if (!hotspot.element || !hotspot.visible) return;
        
        // 월드 포지션 업데이트
        if (hotspot.worldObject) {
            hotspot.worldObject.getWorldPosition(hotspot.worldPosition);
        }
        
        // 스크린 좌표로 변환
        this.tempVector.copy(hotspot.worldPosition);
        this.tempVector.project(this.sceneManager.camera);
        
        // 스크린 좌표 계산
        const canvas = this.sceneManager.renderer.domElement;
        const screenX = (this.tempVector.x * 0.5 + 0.5) * canvas.clientWidth;
        const screenY = (this.tempVector.y * -0.5 + 0.5) * canvas.clientHeight;
        
        hotspot.screenPosition.set(screenX, screenY);
        
        // DOM 위치 업데이트
        hotspot.element.style.left = `${screenX - 16}px`;
        hotspot.element.style.top = `${screenY - 16}px`;
        
        // 거리 계산
        hotspot.distance = this.sceneManager.camera.position.distanceTo(hotspot.worldPosition);
    }
    
    /**
     * 핫스팟 가시성 업데이트
     */
    updateHotspotVisibility(hotspot) {
        if (!hotspot.element) return;
        
        // Frustum culling
        const isInFrustum = this.frustum.containsPoint(hotspot.worldPosition);
        
        // Z-depth 검사 (카메라 뒤에 있는지)
        const isInFrontOfCamera = this.tempVector.copy(hotspot.worldPosition)
            .project(this.sceneManager.camera).z < 1;
        
        // 거리 기반 가시성
        const maxDistance = getConfig('hotspots.maxDistance', 100);
        const isWithinRange = hotspot.distance <= maxDistance;
        
        // 최종 가시성 결정
        const shouldBeVisible = hotspot.visible && 
                               isInFrustum && 
                               isInFrontOfCamera && 
                               isWithinRange;
        
        // 오클루전 검사 (선택적)
        const enableOcclusion = getConfig('hotspots.enableOcclusion', false);
        let isOccluded = false;
        
        if (enableOcclusion && shouldBeVisible) {
            isOccluded = this.checkOcclusion(hotspot);
        }
        
        const finalVisibility = shouldBeVisible && !isOccluded;
        
        // DOM 업데이트
        hotspot.element.classList.toggle('hidden', !finalVisibility);
        hotspot.element.style.display = finalVisibility ? 'block' : 'none';
    }
    
    /**
     * 오클루전 검사
     */
    checkOcclusion(hotspot) {
        if (!this.sceneManager.scene) return false;
        
        const direction = hotspot.worldPosition.clone()
            .sub(this.sceneManager.camera.position)
            .normalize();
        
        this.raycaster.set(this.sceneManager.camera.position, direction);
        const intersects = this.raycaster.intersectObjects(this.sceneManager.scene.children, true);
        
        if (intersects.length > 0) {
            const firstIntersection = intersects[0];
            const intersectionDistance = firstIntersection.distance;
            
            return intersectionDistance < (hotspot.distance - this.intersectionThreshold);
        }
        
        return false;
    }
    
    /**
     * 핫스팟 스케일 업데이트
     */
    updateHotspotScale(hotspot) {
        if (!hotspot.element) return;
        
        // 거리 기반 스케일링
        const enableDistanceScaling = getConfig('hotspots.enableDistanceScaling', true);
        let scale = 1;
        
        if (enableDistanceScaling) {
            const minDistance = getConfig('hotspots.minScaleDistance', 5);
            const maxDistance = getConfig('hotspots.maxScaleDistance', 50);
            const minScale = getConfig('hotspots.minScale', 0.5);
            const maxScale = getConfig('hotspots.maxScale', 1.5);
            
            const normalizedDistance = Math.max(0, Math.min(1, 
                (hotspot.distance - minDistance) / (maxDistance - minDistance)
            ));
            
            scale = maxScale - (normalizedDistance * (maxScale - minScale));
        }
        
        // 상태 기반 스케일링
        if (hotspot.active) scale *= 1.2;
        else if (hotspot.hovered) scale *= 1.1;
        
        hotspot.scale = scale;
        hotspot.element.style.transform = `scale(${scale})`;
    }
    
    /**
     * 애니메이션 업데이트
     */
    updateAnimations() {
        const currentTime = performance.now();
        const completedAnimations = [];
        
        this.animations.forEach((animation, id) => {
            if (animation.completed || animation.paused) return;
            
            const elapsed = currentTime - animation.startTime;
            const progress = Math.min(elapsed / animation.duration, 1);
            
            // 이징 적용
            const easedProgress = this.applyEasing(progress, animation.easing);
            
            // 애니메이션 실행
            animation.update(easedProgress);
            
            // 완료 확인
            if (progress >= 1) {
                animation.completed = true;
                completedAnimations.push(id);
                
                if (animation.onComplete) {
                    animation.onComplete();
                }
            }
        });
        
        // 완료된 애니메이션 제거
        completedAnimations.forEach(id => {
            this.animations.delete(id);
        });
    }
    
    /**
     * 이징 함수 적용
     */
    applyEasing(t, easing = 'ease') {
        switch (easing) {
            case 'linear': return t;
            case 'ease-in': return t * t;
            case 'ease-out': return 1 - (1 - t) * (1 - t);
            case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
            case 'bounce': return this.bounceEasing(t);
            default: return t;
        }
    }
    
    /**
     * 바운스 이징
     */
    bounceEasing(t) {
        if (t < 1 / 2.75) {
            return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
            return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
            return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
    }
    
    /**
     * 이벤트 핸들러들
     */
    handleHotspotClick(hotspot, event) {
        if (!hotspot.interactive) return;
        
        // 활성 핫스팟 설정
        this.setActiveHotspot(hotspot);
        
        // 클릭 애니메이션
        this.playClickAnimation(hotspot);
        
        // 정보 패널 표시
        this.showInfoPanel(hotspot);
        
        // 접근성 안내
        this.announceToScreenReader(`핫스팟 선택됨: ${hotspot.title}`);
        
        this.emit('hotspot:click', { hotspot, event });
        console.log(`[HotspotManager] 핫스팟 클릭: ${hotspot.name}`);
    }
    
    handleHotspotHover(hotspot, isHovering, event) {
        hotspot.hovered = isHovering;
        
        if (isHovering) {
            this.hoveredHotspot = hotspot;
            this.showTooltip(hotspot, event);
        } else {
            if (this.hoveredHotspot === hotspot) {
                this.hoveredHotspot = null;
            }
            this.hideTooltip();
        }
        
        this.emit('hotspot:hover', { hotspot, isHovering, event });
    }
    
    handleHotspotFocus(hotspot, isFocused, event) {
        hotspot.focused = isFocused;
        
        if (isFocused) {
            this.focusedHotspot = hotspot;
            this.state.keyboardNavigation = true;
            this.announceToScreenReader(`핫스팟 포커스: ${hotspot.title}. ${hotspot.description}`);
        } else {
            if (this.focusedHotspot === hotspot) {
                this.focusedHotspot = null;
            }
        }
        
        this.emit('hotspot:focus', { hotspot, isFocused, event });
    }
    
    handleKeyDown(event) {
        if (!this.state.keyboardNavigation) return;
        
        switch (event.key) {
            case 'Tab':
                // Tab 네비게이션은 브라우저가 처리
                break;
            case 'Escape':
                this.hideInfoPanel();
                this.hideTooltip();
                break;
            case 'Enter':
            case ' ':
                if (this.focusedHotspot) {
                    event.preventDefault();
                    this.handleHotspotClick(this.focusedHotspot, event);
                }
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault();
                this.focusNextHotspot();
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault();
                this.focusPreviousHotspot();
                break;
        }
    }
    
    handleMouseMove(event) {
        // 마우스 사용 시 키보드 네비게이션 비활성화
        this.state.keyboardNavigation = false;
    }
    
    handleMouseClick(event) {
        // 빈 공간 클릭 시 정보 패널 숨김
        if (event.target === this.sceneManager.renderer.domElement) {
            this.hideInfoPanel();
            this.setActiveHotspot(null);
        }
    }
    
    handleResize() {
        // 다음 프레임에서 위치 업데이트
        requestAnimationFrame(() => {
            this.updateHotspots();
        });
    }
    
    handleConfigChange(key, value) {
        if (!key.startsWith('hotspots.')) return;
        
        const property = key.substring('hotspots.'.length);
        
        switch (property) {
            case 'visible':
                this.setVisible(value);
                break;
            case 'interactive':
                this.setInteractive(value);
                break;
            case 'animationsEnabled':
                this.setAnimationsEnabled(value);
                break;
            case 'updateInterval':
                this.updateInterval = value;
                break;
        }
    }
    
    /**
     * 키보드 네비게이션
     */
    focusNextHotspot() {
        const visibleHotspots = Array.from(this.hotspots.values())
            .filter(h => h.visible && h.interactive)
            .sort((a, b) => a.distance - b.distance);
        
        if (visibleHotspots.length === 0) return;
        
        let currentIndex = this.focusedHotspot ? 
            visibleHotspots.indexOf(this.focusedHotspot) : -1;
        
        const nextIndex = (currentIndex + 1) % visibleHotspots.length;
        const nextHotspot = visibleHotspots[nextIndex];
        
        if (nextHotspot?.element) {
            nextHotspot.element.focus();
        }
    }
    
    focusPreviousHotspot() {
        const visibleHotspots = Array.from(this.hotspots.values())
            .filter(h => h.visible && h.interactive)
            .sort((a, b) => a.distance - b.distance);
        
        if (visibleHotspots.length === 0) return;
        
        let currentIndex = this.focusedHotspot ? 
            visibleHotspots.indexOf(this.focusedHotspot) : 0;
        
        const prevIndex = currentIndex === 0 ? 
            visibleHotspots.length - 1 : currentIndex - 1;
        const prevHotspot = visibleHotspots[prevIndex];
        
        if (prevHotspot?.element) {
            prevHotspot.element.focus();
        }
    }
    
    /**
     * 접근성 지원
     */
    announceToScreenReader(message) {
        const liveRegion = document.getElementById('hotspot-announcements');
        if (liveRegion) {
            liveRegion.textContent = message;
            
            // 중복 방지
            setTimeout(() => {
                if (liveRegion.textContent === message) {
                    liveRegion.textContent = '';
                }
            }, 1000);
        }
    }
    
    /**
     * UI 관리 메서드들
     */
    setActiveHotspot(hotspot) {
        // 이전 활성 핫스팟 비활성화
        if (this.activeHotspot) {
            this.activeHotspot.active = false;
            this.activeHotspot.element?.classList.remove('active');
        }
        
        // 새 활성 핫스팟 설정
        this.activeHotspot = hotspot;
        if (hotspot) {
            hotspot.active = true;
            hotspot.element?.classList.add('active');
        }
        
        this.emit('hotspot:active:change', this.activeHotspot);
    }
    
    showTooltip(hotspot, event) {
        if (!getConfig('hotspots.showTooltips', true)) return;
        
        const tooltip = this.getOrCreateTooltip();
        
        // 내용 설정
        tooltip.querySelector('.hotspot-tooltip-title').textContent = hotspot.title;
        tooltip.querySelector('.hotspot-tooltip-description').textContent = hotspot.description;
        
        // 위치 설정
        const margin = 10;
        let x = hotspot.screenPosition.x + margin;
        let y = hotspot.screenPosition.y - tooltip.offsetHeight - margin;
        
        // 화면 경계 확인
        const rect = this.hotspotsContainer.getBoundingClientRect();
        if (x + tooltip.offsetWidth > rect.width) {
            x = hotspot.screenPosition.x - tooltip.offsetWidth - margin;
        }
        if (y < 0) {
            y = hotspot.screenPosition.y + margin;
        }
        
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
        tooltip.classList.add('visible');
    }
    
    hideTooltip() {
        const tooltip = document.querySelector('.hotspot-tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
        }
    }
    
    getOrCreateTooltip() {
        let tooltip = this.tooltipContainer.querySelector('.hotspot-tooltip');
        
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'hotspot-tooltip';
            tooltip.innerHTML = `
                <div class="hotspot-tooltip-title"></div>
                <div class="hotspot-tooltip-description"></div>
            `;
            this.tooltipContainer.appendChild(tooltip);
        }
        
        return tooltip;
    }
    
    showInfoPanel(hotspot) {
        if (!hotspot.content && !hotspot.description) return;
        
        this.infoPanel.innerHTML = `
            <div class="hotspot-info-header">
                <div class="hotspot-info-title">${hotspot.title}</div>
                <div class="hotspot-info-subtitle">${hotspot.type}</div>
                <button class="hotspot-info-close" aria-label="정보 패널 닫기">×</button>
            </div>
            <div class="hotspot-info-content">
                ${hotspot.content || hotspot.description}
            </div>
        `;
        
        // 닫기 버튼 이벤트
        const closeBtn = this.infoPanel.querySelector('.hotspot-info-close');
        closeBtn.addEventListener('click', () => {
            this.hideInfoPanel();
        });
        
        this.infoPanel.classList.add('visible');
        this.emit('info-panel:show', hotspot);
    }
    
    hideInfoPanel() {
        this.infoPanel.classList.remove('visible');
        this.emit('info-panel:hide');
    }
    
    /**
     * 애니메이션 메서드들
     */
    playClickAnimation(hotspot) {
        if (!this.state.animationsEnabled) return;
        
        const element = hotspot.element;
        if (!element) return;
        
        // 클릭 리플 효과
        element.style.animation = 'none';
        requestAnimationFrame(() => {
            element.style.animation = 'hotspot-click 0.3s ease';
        });
        
        setTimeout(() => {
            element.style.animation = '';
        }, 300);
    }
    
    /**
     * 그룹 관리
     */
    addToGroup(hotspotId, groupId) {
        if (!this.hotspotGroups.has(groupId)) {
            this.hotspotGroups.set(groupId, new Set());
        }
        this.hotspotGroups.get(groupId).add(hotspotId);
    }
    
    removeFromGroup(hotspotId, groupId) {
        const group = this.hotspotGroups.get(groupId);
        if (group) {
            group.delete(hotspotId);
            if (group.size === 0) {
                this.hotspotGroups.delete(groupId);
            }
        }
    }
    
    setGroupVisibility(groupId, visible) {
        const group = this.hotspotGroups.get(groupId);
        if (!group) return;
        
        group.forEach(hotspotId => {
            const hotspot = this.hotspots.get(hotspotId);
            if (hotspot) {
                this.setHotspotVisibility(hotspotId, visible);
            }
        });
        
        this.emit('group:visibility:change', { groupId, visible });
    }
    
    /**
     * 유틸리티 메서드들
     */
    setVisible(visible) {
        this.state.visible = visible;
        this.hotspotsContainer.style.display = visible ? 'block' : 'none';
        this.emit('visibility:change', visible);
    }
    
    setInteractive(interactive) {
        this.state.interactive = interactive;
        this.hotspots.forEach(hotspot => {
            if (hotspot.element) {
                hotspot.element.style.pointerEvents = interactive ? 'auto' : 'none';
            }
        });
        this.emit('interactive:change', interactive);
    }
    
    setAnimationsEnabled(enabled) {
        this.state.animationsEnabled = enabled;
        setConfig('hotspots.animationsEnabled', enabled);
        this.emit('animations:change', enabled);
    }
    
    setHotspotVisibility(hotspotId, visible) {
        const hotspot = this.hotspots.get(hotspotId);
        if (hotspot) {
            hotspot.visible = visible;
            if (hotspot.element) {
                hotspot.element.classList.toggle('hidden', !visible);
            }
            this.emit('hotspot:visibility:change', { hotspotId, visible });
        }
    }
    
    removeHotspot(hotspotId) {
        const hotspot = this.hotspots.get(hotspotId);
        if (!hotspot) return false;
        
        // DOM 요소 제거
        if (hotspot.element) {
            hotspot.element.remove();
        }
        
        // 그룹에서 제거
        if (hotspot.groupId) {
            this.removeFromGroup(hotspotId, hotspot.groupId);
        }
        
        // 활성/호버/포커스 상태 정리
        if (this.activeHotspot === hotspot) this.activeHotspot = null;
        if (this.hoveredHotspot === hotspot) this.hoveredHotspot = null;
        if (this.focusedHotspot === hotspot) this.focusedHotspot = null;
        
        // 핫스팟 제거
        this.hotspots.delete(hotspotId);
        
        this.emit('hotspot:removed', hotspotId);
        return true;
    }
    
    clearAllHotspots() {
        this.hotspots.forEach((hotspot, id) => {
            this.removeHotspot(id);
        });
        
        this.emit('hotspots:cleared');
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
    dispose() {
        console.log('[HotspotManager] 정리 중...');
        
        // 업데이트 루프 중지
        if (this.updateId) {
            cancelAnimationFrame(this.updateId);
            this.updateId = null;
        }
        
        // 이벤트 리스너 제거
        window.removeEventListener('resize', this.handleResize);
        document.removeEventListener('keydown', this.handleKeyDown);
        
        const canvas = this.sceneManager?.renderer?.domElement;
        if (canvas) {
            canvas.removeEventListener('mousemove', this.handleMouseMove);
            canvas.removeEventListener('click', this.handleMouseClick);
        }
        
        // 설정 변경 리스너 제거
        if (getConfig.removeChangeListener) {
            getConfig.removeChangeListener(this.handleConfigChange);
        }
        
        // 모든 핫스팟 제거
        this.clearAllHotspots();
        
        // DOM 요소 제거
        if (this.hotspotsContainer?.parentNode) {
            this.hotspotsContainer.parentNode.removeChild(this.hotspotsContainer);
        }
        
        // 스타일 제거
        const style = document.getElementById('hotspot-manager-styles');
        if (style) {
            style.remove();
        }
        
        // 접근성 요소 제거
        const liveRegion = document.getElementById('hotspot-announcements');
        if (liveRegion) {
            liveRegion.remove();
        }
        
        // 데이터 정리
        this.hotspots.clear();
        this.hotspotGroups.clear();
        this.animations.clear();
        this.events.clear();
        
        this.emit('disposed');
        console.log('[HotspotManager] 정리 완료');
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[HotspotManager] 디버그 정보');
        console.log('상태:', this.state);
        console.log('핫스팟 수:', this.hotspots.size);
        console.log('그룹 수:', this.hotspotGroups.size);
        console.log('활성 핫스팟:', this.activeHotspot?.name || 'None');
        console.log('호버 핫스팟:', this.hoveredHotspot?.name || 'None');
        console.log('포커스 핫스팟:', this.focusedHotspot?.name || 'None');
        console.log('실행 중인 애니메이션:', this.animations.size);
        console.log('성능:', {
            업데이트간격: this.updateInterval,
            마지막업데이트: this.lastUpdateTime
        });
        console.groupEnd();
    }
    
    /**
     * 상태 정보 가져오기
     */
    getStatus() {
        return {
            totalHotspots: this.hotspots.size,
            visibleHotspots: Array.from(this.hotspots.values()).filter(h => h.visible).length,
            interactiveHotspots: Array.from(this.hotspots.values()).filter(h => h.interactive).length,
            groups: this.hotspotGroups.size,
            activeHotspot: this.activeHotspot?.id || null,
            state: { ...this.state },
            performance: {
                updateInterval: this.updateInterval,
                animationsCount: this.animations.size
            }
        };
    }
}

export default HotspotManager;