// js/plugins/LightingControlPlugin.js
// 조명 제어 플러그인 - 실시간 조명 조절

import { Plugin } from '../PluginSystem.js';
import { getConfig, setConfig } from '../core/ConfigManager.js';

/**
 * 조명 제어 플러그인
 * - 실시간 조명 강도 조절
 * - 조명 색상 변경
 * - 조명 위치 조절
 * - 그림자 설정 제어
 * - 프리셋 시스템
 */
export class LightingControlPlugin extends Plugin {
    constructor(options = {}) {
        super('LightingControl', '1.0.0', {
            displayName: '조명 제어',
            ...options
        });
        
        // 조명 상태
        this.lightingState = {
            ambient: {
                intensity: 0.8,
                color: '#404040'
            },
            directional: {
                intensity: 1.2,
                color: '#ffffff',
                position: { x: 10, y: 10, z: 5 },
                castShadow: true
            },
            shadowQuality: 2048
        };
        
        // 프리셋
        this.presets = new Map();
        this.currentPreset = null;
        
        // UI 요소들
        this.controls = new Map();
    }
    
    /**
     * 기본 설정
     */
    async getDefaultConfig() {
        return {
            ...await super.getDefaultConfig(),
            
            // 조명 설정
            lighting: {
                enableAmbientControl: true,
                enableDirectionalControl: true,
                enableShadowControl: true,
                enableColorControl: true,
                enablePositionControl: true
            },
            
            // 프리셋
            presets: {
                daylight: {
                    name: '낮 조명',
                    ambient: { intensity: 0.6, color: '#87CEEB' },
                    directional: { intensity: 1.5, color: '#FFF8DC' }
                },
                sunset: {
                    name: '석양',
                    ambient: { intensity: 0.4, color: '#FF6347' },
                    directional: { intensity: 1.0, color: '#FF4500' }
                },
                night: {
                    name: '밤',
                    ambient: { intensity: 0.2, color: '#191970' },
                    directional: { intensity: 0.5, color: '#F0F8FF' }
                },
                studio: {
                    name: '스튜디오',
                    ambient: { intensity: 0.8, color: '#FFFFFF' },
                    directional: { intensity: 1.2, color: '#FFFFFF' }
                }
            },
            
            // UI 설정
            ui: {
                visible: true,
                position: 'right',
                collapsible: true,
                showPresets: true,
                showAdvanced: false
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
        // 현재 조명 상태 읽기
        this.readCurrentLighting();
        
        // 프리셋 로드
        this.loadPresets();
        
        console.log('[LightingControl] 조명 제어 플러그인 초기화됨');
    }
    
    /**
     * 현재 조명 상태 읽기
     */
    readCurrentLighting() {
        const sceneManager = this.context.sceneManager;
        if (!sceneManager) return;
        
        // 주변광
        const ambientLight = sceneManager.lights?.get('ambient');
        if (ambientLight) {
            this.lightingState.ambient.intensity = ambientLight.intensity;
            this.lightingState.ambient.color = `#${ambientLight.color.getHexString()}`;
        }
        
        // 직사광
        const directionalLight = sceneManager.lights?.get('directional');
        if (directionalLight) {
            this.lightingState.directional.intensity = directionalLight.intensity;
            this.lightingState.directional.color = `#${directionalLight.color.getHexString()}`;
            this.lightingState.directional.position = {
                x: directionalLight.position.x,
                y: directionalLight.position.y,
                z: directionalLight.position.z
            };
            this.lightingState.directional.castShadow = directionalLight.castShadow;
        }
    }
    
    /**
     * 프리셋 로드
     */
    loadPresets() {
        const presetConfig = this.config.presets;
        
        Object.entries(presetConfig).forEach(([key, preset]) => {
            this.presets.set(key, preset);
        });
        
        console.log(`[LightingControl] ${this.presets.size}개 프리셋 로드됨`);
    }
    
    /**
     * UI 생성
     */
    async onCreateUI(container) {
        const content = container.querySelector('.plugin-content');
        if (!content) return;
        
        // 프리셋 섹션
        if (this.config.ui.showPresets) {
            this.createPresetSection(content);
        }
        
        // 주변광 제어
        if (this.config.lighting.enableAmbientControl) {
            this.createAmbientSection(content);
        }
        
        // 직사광 제어
        if (this.config.lighting.enableDirectionalControl) {
            this.createDirectionalSection(content);
        }
        
        // 그림자 제어
        if (this.config.lighting.enableShadowControl) {
            this.createShadowSection(content);
        }
        
        // 고급 설정 (접기 가능)
        if (this.config.ui.showAdvanced) {
            this.createAdvancedSection(content);
        }
        
        // 하단 버튼들
        this.createActionButtons(content);
    }
    
    /**
     * 프리셋 섹션 생성
     */
    createPresetSection(container) {
        const section = document.createElement('div');
        section.className = 'lighting-section preset-section';
        section.innerHTML = '<h4>조명 프리셋</h4>';
        
        // 프리셋 버튼들
        const presetGrid = document.createElement('div');
        presetGrid.className = 'preset-grid';
        presetGrid.style.display = 'grid';
        presetGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        presetGrid.style.gap = '8px';
        presetGrid.style.marginBottom = '16px';
        
        this.presets.forEach((preset, key) => {
            const btn = this.createButton(preset.name, () => {
                this.applyPreset(key);
            }, { fullWidth: false });
            
            btn.style.padding = '6px 12px';
            btn.style.fontSize = '12px';
            btn.style.marginBottom = '0';
            
            presetGrid.appendChild(btn);
        });
        
        section.appendChild(presetGrid);
        container.appendChild(section);
    }
    
    /**
     * 주변광 섹션 생성
     */
    createAmbientSection(container) {
        const section = document.createElement('div');
        section.className = 'lighting-section ambient-section';
        section.innerHTML = '<h4>주변광 (Ambient Light)</h4>';
        
        // 강도 슬라이더
        const intensitySlider = this.createSlider(
            '강도',
            0, 2, this.lightingState.ambient.intensity,
            (value) => this.updateAmbientIntensity(value),
            { step: 0.1, decimals: 1 }
        );
        section.appendChild(intensitySlider);
        this.controls.set('ambientIntensity', intensitySlider);
        
        // 색상 제어
        if (this.config.lighting.enableColorControl) {
            const colorPicker = this.createColorPicker(
                '색상',
                this.lightingState.ambient.color,
                (color) => this.updateAmbientColor(color)
            );
            section.appendChild(colorPicker);
            this.controls.set('ambientColor', colorPicker);
        }
        
        container.appendChild(section);
    }
    
    /**
     * 직사광 섹션 생성
     */
    createDirectionalSection(container) {
        const section = document.createElement('div');
        section.className = 'lighting-section directional-section';
        section.innerHTML = '<h4>직사광 (Directional Light)</h4>';
        
        // 강도 슬라이더
        const intensitySlider = this.createSlider(
            '강도',
            0, 3, this.lightingState.directional.intensity,
            (value) => this.updateDirectionalIntensity(value),
            { step: 0.1, decimals: 1 }
        );
        section.appendChild(intensitySlider);
        this.controls.set('directionalIntensity', intensitySlider);
        
        // 색상 제어
        if (this.config.lighting.enableColorControl) {
            const colorPicker = this.createColorPicker(
                '색상',
                this.lightingState.directional.color,
                (color) => this.updateDirectionalColor(color)
            );
            section.appendChild(colorPicker);
            this.controls.set('directionalColor', colorPicker);
        }
        
        // 위치 제어
        if (this.config.lighting.enablePositionControl) {
            const posSection = this.createPositionControls();
            section.appendChild(posSection);
        }
        
        container.appendChild(section);
    }
    
    /**
     * 위치 제어 생성
     */
    createPositionControls() {
        const posSection = document.createElement('div');
        posSection.className = 'position-controls';
        posSection.innerHTML = '<h5>위치</h5>';
        
        // X, Y, Z 슬라이더
        const axes = ['x', 'y', 'z'];
        axes.forEach(axis => {
            const slider = this.createSlider(
                axis.toUpperCase(),
                -20, 20, this.lightingState.directional.position[axis],
                (value) => this.updateDirectionalPosition(axis, value),
                { step: 0.5, decimals: 1 }
            );
            posSection.appendChild(slider);
            this.controls.set(`directionalPos${axis.toUpperCase()}`, slider);
        });
        
        return posSection;
    }
    
    /**
     * 그림자 섹션 생성
     */
    createShadowSection(container) {
        const section = document.createElement('div');
        section.className = 'lighting-section shadow-section';
        section.innerHTML = '<h4>그림자</h4>';
        
        // 그림자 활성화
        const shadowToggle = this.createCheckbox(
            '그림자 활성화',
            this.lightingState.directional.castShadow,
            (checked) => this.updateShadowEnabled(checked)
        );
        section.appendChild(shadowToggle);
        this.controls.set('shadowEnabled', shadowToggle);
        
        // 그림자 품질
        const qualitySelect = this.createSelect(
            '그림자 품질',
            [
                { value: '512', label: '낮음 (512x512)' },
                { value: '1024', label: '보통 (1024x1024)' },
                { value: '2048', label: '높음 (2048x2048)' },
                { value: '4096', label: '최고 (4096x4096)' }
            ],
            this.lightingState.shadowQuality.toString(),
            (value) => this.updateShadowQuality(parseInt(value))
        );
        section.appendChild(qualitySelect);
        this.controls.set('shadowQuality', qualitySelect);
        
        container.appendChild(section);
    }
    
    /**
     * 고급 설정 섹션
     */
    createAdvancedSection(container) {
        const section = document.createElement('div');
        section.className = 'lighting-section advanced-section';
        
        const header = document.createElement('h4');
        header.textContent = '고급 설정';
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        
        const content = document.createElement('div');
        content.className = 'advanced-content';
        content.style.display = 'none';
        
        // 토글 기능
        header.addEventListener('click', () => {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            header.textContent = `고급 설정 ${isVisible ? '▼' : '▲'}`;
        });
        
        // 고급 제어들
        this.createAdvancedControls(content);
        
        section.appendChild(header);
        section.appendChild(content);
        container.appendChild(section);
    }
    
    /**
     * 고급 제어 생성
     */
    createAdvancedControls(container) {
        // 톤 매핑 노출값
        const exposureSlider = this.createSlider(
            '노출값',
            0.1, 3.0, getConfig('scene.renderer.exposure', 1.0),
            (value) => this.updateExposure(value),
            { step: 0.1, decimals: 1 }
        );
        container.appendChild(exposureSlider);
        
        // 환경 매핑 강도
        const envMapSlider = this.createSlider(
            '환경 매핑 강도',
            0, 2.0, getConfig('scene.material.envMapIntensity', 0.5),
            (value) => this.updateEnvMapIntensity(value),
            { step: 0.1, decimals: 1 }
        );
        container.appendChild(envMapSlider);
    }
    
    /**
     * 액션 버튼들
     */
    createActionButtons(container) {
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'action-buttons';
        buttonGroup.style.marginTop = '16px';
        buttonGroup.style.display = 'flex';
        buttonGroup.style.gap = '8px';
        
        // 리셋 버튼
        const resetBtn = this.createButton('기본값 복원', () => {
            this.resetToDefaults();
        }, { fullWidth: false });
        resetBtn.style.flex = '1';
        resetBtn.style.marginBottom = '0';
        
        // 저장 버튼
        const saveBtn = this.createButton('현재 설정 저장', () => {
            this.saveCurrentAsPreset();
        }, { fullWidth: false });
        saveBtn.style.flex = '1';
        saveBtn.style.marginBottom = '0';
        
        buttonGroup.appendChild(resetBtn);
        buttonGroup.appendChild(saveBtn);
        container.appendChild(buttonGroup);
    }
    
    /**
     * 색상 선택기 생성
     */
    createColorPicker(label, color, onChange) {
        const container = document.createElement('div');
        container.className = 'color-picker-container';
        container.style.marginBottom = '12px';
        
        container.innerHTML = `
            <label class="color-label">${label}</label>
            <div class="color-input-wrapper" style="display: flex; gap: 8px; align-items: center;">
                <input type="color" class="color-input" value="${color}" style="width: 40px; height: 30px; border: none; border-radius: 4px; cursor: pointer;">
                <input type="text" class="color-text" value="${color}" style="flex: 1; padding: 6px; border: 1px solid #666; border-radius: 4px; background: #333; color: #fff;">
            </div>
        `;
        
        const colorInput = container.querySelector('.color-input');
        const textInput = container.querySelector('.color-text');
        
        // 색상 변경 이벤트
        colorInput.addEventListener('input', (e) => {
            const color = e.target.value;
            textInput.value = color;
            if (onChange) onChange(color);
        });
        
        textInput.addEventListener('input', (e) => {
            const color = e.target.value;
            if (/^#[0-9A-F]{6}$/i.test(color)) {
                colorInput.value = color;
                if (onChange) onChange(color);
            }
        });
        
        return container;
    }
    
    /**
     * 조명 업데이트 메서드들
     */
    updateAmbientIntensity(intensity) {
        this.lightingState.ambient.intensity = intensity;
        this.applyAmbientLighting();
    }
    
    updateAmbientColor(color) {
        this.lightingState.ambient.color = color;
        this.applyAmbientLighting();
    }
    
    updateDirectionalIntensity(intensity) {
        this.lightingState.directional.intensity = intensity;
        this.applyDirectionalLighting();
    }
    
    updateDirectionalColor(color) {
        this.lightingState.directional.color = color;
        this.applyDirectionalLighting();
    }
    
    updateDirectionalPosition(axis, value) {
        this.lightingState.directional.position[axis] = value;
        this.applyDirectionalLighting();
    }
    
    updateShadowEnabled(enabled) {
        this.lightingState.directional.castShadow = enabled;
        this.applyDirectionalLighting();
    }
    
    updateShadowQuality(quality) {
        this.lightingState.shadowQuality = quality;
        this.applyShadowSettings();
    }
    
    updateExposure(exposure) {
        const sceneManager = this.context.sceneManager;
        if (sceneManager && sceneManager.renderer) {
            sceneManager.renderer.toneMappingExposure = exposure;
        }
        setConfig('scene.renderer.exposure', exposure);
    }
    
    updateEnvMapIntensity(intensity) {
        setConfig('scene.material.envMapIntensity', intensity);
        
        // 현재 모델의 재질에 적용
        const sceneManager = this.context.sceneManager;
        if (sceneManager && sceneManager.currentModel) {
            sceneManager.currentModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (child.material.isMeshStandardMaterial) {
                        child.material.envMapIntensity = intensity;
                    }
                }
            });
        }
    }
    
    /**
     * 조명 적용 메서드들
     */
    applyAmbientLighting() {
        const sceneManager = this.context.sceneManager;
        const ambientLight = sceneManager?.lights?.get('ambient');
        
        if (ambientLight) {
            ambientLight.intensity = this.lightingState.ambient.intensity;
            ambientLight.color.setHex(this.lightingState.ambient.color.replace('#', '0x'));
        }
        
        // 설정에도 저장
        setConfig('scene.lighting.ambient.intensity', this.lightingState.ambient.intensity);
        setConfig('scene.lighting.ambient.color', parseInt(this.lightingState.ambient.color.replace('#', '0x')));
    }
    
    applyDirectionalLighting() {
        const sceneManager = this.context.sceneManager;
        const directionalLight = sceneManager?.lights?.get('directional');
        
        if (directionalLight) {
            directionalLight.intensity = this.lightingState.directional.intensity;
            directionalLight.color.setHex(this.lightingState.directional.color.replace('#', '0x'));
            
            const pos = this.lightingState.directional.position;
            directionalLight.position.set(pos.x, pos.y, pos.z);
            
            directionalLight.castShadow = this.lightingState.directional.castShadow;
        }
        
        // 설정에도 저장
        setConfig('scene.lighting.directional.intensity', this.lightingState.directional.intensity);
        setConfig('scene.lighting.directional.color', parseInt(this.lightingState.directional.color.replace('#', '0x')));
        setConfig('scene.lighting.directional.position', this.lightingState.directional.position);
        setConfig('scene.lighting.directional.castShadow', this.lightingState.directional.castShadow);
    }
    
    applyShadowSettings() {
        const sceneManager = this.context.sceneManager;
        const directionalLight = sceneManager?.lights?.get('directional');
        
        if (directionalLight && directionalLight.shadow) {
            const quality = this.lightingState.shadowQuality;
            directionalLight.shadow.mapSize.width = quality;
            directionalLight.shadow.mapSize.height = quality;
            
            // 그림자 맵 업데이트 (필요시 재생성)
            if (directionalLight.shadow.map) {
                directionalLight.shadow.map.dispose();
                directionalLight.shadow.map = null;
            }
        }
        
        setConfig('scene.renderer.shadowMapSize', this.lightingState.shadowQuality);
    }
    
    /**
     * 프리셋 적용
     */
    applyPreset(presetKey) {
        const preset = this.presets.get(presetKey);
        if (!preset) return;
        
        // 주변광 적용
        if (preset.ambient) {
            this.lightingState.ambient = { ...preset.ambient };
            this.applyAmbientLighting();
        }
        
        // 직사광 적용
        if (preset.directional) {
            this.lightingState.directional = { 
                ...this.lightingState.directional,
                ...preset.directional 
            };
            this.applyDirectionalLighting();
        }
        
        // UI 업데이트
        this.updateUIControls();
        
        this.currentPreset = presetKey;
        console.log(`[LightingControl] 프리셋 적용: ${preset.name}`);
    }
    
    /**
     * UI 컨트롤 업데이트
     */
    updateUIControls() {
        // 주변광 강도 슬라이더
        const ambientSlider = this.controls.get('ambientIntensity')?.querySelector('.slider');
        if (ambientSlider) {
            ambientSlider.value = this.lightingState.ambient.intensity;
            ambientSlider.nextElementSibling.textContent = this.lightingState.ambient.intensity.toFixed(1);
        }
        
        // 직사광 강도 슬라이더
        const directionalSlider = this.controls.get('directionalIntensity')?.querySelector('.slider');
        if (directionalSlider) {
            directionalSlider.value = this.lightingState.directional.intensity;
            directionalSlider.nextElementSibling.textContent = this.lightingState.directional.intensity.toFixed(1);
        }
        
        // 색상 선택기들
        const ambientColor = this.controls.get('ambientColor');
        if (ambientColor) {
            const colorInput = ambientColor.querySelector('.color-input');
            const textInput = ambientColor.querySelector('.color-text');
            if (colorInput) colorInput.value = this.lightingState.ambient.color;
            if (textInput) textInput.value = this.lightingState.ambient.color;
        }
        
        const directionalColor = this.controls.get('directionalColor');
        if (directionalColor) {
            const colorInput = directionalColor.querySelector('.color-input');
            const textInput = directionalColor.querySelector('.color-text');
            if (colorInput) colorInput.value = this.lightingState.directional.color;
            if (textInput) textInput.value = this.lightingState.directional.color;
        }
        
        // 위치 슬라이더들
        ['x', 'y', 'z'].forEach(axis => {
            const posSlider = this.controls.get(`directionalPos${axis.toUpperCase()}`)?.querySelector('.slider');
            if (posSlider) {
                posSlider.value = this.lightingState.directional.position[axis];
                posSlider.nextElementSibling.textContent = this.lightingState.directional.position[axis].toFixed(1);
            }
        });
    }
    
    /**
     * 기본값 복원
     */
    resetToDefaults() {
        const defaultLighting = getConfig('scene.lighting');
        
        // 기본 상태로 복원
        if (defaultLighting.ambient) {
            this.lightingState.ambient = {
                intensity: defaultLighting.ambient.intensity,
                color: `#${defaultLighting.ambient.color.toString(16).padStart(6, '0')}`
            };
        }
        
        if (defaultLighting.directional) {
            this.lightingState.directional = {
                intensity: defaultLighting.directional.intensity,
                color: `#${defaultLighting.directional.color.toString(16).padStart(6, '0')}`,
                position: { ...defaultLighting.directional.position },
                castShadow: defaultLighting.directional.castShadow
            };
        }
        
        // 적용 및 UI 업데이트
        this.applyAmbientLighting();
        this.applyDirectionalLighting();
        this.updateUIControls();
        
        console.log('[LightingControl] 기본값으로 복원됨');
    }
    
    /**
     * 현재 설정을 프리셋으로 저장
     */
    saveCurrentAsPreset() {
        const name = prompt('프리셋 이름을 입력하세요:', `사용자 프리셋 ${Date.now()}`);
        if (!name) return;
        
        const presetKey = `user_${Date.now()}`;
        const preset = {
            name: name,
            ambient: { ...this.lightingState.ambient },
            directional: {
                intensity: this.lightingState.directional.intensity,
                color: this.lightingState.directional.color
            }
        };
        
        this.presets.set(presetKey, preset);
        
        // 설정에 저장
        const userPresets = getConfig(`${this.configNamespace}.userPresets`, {});
        userPresets[presetKey] = preset;
        setConfig(`${this.configNamespace}.userPresets`, userPresets);
        
        console.log(`[LightingControl] 프리셋 저장됨: ${name}`);
        
        // UI 갱신 (선택적)
        // this.rebuildPresetSection();
    }
    
    /**
     * 설정 변경 처리
     */
    onConfigChange(key, value) {
        // 조명 관련 설정이 외부에서 변경된 경우
        if (key.startsWith('scene.lighting')) {
            this.readCurrentLighting();
            this.updateUIControls();
        }
    }
    
    /**
     * 업데이트 (필요시)
     */
    onUpdate(deltaTime) {
        // 실시간 업데이트가 필요한 경우 여기에 구현
    }
    
    /**
     * 정리
     */
    onDestroy() {
        // 정리 작업
        this.controls.clear();
        this.presets.clear();
    }
}

export default LightingControlPlugin;