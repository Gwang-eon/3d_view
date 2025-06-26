// js/hotspot-v2.js - CSS2DRenderer 기반 핫스팟 시스템

// 전역 THREE 객체 확인
if (typeof THREE === 'undefined') {
    console.error('Three.js가 로드되지 않았습니다.');
}

export class HotspotManagerV2 {
    constructor(viewer) {
        this.viewer = viewer;
        this.cssRenderer = null;
        this.hotspots = [];
        this.activeHotspot = null;
        
        // 핫스팟 설정
        this.config = {
            prefix: 'HS_',
            defaultStyle: 'default',
            defaultType: 'info',
            defaultSize: 'medium',
            showTooltips: true,
            animateOnHover: true
        };
        
        // 핫스팟 데이터 (블렌더 Empty 이름과 매핑)


        this.hotspotData = {
            // 기울기 센서
            'HS_Tilt_Sensor.001': {
                SensorType: '균열센서',
                SensorId: '1',
                CurrentValue: '1',
                WarningThreshold: '1',
                DangerThreshold: '1',
                Description: '1',
                Location: '1',
                Status: '1',
                isActive: 'true'
            },
            'HS_Tilt_Sensor.002': {
                SensorType: '균열센서',
                SensorId: '1',
                CurrentValue: '1',
                WarningThreshold: '1',
                DangerThreshold: '1',
                Description: '1',
                Location: '1',
                Status: '1',
                isActive: 'true'
            },
            // 블록 옹벽
            'HS_Block_Unit': {
                title: '블록 유닛',
                description: '프리캐스트 콘크리트 블록으로 제작되어 현장에서 조립합니다.',
                icon: '🧱',
                number: 1,
                type: 'info',
                details: {
                    '재질': '고강도 콘크리트',
                    '규격': '600×300×300mm',
                    '무게': '약 130kg/개',
                    '압축강도': '35MPa 이상'
                }
            },
            'HS_Foundation': {
                title: '기초부',
                description: '안정적인 지지를 위한 콘크리트 기초입니다.',
                icon: '⚡',
                number: 2,
                type: 'warning',
                details: {
                    '형식': '직접기초',
                    '깊이': '1.5m 이상',
                    '콘크리트': 'fck=24MPa',
                    '지지력': '200kN/㎡ 이상'
                }
            },
            'HS_Drainage': {
                title: '배수시설',
                description: '벽체 배면의 수압을 감소시키는 배수 시스템입니다.',
                icon: '💧',
                number: 3,
                type: 'success',
                details: {
                    '배수재': '자갈 또는 쇄석',
                    '입경': '20~40mm',
                    '배수관': 'Φ100mm 유공관',
                    '간격': '2~3m'
                }
            },
            
            // 캔틸레버 옹벽
            'HS_Wall_Body': {
                title: '벽체부',
                description: '철근 콘크리트로 일체 타설된 주 구조체입니다.',
                icon: '🏗️',
                number: 1,
                type: 'info',
                details: {
                    '콘크리트': 'fck=27MPa',
                    '철근': 'SD400',
                    '피복두께': '60mm 이상',
                    '신축줄눈': '15~20m 간격'
                }
            },
            'HS_Base_Slab': {
                title: '저판',
                description: '토압에 저항하는 수평 구조 부재입니다.',
                icon: '⬜',
                number: 2,
                type: 'info',
                details: {
                    '두께': '벽체 높이의 1/10 이상',
                    '철근': '상하부 복철근',
                    '지지방식': '캔틸레버',
                    '안전율': '전도 2.0, 활동 1.5'
                }
            },
            'HS_Heel': {
                title: '힐(Heel)',
                description: '저판의 후방 연장부로 안정성을 높입니다.',
                icon: '◀️',
                number: 3,
                type: 'warning',
                details: {
                    '길이': '벽체 높이의 50~70%',
                    '역할': '전도 저항',
                    '하중': '토압 및 상재하중',
                    '설계': '캔틸레버 슬래브'
                }
            },
            'HS_Toe': {
                title: '토우(Toe)',
                description: '저판의 전방 연장부로 전도에 저항합니다.',
                icon: '▶️',
                number: 4,
                type: 'success',
                details: {
                    '길이': '저판 길이의 1/3 이하',
                    '역할': '지지력 분산',
                    '응력': '지반반력 최대',
                    '검토': '펀칭전단'
                }
            },
            
            // MSE 옹벽
            'HS_Panel': {
                title: '전면 패널',
                description: '프리캐스트 콘크리트 패널로 미관과 구조를 담당합니다.',
                icon: '🎭',
                number: 1,
                type: 'info',
                details: {
                    '재질': '프리캐스트 콘크리트',
                    '두께': '140~200mm',
                    '표면처리': '다양한 문양 가능',
                    '연결': '기계적 연결장치'
                }
            },
            'HS_Geogrid': {
                title: '지오그리드',
                description: '토체 보강을 위한 고강도 지오신세틱 재료입니다.',
                icon: '🔗',
                number: 2,
                type: 'danger',
                details: {
                    '재질': 'HDPE 또는 폴리에스터',
                    '인장강도': '50~200kN/m',
                    '간격': '0.4~0.8m',
                    '설치길이': '벽체 높이의 70% 이상'
                }
            },
            'HS_Backfill': {
                title: '뒤채움재',
                description: '다짐이 잘된 선별된 토사로 구조체를 형성합니다.',
                icon: '⛰️',
                number: 3,
                type: 'warning',
                details: {
                    '재료': '사질토 또는 자갈질 흙',
                    '내부마찰각': '30° 이상',
                    '다짐도': '95% 이상',
                    '층두께': '20~30cm'
                }
            },
            'HS_Connection': {
                title: '연결부',
                description: '패널과 지오그리드를 연결하는 중요한 부분입니다.',
                icon: '🔧',
                number: 4,
                type: 'danger',
                details: {
                    '형식': '기계적 연결',
                    '강도': '지오그리드 강도 이상',
                    '간격': '지오그리드 설치 간격과 동일',
                    '점검': '정기적 점검 필요'
                }
            }
        };
        
        this.init();
    }
    
    /**
     * 초기화
     */
    init() {
        // CSS2DRenderer 생성
        this.createCSSRenderer();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        console.log('✅ HotspotManagerV2 초기화 완료');
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
                    this.createHotspotFromEmpty(child);
                }
            }
        });
        
        console.log(`✅ ${this.hotspots.length}개 핫스팟 발견`);
    }
    
    /**
     * Empty에서 핫스팟 생성
     */
    createHotspotFromEmpty(empty) {
        const name = empty.name;
        const data = this.hotspotData[name];
        
        if (!data) {
            console.warn(`⚠️ ${name}에 대한 정보가 없습니다.`);
            return;
        }
        
        // HTML 요소 생성
        const hotspotElement = this.createHotspotElement(data);
        
        // CSS2DObject 생성
        const cssObject = new THREE.CSS2DObject(hotspotElement);
        
        // Empty의 월드 위치 가져오기
        const worldPosition = new THREE.Vector3();
        empty.getWorldPosition(worldPosition);
        cssObject.position.copy(worldPosition);
        
        // 핫스팟 데이터
        const hotspot = {
            id: name,
            cssObject: cssObject,
            element: hotspotElement,
            empty: empty,
            data: data,
            isActive: false
        };
        
        // 이벤트 핸들러 바인딩
        this.bindHotspotEvents(hotspotElement, hotspot);
        
        // 씬에 추가
        this.viewer.scene.add(cssObject);
        this.hotspots.push(hotspot);
        
        console.log(`📍 핫스팟 생성: ${data.title} (${name})`);
    }
    
    /**
     * 핫스팟 HTML 요소 생성
     */
    createHotspotElement(data) {
        const container = document.createElement('div');
        container.className = `hotspot-marker type-${data.type || 'info'}`;
        
        // 콘텐츠 (번호 또는 아이콘)
        const content = document.createElement('div');
        content.className = 'hotspot-content';
        
        if (data.icon) {
            content.innerHTML = `<span class="hotspot-icon">${data.icon}</span>`;
        } else if (data.number) {
            content.innerHTML = `<span class="hotspot-number">${data.number}</span>`;
        }
        
        container.appendChild(content);
        
        // 툴팁
        if (this.config.showTooltips) {
            const tooltip = document.createElement('div');
            tooltip.className = 'hotspot-tooltip';
            tooltip.textContent = data.title;
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
        
        // 헤더 업데이트
        const header = panel.querySelector('.hotspot-info-header h3');
        if (header) {
            header.textContent = data.title;
        }
        
        // 바디 업데이트
        const body = panel.querySelector('.hotspot-info-body');
        if (body) {
            let content = `<p>${data.description}</p>`;
            
            // 상세 정보가 있으면 테이블로 표시
            if (data.details) {
                content += '<table class="hotspot-info-table">';
                for (const [key, value] of Object.entries(data.details)) {
                    content += `
                        <tr>
                            <td>${key}</td>
                            <td>${value}</td>
                        </tr>
                    `;
                }
                content += '</table>';
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
     * 렌더링 업데이트 (매 프레임 호출 필요)
     */
    render() {
        if (this.cssRenderer && this.viewer.camera) {
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
     * 특정 타입의 핫스팟만 표시
     */
    filterByType(type) {
        this.hotspots.forEach(hotspot => {
            if (type === 'all' || hotspot.data.type === type) {
                hotspot.cssObject.visible = true;
            } else {
                hotspot.cssObject.visible = false;
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
        
        console.log('🔚 HotspotManagerV2 정리 완료');
    }
}