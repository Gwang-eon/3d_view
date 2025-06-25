// ObjectVisibilityController.js
export class ObjectVisibilityController {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        this.objects = new Map(); // 오브젝트 이름과 참조 매핑
        this.groups = new Map(); // 그룹별 오브젝트 관리
        this.visibilityStates = new Map(); // 가시성 상태 저장
    }
    
    // 모델 로드 후 오브젝트 스캔
    scanModel(model) {
        console.log('[VisibilityController] 모델 스캔 시작');
        this.objects.clear();
        this.groups.clear();
        
        model.traverse((child) => {
            if (child.name) {
                // 오브젝트 등록
                this.objects.set(child.name, child);
                this.visibilityStates.set(child.name, child.visible);
                
                // 그룹 분류 (이름 패턴으로)
                this.categorizeObject(child);
                
                console.log(`[VisibilityController] 발견된 오브젝트: ${child.name}, 타입: ${child.type}`);
            }
        });
        
        console.log(`[VisibilityController] 총 ${this.objects.size}개 오브젝트 등록됨`);
        this.logGroups();
    }
    
    // 오브젝트를 그룹으로 분류
    categorizeObject(object) {
        const name = object.name.toLowerCase();
        
        // 그룹 패턴 정의
        const patterns = {
            'structure': ['wall', 'block', 'concrete', 'foundation'],
            'reinforcement': ['geogrid', 'rebar', 'mesh', 'tie'],
            'drainage': ['drain', 'pipe', 'filter'],
            'backfill': ['soil', 'sand', 'gravel', 'backfill'],
            'accessories': ['cap', 'pin', 'connector'],
            'hotspots': ['hs_']
        };
        
        // 패턴 매칭
        for (const [groupName, keywords] of Object.entries(patterns)) {
            if (keywords.some(keyword => name.includes(keyword))) {
                if (!this.groups.has(groupName)) {
                    this.groups.set(groupName, new Set());
                }
                this.groups.get(groupName).add(object.name);
                break;
            }
        }
    }
    
    // 단일 오브젝트 표시/숨김
    setObjectVisibility(objectName, visible) {
        const object = this.objects.get(objectName);
        if (object) {
            object.visible = visible;
            this.visibilityStates.set(objectName, visible);
            console.log(`[VisibilityController] ${objectName}: ${visible ? '표시' : '숨김'}`);
            return true;
        }
        console.warn(`[VisibilityController] 오브젝트를 찾을 수 없음: ${objectName}`);
        return false;
    }
    
    // 여러 오브젝트 일괄 제어
    setMultipleVisibility(objectNames, visible) {
        const results = [];
        objectNames.forEach(name => {
            results.push(this.setObjectVisibility(name, visible));
        });
        return results;
    }
    
    // 그룹 단위 표시/숨김
    setGroupVisibility(groupName, visible) {
        const group = this.groups.get(groupName);
        if (group) {
            group.forEach(objectName => {
                this.setObjectVisibility(objectName, visible);
            });
            console.log(`[VisibilityController] ${groupName} 그룹: ${visible ? '표시' : '숨김'}`);
            return true;
        }
        console.warn(`[VisibilityController] 그룹을 찾을 수 없음: ${groupName}`);
        return false;
    }
    
    // 패턴으로 오브젝트 찾기
    setVisibilityByPattern(pattern, visible) {
        const regex = new RegExp(pattern, 'i');
        const matched = [];
        
        this.objects.forEach((object, name) => {
            if (regex.test(name)) {
                this.setObjectVisibility(name, visible);
                matched.push(name);
            }
        });
        
        console.log(`[VisibilityController] 패턴 '${pattern}' 매칭: ${matched.length}개`);
        return matched;
    }
    
    // 토글 기능
    toggleObjectVisibility(objectName) {
        const object = this.objects.get(objectName);
        if (object) {
            object.visible = !object.visible;
            this.visibilityStates.set(objectName, object.visible);
            return object.visible;
        }
        return null;
    }
    
    // 모든 오브젝트 표시
    showAll() {
        this.objects.forEach((object, name) => {
            object.visible = true;
            this.visibilityStates.set(name, true);
        });
        console.log('[VisibilityController] 모든 오브젝트 표시');
    }
    
    // 모든 오브젝트 숨김
    hideAll() {
        this.objects.forEach((object, name) => {
            object.visible = false;
            this.visibilityStates.set(name, false);
        });
        console.log('[VisibilityController] 모든 오브젝트 숨김');
    }
    
    // 특정 오브젝트만 표시 (나머지는 숨김)
    isolate(objectNames) {
        this.hideAll();
        if (Array.isArray(objectNames)) {
            objectNames.forEach(name => this.setObjectVisibility(name, true));
        } else {
            this.setObjectVisibility(objectNames, true);
        }
    }
    
    // 상태 저장
    saveState() {
        const state = {};
        this.visibilityStates.forEach((visible, name) => {
            state[name] = visible;
        });
        return state;
    }
    
    // 상태 복원
    restoreState(state) {
        Object.entries(state).forEach(([name, visible]) => {
            this.setObjectVisibility(name, visible);
        });
    }
    
    // 오브젝트 목록 가져오기
    getObjectList() {
        return Array.from(this.objects.keys());
    }
    
    // 그룹 목록 가져오기
    getGroupList() {
        const groups = {};
        this.groups.forEach((objects, groupName) => {
            groups[groupName] = Array.from(objects);
        });
        return groups;
    }
    
    // 디버그 정보 출력
    logGroups() {
        console.log('[VisibilityController] 그룹 정보:');
        this.groups.forEach((objects, groupName) => {
            console.log(`  ${groupName}: ${objects.size}개 오브젝트`);
        });
    }
    
    // 오브젝트 검색
    findObjects(searchTerm) {
        const results = [];
        const term = searchTerm.toLowerCase();
        
        this.objects.forEach((object, name) => {
            if (name.toLowerCase().includes(term)) {
                results.push({
                    name: name,
                    type: object.type,
                    visible: object.visible
                });
            }
        });
        
        return results;
    }
    
    // 재질별 제어
    setVisibilityByMaterial(materialName, visible) {
        const matched = [];
        
        this.objects.forEach((object, name) => {
            if (object.isMesh && object.material) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                
                materials.forEach(mat => {
                    if (mat.name && mat.name.includes(materialName)) {
                        object.visible = visible;
                        this.visibilityStates.set(name, visible);
                        matched.push(name);
                    }
                });
            }
        });
        
        console.log(`[VisibilityController] 재질 '${materialName}' 매칭: ${matched.length}개`);
        return matched;
    }
    
    // 타입별 제어 (Mesh, Line, Points 등)
    setVisibilityByType(type, visible) {
        const matched = [];
        
        this.objects.forEach((object, name) => {
            if (object.type === type || object[`is${type}`]) {
                object.visible = visible;
                this.visibilityStates.set(name, visible);
                matched.push(name);
            }
        });
        
        console.log(`[VisibilityController] 타입 '${type}' 매칭: ${matched.length}개`);
        return matched;
    }
}