// js/hotspot.js - 핫스팟 시스템 (블렌더 Empty 기반)

export class HotspotManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.hotspots = [];
        this.activeHotspot = null;
        
        // 레이캐스터 (클릭 감지용)
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // 핫스팟 설정
        this.config = {
            prefix: 'HS_',           // 블렌더에서 사용할 접두사
            defaultColor: 0x007bff,
            hoverColor: 0x00b4d8,
            activeColor: 0xffd60a,
            size: 0.2,
            opacity: 0.8
        };
        
        // 핫스팟 정보 (블렌더 Empty 이름과 매핑)
        this.hotspotData = {
            // 블록 옹벽
            'HS_Block_Unit': {
                title: '블록 유닛',
                description: '프리캐스트 콘크리트 블록으로 제작되어 현장에서 조립합니다.'
            },
            'HS_Foundation': {
                title: '기초부',
                description: '안정적인 지지를 위한 콘크리트 기초입니다.'
            },
            'HS_Drainage': {
                title: '배수시설',
                description: '벽체 배면의 수압을 감소시키는 배수 시스템입니다.'
            },
            
            // 캔틸레버 옹벽
            'HS_Wall_Body': {
                title: '벽체부',
                description: '철근 콘크리트로 일체 타설된 주 구조체입니다.'
            },
            'HS_Base_Slab': {
                title: '저판',
                description: '토압에 저항하는 수평 구조 부재입니다.'
            },
            'HS_Heel': {
                title: '힐(Heel)',
                description: '저판의 후방 연장부로 안정성을 높입니다.'
            },
            'HS_Toe': {
                title: '토우(Toe)',
                description: '저판의 전방 연장부로 전도에 저항합니다.'
            },
            
            // MSE 옹벽
            'HS_Panel': {
                title: '전면 패널',
                description: '프리캐스트 콘크리트 패널로 미관과 구조를 담당합니다.'
            },
            'HS_Geogrid': {
                title: '지오그리드',
                description: '토체 보강을 위한 고강도 지오신세틱 재료입니다.'
            },
            'HS_Backfill': {
                title: '뒤채움재',
                description: '다짐이 잘된 선별된 토사로 구조체를 형성합니다.'
            },
            'HS_Connection': {
                title: '연결부',
                description: '패널과 지오그리드를 연결하는 중요한 부분입니다.'
            }
        };
        
        // 이벤트 바인딩
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseClick = this.onMouseClick.bind(this);
        
        this.setupEventListeners();
    }
    
    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        const canvas = this.viewer.renderer.domElement;
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onMouseClick);
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
        
        // 핫스팟이 없으면 숨기기
        if (this.hotspots.length === 0) {
            console.log('⚠️ 모델에 핫스팟(HS_) Empty가 없습니다.');
        }
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
        
        // 핫스팟 메시 생성
        const geometry = new THREE.SphereGeometry(this.config.size, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: this.config.defaultColor,
            transparent: true,
            opacity: this.config.opacity,
            depthTest: false,
            depthWrite: false
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        
        // Empty의 월드 위치 가져오기
        const worldPosition = new THREE.Vector3();
        empty.getWorldPosition(worldPosition);
        mesh.position.copy(worldPosition);
        
        // 핫스팟 데이터
        const hotspot = {
            id: name,
            mesh: mesh,
            empty: empty,
            title: data.title,
            description: data.description,
            originalMaterial: material.clone(),
            isHovered: false
        };
        
        mesh.userData.hotspot = hotspot;
        
        // 씬에 추가
        this.viewer.scene.add(mesh);
        this.hotspots.push(hotspot);
        
        console.log(`📍 핫스팟 생성: ${data.title} (${name})`);
    }
    
    /**
     * 핫스팟 가시성 토글
     */
    toggleHotspots() {
        const visible = this.hotspots.length > 0 && this.hotspots[0].mesh.visible;
        
        this.hotspots.forEach(hotspot => {
            hotspot.mesh.visible = !visible;
        });
        
        console.log(visible ? '🙈 핫스팟 숨김' : '👁️ 핫스팟 표시');
        
        // 정보 패널도 숨기기
        if (visible) {
            const panel = document.getElementById('hotspot-panel');
            if (panel) {
                panel.style.display = 'none';
            }
        }
    }
    
    /**
     * 마우스 이동 처리
     */
    onMouseMove(event) {
        const rect = this.viewer.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.checkHover();
    }
    
    /**
     * 호버 체크
     */
    checkHover() {
        this.raycaster.setFromCamera(this.mouse, this.viewer.camera);
        
        // 보이는 핫스팟만 체크
        const visibleMeshes = this.hotspots
            .filter(h => h.mesh.visible)
            .map(h => h.mesh);
            
        const intersects = this.raycaster.intersectObjects(visibleMeshes);
        
        // 모든 핫스팟 호버 해제
        this.hotspots.forEach(hotspot => {
            if (hotspot.isHovered && hotspot !== this.activeHotspot) {
                hotspot.mesh.material.color.setHex(this.config.defaultColor);
                hotspot.isHovered = false;
            }
        });
        
        // 호버된 핫스팟 처리
        if (intersects.length > 0) {
            const hotspot = intersects[0].object.userData.hotspot;
            if (hotspot && hotspot !== this.activeHotspot) {
                hotspot.mesh.material.color.setHex(this.config.hoverColor);
                hotspot.isHovered = true;
                this.viewer.renderer.domElement.style.cursor = 'pointer';
            }
        } else {
            this.viewer.renderer.domElement.style.cursor = 'default';
        }
    }
    
    /**
     * 클릭 처리
     */
    onMouseClick(event) {
        this.raycaster.setFromCamera(this.mouse, this.viewer.camera);
        
        const visibleMeshes = this.hotspots
            .filter(h => h.mesh.visible)
            .map(h => h.mesh);
            
        const intersects = this.raycaster.intersectObjects(visibleMeshes);
        
        if (intersects.length > 0) {
            const hotspot = intersects[0].object.userData.hotspot;
            if (hotspot) {
                this.showHotspotInfo(hotspot);
            }
        }
    }
    
    /**
     * 핫스팟 정보 표시
     */
    showHotspotInfo(hotspot) {
        // 정보 패널 생성 또는 업데이트
        let panel = document.getElementById('hotspot-panel');
        
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'hotspot-panel';
            panel.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                padding: 24px;
                max-width: 400px;
                color: white;
                z-index: 1000;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            `;
            document.body.appendChild(panel);
        }
        
        panel.innerHTML = `
            <button onclick="document.getElementById('hotspot-panel').style.display='none'" style="
                position: absolute;
                top: 10px;
                right: 10px;
                background: transparent;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
            ">×</button>
            <h3 style="margin: 0 0 12px 0; color: #007bff;">${hotspot.title}</h3>
            <p style="margin: 0; line-height: 1.6; color: #ccc;">${hotspot.description}</p>
        `;
        
        panel.style.display = 'block';
        
        // 이전 활성 핫스팟 색상 복원
        if (this.activeHotspot && this.activeHotspot !== hotspot) {
            this.activeHotspot.mesh.material.color.setHex(this.config.defaultColor);
        }
        
        // 현재 핫스팟 활성화
        hotspot.mesh.material.color.setHex(this.config.activeColor);
        this.activeHotspot = hotspot;
    }
    
    /**
     * 모든 핫스팟 제거
     */
    clearHotspots() {
        this.hotspots.forEach(hotspot => {
            this.viewer.scene.remove(hotspot.mesh);
            hotspot.mesh.geometry.dispose();
            hotspot.mesh.material.dispose();
        });
        this.hotspots = [];
        this.activeHotspot = null;
        
        // 정보 패널 숨기기
        const panel = document.getElementById('hotspot-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }
    
    /**
     * 정리
     */
    destroy() {
        const canvas = this.viewer.renderer.domElement;
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onMouseClick);
        
        this.clearHotspots();
        
        const panel = document.getElementById('hotspot-panel');
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
        }
    }
}