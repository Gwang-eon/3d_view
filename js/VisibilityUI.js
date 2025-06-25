// VisibilityUI.js
export class VisibilityUI {
    constructor(visibilityController) {
        this.controller = visibilityController;
        this.container = null;
    }
    
    // UI 생성
    create(parentElement) {
        this.container = document.createElement('div');
        this.container.className = 'visibility-control-panel';
        this.container.innerHTML = `
            <div class="panel-header">
                <h3>🎯 오브젝트 표시/숨김</h3>
                <button class="panel-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
            </div>
            <div class="panel-body">
                <!-- 빠른 액션 -->
                <div class="quick-actions">
                    <button class="btn-action" onclick="visibilityUI.showAll()">모두 표시</button>
                    <button class="btn-action" onclick="visibilityUI.hideAll()">모두 숨김</button>
                    <button class="btn-action" onclick="visibilityUI.resetVisibility()">초기화</button>
                </div>
                
                <!-- 검색 -->
                <div class="search-box">
                    <input type="text" id="object-search" placeholder="오브젝트 검색..." />
                    <button onclick="visibilityUI.searchObjects()">🔍</button>
                </div>
                
                <!-- 그룹 제어 -->
                <div class="group-control">
                    <h4>그룹별 제어</h4>
                    <div id="group-toggles"></div>
                </div>
                
                <!-- 개별 오브젝트 목록 -->
                <div class="object-list">
                    <h4>개별 오브젝트</h4>
                    <div id="object-toggles"></div>
                </div>
                
                <!-- 프리셋 -->
                <div class="presets">
                    <h4>표시 프리셋</h4>
                    <button class="btn-preset" onclick="visibilityUI.applyPreset('structure')">구조물만</button>
                    <button class="btn-preset" onclick="visibilityUI.applyPreset('drainage')">배수시설만</button>
                    <button class="btn-preset" onclick="visibilityUI.applyPreset('reinforcement')">보강재만</button>
                    <button class="btn-preset" onclick="visibilityUI.applyPreset('analysis')">분석 모드</button>
                </div>
            </div>
        `;
        
        parentElement.appendChild(this.container);
        
        // 전역 참조 (이벤트 핸들러용)
        window.visibilityUI = this;
        
        // UI 업데이트
        this.updateUI();
        
        return this.container;
    }
    
    // UI 업데이트
    updateUI() {
        this.updateGroupToggles();
        this.updateObjectToggles();
    }
    
    // 그룹 토글 생성
    updateGroupToggles() {
        const groupContainer = document.getElementById('group-toggles');
        if (!groupContainer) return;
        
        groupContainer.innerHTML = '';
        const groups = this.controller.getGroupList();
        
        Object.entries(groups).forEach(([groupName, objects]) => {
            const toggle = document.createElement('div');
            toggle.className = 'toggle-item';
            toggle.innerHTML = `
                <label>
                    <input type="checkbox" 
                           id="group-${groupName}" 
                           checked 
                           onchange="visibilityUI.toggleGroup('${groupName}', this.checked)">
                    <span>${this.formatGroupName(groupName)} (${objects.length})</span>
                </label>
            `;
            groupContainer.appendChild(toggle);
        });
    }
    
    // 오브젝트 토글 생성
    updateObjectToggles() {
        const objectContainer = document.getElementById('object-toggles');
        if (!objectContainer) return;
        
        objectContainer.innerHTML = '';
        const objects = this.controller.getObjectList();
        
        // 핫스팟 제외
        const filteredObjects = objects.filter(name => !name.startsWith('HS_'));
        
        filteredObjects.forEach(objectName => {
            const toggle = document.createElement('div');
            toggle.className = 'toggle-item';
            toggle.innerHTML = `
                <label>
                    <input type="checkbox" 
                           id="obj-${objectName}" 
                           checked 
                           onchange="visibilityUI.toggleObject('${objectName}', this.checked)">
                    <span>${objectName}</span>
                </label>
            `;
            objectContainer.appendChild(toggle);
        });
    }
    
    // 그룹명 포맷팅
    formatGroupName(groupName) {
        const nameMap = {
            'structure': '🏗️ 구조물',
            'reinforcement': '🔗 보강재',
            'drainage': '💧 배수',
            'backfill': '🪨 뒤채움',
            'accessories': '🔧 부속품',
            'hotspots': '📍 핫스팟'
        };
        return nameMap[groupName] || groupName;
    }
    
    // 이벤트 핸들러들
    showAll() {
        this.controller.showAll();
        this.updateCheckboxes(true);
    }
    
    hideAll() {
        this.controller.hideAll();
        this.updateCheckboxes(false);
    }
    
    resetVisibility() {
        // 초기 상태로 복원
        this.controller.showAll();
        this.updateCheckboxes(true);
    }
    
    toggleGroup(groupName, visible) {
        this.controller.setGroupVisibility(groupName, visible);
    }
    
    toggleObject(objectName, visible) {
        this.controller.setObjectVisibility(objectName, visible);
    }
    
    searchObjects() {
        const searchTerm = document.getElementById('object-search').value;
        if (!searchTerm) return;
        
        const results = this.controller.findObjects(searchTerm);
        
        // 검색 결과만 표시
        this.controller.hideAll();
        results.forEach(result => {
            this.controller.setObjectVisibility(result.name, true);
        });
        
        this.updateCheckboxes(false);
        
        // 검색된 항목 체크
        results.forEach(result => {
            const checkbox = document.getElementById(`obj-${result.name}`);
            if (checkbox) checkbox.checked = true;
        });
    }
    
    // 프리셋 적용
    applyPreset(presetName) {
        const presets = {
            'structure': () => {
                this.controller.hideAll();
                this.controller.setGroupVisibility('structure', true);
            },
            'drainage': () => {
                this.controller.hideAll();
                this.controller.setGroupVisibility('drainage', true);
                this.controller.setVisibilityByPattern('pipe', true);
            },
            'reinforcement': () => {
                this.controller.hideAll();
                this.controller.setGroupVisibility('reinforcement', true);
            },
            'analysis': () => {
                // 분석 모드: 구조물은 반투명, 보강재는 강조
                this.controller.showAll();
                // 여기서는 opacity 조정 등 추가 효과 가능
            }
        };
        
        if (presets[presetName]) {
            presets[presetName]();
            this.syncCheckboxes();
        }
    }
    
    // 체크박스 일괄 업데이트
    updateCheckboxes(checked) {
        document.querySelectorAll('.toggle-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = checked;
        });
    }
    
    // 현재 상태와 체크박스 동기화
    syncCheckboxes() {
        const states = this.controller.visibilityStates;
        
        states.forEach((visible, objectName) => {
            const checkbox = document.getElementById(`obj-${objectName}`);
            if (checkbox) {
                checkbox.checked = visible;
            }
        });
        
        // 그룹 체크박스도 업데이트
        const groups = this.controller.getGroupList();
        Object.entries(groups).forEach(([groupName, objects]) => {
            const checkbox = document.getElementById(`group-${groupName}`);
            if (checkbox) {
                // 그룹 내 모든 오브젝트가 visible인지 확인
                const allVisible = objects.every(objName => 
                    this.controller.visibilityStates.get(objName)
                );
                checkbox.checked = allVisible;
            }
        });
    }
    
    // UI 표시/숨김
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
    
    toggle() {
        if (this.container) {
            const isVisible = this.container.style.display !== 'none';
            this.container.style.display = isVisible ? 'none' : 'block';
        }
    }
}