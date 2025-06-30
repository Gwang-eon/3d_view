// js/sensor-data-loader.js - 센서 데이터 로더 모듈

export class SensorDataLoader {
    constructor() {
        this.dataCache = null;
        this.currentModel = null;
        this.dataPath = './sensor-data.json';  // 수정됨: ./data/ 제거
    }
    
    /**
     * 센서 데이터 로드
     */
    async loadData() {
        if (this.dataCache) {
            return this.dataCache;
        }
        
        try {
            const response = await fetch(this.dataPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.dataCache = await response.json();
            console.log('✅ 센서 데이터 로드 완료');
            return this.dataCache;
            
        } catch (error) {
            console.error('❌ 센서 데이터 로드 실패:', error);
            // 폴백: 기본 데이터 반환
            return this.getDefaultData();
        }
    }
    
    /**
     * 모델별 센서 데이터 가져오기
     */
    async getModelData(modelName) {
        const data = await this.loadData();
        return data[modelName] || data['Block_Retaining_Wall']; // 기본값
    }
    
    /**
     * 시나리오별 데이터 생성
     */
    generateScenarioData(modelName, currentFrame, maxFrame) {
        const modelData = this.dataCache?.[modelName];
        if (!modelData) {
            return this.generateDefaultData(currentFrame, maxFrame);
        }
        
        const fps = modelData.fps || 30;
        const crackFrame = modelData.crackFrame || 30;
        const scenarios = modelData.scenarios;
        
        // 프레임 기반으로 시나리오 결정
        let scenario;
        if (currentFrame < 15) {
            scenario = scenarios.normal;
        } else if (currentFrame < 25) {
            scenario = scenarios.warning;
        } else {
            scenario = scenarios.danger;
        }
        
        return this.generateDataFromScenario(scenario, currentFrame, fps);
    }
    
    /**
     * 시나리오 기반 데이터 생성
     */
    generateDataFromScenario(scenario, currentFrame, fps) {
        const times = [];
        const data = {
            tilt: { x: [], y: [], z: [] },
            crack: []
        };
        
        // 시간 배열 생성
        for (let i = 0; i <= currentFrame; i++) {
            times.push(i / fps);
        }
        
        // 각 센서별 데이터 생성
        times.forEach((time, index) => {
            const frame = index;
            const progress = frame / currentFrame;
            
            // 기울기 센서
            ['x', 'y', 'z'].forEach(axis => {
                const config = scenario.data.tilt[axis];
                const value = this.generateValue(config, progress, frame);
                data.tilt[axis].push({ x: time, y: value });
            });
            
            // 균열 센서
            const crackConfig = scenario.data.crack;
            const crackValue = this.generateValue(crackConfig, progress, frame);
            data.crack.push({ x: time, y: Math.max(0, crackValue) });
        });
        
        return data;
    }
    
    /**
     * 패턴별 값 생성
     */
    generateValue(config, progress, frame) {
        const { min, max, peak, pattern } = config;
        
        switch (pattern) {
            case 'random':
                return this.randomInRange(min, max);
                
            case 'stable':
                return (min + max) / 2 + this.randomInRange(-0.01, 0.01);
                
            case 'sine_wave':
                return min + (max - min) * (0.5 + 0.5 * Math.sin(frame * 0.1));
                
            case 'gradual_increase':
                return min + (max - min) * progress + this.randomInRange(-0.05, 0.05);
                
            case 'linear_increase':
                return min + (max - min) * progress;
                
            case 'step_increase':
                const steps = 5;
                const step = Math.floor(progress * steps) / steps;
                return min + (max - min) * step;
                
            case 'exponential':
                const expValue = min + (max - min) * Math.pow(progress, 2);
                if (peak && progress > 0.9) {
                    return expValue + (peak - max) * ((progress - 0.9) / 0.1);
                }
                return expValue;
                
            case 'sudden_spike':
                if (progress < 0.8) {
                    return min + (max - min) * progress * 0.5;
                } else if (progress < 0.95) {
                    return max;
                } else {
                    return peak || max * 1.5;
                }
                
            default:
                return this.randomInRange(min, max);
        }
    }
    
    /**
     * 미리 계산된 전체 데이터 생성
     */
    async generateFullDataset(modelName, maxFrame = 30) {
        await this.loadData();
        
        const modelData = this.dataCache?.[modelName];
        if (!modelData) {
            return null;
        }
        
        const fps = modelData.fps || 30;
        const dataset = [];
        
        // 각 프레임별 데이터 생성
        for (let frame = 0; frame <= maxFrame; frame++) {
            const time = frame / fps;
            const frameData = {
                frame: frame,
                time: time,
                tilt: { x: 0, y: 0, z: 0 },
                crack: 0
            };
            
            // 시나리오 결정
            let scenario;
            if (frame < 15) {
                scenario = modelData.scenarios.normal;
            } else if (frame < 23) {
                scenario = modelData.scenarios.warning;
            } else {
                scenario = modelData.scenarios.danger;
            }
            
            const progress = frame / maxFrame;
            
            // 값 생성
            ['x', 'y', 'z'].forEach(axis => {
                frameData.tilt[axis] = this.generateValue(
                    scenario.data.tilt[axis], 
                    progress, 
                    frame
                );
            });
            
            frameData.crack = this.generateValue(
                scenario.data.crack, 
                progress, 
                frame
            );
            
            dataset.push(frameData);
        }
        
        return dataset;
    }
    
    /**
     * 기본 데이터 (폴백)
     */
    getDefaultData() {
        return {
            "Default": {
                "name": "기본 센서 데이터",
                "fps": 30,
                "crackFrame": 30,
                "scenarios": {
                    "normal": {
                        "name": "정상 상태",
                        "data": {
                            "tilt": {
                                "x": { "min": -0.05, "max": 0.05, "pattern": "random" },
                                "y": { "min": -0.05, "max": 0.05, "pattern": "random" },
                                "z": { "min": -0.05, "max": 0.05, "pattern": "random" }
                            },
                            "crack": { "min": 0, "max": 0.1, "pattern": "stable" }
                        }
                    },
                    "warning": {
                        "name": "경고 상태",
                        "transitionFrame": 20,
                        "data": {
                            "tilt": {
                                "x": { "min": 0.5, "max": 0.8, "pattern": "gradual_increase" },
                                "y": { "min": 0.5, "max": 0.8, "pattern": "gradual_increase" },
                                "z": { "min": 0.5, "max": 0.8, "pattern": "gradual_increase" }
                            },
                            "crack": { "min": 1.0, "max": 1.5, "pattern": "gradual_increase" }
                        }
                    },
                    "danger": {
                        "name": "위험 상태",
                        "transitionFrame": 25,
                        "data": {
                            "tilt": {
                                "x": { "min": 0.8, "max": 1.5, "pattern": "exponential" },
                                "y": { "min": 0.8, "max": 1.5, "pattern": "exponential" },
                                "z": { "min": 0.8, "max": 1.5, "pattern": "exponential" }
                            },
                            "crack": { "min": 2.0, "max": 2.5, "pattern": "exponential" }
                        }
                    }
                }
            }
        };
    }
    
    /**
     * 유틸리티 함수
     */
    randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }
}