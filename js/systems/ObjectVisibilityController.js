// js/systems/ObjectVisibilityController.js
// 객체 표시/숨김 제어 시스템 - 고급 가시성 관리

import { getConfig, setConfig } from '../core/ConfigManager.js';

/**
 * 객체 가시성 제어 시스템
 * - 모델 내 개별 객체 표시/숨김
 * - 그룹별 관리 시스템
 * - 레이어 기반 제어
 * - 애니메이션 효과
 * - 상태 저장/복원
 */
export class ObjectVisibilityController {
    constructor(sceneManager) {
        this.sceneManager = sceneManager;
        
        // 객체 관리
        this.objects = new Map(); // name -> object
        this.groups = new Map(); // groupName -> Set<objectName>
        this.layers = new Map(); // layerName -> Set<objectName>
        
        // 가시성 상태
        this.visibilityStates = new Map(); // objectName -> boolean
        this.groupStates = new Map(); // groupName -> boolean
        this.layerStates = new Map(); // layerName -> boolean
        
        // 애니메이션 관리
        this.animations = new Map();
        this.animationQueue = [];
        
        // 필터링
        this.filters = new Map();
        this.activeFilters = new Set();
        
        // 설정
        this.config = {
            enableAnimations: getConfig('objectVisibility.enableAnimations', true),
            animationDuration: getConfig('objectVisibility.animationDuration', 300),
            fadeInEasing: getConfig('objectVisibility.fadeInEasing', 'easeOut'),
            fadeOutEasing: getConfig('objectVisibility.fadeOutEasing', 'easeIn'),
            enableGrouping: getConfig('objectVisibility.enableGrouping', true),
            enableLayers: getConfig('objectVisibility.enableLayers', true),
            enableMaterialPreservation: getConfig('objectVisibility.enableMaterialPreservation', true)
        };
        
        // 이벤트 시스템
        this.events = new Map();
        
        console.log('[ObjectVisibilityController] 초기화됨');
    }
    
    /**
     * 모델 스캔 및 객체 등록
     */
    scanModel(model) {
        if (!model) return;
        
        console.log('[ObjectVisibilityController] 모델 스캔 시작...');
        
        // 기존 데이터 정리
        this.clear();
        
        let objectCount = 0;
        
        // 모델 순회하여 객체 등록
        model.traverse((child) => {
            if (child.isMesh || child.isGroup) {
                this.registerObject(child);
                objectCount++;
            }
        });
        
        // 자동 그룹핑
        if (this.config.enableGrouping) {
            this.autoCreateGroups();
        }
        
        // 자동 레이어 분류
        if (this.config.enableLayers) {
            this.autoCreateLayers();
        }
        
        console.log(`[ObjectVisibilityController] ${objectCount}개 객체 스캔 완료`);
        this.emit('scan:complete', { objectCount, groups: this.groups.size, layers: this.layers.size });
    }
    
    /**
     * 객체 등록
     */
    registerObject(object) {
        const name = object.name || `Object_${this.objects.size}`;
        
        // 중복 이름 처리
        let uniqueName = name;
        let counter = 1;
        while (this.objects.has(uniqueName)) {
            uniqueName = `${name}_${counter}`;
            counter++;
        }
        
        // 객체 등록
        this.objects.set(uniqueName, object);
        this.visibilityStates.set(uniqueName, object.visible);
        
        // 원본 재질 보존
        if (this.config.enableMaterialPreservation) {
            this.preserveOriginalMaterial(object);
        }
        
        // 사용자 데이터에 참조 저장
        object.userData.visibilityName = uniqueName;
        
        return uniqueName;
    }
    
    /**
     * 원본 재질 보존
     */
    preserveOriginalMaterial(object) {
        if (object.isMesh && object.material) {
            object.userData.originalMaterial = object.material.clone();
            object.userData.originalOpacity = object.material.opacity || 1.0;
            object.userData.originalTransparent = object.material.transparent || false;
        }
    }
    
    /**
     * 자동 그룹 생성
     */
    autoCreateGroups() {
        // 이름 패턴 기반 그룹핑
        const patterns = [
            { pattern: /wall/i, group: 'Walls' },
            { pattern: /floor/i, group: 'Floors' },
            { pattern: /beam/i, group: 'Beams' },
            { pattern: /column/i, group: 'Columns' },
            { pattern: /foundation/i, group: 'Foundation' },
            { pattern: /block/i, group: 'Blocks' },
            { pattern: /panel/i, group: 'Panels' },
            { pattern: /support/i, group: 'Supports' },
            { pattern: /anchor/i, group: 'Anchors' },
            { pattern: /reinforcement/i, group: 'Reinforcement' }
        ];
        
        this.objects.forEach((object, name) => {
            for (const { pattern, group } of patterns) {
                if (pattern.test(name)) {
                    this.addToGroup(name, group);
                    break;
                }
            }
        });
        
        // 부모-자식 관계 기반 그룹핑
        this.objects.forEach((object, name) => {
            if (object.parent && object.parent.name) {
                const parentName = object.parent.name;
                this.addToGroup(name, `Parent_${parentName}`);
            }
        });
        
        console.log(`[ObjectVisibilityController] ${this.groups.size}개 그룹 자동 생성됨`);
    }
    
    /**
     * 자동 레이어 분류
     */
    autoCreateLayers() {
        // 재질 타입 기반 레이어
        const materialLayers = new Map();
        
        this.objects.forEach((object, name) => {
            if (object.isMesh && object.material) {
                const materialType = object.material.type;
                const layerName = `Material_${materialType}`;
                
                if (!materialLayers.has(layerName)) {
                    materialLayers.set(layerName, new Set());
                }
                materialLayers.get(layerName).add(name);
            }
        });
        
        // 높이 기반 레이어
        const heightLayers = new Map();
        const heightThresholds = [0, 2, 5, 10, 20]; // 미터 단위
        
        this.objects.forEach((object, name) => {
            const bbox = new THREE.Box3().setFromObject(object);
            const height = bbox.max.y;
            
            let layerName = 'Height_Ground';
            for (let i = heightThresholds.length - 1; i >= 0; i--) {
                if (height >= heightThresholds[i]) {
                    layerName = `Height_${heightThresholds[i]}m+`;
                    break;
                }
            }
            
            if (!heightLayers.has(layerName)) {
                heightLayers.set(layerName, new Set());
            }
            heightLayers.get(layerName).add(name);
        });
        
        // 레이어 등록
        materialLayers.forEach((objects, layerName) => {
            this.layers.set(layerName, objects);
        });
        
        heightLayers.forEach((objects, layerName) => {
            this.layers.set(layerName, objects);
        });
        
        console.log(`[ObjectVisibilityController] ${this.layers.size}개 레이어 자동 생성됨`);
    }
    
    /**
     * 그룹에 객체 추가
     */
    addToGroup(objectName, groupName) {
        if (!this.groups.has(groupName)) {
            this.groups.set(groupName, new Set());
            this.groupStates.set(groupName, true);
        }
        
        this.groups.get(groupName).add(objectName);
    }
    
    /**
     * 레이어에 객체 추가
     */
    addToLayer(objectName, layerName) {
        if (!this.layers.has(layerName)) {
            this.layers.set(layerName, new Set());
            this.layerStates.set(layerName, true);
        }
        
        this.layers.get(layerName).add(objectName);
    }
    
    /**
     * 객체 가시성 설정
     */
    setObjectVisibility(objectName, visible, animated = true) {
        const object = this.objects.get(objectName);
        if (!object) {
            console.warn(`[ObjectVisibilityController] 객체를 찾을 수 없음: ${objectName}`);
            return false;
        }
        
        const wasVisible = this.visibilityStates.get(objectName);
        if (wasVisible === visible) return true; // 이미 같은 상태
        
        this.visibilityStates.set(objectName, visible);
        
        if (animated && this.config.enableAnimations) {
            this.animateVisibility(object, visible);
        } else {
            object.visible = visible;
        }
        
        this.emit('object:visibility:change', { objectName, visible, animated });
        console.log(`[ObjectVisibilityController] ${objectName}: ${visible ? '표시' : '숨김'}`);
        
        return true;
    }
    
    /**
     * 가시성 애니메이션
     */
    animateVisibility(object, visible) {
        // 기존 애니메이션 중지
        if (this.animations.has(object.uuid)) {
            this.animations.get(object.uuid).stop();
        }
        
        if (visible) {
            // 페이드 인
            object.visible = true;
            this.fadeIn(object);
        } else {
            // 페이드 아웃
            this.fadeOut(object);
        }
    }
    
    /**
     * 페이드 인 애니메이션
     */
    fadeIn(object) {
        if (!object.material) {
            object.visible = true;
            return;
        }
        
        // 재질 설정
        const material = object.material;
        const originalOpacity = object.userData.originalOpacity || 1.0;
        
        material.transparent = true;
        material.opacity = 0;
        
        // 애니메이션 생성
        const animation = {
            object: object,
            startTime: performance.now(),
            duration: this.config.animationDuration,
            startOpacity: 0,
            endOpacity: originalOpacity,
            easing: this.config.fadeInEasing,
            type: 'fadeIn'
        };
        
        this.animations.set(object.uuid, animation);
        this.startAnimation(animation);
    }
    
    /**
     * 페이드 아웃 애니메이션
     */
    fadeOut(object) {
        if (!object.material) {
            object.visible = false;
            return;
        }
        
        const material = object.material;
        const startOpacity = material.opacity;
        
        material.transparent = true;
        
        // 애니메이션 생성
        const animation = {
            object: object,
            startTime: performance.now(),
            duration: this.config.animationDuration,
            startOpacity: startOpacity,
            endOpacity: 0,
            easing: this.config.fadeOutEasing,
            type: 'fadeOut'
        };
        
        this.animations.set(object.uuid, animation);
        this.startAnimation(animation);
    }
    
    /**
     * 애니메이션 시작
     */
    startAnimation(animation) {
        const animate = () => {
            const elapsed = performance.now() - animation.startTime;
            const progress = Math.min(elapsed / animation.duration, 1);
            
            // 이징 적용
            const easedProgress = this.applyEasing(progress, animation.easing);
            
            // 투명도 보간
            const opacity = animation.startOpacity + 
                           (animation.endOpacity - animation.startOpacity) * easedProgress;
            
            animation.object.material.opacity = opacity;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // 애니메이션 완료
                this.completeAnimation(animation);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    /**
     * 애니메이션 완료 처리
     */
    completeAnimation(animation) {
        if (animation.type === 'fadeOut') {
            animation.object.visible = false;
        }
        
        // 원본 재질 속성 복원 (필요시)
        if (animation.type === 'fadeIn') {
            const originalTransparent = animation.object.userData.originalTransparent;
            if (!originalTransparent) {
                animation.object.material.transparent = false;
            }
        }
        
        this.animations.delete(animation.object.uuid);
        this.emit('animation:complete', animation);
    }
    
    /**
     * 이징 함수 적용
     */
    applyEasing(t, easingType) {
        switch (easingType) {
            case 'linear':
                return t;
            case 'easeIn':
                return t * t;
            case 'easeOut':
                return 1 - (1 - t) * (1 - t);
            case 'easeInOut':
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            default:
                return t;
        }
    }
    
    /**
     * 그룹 가시성 설정
     */
    setGroupVisibility(groupName, visible, animated = true) {
        const group = this.groups.get(groupName);
        if (!group) {
            console.warn(`[ObjectVisibilityController] 그룹을 찾을 수 없음: ${groupName}`);
            return false;
        }
        
        this.groupStates.set(groupName, visible);
        
        group.forEach(objectName => {
            this.setObjectVisibility(objectName, visible, animated);
        });
        
        this.emit('group:visibility:change', { groupName, visible, count: group.size });
        console.log(`[ObjectVisibilityController] ${groupName} 그룹: ${visible ? '표시' : '숨김'} (${group.size}개)`);
        
        return true;
    }
    
    /**
     * 레이어 가시성 설정
     */
    setLayerVisibility(layerName, visible, animated = true) {
        const layer = this.layers.get(layerName);
        if (!layer) {
            console.warn(`[ObjectVisibilityController] 레이어를 찾을 수 없음: ${layerName}`);
            return false;
        }
        
        this.layerStates.set(layerName, visible);
        
        layer.forEach(objectName => {
            this.setObjectVisibility(objectName, visible, animated);
        });
        
        this.emit('layer:visibility:change', { layerName, visible, count: layer.size });
        console.log(`[ObjectVisibilityController] ${layerName} 레이어: ${visible ? '표시' : '숨김'} (${layer.size}개)`);
        
        return true;
    }
    
    /**
     * 패턴으로 객체 제어
     */
    setVisibilityByPattern(pattern, visible, animated = true) {
        const regex = new RegExp(pattern, 'i');
        const matched = [];
        
        this.objects.forEach((object, name) => {
            if (regex.test(name)) {
                this.setObjectVisibility(name, visible, animated);
                matched.push(name);
            }
        });
        
        this.emit('pattern:visibility:change', { pattern, visible, matched });
        console.log(`[ObjectVisibilityController] 패턴 '${pattern}' 매칭: ${matched.length}개`);
        
        return matched;
    }
    
    /**
     * 필터 생성
     */
    createFilter(filterName, filterFunction) {
        this.filters.set(filterName, filterFunction);
        console.log(`[ObjectVisibilityController] 필터 생성: ${filterName}`);
    }
    
    /**
     * 필터 적용
     */
    applyFilter(filterName, animated = true) {
        const filterFunction = this.filters.get(filterName);
        if (!filterFunction) {
            console.warn(`[ObjectVisibilityController] 필터를 찾을 수 없음: ${filterName}`);
            return false;
        }
        
        this.activeFilters.add(filterName);
        
        this.objects.forEach((object, name) => {
            const visible = filterFunction(object, name);
            this.setObjectVisibility(name, visible, animated);
        });
        
        this.emit('filter:applied', { filterName });
        console.log(`[ObjectVisibilityController] 필터 적용: ${filterName}`);
        
        return true;
    }
    
    /**
     * 필터 제거
     */
    removeFilter(filterName, animated = true) {
        if (!this.activeFilters.has(filterName)) return false;
        
        this.activeFilters.delete(filterName);
        
        // 다른 활성 필터들 재적용
        if (this.activeFilters.size > 0) {
            this.reapplyFilters(animated);
        } else {
            // 모든 객체 표시
            this.showAll(animated);
        }
        
        this.emit('filter:removed', { filterName });
        console.log(`[ObjectVisibilityController] 필터 제거: ${filterName}`);
        
        return true;
    }
    
    /**
     * 필터 재적용
     */
    reapplyFilters(animated = true) {
        this.objects.forEach((object, name) => {
            let visible = true;
            
            // 모든 활성 필터 적용 (AND 조건)
            for (const filterName of this.activeFilters) {
                const filterFunction = this.filters.get(filterName);
                if (filterFunction && !filterFunction(object, name)) {
                    visible = false;
                    break;
                }
            }
            
            this.setObjectVisibility(name, visible, animated);
        });
    }
    
    /**
     * 객체 하이라이트
     */
    highlightObject(objectName, highlightColor = '#ffff00') {
        const object = this.objects.get(objectName);
        if (!object || !object.material) return false;
        
        // 기존 하이라이트 제거
        this.removeHighlight(objectName);
        
        // 하이라이트 재질 적용
        const highlightMaterial = object.material.clone();
        highlightMaterial.color.setHex(highlightColor.replace('#', '0x'));
        highlightMaterial.emissive.setHex(highlightColor.replace('#', '0x'));
        highlightMaterial.emissiveIntensity = 0.3;
        
        object.userData.currentMaterial = object.material;
        object.material = highlightMaterial;
        
        this.emit('object:highlight', { objectName, color: highlightColor });
        
        return true;
    }
    
    /**
     * 하이라이트 제거
     */
    removeHighlight(objectName) {
        const object = this.objects.get(objectName);
        if (!object || !object.userData.currentMaterial) return false;
        
        // 원본 재질 복원
        object.material = object.userData.currentMaterial;
        delete object.userData.currentMaterial;
        
        this.emit('object:highlight:remove', { objectName });
        
        return true;
    }
    
    /**
     * 모든 하이라이트 제거
     */
    removeAllHighlights() {
        this.objects.forEach((object, name) => {
            this.removeHighlight(name);
        });
    }
    
    /**
     * 특정 객체만 표시 (격리)
     */
    isolateObjects(objectNames, animated = true) {
        if (!Array.isArray(objectNames)) {
            objectNames = [objectNames];
        }
        
        this.objects.forEach((object, name) => {
            const visible = objectNames.includes(name);
            this.setObjectVisibility(name, visible, animated);
        });
        
        this.emit('objects:isolated', { objectNames });
        console.log(`[ObjectVisibilityController] 객체 격리: ${objectNames.length}개`);
    }
    
    /**
     * 모든 객체 표시
     */
    showAll(animated = true) {
        this.objects.forEach((object, name) => {
            this.setObjectVisibility(name, true, animated);
        });
        
        this.emit('visibility:show:all');
        console.log('[ObjectVisibilityController] 모든 객체 표시');
    }
    
    /**
     * 모든 객체 숨김
     */
    hideAll(animated = true) {
        this.objects.forEach((object, name) => {
            this.setObjectVisibility(name, false, animated);
        });
        
        this.emit('visibility:hide:all');
        console.log('[ObjectVisibilityController] 모든 객체 숨김');
    }
    
    /**
     * 가시성 상태 저장
     */
    saveState(stateName = 'default') {
        const state = {
            timestamp: Date.now(),
            objects: Object.fromEntries(this.visibilityStates),
            groups: Object.fromEntries(this.groupStates),
            layers: Object.fromEntries(this.layerStates),
            activeFilters: Array.from(this.activeFilters)
        };
        
        // ConfigManager를 통해 저장
        const savedStates = getConfig('objectVisibility.savedStates', {});
        savedStates[stateName] = state;
        setConfig('objectVisibility.savedStates', savedStates);
        
        this.emit('state:saved', { stateName, state });
        console.log(`[ObjectVisibilityController] 상태 저장: ${stateName}`);
        
        return state;
    }
    
    /**
     * 가시성 상태 복원
     */
    restoreState(stateName = 'default', animated = true) {
        const savedStates = getConfig('objectVisibility.savedStates', {});
        const state = savedStates[stateName];
        
        if (!state) {
            console.warn(`[ObjectVisibilityController] 저장된 상태를 찾을 수 없음: ${stateName}`);
            return false;
        }
        
        // 객체 상태 복원
        Object.entries(state.objects).forEach(([objectName, visible]) => {
            this.setObjectVisibility(objectName, visible, animated);
        });
        
        // 그룹 상태 복원
        Object.entries(state.groups).forEach(([groupName, visible]) => {
            this.groupStates.set(groupName, visible);
        });
        
        // 레이어 상태 복원
        Object.entries(state.layers).forEach(([layerName, visible]) => {
            this.layerStates.set(layerName, visible);
        });
        
        // 필터 상태 복원
        this.activeFilters.clear();
        state.activeFilters.forEach(filterName => {
            this.activeFilters.add(filterName);
        });
        
        this.emit('state:restored', { stateName, state });
        console.log(`[ObjectVisibilityController] 상태 복원: ${stateName}`);
        
        return true;
    }
    
    /**
     * 통계 정보
     */
    getStatistics() {
        const visible = Array.from(this.visibilityStates.values()).filter(v => v).length;
        const hidden = this.objects.size - visible;
        
        return {
            total: this.objects.size,
            visible: visible,
            hidden: hidden,
            groups: this.groups.size,
            layers: this.layers.size,
            activeFilters: this.activeFilters.size,
            runningAnimations: this.animations.size
        };
    }
    
    /**
     * 검색
     */
    searchObjects(query) {
        const results = [];
        const searchTerm = query.toLowerCase();
        
        this.objects.forEach((object, name) => {
            if (name.toLowerCase().includes(searchTerm)) {
                results.push({
                    name: name,
                    visible: this.visibilityStates.get(name),
                    type: object.type,
                    groups: this.getObjectGroups(name),
                    layers: this.getObjectLayers(name)
                });
            }
        });
        
        return results;
    }
    
    /**
     * 객체가 속한 그룹 목록
     */
    getObjectGroups(objectName) {
        const groups = [];
        this.groups.forEach((objects, groupName) => {
            if (objects.has(objectName)) {
                groups.push(groupName);
            }
        });
        return groups;
    }
    
    /**
     * 객체가 속한 레이어 목록
     */
    getObjectLayers(objectName) {
        const layers = [];
        this.layers.forEach((objects, layerName) => {
            if (objects.has(objectName)) {
                layers.push(layerName);
            }
        });
        return layers;
    }
    
    /**
     * 정리
     */
    clear() {
        // 애니메이션 중지
        this.animations.forEach(animation => {
            animation.stop = true;
        });
        this.animations.clear();
        
        // 하이라이트 제거
        this.removeAllHighlights();
        
        // 데이터 정리
        this.objects.clear();
        this.groups.clear();
        this.layers.clear();
        this.visibilityStates.clear();
        this.groupStates.clear();
        this.layerStates.clear();
        this.activeFilters.clear();
        
        this.emit('cleared');
        console.log('[ObjectVisibilityController] 데이터 정리됨');
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
                    console.error(`[ObjectVisibilityController] 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[ObjectVisibilityController] 디버그 정보');
        console.log('통계:', this.getStatistics());
        console.log('그룹:', Array.from(this.groups.keys()));
        console.log('레이어:', Array.from(this.layers.keys()));
        console.log('활성 필터:', Array.from(this.activeFilters));
        console.log('실행 중인 애니메이션:', this.animations.size);
        console.groupEnd();
    }
}

export default ObjectVisibilityController;