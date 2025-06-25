// js/PluginSystem.js
// 완전한 플러그인 아키텍처 - ConfigManager 기반

import { getConfig, setConfig } from './core/ConfigManager.js';

/**
 * 플러그인 베이스 클래스
 * 모든 플러그인이 상속받아야 하는 기본 클래스
 */
export class Plugin {
    constructor(name, version = '1.0.0', options = {}) {
        this.name = name;
        this.version = version;
        this.options = { ...options };
        
        // 플러그인 상태
        this.enabled = true;
        this.initialized = false;
        this.destroyed = false;
        
        // 앱 컨텍스트 (의존성 주입)
        this.context = null;
        
        // UI 요소들
        this.uiElements = new Map();
        
        // 이벤트 시스템
        this.events = new Map();
        
        // 설정 네임스페이스
        this.configNamespace = `plugins.${name}`;
        
        console.log(`[Plugin] ${name} v${version} 생성됨`);
    }
    
    /**
     * 플러그인 초기화
     * @param {Object} context - 앱 컨텍스트 (services, config 등)
     */
    async init(context) {
        if (this.initialized) {
            console.warn(`[Plugin] ${this.name}이 이미 초기화되었습니다.`);
            return;
        }
        
        this.context = context;
        
        try {
            // 설정 로드
            await this.loadConfig();
            
            // 의존성 확인
            await this.checkDependencies();
            
            // 플러그인별 초기화
            await this.onInit();
            
            // UI 생성
            if (this.shouldCreateUI()) {
                await this.createUI();
            }
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            this.initialized = true;
            this.emit('initialized');
            
            console.log(`[Plugin] ${this.name} 초기화 완료`);
            
        } catch (error) {
            console.error(`[Plugin] ${this.name} 초기화 실패:`, error);
            throw error;
        }
    }
    
    /**
     * 설정 로드
     */
    async loadConfig() {
        const defaultConfig = await this.getDefaultConfig();
        const userConfig = getConfig(this.configNamespace, {});
        
        // 기본 설정과 사용자 설정 병합
        const mergedConfig = { ...defaultConfig, ...userConfig };
        setConfig(this.configNamespace, mergedConfig);
        
        this.config = mergedConfig;
    }
    
    /**
     * 기본 설정 가져오기 (서브클래스에서 오버라이드)
     */
    async getDefaultConfig() {
        return {
            enabled: true,
            autoStart: true,
            ui: {
                visible: true,
                position: 'right',
                collapsible: true
            }
        };
    }
    
    /**
     * 의존성 확인
     */
    async checkDependencies() {
        const dependencies = this.getDependencies();
        
        for (const dep of dependencies) {
            if (!this.context[dep]) {
                throw new Error(`필수 의존성이 없습니다: ${dep}`);
            }
        }
    }
    
    /**
     * 의존성 목록 (서브클래스에서 오버라이드)
     */
    getDependencies() {
        return []; // 예: ['sceneManager', 'modelLoader']
    }
    
    /**
     * UI 생성 여부 결정
     */
    shouldCreateUI() {
        return this.config.ui && this.config.ui.visible;
    }
    
    /**
     * UI 생성
     */
    async createUI() {
        // 플러그인 컨테이너 찾기/생성
        const container = this.getOrCreatePluginContainer();
        
        // 플러그인 패널 생성
        const panel = this.createPluginPanel();
        container.appendChild(panel);
        
        // UI 요소 등록
        this.uiElements.set('panel', panel);
        
        // 플러그인별 UI 생성
        await this.onCreateUI(panel);
        
        // UI 이벤트 설정
        this.setupUIEvents();
    }
    
    /**
     * 플러그인 컨테이너 가져오기/생성
     */
    getOrCreatePluginContainer() {
        const containerId = getConfig('selectors.pluginContainer', '#plugin-container');
        let container = document.querySelector(containerId);
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'plugin-container';
            container.className = 'plugin-container';
            
            // 기본 스타일 적용
            this.applyContainerStyles(container);
            
            // 적절한 위치에 추가
            const targetContainer = this.findPluginTarget();
            targetContainer.appendChild(container);
        }
        
        return container;
    }
    
    /**
     * 플러그인 대상 컨테이너 찾기
     */
    findPluginTarget() {
        const candidates = [
            '#control-panel',
            '#right-panel', 
            '#left-panel',
            '.viewer-container',
            'body'
        ];
        
        for (const selector of candidates) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        
        return document.body;
    }
    
    /**
     * 컨테이너 스타일 적용
     */
    applyContainerStyles(container) {
        Object.assign(container.style, {
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: '1000',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto'
        });
    }
    
    /**
     * 플러그인 패널 생성
     */
    createPluginPanel() {
        const panel = document.createElement('div');
        panel.className = 'plugin-panel';
        panel.dataset.plugin = this.name;
        
        // 기본 구조 생성
        panel.innerHTML = `
            <div class="plugin-header">
                <h4 class="plugin-title">${this.getDisplayName()}</h4>
                <div class="plugin-controls">
                    ${this.config.ui.collapsible ? `
                        <button class="plugin-toggle" title="접기/펼치기">
                            <span class="toggle-icon">−</span>
                        </button>
                    ` : ''}
                    <button class="plugin-close" title="닫기">
                        <span class="close-icon">×</span>
                    </button>
                </div>
            </div>
            <div class="plugin-content">
                <!-- 플러그인별 내용이 여기에 추가됨 -->
            </div>
        `;
        
        // 스타일 적용
        this.applyPanelStyles(panel);
        
        return panel;
    }
    
    /**
     * 패널 스타일 적용
     */
    applyPanelStyles(panel) {
        const theme = getConfig('ui.theme', 'dark');
        
        const baseStyles = {
            background: theme === 'dark' ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            border: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}`,
            borderRadius: '8px',
            backdropFilter: 'blur(10px)',
            color: theme === 'dark' ? '#fff' : '#333',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            minWidth: '250px',
            maxWidth: '400px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        };
        
        Object.assign(panel.style, baseStyles);
        
        // 헤더 스타일
        const header = panel.querySelector('.plugin-header');
        if (header) {
            Object.assign(header.style, {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                cursor: this.config.ui.collapsible ? 'pointer' : 'default'
            });
        }
        
        // 제목 스타일
        const title = panel.querySelector('.plugin-title');
        if (title) {
            Object.assign(title.style, {
                margin: '0',
                fontSize: '16px',
                fontWeight: '600'
            });
        }
        
        // 컨트롤 버튼 스타일
        const controls = panel.querySelectorAll('.plugin-toggle, .plugin-close');
        controls.forEach(btn => {
            Object.assign(btn.style, {
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '16px',
                opacity: '0.7',
                transition: 'opacity 0.2s ease'
            });
            
            btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
            btn.addEventListener('mouseleave', () => btn.style.opacity = '0.7');
        });
        
        // 내용 영역 스타일
        const content = panel.querySelector('.plugin-content');
        if (content) {
            Object.assign(content.style, {
                padding: '16px'
            });
        }
    }
    
    /**
     * UI 이벤트 설정
     */
    setupUIEvents() {
        const panel = this.uiElements.get('panel');
        if (!panel) return;
        
        // 토글 버튼
        const toggleBtn = panel.querySelector('.plugin-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.togglePanel();
            });
        }
        
        // 닫기 버튼
        const closeBtn = panel.querySelector('.plugin-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hidePanel();
            });
        }
        
        // 헤더 클릭으로 토글 (접기 가능한 경우)
        if (this.config.ui.collapsible) {
            const header = panel.querySelector('.plugin-header');
            if (header) {
                header.addEventListener('click', () => {
                    this.togglePanel();
                });
            }
        }
    }
    
    /**
     * 패널 토글
     */
    togglePanel() {
        const panel = this.uiElements.get('panel');
        const content = panel?.querySelector('.plugin-content');
        const toggleIcon = panel?.querySelector('.toggle-icon');
        
        if (!content || !toggleIcon) return;
        
        const isCollapsed = content.style.display === 'none';
        
        content.style.display = isCollapsed ? 'block' : 'none';
        toggleIcon.textContent = isCollapsed ? '−' : '+';
        
        this.emit('panel:toggle', !isCollapsed);
    }
    
    /**
     * 패널 숨김
     */
    hidePanel() {
        const panel = this.uiElements.get('panel');
        if (panel) {
            panel.style.display = 'none';
            this.emit('panel:hide');
        }
    }
    
    /**
     * 패널 표시
     */
    showPanel() {
        const panel = this.uiElements.get('panel');
        if (panel) {
            panel.style.display = 'block';
            this.emit('panel:show');
        }
    }
    
    /**
     * UI 요소 생성 헬퍼들
     */
    createButton(text, onClick, options = {}) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = 'plugin-button';
        
        // 기본 스타일
        const theme = getConfig('ui.theme', 'dark');
        Object.assign(btn.style, {
            background: theme === 'dark' ? '#444' : '#f0f0f0',
            border: `1px solid ${theme === 'dark' ? '#666' : '#ccc'}`,
            color: theme === 'dark' ? '#fff' : '#333',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease',
            width: options.fullWidth ? '100%' : 'auto',
            marginBottom: options.marginBottom || '8px'
        });
        
        // 호버 효과
        btn.addEventListener('mouseenter', () => {
            btn.style.background = theme === 'dark' ? '#555' : '#e0e0e0';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = theme === 'dark' ? '#444' : '#f0f0f0';
        });
        
        // 클릭 이벤트
        if (onClick) {
            btn.addEventListener('click', onClick);
        }
        
        return btn;
    }
    
    createSlider(label, min, max, value, onChange, options = {}) {
        const container = document.createElement('div');
        container.className = 'plugin-slider-container';
        
        container.innerHTML = `
            <label class="slider-label">${label}</label>
            <div class="slider-wrapper">
                <input type="range" class="slider" 
                       min="${min}" max="${max}" value="${value}" 
                       step="${options.step || 0.1}">
                <span class="slider-value">${value}</span>
            </div>
        `;
        
        // 스타일 적용
        const slider = container.querySelector('.slider');
        const valueSpan = container.querySelector('.slider-value');
        
        Object.assign(container.style, {
            marginBottom: '12px'
        });
        
        Object.assign(slider.style, {
            width: '100%',
            marginRight: '8px'
        });
        
        // 변경 이벤트
        slider.addEventListener('input', (e) => {
            const newValue = parseFloat(e.target.value);
            valueSpan.textContent = newValue.toFixed(options.decimals || 1);
            if (onChange) onChange(newValue);
        });
        
        return container;
    }
    
    createSelect(label, options, value, onChange) {
        const container = document.createElement('div');
        container.className = 'plugin-select-container';
        
        const select = document.createElement('select');
        select.className = 'plugin-select';
        
        // 옵션 추가
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            optionElement.selected = option.value === value;
            select.appendChild(optionElement);
        });
        
        container.innerHTML = `<label class="select-label">${label}</label>`;
        container.appendChild(select);
        
        // 스타일 적용
        const theme = getConfig('ui.theme', 'dark');
        Object.assign(select.style, {
            width: '100%',
            padding: '6px',
            border: `1px solid ${theme === 'dark' ? '#666' : '#ccc'}`,
            borderRadius: '4px',
            background: theme === 'dark' ? '#333' : '#fff',
            color: theme === 'dark' ? '#fff' : '#333',
            fontSize: '14px'
        });
        
        Object.assign(container.style, {
            marginBottom: '12px'
        });
        
        // 변경 이벤트
        if (onChange) {
            select.addEventListener('change', (e) => {
                onChange(e.target.value);
            });
        }
        
        return container;
    }
    
    createCheckbox(label, checked, onChange) {
        const container = document.createElement('div');
        container.className = 'plugin-checkbox-container';
        
        container.innerHTML = `
            <label class="checkbox-label">
                <input type="checkbox" class="checkbox" ${checked ? 'checked' : ''}>
                <span class="checkbox-text">${label}</span>
            </label>
        `;
        
        const checkbox = container.querySelector('.checkbox');
        
        // 스타일 적용
        Object.assign(container.style, {
            marginBottom: '8px'
        });
        
        // 변경 이벤트
        if (onChange) {
            checkbox.addEventListener('change', (e) => {
                onChange(e.target.checked);
            });
        }
        
        return container;
    }
    
    /**
     * 플러그인 표시 이름
     */
    getDisplayName() {
        return this.options.displayName || this.name;
    }
    
    /**
     * 이벤트 리스너 설정 (서브클래스에서 오버라이드)
     */
    setupEventListeners() {
        // 기본적으로 아무것도 하지 않음
    }
    
    /**
     * 플러그인 활성화
     */
    enable() {
        if (this.enabled) return;
        
        this.enabled = true;
        
        // UI 표시
        if (this.uiElements.has('panel')) {
            this.showPanel();
        }
        
        // 플러그인별 활성화 로직
        this.onEnable();
        
        this.emit('enabled');
        console.log(`[Plugin] ${this.name} 활성화됨`);
    }
    
    /**
     * 플러그인 비활성화
     */
    disable() {
        if (!this.enabled) return;
        
        this.enabled = false;
        
        // UI 숨김
        if (this.uiElements.has('panel')) {
            this.hidePanel();
        }
        
        // 플러그인별 비활성화 로직
        this.onDisable();
        
        this.emit('disabled');
        console.log(`[Plugin] ${this.name} 비활성화됨`);
    }
    
    /**
     * 플러그인 업데이트 (매 프레임)
     */
    update(deltaTime) {
        if (!this.enabled || !this.initialized) return;
        
        this.onUpdate(deltaTime);
    }
    
    /**
     * 설정 저장
     */
    saveConfig() {
        setConfig(this.configNamespace, this.config);
    }
    
    /**
     * 설정 값 가져오기
     */
    getConfigValue(key, defaultValue) {
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }
    
    /**
     * 설정 값 설정
     */
    setConfigValue(key, value) {
        this.config[key] = value;
        this.saveConfig();
        this.onConfigChange(key, value);
    }
    
    /**
     * 정리
     */
    destroy() {
        if (this.destroyed) return;
        
        console.log(`[Plugin] ${this.name} 정리 중...`);
        
        // 플러그인별 정리
        this.onDestroy();
        
        // UI 제거
        this.uiElements.forEach(element => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        this.uiElements.clear();
        
        // 이벤트 정리
        this.events.clear();
        
        this.destroyed = true;
        this.initialized = false;
        
        this.emit('destroyed');
        console.log(`[Plugin] ${this.name} 정리 완료`);
    }
    
    /**
     * 서브클래스에서 오버라이드할 메서드들
     */
    async onInit() {
        // 플러그인별 초기화 로직
    }
    
    async onCreateUI(container) {
        // 플러그인별 UI 생성 로직
    }
    
    onEnable() {
        // 플러그인별 활성화 로직
    }
    
    onDisable() {
        // 플러그인별 비활성화 로직
    }
    
    onUpdate(deltaTime) {
        // 플러그인별 업데이트 로직
    }
    
    onConfigChange(key, value) {
        // 설정 변경 시 로직
    }
    
    onDestroy() {
        // 플러그인별 정리 로직
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
                    console.error(`[Plugin] ${this.name} 이벤트 콜백 오류 (${event}):`, error);
                }
            });
        }
    }
}

/**
 * 플러그인 매니저 클래스
 * 플러그인들의 생명주기를 관리
 */
export class PluginManager {
    constructor(app) {
        this.app = app;
        this.plugins = new Map();
        this.loadOrder = [];
        
        // 앱 컨텍스트 생성
        this.context = {
            app: app,
            sceneManager: app.sceneManager,
            modelLoader: app.modelLoader,
            uiController: app.uiController,
            hotspotManager: app.hotspotManager,
            animationController: app.animationController
        };
        
        console.log('[PluginManager] 초기화됨');
    }
    
    /**
     * 플러그인 등록
     */
    async register(PluginClass, options = {}) {
        try {
            // 플러그인 인스턴스 생성
            const plugin = new PluginClass(options);
            
            // 중복 확인
            if (this.plugins.has(plugin.name)) {
                console.warn(`[PluginManager] 플러그인이 이미 등록됨: ${plugin.name}`);
                return this.plugins.get(plugin.name);
            }
            
            // 초기화
            await plugin.init(this.context);
            
            // 등록
            this.plugins.set(plugin.name, plugin);
            this.loadOrder.push(plugin.name);
            
            console.log(`[PluginManager] 플러그인 등록됨: ${plugin.name} v${plugin.version}`);
            
            return plugin;
            
        } catch (error) {
            console.error(`[PluginManager] 플러그인 등록 실패:`, error);
            throw error;
        }
    }
    
    /**
     * 플러그인 제거
     */
    unregister(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            console.warn(`[PluginManager] 플러그인을 찾을 수 없음: ${pluginName}`);
            return false;
        }
        
        // 정리
        plugin.destroy();
        
        // 제거
        this.plugins.delete(pluginName);
        const index = this.loadOrder.indexOf(pluginName);
        if (index > -1) {
            this.loadOrder.splice(index, 1);
        }
        
        console.log(`[PluginManager] 플러그인 제거됨: ${pluginName}`);
        return true;
    }
    
    /**
     * 플러그인 가져오기
     */
    get(pluginName) {
        return this.plugins.get(pluginName);
    }
    
    /**
     * 모든 플러그인 가져오기
     */
    getAll() {
        return Array.from(this.plugins.values());
    }
    
    /**
     * 활성화된 플러그인 가져오기
     */
    getEnabled() {
        return this.getAll().filter(plugin => plugin.enabled);
    }
    
    /**
     * 플러그인 활성화/비활성화
     */
    enable(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (plugin) {
            plugin.enable();
            return true;
        }
        return false;
    }
    
    disable(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (plugin) {
            plugin.disable();
            return true;
        }
        return false;
    }
    
    /**
     * 모든 플러그인 업데이트
     */
    updateAll(deltaTime) {
        this.plugins.forEach(plugin => {
            if (plugin.enabled && plugin.initialized) {
                plugin.update(deltaTime);
            }
        });
    }
    
    /**
     * 플러그인 자동 로드
     */
    async autoLoad() {
        const autoLoadPlugins = getConfig('plugins.autoLoad', []);
        
        for (const pluginPath of autoLoadPlugins) {
            try {
                await this.loadPluginFromPath(pluginPath);
            } catch (error) {
                console.error(`[PluginManager] 자동 로드 실패: ${pluginPath}`, error);
            }
        }
    }
    
    /**
     * 경로에서 플러그인 로드
     */
    async loadPluginFromPath(pluginPath) {
        const module = await import(pluginPath);
        const PluginClass = module.default || module[Object.keys(module)[0]];
        
        if (PluginClass && PluginClass.prototype instanceof Plugin) {
            return await this.register(PluginClass);
        } else {
            throw new Error(`유효하지 않은 플러그인 클래스: ${pluginPath}`);
        }
    }
    
    /**
     * 모든 플러그인 정리
     */
    destroyAll() {
        console.log('[PluginManager] 모든 플러그인 정리 중...');
        
        // 로드 순서의 역순으로 정리
        const reverseOrder = [...this.loadOrder].reverse();
        
        reverseOrder.forEach(pluginName => {
            const plugin = this.plugins.get(pluginName);
            if (plugin) {
                plugin.destroy();
            }
        });
        
        this.plugins.clear();
        this.loadOrder = [];
        
        console.log('[PluginManager] 모든 플러그인 정리 완료');
    }
    
    /**
     * 플러그인 상태 정보
     */
    getStatus() {
        const status = {
            total: this.plugins.size,
            enabled: 0,
            disabled: 0,
            plugins: []
        };
        
        this.plugins.forEach(plugin => {
            if (plugin.enabled) {
                status.enabled++;
            } else {
                status.disabled++;
            }
            
            status.plugins.push({
                name: plugin.name,
                version: plugin.version,
                enabled: plugin.enabled,
                initialized: plugin.initialized
            });
        });
        
        return status;
    }
    
    /**
     * 디버그 정보
     */
    debug() {
        if (!getConfig('app.debug')) return;
        
        console.group('[PluginManager] 디버그 정보');
        console.log('총 플러그인 수:', this.plugins.size);
        console.log('로드 순서:', this.loadOrder);
        console.log('상태:', this.getStatus());
        console.groupEnd();
    }
}

export default { Plugin, PluginManager };