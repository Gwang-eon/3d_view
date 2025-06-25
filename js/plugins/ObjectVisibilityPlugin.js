// js/plugins/ObjectVisibilityPlugin.js
// 객체 가시성 제어 플러그인 - UI와 컨트롤러 통합

import { Plugin } from '../PluginSystem.js';
import { ObjectVisibilityController } from '../systems/ObjectVisibilityController.js';
import { getConfig, setConfig } from '../core/ConfigManager.js';

/**
 * 객체 가시성 제어 플러그인
 * - ObjectVisibilityController를 플러그인으로 래핑
 * - 직관적인 UI 제공
 * - 그룹/레이어 관리 인터페이스
 * - 필터링 및 검색 기능
 * - 상태 저장/불러오기
 */
export class ObjectVisibilityPlugin extends Plugin {
    constructor(options = {}) {
        super('ObjectVisibility', '1.0.0', {
            displayName: '객체 가시성 제어',
            ...options
        });
        
        // 컨트롤러
        this.visibilityController = null;
        
        // UI 상태
        this.uiState = {
            activeTab: 'objects', // 'objects', 'groups', 'layers', 'filters'
            searchQuery: '',
            selectedItems: new Set(),
            expandedGroups: new Set(),
            showHidden: false
        };
        
        // UI 요소들
        this.controls = new Map();
        this.listElements = new Map();
        
        // 자동 새로고침
        this.refreshInterval = null;
    }
    
    /**
     * 기본 설정
     */
    async getDefaultConfig() {
        return {
            ...await super.getDefaultConfig(),
            
            // UI 설정
            ui: {
                visible: true,
                position: 'left',
                width: 320,
                height: 500,
                collapsible: true,
                resizable: true,
                showSearch: true,
                showStats: true,
                autoRefresh: true,
                refreshInterval: 1000
            },
            
            // 기능 설정
            features: {
                enableGrouping: true,
                enableLayers: true,
                enableFilters: true,
                enableBulkOperations: true,
                enableStateManagement: true,
                enableKeyboardShortcuts: true
            },
            
            // 표시 설정
            display: {
                maxVisibleItems: 100,
                showObjectCounts: true,
                showVisibilityIcons: true,
                showProgressBars: true,
                highlightOnHover: true
            }
        };
    }
    
    /**
     * 의존성
     */
    getDependencies() {
        return ['sceneManager'];
    }
    
    /**
     * 초기화
     */
    async onInit() {
        // 컨트롤러 생성
        this.visibilityController = new ObjectVisibilityController(this.context.sceneManager);
        
        // 이벤트 리스너 설정
        this.setupControllerEvents();
        
        // 키보드 단축키 설정
        if (this.config.features.enableKeyboardShortcuts) {
            this.setupKeyboardShortcuts();
        }
        
        // 자동 새로고침 시작
        if (this.config.ui.autoRefresh) {
            this.startAutoRefresh();
        }
        
        console.log('[ObjectVisibility] 객체 가시성 제어 플러그인 초기화됨');
    }
    
    /**
     * 컨트롤러 이벤트 설정
     */
    setupControllerEvents() {
        const controller = this.visibilityController;
        
        // 모델 스캔 완료
        controller.on('model:scanned', (data) => {
            this.refreshUI();
            this.updateStats();
        });
        
        // 가시성 변경
        controller.on('object:visibility:change', (data) => {
            this.updateObjectUI(data.objectName);
            this.updateStats();
        });
        
        // 그룹/레이어 변경
        controller.on('group:visibility:change', (data) => {
            this.updateGroupUI(data.groupName);
            this.updateStats();
        });
        
        controller.on('layer:visibility:change', (data) => {
            this.updateLayerUI(data.layerName);
            this.updateStats();
        });
        
        // 하이라이트 변경
        controller.on('object:highlighted', (data) => {
            this.updateObjectHighlight(data.objectName, true);
        });
        
        controller.on('object:unhighlighted', (data) => {
            this.updateObjectHighlight(data.objectName, false);
        });
    }
    
    /**
     * UI 생성
     */
    async onCreateUI(container) {
        const content = container.querySelector('.plugin-content');
        if (!content) return;
        
        content.innerHTML = `
            <div class="object-visibility-plugin">
                <!-- 탭 네비게이션 -->
                <div class="tab-navigation">
                    <button class="tab-btn active" data-tab="objects">객체</button>
                    <button class="tab-btn" data-tab="groups">그룹</button>
                    <button class="tab-btn" data-tab="layers">레이어</button>
                    <button class="tab-btn" data-tab="filters">필터</button>
                </div>
                
                <!-- 검색 및 도구 -->
                <div class="search-tools">
                    <div class="search-box">
                        <input type="text" class="search-input" placeholder="검색...">
                        <button class="search-clear">×</button>
                    </div>
                    <div class="tool-buttons">
                        <button class="tool-btn" data-action="show-all" title="모두 표시">👁️</button>
                        <button class="tool-btn" data-action="hide-all" title="모두 숨김">🙈</button>
                        <button class="tool-btn" data-action="invert" title="반전">🔄</button>
                        <button class="tool-btn" data-action="save-state" title="상태 저장">💾</button>
                    </div>
                </div>
                
                <!-- 통계 정보 -->
                <div class="stats-info">
                    <div class="stat-item">
                        <span class="stat-label">전체:</span>
                        <span class="stat-value" id="total-objects">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">표시:</span>
                        <span class="stat-value" id="visible-objects">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">숨김:</span>
                        <span class="stat-value" id="hidden-objects">0</span>
                    </div>
                </div>
                
                <!-- 탭 콘텐츠 -->
                <div class="tab-content">
                    <!-- 객체 탭 -->
                    <div class="tab-panel active" data-tab="objects">
                        <div class="object-list" id="object-list">
                            <!-- 동적 생성 -->
                        </div>
                    </div>
                    
                    <!-- 그룹 탭 -->
                    <div class="tab-panel" data-tab="groups">
                        <div class="group-list" id="group-list">
                            <!-- 동적 생성 -->
                        </div>
                    </div>
                    
                    <!-- 레이어 탭 -->
                    <div class="tab-panel" data-tab="layers">
                        <div class="layer-list" id="layer-list">
                            <!-- 동적 생성 -->
                        </div>
                    </div>
                    
                    <!-- 필터 탭 -->
                    <div class="tab-panel" data-tab="filters">
                        <div class="filter-controls" id="filter-controls">
                            <div class="filter-group">
                                <h4>재질별 필터</h4>
                                <div class="filter-buttons" id="material-filters">
                                    <!-- 동적 생성 -->
                                </div>
                            </div>
                            <div class="filter-group">
                                <h4>크기별 필터</h4>
                                <div class="filter-buttons" id="size-filters">
                                    <button class="filter-btn" data-filter="size:small">작음</button>
                                    <button class="filter-btn" data-filter="size:medium">중간</button>
                                    <button class="filter-btn" data-filter="size:large">큼</button>
                                </div>
                            </div>
                            <div class="filter-group">
                                <h4>타입별 필터</h4>
                                <div class="filter-buttons" id="type-filters">
                                    <button class="filter-btn" data-filter="type:wall">벽체</button>
                                    <button class="filter-btn" data-filter="type:block">블록</button>
                                    <button class="filter-btn" data-filter="type:foundation">기초</button>
                                    <button class="filter-btn" data-filter="type:reinforcement">보강재</button>
                                </div>
                            </div>
                            <button class="clear-filters-btn">모든 필터 해제</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 스타일 적용
        this.applyStyles(content);
        
        // 이벤트 리스너 설정
        this.setupUIEvents(content);
        
        // 초기 UI 업데이트
        this.refreshUI();
    }
    
    /**
     * 스타일 적용
     */
    applyStyles(container) {
        const style = document.createElement('style');
        style.textContent = `
            .object-visibility-plugin {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 12px;
                color: #e0e0e0;
            }
            
            .tab-navigation {
                display: flex;
                border-bottom: 1px solid #444;
                margin-bottom: 10px;
            }
            
            .tab-btn {
                flex: 1;
                padding: 8px 4px;
                border: none;
                background: transparent;
                color: #aaa;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
            }
            
            .tab-btn:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.1);
            }
            
            .tab-btn.active {
                color: #64b5f6;
                border-bottom-color: #64b5f6;
            }
            
            .search-tools {
                margin-bottom: 10px;
            }
            
            .search-box {
                position: relative;
                margin-bottom: 8px;
            }
            
            .search-input {
                width: 100%;
                padding: 6px 24px 6px 8px;
                border: 1px solid #444;
                border-radius: 4px;
                background: #2a2a2a;
                color: #e0e0e0;
                font-size: 11px;
            }
            
            .search-clear {
                position: absolute;
                right: 4px;
                top: 50%;
                transform: translateY(-50%);
                border: none;
                background: none;
                color: #aaa;
                cursor: pointer;
                padding: 2px;
            }
            
            .tool-buttons {
                display: flex;
                gap: 4px;
            }
            
            .tool-btn {
                padding: 4px 8px;
                border: 1px solid #444;
                border-radius: 3px;
                background: #2a2a2a;
                color: #e0e0e0;
                cursor: pointer;
                font-size: 10px;
                transition: all 0.2s;
            }
            
            .tool-btn:hover {
                background: #444;
                border-color: #666;
            }
            
            .stats-info {
                display: flex;
                gap: 12px;
                padding: 8px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 4px;
                margin-bottom: 10px;
                font-size: 10px;
            }
            
            .stat-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .stat-label {
                color: #aaa;
            }
            
            .stat-value {
                color: #64b5f6;
                font-weight: bold;
            }
            
            .tab-content {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .tab-panel {
                display: none;
            }
            
            .tab-panel.active {
                display: block;
            }
            
            .object-item, .group-item, .layer-item {
                display: flex;
                align-items: center;
                padding: 4px 8px;
                border-bottom: 1px solid #333;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .object-item:hover, .group-item:hover, .layer-item:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            
            .visibility-toggle {
                width: 16px;
                height: 16px;
                border: 1px solid #444;
                border-radius: 2px;
                margin-right: 8px;
                cursor: pointer;
                position: relative;
                background: #2a2a2a;
            }
            
            .visibility-toggle.visible {
                background: #4caf50;
                border-color: #4caf50;
            }
            
            .visibility-toggle.visible::after {
                content: '✓';
                position: absolute;
                color: white;
                font-size: 10px;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
            }
            
            .item-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .item-count {
                color: #aaa;
                font-size: 10px;
                margin-left: 8px;
            }
            
            .filter-group {
                margin-bottom: 15px;
            }
            
            .filter-group h4 {
                margin: 0 0 8px 0;
                color: #ccc;
                font-size: 11px;
            }
            
            .filter-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }
            
            .filter-btn {
                padding: 4px 8px;
                border: 1px solid #444;
                border-radius: 3px;
                background: #2a2a2a;
                color: #e0e0e0;
                cursor: pointer;
                font-size: 10px;
                transition: all 0.2s;
            }
            
            .filter-btn:hover {
                background: #444;
            }
            
            .filter-btn.active {
                background: #64b5f6;
                border-color: #64b5f6;
                color: white;
            }
            
            .clear-filters-btn {
                width: 100%;
                padding: 8px;
                border: 1px solid #f44336;
                border-radius: 4px;
                background: transparent;
                color: #f44336;
                cursor: pointer;
                margin-top: 10px;
                transition: all 0.2s;
            }
            
            .clear-filters-btn:hover {
                background: #f44336;
                color: white;
            }
            
            .highlighted {
                background: rgba(255, 255, 0, 0.2) !important;
                border-color: #ffeb3b !important;
            }
        `;
        
        if (!document.head.querySelector('#object-visibility-plugin-styles')) {
            style.id = 'object-visibility-plugin-styles';
            document.head.appendChild(style);
        }
    }
    
    /**
     * UI 이벤트 설정
     */
    setupUIEvents(container) {
        // 탭 네비게이션
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });
        
        // 검색
        const searchInput = container.querySelector('.search-input');
        const searchClear = container.querySelector('.search-clear');
        
        searchInput.addEventListener('input', (e) => {
            this.uiState.searchQuery = e.target.value;
            this.filterUI();
        });
        
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            this.uiState.searchQuery = '';
            this.filterUI();
        });
        
        // 도구 버튼들
        container.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleToolAction(btn.dataset.action);
            });
        });
        
        // 필터 버튼들
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.toggleFilter(btn);
            });
        });
        
        // 필터 초기화
        const clearFiltersBtn = container.querySelector('.clear-filters-btn');
        clearFiltersBtn.addEventListener('click', () => {
            this.clearAllFilters();
        });
    }
    
    /**
     * 탭 전환
     */
    switchTab(tabName) {
        this.uiState.activeTab = tabName;
        
        // 탭 버튼 상태 업데이트
        this.uiElements.get('container').querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // 탭 패널 상태 업데이트
        this.uiElements.get('container').querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.dataset.tab === tabName);
        });
        
        // 해당 탭 내용 새로고침
        this.refreshTabContent(tabName);
    }
    
    /**
     * 도구 액션 처리
     */
    handleToolAction(action) {
        switch (action) {
            case 'show-all':
                this.visibilityController.showAll(true);
                break;
            case 'hide-all':
                this.visibilityController.hideAll(true);
                break;
            case 'invert':
                this.visibilityController.invertVisibility(true);
                break;
            case 'save-state':
                this.saveState();
                break;
        }
    }
    
    /**
     * 필터 토글
     */
    toggleFilter(button) {
        const filter = button.dataset.filter;
        const isActive = button.classList.contains('active');
        
        if (isActive) {
            button.classList.remove('active');
            // 필터 해제 로직
        } else {
            button.classList.add('active');
            const [filterName, filterValue] = filter.split(':');
            this.visibilityController.applyFilter(filterName, filterValue, false);
        }
    }
    
    /**
     * 모든 필터 초기화
     */
    clearAllFilters() {
        this.visibilityController.clearFilters();
        
        // UI 상태 초기화
        this.uiElements.get('container').querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    /**
     * UI 새로고침
     */
    refreshUI() {
        this.refreshTabContent(this.uiState.activeTab);
        this.updateStats();
    }
    
    /**
     * 탭 콘텐츠 새로고침
     */
    refreshTabContent(tabName) {
        switch (tabName) {
            case 'objects':
                this.refreshObjectList();
                break;
            case 'groups':
                this.refreshGroupList();
                break;
            case 'layers':
                this.refreshLayerList();
                break;
            case 'filters':
                this.refreshFilterList();
                break;
        }
    }
    
    /**
     * 객체 리스트 새로고침
     */
    refreshObjectList() {
        const container = this.uiElements.get('container');
        const objectList = container.querySelector('#object-list');
        if (!objectList) return;
        
        objectList.innerHTML = '';
        
        this.visibilityController.objects.forEach((object, name) => {
            if (this.shouldShowItem(name)) {
                const item = this.createObjectItem(name, object);
                objectList.appendChild(item);
            }
        });
    }
    
    /**
     * 객체 아이템 생성
     */
    createObjectItem(name, object) {
        const isVisible = this.visibilityController.visibilityStates.get(name);
        const isHighlighted = this.visibilityController.highlightedObjects.has(name);
        
        const item = document.createElement('div');
        item.className = `object-item ${isHighlighted ? 'highlighted' : ''}`;
        item.dataset.objectName = name;
        
        item.innerHTML = `
            <div class="visibility-toggle ${isVisible ? 'visible' : ''}"></div>
            <span class="item-name" title="${name}">${name}</span>
        `;
        
        // 이벤트 리스너
        const toggle = item.querySelector('.visibility-toggle');
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.visibilityController.setObjectVisibility(name, !isVisible, true);
        });
        
        item.addEventListener('click', () => {
            this.visibilityController.highlightObject(name, !isHighlighted);
        });
        
        return item;
    }
    
    /**
     * 통계 업데이트
     */
    updateStats() {
        const container = this.uiElements.get('container');
        if (!container) return;
        
        const stats = this.visibilityController.getStatistics();
        
        const totalEl = container.querySelector('#total-objects');
        const visibleEl = container.querySelector('#visible-objects');
        const hiddenEl = container.querySelector('#hidden-objects');
        
        if (totalEl) totalEl.textContent = stats.totalObjects;
        if (visibleEl) visibleEl.textContent = stats.visibleObjects;
        if (hiddenEl) hiddenEl.textContent = stats.hiddenObjects;
    }
    
    /**
     * 아이템 표시 여부 확인
     */
    shouldShowItem(name) {
        if (!this.uiState.searchQuery) return true;
        return name.toLowerCase().includes(this.uiState.searchQuery.toLowerCase());
    }
    
    /**
     * 키보드 단축키 설정
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'h':
                        e.preventDefault();
                        this.visibilityController.hideAll(true);
                        break;
                    case 's':
                        if (e.shiftKey) {
                            e.preventDefault();
                            this.visibilityController.showAll(true);
                        }
                        break;
                    case 'i':
                        e.preventDefault();
                        this.visibilityController.invertVisibility(true);
                        break;
                }
            }
        });
    }
    
    /**
     * 자동 새로고침 시작
     */
    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            if (this.enabled && this.uiElements.get('container')) {
                this.updateStats();
            }
        }, this.config.ui.refreshInterval);
    }
    
    /**
     * 상태 저장
     */
    saveState() {
        const state = this.visibilityController.saveState();
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `visibility_state_${Date.now()}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        console.log('[ObjectVisibility] 상태 저장 완료');
    }
    
    /**
     * 플러그인 비활성화
     */
    onDisable() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        
        this.visibilityController.removeAllHighlights();
    }
    
    /**
     * 정리
     */
    onDestroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        if (this.visibilityController) {
            this.visibilityController.destroy();
        }
        
        // 스타일 제거
        const styleEl = document.querySelector('#object-visibility-plugin-styles');
        if (styleEl) {
            styleEl.remove();
        }
        
        console.log('[ObjectVisibility] 객체 가시성 제어 플러그인 정리 완료');
    }
    
    /**
     * 모델 변경 처리
     */
    onModelChanged(model) {
        if (this.visibilityController && model) {
            this.visibilityController.scanModel(model);
        }
    }
}

export default ObjectVisibilityPlugin;