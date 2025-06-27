// js/hotspot-sprite.js - Three.js Sprite 기반 핫스팟 시스템

export class HotspotSpriteManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.hotspots = [];
        this.sprites = [];
        this.activeHotspot = null;
        
        // Raycaster for interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Canvas for sprite textures
        this.textureCache = new Map();
        
        // Animation state
        this.animationTime = 0;
        
        // Configuration
        this.config = {
            spriteScale: { min: 1.5, max: 3.0 },
            animationSpeed: 2,
            hoverScale: 1.2,
            pulseScale: 0.1,
            depthTest: true,
            depthWrite: false
        };
        
        // Bind event handlers
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseClick = this.onMouseClick.bind(this);
        this.animate = this.animate.bind(this);
        
        this.init();
    }
    
    /**
     * Initialize the manager
     */
    init() {
        this.setupEventListeners();
        console.log('✅ HotspotSpriteManager initialized');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const canvas = this.viewer.renderer.domElement;
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onMouseClick);
        
        // Add to render loop
        this.viewer.addRenderCallback(this.animate);
    }
    
    /**
     * Load hotspots from model and JSON data
     */
    loadHotspots(model, jsonData) {
        // Clear existing hotspots
        this.clearHotspots();
        
        if (!jsonData || !jsonData.hotspots) {
            console.warn('No hotspot data found');
            return;
        }
        
        console.log('🔍 Loading hotspots from model and JSON...');
        
        // Apply settings
        if (jsonData.settings) {
            Object.assign(this.config, jsonData.settings);
        }
        
        // Find Empty objects and match with JSON data
        model.traverse((child) => {
            if (child.name && child.name.startsWith('HS_')) {
                const hotspotConfig = jsonData.hotspots[child.name];
                
                if (hotspotConfig) {
                    this.createHotspot(child, hotspotConfig, child.name);
                } else {
                    console.warn(`No JSON data for Empty: ${child.name}`);
                }
            }
        });
        
        console.log(`✅ Created ${this.hotspots.length} hotspots`);
    }
    
    /**
     * Create a hotspot sprite
     */
    createHotspot(empty, config, id) {
        // Get world position
        const worldPosition = new THREE.Vector3();
        empty.getWorldPosition(worldPosition);
        
        // Create sprite texture
        const texture = this.createSpriteTexture(config);
        
        // Create sprite material
        const material = new THREE.SpriteMaterial({
            map: texture,
            color: 0xffffff,
            depthTest: this.config.depthTest,
            depthWrite: this.config.depthWrite,
            transparent: true,
            opacity: 1.0
        });
        
        // Create sprite
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(worldPosition);
        
        // Set initial scale
        const scale = config.ui?.size || 2.0;
        sprite.scale.set(scale, scale, 1);
        
        // Store data
        const hotspotData = {
            id: id,
            sprite: sprite,
            empty: empty,
            config: config,
            baseScale: scale,
            isHovered: false,
            isActive: false,
            pulsePhase: Math.random() * Math.PI * 2 // Random phase for animation
        };
        
        // Add user data to sprite for raycasting
        sprite.userData = {
            hotspot: hotspotData,
            isHotspot: true
        };
        
        // Add to scene and lists
        this.viewer.scene.add(sprite);
        this.hotspots.push(hotspotData);
        this.sprites.push(sprite);
        
        console.log(`📍 Created hotspot: ${config.info?.title || id}`);
    }
    
/**
 * Create sprite texture with SVG/image support
 */
createSpriteTexture(config) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Clear canvas
    ctx.clearRect(0, 0, 256, 256);
    
    // Determine colors based on status
    let bgColor = config.ui?.color || '#007bff';
    
    if (config.data?.status === 'warning') {
        bgColor = '#ff6b35';
    } else if (config.data?.status === 'danger') {
        bgColor = '#ff1744';
    }
    
    // Draw outer glow
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 100);
    gradient.addColorStop(0, bgColor + '40');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    // Draw main circle
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.arc(128, 128, 80, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw inner circle (lighter)
    const innerGradient = ctx.createRadialGradient(128, 108, 0, 128, 128, 70);
    innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    innerGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(128, 128, 70, 0, Math.PI * 2);
    ctx.fill();
    
    // Create texture first (will be updated if image loads)
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Check if icon is URL
    const iconValue = config.ui?.icon || '!';
    if (this.isImageUrl(iconValue)) {
        // Asynchronously load and draw image
        this.loadAndDrawIcon(canvas, ctx, iconValue, texture);
    } else {
        // Draw text icon immediately
        this.drawTextIcon(ctx, iconValue);
        texture.needsUpdate = true;
    }
    
    return texture;
}

/**
 * Check if string is image URL
 */
isImageUrl(str) {
    return str.startsWith('http') || 
           str.startsWith('/') || 
           str.includes('.svg') || 
           str.includes('.png') || 
           str.includes('.jpg');
}

/**
 * Load and draw icon image
 */
loadAndDrawIcon(canvas, ctx, url, texture) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
        // Clear icon area
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(128, 128, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        // Draw image
        const iconSize = 80;
        const x = (256 - iconSize) / 2;
        const y = (256 - iconSize) / 2;
        
        // White background for icon
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(128, 128, 60, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw icon with multiply blend
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(img, x, y, iconSize, iconSize);
        ctx.restore();
        
        // Update texture
        texture.needsUpdate = true;
    };
    
    img.onerror = () => {
        // Fallback to text
        console.warn(`Failed to load icon: ${url}`);
        this.drawTextIcon(ctx, '!');
        texture.needsUpdate = true;
    };
    
    img.src = url;
}

/**
 * Draw text icon
 */
drawTextIcon(ctx, text) {
    ctx.fillStyle = 'white';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);
}
    /**
     * Update hotspot positions
     */
    updateHotspotPositions() {
        this.hotspots.forEach(hotspot => {
            if (hotspot.empty && hotspot.sprite) {
                // Get updated world position
                const worldPosition = new THREE.Vector3();
                hotspot.empty.getWorldPosition(worldPosition);
                hotspot.sprite.position.copy(worldPosition);
            }
        });
    }
    
    /**
     * Animation loop
     */
    animate() {
        this.animationTime += 0.016; // ~60fps
        
        // Update positions
        this.updateHotspotPositions();
        
        // Animate sprites
        this.hotspots.forEach(hotspot => {
            const { sprite, config, baseScale, isHovered, pulsePhase } = hotspot;
            
            if (!config.settings?.animationEnabled !== false) {
                // Base pulse animation
                const pulse = Math.sin(this.animationTime * this.config.animationSpeed + pulsePhase) * this.config.pulseScale;
                let scale = baseScale * (1 + pulse);
                
                // Hover effect
                if (isHovered) {
                    scale *= this.config.hoverScale;
                }
                
                // Warning/danger states have faster pulse
                if (config.data?.status === 'warning') {
                    const fastPulse = Math.sin(this.animationTime * 4) * 0.1;
                    scale *= (1 + fastPulse);
                } else if (config.data?.status === 'danger') {
                    const fastPulse = Math.sin(this.animationTime * 8) * 0.15;
                    scale *= (1 + fastPulse);
                }
                
                sprite.scale.set(scale, scale, 1);
                
                // Rotate slightly for active hotspot
                if (hotspot.isActive) {
                    sprite.material.rotation = this.animationTime * 0.5;
                }
            }
        });
    }
    
    /**
     * Mouse move handler
     */
    onMouseMove(event) {
        const rect = this.viewer.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Raycast
        this.raycaster.setFromCamera(this.mouse, this.viewer.camera);
        const intersects = this.raycaster.intersectObjects(this.sprites);
        
        // Reset hover states
        this.hotspots.forEach(h => h.isHovered = false);
        
        // Check hover
        if (intersects.length > 0) {
            const sprite = intersects[0].object;
            if (sprite.userData.isHotspot) {
                const hotspot = sprite.userData.hotspot;
                hotspot.isHovered = true;
                this.viewer.renderer.domElement.style.cursor = 'pointer';
                
                // Show tooltip
                this.showTooltip(hotspot, event);
            }
        } else {
            this.viewer.renderer.domElement.style.cursor = 'default';
            this.hideTooltip();
        }
    }
    
    /**
     * Mouse click handler
     */
    onMouseClick(event) {
        this.raycaster.setFromCamera(this.mouse, this.viewer.camera);
        const intersects = this.raycaster.intersectObjects(this.sprites);
        
        if (intersects.length > 0) {
            const sprite = intersects[0].object;
            if (sprite.userData.isHotspot) {
                const hotspot = sprite.userData.hotspot;
                this.selectHotspot(hotspot);
            }
        }
    }
    
    /**
     * Select a hotspot
     */
    selectHotspot(hotspot) {
        // Deactivate previous
        if (this.activeHotspot && this.activeHotspot !== hotspot) {
            this.activeHotspot.isActive = false;
        }
        
        // Activate new
        hotspot.isActive = true;
        this.activeHotspot = hotspot;
        
        // Show info panel
        this.showInfoPanel(hotspot);
        
        console.log(`Selected: ${hotspot.config.info?.title || hotspot.id}`);
    }
    
    /**
     * Show tooltip
     */
    showTooltip(hotspot, event) {
        let tooltip = document.getElementById('hotspot-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'hotspot-tooltip';
            tooltip.className = 'hotspot-sprite-tooltip';
            document.body.appendChild(tooltip);
        }
        
        const config = hotspot.config;
        const title = config.info?.title || hotspot.id;
        let content = `<strong>${title}</strong>`;
        
        if (config.type === 'sensor' && config.data) {
            const statusClass = config.data.status || 'normal';
            content += `<br><span class="status-${statusClass}">`;
            content += `${config.data.currentValue}${config.data.unit}`;
            content += `</span>`;
        }
        
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY - 40}px`;
    }
    
    /**
     * Hide tooltip
     */
    hideTooltip() {
        const tooltip = document.getElementById('hotspot-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    /**
     * Show info panel
     */
    showInfoPanel(hotspot) {
        let panel = document.getElementById('hotspot-info-panel');
        if (!panel) {
            panel = this.createInfoPanel();
            document.body.appendChild(panel);
        }
        
        const config = hotspot.config;
        const info = config.info || {};
        const data = config.data || {};
        
        // Update header
        const header = panel.querySelector('.panel-header h3');
        if (header) {
            header.textContent = info.title || hotspot.id;
        }
        
        // Update status
        const statusEl = panel.querySelector('.panel-status');
        if (statusEl && config.type === 'sensor') {
            let statusText = '정상';
            let statusClass = 'normal';
            
            if (data.status === 'warning') {
                statusText = '경고';
                statusClass = 'warning';
            } else if (data.status === 'danger') {
                statusText = '위험';
                statusClass = 'danger';
            }
            
            statusEl.className = `panel-status status-${statusClass}`;
            statusEl.textContent = statusText;
            statusEl.style.display = 'block';
        } else if (statusEl) {
            statusEl.style.display = 'none';
        }
        
        // Update body
        const body = panel.querySelector('.panel-body');
        if (body) {
            let html = `<p class="description">${info.description || ''}</p>`;
            
            // Sensor data
            if (config.type === 'sensor' && data) {
                html += `
                    <div class="data-section">
                        <h4>센서 데이터</h4>
                        <table class="info-table">
                            <tr>
                                <td>센서 타입</td>
                                <td>${config.sensorType || '-'}</td>
                            </tr>
                            <tr>
                                <td>현재값</td>
                                <td class="value">${data.currentValue}${data.unit}</td>
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
                                <td>설치 위치</td>
                                <td>${info.location || '-'}</td>
                            </tr>
                            <tr>
                                <td>설치일</td>
                                <td>${info.installDate || '-'}</td>
                            </tr>
                        </table>
                    </div>
                `;
            }
            
            // Structure details
            if (config.type === 'info' && info.details) {
                html += '<div class="details-section"><h4>상세 정보</h4><table class="info-table">';
                for (const [key, value] of Object.entries(info.details)) {
                    html += `<tr><td>${key}</td><td>${value}</td></tr>`;
                }
                html += '</table></div>';
            }
            
            body.innerHTML = html;
        }
        
        // Show panel
        panel.classList.add('show');
    }
    
    /**
     * Create info panel
     */
    createInfoPanel() {
        const panel = document.createElement('div');
        panel.id = 'hotspot-info-panel';
        panel.className = 'hotspot-sprite-panel';
        
        panel.innerHTML = `
            <div class="panel-header">
                <h3></h3>
                <span class="panel-status"></span>
                <button class="panel-close">&times;</button>
            </div>
            <div class="panel-body"></div>
        `;
        
        // Close button
        const closeBtn = panel.querySelector('.panel-close');
        closeBtn.addEventListener('click', () => {
            this.hideInfoPanel();
        });
        
        // Click outside to close
        panel.addEventListener('click', (e) => {
            if (e.target === panel) {
                this.hideInfoPanel();
            }
        });
        
        return panel;
    }
    
    /**
     * Hide info panel
     */
    hideInfoPanel() {
        const panel = document.getElementById('hotspot-info-panel');
        if (panel) {
            panel.classList.remove('show');
        }
        
        if (this.activeHotspot) {
            this.activeHotspot.isActive = false;
            this.activeHotspot = null;
        }
    }
    
    /**
     * Toggle hotspot visibility
     */
    toggleHotspots() {
        const visible = this.sprites.length > 0 && this.sprites[0].visible;
        
        this.sprites.forEach(sprite => {
            sprite.visible = !visible;
        });
        
        console.log(visible ? '🙈 Hotspots hidden' : '👁️ Hotspots shown');
        
        if (visible) {
            this.hideInfoPanel();
            this.hideTooltip();
        }
    }
    
    /**
     * Filter hotspots by status
     */
    filterByStatus(status) {
        this.hotspots.forEach(hotspot => {
            const data = hotspot.config.data;
            let visible = true;
            
            switch (status) {
                case 'all':
                    visible = true;
                    break;
                case 'normal':
                    visible = !data || data.status === 'normal';
                    break;
                case 'warning':
                    visible = data && data.status === 'warning';
                    break;
                case 'danger':
                    visible = data && data.status === 'danger';
                    break;
                case 'sensors':
                    visible = hotspot.config.type === 'sensor';
                    break;
                default:
                    visible = true;
            }
            
            hotspot.sprite.visible = visible;
        });
    }
    
    /**
     * Update hotspot data (for real-time monitoring)
     */
    updateHotspotData(hotspotId, newData) {
        const hotspot = this.hotspots.find(h => h.id === hotspotId);
        if (!hotspot) return;
        
        // Update data
        Object.assign(hotspot.config.data, newData);
        
        // Recreate texture if status changed
        if (newData.status) {
            const texture = this.createSpriteTexture(hotspot.config);
            hotspot.sprite.material.map = texture;
            hotspot.sprite.material.needsUpdate = true;
        }
        
        // Update panel if active
        if (this.activeHotspot === hotspot) {
            this.showInfoPanel(hotspot);
        }
    }
    
    /**
     * Clear all hotspots
     */
    clearHotspots() {
        // Remove sprites from scene
        this.sprites.forEach(sprite => {
            this.viewer.scene.remove(sprite);
            sprite.material.map.dispose();
            sprite.material.dispose();
        });
        
        // Clear arrays
        this.hotspots = [];
        this.sprites = [];
        this.activeHotspot = null;
        
        // Clear texture cache
        this.textureCache.forEach(texture => texture.dispose());
        this.textureCache.clear();
        
        // Hide UI
        this.hideInfoPanel();
        this.hideTooltip();
    }
    
    /**
     * Destroy manager
     */
    destroy() {
        // Remove event listeners
        const canvas = this.viewer.renderer.domElement;
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onMouseClick);
        
        // Remove from render loop
        this.viewer.removeRenderCallback(this.animate);
        
        // Clear hotspots
        this.clearHotspots();
        
        // Remove UI elements
        const panel = document.getElementById('hotspot-info-panel');
        if (panel) panel.remove();
        
        const tooltip = document.getElementById('hotspot-tooltip');
        if (tooltip) tooltip.remove();
        
        console.log('🔚 HotspotSpriteManager destroyed');
    }
}