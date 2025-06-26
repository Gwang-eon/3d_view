// js/hotspot-v3.js - 블렌더 Custom Properties를 자동으로 읽는 핫스팟 시스템

// 전역 THREE 객체 확인
if (typeof THREE === 'undefined') {
    console.error('Three.js가 로드되지 않았습니다.');
}

export class HotspotManagerV3 {
    constructor(viewer) {
        this.viewer = viewer;
        this.cssRenderer = null;
        this.hotspots = [];
        this.activeHotspot = null;
        this.lastModelMatrix = new THREE.Matrix4();
        this.modelTransformChanged = false;
        
        // 핫스팟 설정
        this.config = {
            prefix: 'HS_',
            defaultStyle: 'default',
            defaultType: 'info',
            defaultSize: 'medium',
            showTooltips: true,
            animateOnHover: true
        };
        
        // 타입별 아이콘 매핑
        this.typeIcons = {
            '굴절센서': '📐',
            '균열센서': '🔍',
            '압력센서': '⚡',
            '온도센서': '🌡️',
            '습도센서': '💧',
            '변위센서': '📏',
            'default': '📍'
        };
        
        // 상태별 타입 매핑
        this.statusTypes = {
            0: 'success',  // 정상
            1: 'warning',  // 경고
            2: 'danger',   // 위험
            'default': 'info'
        };
        
        this.init();
    }
    
    // 모델 변환 감지 메서드 추가
    checkModelTransform() {
        if (!this.viewer.currentModel) return false;
        
        const currentMatrix = this.viewer.currentModel.matrixWorld;
        
        if (!currentMatrix.equals(this.lastModelMatrix)) {
            this.lastModelMatrix.copy(currentMatrix);
            return true;
        }
        
        return false;
    }



    /**
     * 초기화
     */
    init() {
        // CSS2DRenderer 생성
        this.createCSSRenderer();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        console.log('✅ HotspotManagerV3 초기화 완료');
    }
    
    /**
     * CSS2DRenderer 생성
     */
    createCSSRenderer() {
        this.cssRenderer = new THREE.CSS2DRenderer();
        this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
        this.cssRenderer.domElement.style.position = 'absolute';
        this.cssRenderer.domElement.style.top = '0';
        this.cssRenderer.domElement.style.pointerEvents = 'none';
        
        // 뷰어 컨테이너에 추가
        const container = this.viewer.container || document.getElementById('viewer');
        if (container) {
            container.appendChild(this.cssRenderer.domElement);
        }
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 창 크기 변경 시 CSS렌더러도 업데이트
        window.addEventListener('resize', () => {
            this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    /**
     * 모델에서 핫스팟 추출
     */
    extractHotspotsFromModel(model) {
        // 기존 핫스팟 제거
        this.clearHotspots();
        
        console.log('🔍 핫스팟 검색 중...');
        
        // 모델 순회하며 HS_로 시작하는 Empty 찾기
        model.traverse((child) => {
            if (child.name && child.name.startsWith(this.config.prefix)) {
                // Empty 오브젝트 (보통 Object3D 또는 Group)
                if (child.type === 'Object3D' || child.type === 'Group' || !child.geometry) {
                    // 블렌더 Custom Properties 읽기
                    const hotspotData = this.extractCustomProperties(child);
                    if (hotspotData) {
                        this.createHotspotFromEmpty(child, hotspotData);
                    }
                }
            }
        });
        
        console.log(`✅ ${this.hotspots.length}개 핫스팟 발견`);
    }
    
    /**
     * 블렌더 Custom Properties 추출
     */
    extractCustomProperties(empty) {
        // GLTF에서 Custom Properties는 userData에 저장됨
        const userData = empty.userData || {};
        
        console.log(`📋 ${empty.name} userData:`, userData);
        
        // 필수 속성 확인
        if (!userData.SensorId && !userData.sensorId) {
            console.warn(`⚠️ ${empty.name}: SensorId가 없습니다.`);
            return null;
        }
        
        // 속성 정규화 (대소문자 호환)
        const normalizeKey = (obj, keys) => {
            for (const key of keys) {
                if (obj[key] !== undefined) return obj[key];
            }
            return null;
        };
        
        // 데이터 추출
        const data = {
            id: empty.name,
            sensorId: normalizeKey(userData, ['SensorId', 'sensorId', 'sensor_id']) || empty.name,
            sensorType: normalizeKey(userData, ['SensorType', 'sensorType', 'sensor_type']) || '센서',
            currentValue: parseFloat(normalizeKey(userData, ['CurrentValue', 'currentValue', 'current_value'])) || 0,
            warningThreshold: parseFloat(normalizeKey(userData, ['WarningThreshold', 'warningThreshold', 'warning_threshold'])) || 0.8,
            dangerThreshold: parseFloat(normalizeKey(userData, ['DangerThreshold', 'dangerThreshold', 'danger_threshold'])) || 1.0,
            description: normalizeKey(userData, ['Description', 'description']) || '센서 정보',
            location: normalizeKey(userData, ['Location', 'location']) || '위치 정보 없음',
            status: parseInt(normalizeKey(userData, ['Status', 'status'])) || 0,
            isActive: normalizeKey(userData, ['isActive', 'is_active']) !== false,
            unit: normalizeKey(userData, ['Unit', 'unit']) || '',
            lastUpdate: normalizeKey(userData, ['LastUpdate', 'lastUpdate', 'last_update']) || new Date().toISOString()
        };
        
        // 타입 결정 (현재 값과 임계값 비교)
        if (data.currentValue >= data.dangerThreshold) {
            data.type = 'danger';
            data.status = 2;
        } else if (data.currentValue >= data.warningThreshold) {
            data.type = 'warning';
            data.status = 1;
        } else {
            data.type = 'success';
            data.status = 0;
        }
        
        // 아이콘 결정
        data.icon = this.typeIcons[data.sensorType] || this.typeIcons['default'];
        
        // 제목 생성
        data.title = `${data.sensorType} - ${data.sensorId}`;
        
        return data;
    }
    
    /**
     * Empty에서 핫스팟 생성
     */
    createHotspotFromEmpty(empty, data) {
        // HTML 요소 생성
        const hotspotElement = this.createHotspotElement(data);
        
        // CSS2DObject 생성
        const cssObject = new THREE.CSS2DObject(hotspotElement);
        
        // 초기 위치 설정 (월드 위치)
        const worldPosition = new THREE.Vector3();
        empty.getWorldPosition(worldPosition);
        cssObject.position.copy(worldPosition);
        
        // 핫스팟 데이터
        const hotspot = {
            id: data.id,
            cssObject: cssObject,
            element: hotspotElement,
            empty: empty,  // Empty 참조 저장 (중요!)
            data: data,
            isActive: false,
            worldPosition: worldPosition  // 월드 위치 캐시
        };
        
        // 이벤트 핸들러 바인딩
        this.bindHotspotEvents(hotspotElement, hotspot);
        
        // 씬에 추가
        this.viewer.scene.add(cssObject);
        this.hotspots.push(hotspot);
        
        console.log(`📍 핫스팟 생성: ${data.title} (${data.id})`);
    }
    
    /**
     * 핫스팟 HTML 요소 생성
     */
    createHotspotElement(data) {
        const container = document.createElement('div');
        container.className = `hotspot-marker type-${data.type || 'info'}`;
        
        // 비활성 상태 처리
        if (!data.isActive) {
            container.classList.add('inactive');
        }
        
        // 콘텐츠 (아이콘 또는 상태 표시)
        const content = document.createElement('div');
        content.className = 'hotspot-content';
        
        if (data.status === 2) {
            // 위험 상태일 때 느낌표 표시
            content.innerHTML = `<span class="hotspot-icon">⚠️</span>`;
        } else {
            content.innerHTML = `<span class="hotspot-icon">${data.icon}</span>`;
        }
        
        container.appendChild(content);
        
        // 툴팁
        if (this.config.showTooltips) {
            const tooltip = document.createElement('div');
            tooltip.className = 'hotspot-tooltip';
            tooltip.innerHTML = `
                <strong>${data.title}</strong><br>
                <small>현재값: ${data.currentValue}${data.unit}</small>
            `;
            container.appendChild(tooltip);
        }
        
        // 포인터 이벤트 활성화
        container.style.pointerEvents = 'auto';
        
        return container;
    }
    
    /**
     * 핫스팟 이벤트 바인딩
     */
    bindHotspotEvents(element, hotspot) {
        // 클릭 이벤트
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showHotspotInfo(hotspot);
        });
        
        // 호버 이벤트
        element.addEventListener('mouseenter', () => {
            if (this.config.animateOnHover && !hotspot.isActive) {
                element.classList.add('hover');
            }
        });
        
        element.addEventListener('mouseleave', () => {
            if (!hotspot.isActive) {
                element.classList.remove('hover');
            }
        });
    }
    
    /**
     * 핫스팟 위치 업데이트 (매 프레임 호출)
     */
    updateHotspotPositions() {

        if (!this.viewer.currentModel) return;

        this.hotspots.forEach(hotspot => {
            if (hotspot.empty && hotspot.cssObject && hotspot.empty.parent) {
                // 직접 매트릭스에서 위치 추출
                const mat = hotspot.empty.matrixWorld;
                hotspot.cssObject.position.set(
                    mat.elements[12],
                    mat.elements[13],
                    mat.elements[14]
                );
            }
        });
    }
    /**
     * 핫스팟 정보 표시
     */
    showHotspotInfo(hotspot) {
        // 이전 활성 핫스팟 비활성화
        if (this.activeHotspot && this.activeHotspot !== hotspot) {
            this.activeHotspot.element.classList.remove('active');
            this.activeHotspot.isActive = false;
        }
        
        // 현재 핫스팟 활성화
        hotspot.element.classList.add('active');
        hotspot.isActive = true;
        this.activeHotspot = hotspot;
        
        // 정보 패널 표시
        this.showInfoPanel(hotspot.data);
    }
    
    /**
     * 정보 패널 표시
     */
    showInfoPanel(data) {
        // 기존 패널 확인 또는 생성
        let panel = document.getElementById('hotspot-info-panel');
        
        if (!panel) {
            panel = this.createInfoPanel();
            document.body.appendChild(panel);
        }
        
        // 헤더 업데이트 (상태에 따라 색상 변경)
        const header = panel.querySelector('.hotspot-info-header');
        if (header) {
            header.className = `hotspot-info-header status-${data.type}`;
            const h3 = header.querySelector('h3');
            if (h3) {
                h3.textContent = data.title;
            }
        }
        
        // 바디 업데이트
        const body = panel.querySelector('.hotspot-info-body');
        if (body) {
            let statusText = '정상';
            let statusColor = '#00ff88';
            
            if (data.status === 1) {
                statusText = '경고';
                statusColor = '#ff6b35';
            } else if (data.status === 2) {
                statusText = '위험';
                statusColor = '#ff1744';
            }
            
            let content = `
                <div class="info-status" style="margin-bottom: 20px; text-align: center;">
                    <span style="font-size: 24px; color: ${statusColor}; font-weight: bold;">${statusText}</span>
                </div>
                <p>${data.description}</p>
                <table class="hotspot-info-table">
                    <tr>
                        <td>센서 ID</td>
                        <td>${data.sensorId}</td>
                    </tr>
                    <tr>
                        <td>센서 타입</td>
                        <td>${data.sensorType}</td>
                    </tr>
                    <tr>
                        <td>현재값</td>
                        <td style="color: ${statusColor}; font-weight: bold;">${data.currentValue}${data.unit}</td>
                    </tr>
                    <tr>
                        <td>경고 임계값</td>
                        <td>${data.warningThreshold}${data.unit}</td>
                    </tr>
                    <tr>
                        <td>위험 임계값</td>
                        <td>${data.dangerThreshold}${data.unit}</td>
                    </tr>
                    <tr>
                        <td>위치</td>
                        <td>${data.location}</td>
                    </tr>
                    <tr>
                        <td>상태</td>
                        <td>${data.isActive ? '활성' : '비활성'}</td>
                    </tr>
                    <tr>
                        <td>마지막 업데이트</td>
                        <td>${new Date(data.lastUpdate).toLocaleString('ko-KR')}</td>
                    </tr>
                </table>
            `;
            
            // 상태에 따른 추가 메시지
            if (data.status === 2) {
                content += `
                    <div class="alert-message" style="margin-top: 20px; padding: 10px; background: rgba(255, 23, 68, 0.1); border: 1px solid #ff1744; border-radius: 4px;">
                        <strong>⚠️ 경고:</strong> 위험 수준에 도달했습니다. 즉시 점검이 필요합니다.
                    </div>
                `;
            } else if (data.status === 1) {
                content += `
                    <div class="warning-message" style="margin-top: 20px; padding: 10px; background: rgba(255, 107, 53, 0.1); border: 1px solid #ff6b35; border-radius: 4px;">
                        <strong>⚡ 주의:</strong> 경고 수준에 근접했습니다. 모니터링이 필요합니다.
                    </div>
                `;
            }
            
            body.innerHTML = content;
        }
        
        // 패널 표시
        panel.classList.add('show');
    }
    
    /**
     * 정보 패널 생성
     */
    createInfoPanel() {
        const panel = document.createElement('div');
        panel.id = 'hotspot-info-panel';
        panel.className = 'hotspot-info-panel';
        
        panel.innerHTML = `
            <div class="hotspot-info-header">
                <h3></h3>
                <button class="hotspot-info-close">×</button>
            </div>
            <div class="hotspot-info-body"></div>
        `;
        
        // 닫기 버튼 이벤트
        const closeBtn = panel.querySelector('.hotspot-info-close');
        closeBtn.addEventListener('click', () => {
            this.hideInfoPanel();
        });
        
        // 패널 외부 클릭 시 닫기
        panel.addEventListener('click', (e) => {
            if (e.target === panel) {
                this.hideInfoPanel();
            }
        });
        
        return panel;
    }
    
    /**
     * 정보 패널 숨기기
     */
    hideInfoPanel() {
        const panel = document.getElementById('hotspot-info-panel');
        if (panel) {
            panel.classList.remove('show');
        }
        
        // 활성 핫스팟 비활성화
        if (this.activeHotspot) {
            this.activeHotspot.element.classList.remove('active');
            this.activeHotspot.isActive = false;
            this.activeHotspot = null;
        }
    }
    
    /**
     * 핫스팟 가시성 토글
     */
    toggleHotspots() {
        const visible = this.hotspots.length > 0 && 
                       this.hotspots[0].cssObject.visible;
        
        this.hotspots.forEach(hotspot => {
            hotspot.cssObject.visible = !visible;
        });
        
        console.log(visible ? '🙈 핫스팟 숨김' : '👁️ 핫스팟 표시');
        
        // 정보 패널도 숨기기
        if (visible) {
            this.hideInfoPanel();
        }
    }
    
    /**
     * 핫스팟 데이터 업데이트 (실시간 모니터링용)
     */
    updateHotspotData(sensorId, newData) {
        const hotspot = this.hotspots.find(h => h.data.sensorId === sensorId);
        if (!hotspot) return;
        
        // 데이터 업데이트
        Object.assign(hotspot.data, newData);
        
        // 상태 재계산
        if (hotspot.data.currentValue >= hotspot.data.dangerThreshold) {
            hotspot.data.type = 'danger';
            hotspot.data.status = 2;
        } else if (hotspot.data.currentValue >= hotspot.data.warningThreshold) {
            hotspot.data.type = 'warning';
            hotspot.data.status = 1;
        } else {
            hotspot.data.type = 'success';
            hotspot.data.status = 0;
        }
        
        // UI 업데이트
        hotspot.element.className = `hotspot-marker type-${hotspot.data.type}`;
        
        // 툴팁 업데이트
        const tooltip = hotspot.element.querySelector('.hotspot-tooltip');
        if (tooltip) {
            tooltip.innerHTML = `
                <strong>${hotspot.data.title}</strong><br>
                <small>현재값: ${hotspot.data.currentValue}${hotspot.data.unit}</small>
            `;
        }
        
        // 활성 패널이면 업데이트
        if (this.activeHotspot === hotspot) {
            this.showInfoPanel(hotspot.data);
        }
    }
    
    /**
     * 렌더링 업데이트 (매 프레임 호출 필요)
     */
    render() {
        if (this.cssRenderer && this.viewer.camera) {
            // 핫스팟 위치 업데이트 (중요!)
            // if (this.checkModelTransform()) {
            //     this.updateHotspotPositions();
            // }
            this.updateHotspotPositions();

            // CSS2D 렌더링
            this.cssRenderer.render(this.viewer.scene, this.viewer.camera);
        }
    }
    
    /**
     * 핫스팟 스타일 변경
     */
    setHotspotStyle(style) {
        this.config.defaultStyle = style;
        
        this.hotspots.forEach(hotspot => {
            hotspot.element.className = `hotspot-marker type-${hotspot.data.type} style-${style}`;
        });
    }
    
    /**
     * 핫스팟 크기 변경
     */
    setHotspotSize(size) {
        this.hotspots.forEach(hotspot => {
            hotspot.element.classList.remove('size-small', 'size-medium', 'size-large');
            hotspot.element.classList.add(`size-${size}`);
        });
    }
    
    /**
     * 특정 상태의 핫스팟만 표시
     */
    filterByStatus(status) {
        this.hotspots.forEach(hotspot => {
            if (status === 'all') {
                hotspot.cssObject.visible = true;
            } else if (status === 'active') {
                hotspot.cssObject.visible = hotspot.data.isActive;
            } else if (status === 'warning') {
                hotspot.cssObject.visible = hotspot.data.status === 1;
            } else if (status === 'danger') {
                hotspot.cssObject.visible = hotspot.data.status === 2;
            } else if (status === 'normal') {
                hotspot.cssObject.visible = hotspot.data.status === 0;
            }
        });
    }
    
    /**
     * 모든 핫스팟 제거
     */
    clearHotspots() {
        this.hotspots.forEach(hotspot => {
            // 씬에서 제거
            this.viewer.scene.remove(hotspot.cssObject);
            
            // DOM 요소 제거
            if (hotspot.element && hotspot.element.parentNode) {
                hotspot.element.parentNode.removeChild(hotspot.element);
            }
        });
        
        this.hotspots = [];
        this.activeHotspot = null;
        
        // 정보 패널 숨기기
        this.hideInfoPanel();
    }
    
    /**
     * 정리
     */
    destroy() {
        // 핫스팟 제거
        this.clearHotspots();
        
        // CSS 렌더러 제거
        if (this.cssRenderer && this.cssRenderer.domElement.parentNode) {
            this.cssRenderer.domElement.parentNode.removeChild(this.cssRenderer.domElement);
        }
        
        // 정보 패널 제거
        const panel = document.getElementById('hotspot-info-panel');
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
        
        console.log('🔚 HotspotManagerV3 정리 완료');
    }
}