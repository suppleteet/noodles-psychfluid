// Main Application - Initialization, Input Handling, Render Loop

const STORAGE_KEY = 'psychFluidSettings';

// Settings configuration - add new settings here and they'll auto-persist
const SETTINGS_CONFIG = {
    sliders: [
        'touchSplatRadius',
        'splatForce',
        'touchSplatPush',
        'touchSplatBrightness',
        'velocityDissipation',
        'densityDissipation',
        'pressureIterations',
        'autoSplatRate',
        'autoSplatRadius',
        'autoSplatVelocity',
        'autoSplatFadeDuration',
        'autoSplatPush',
        'brightness',
        'outlineThickness'
    ],
    checkboxes: [
        'normalizeHDR',
        'posterize'
    ],
    selects: [
        'palette'
    ]
};

// Color palettes
const PALETTES = {
    rainbow: {
        name: 'Rainbow',
        colors: [
            { r: 1.0, g: 0.0, b: 0.0 },     // Red
            { r: 1.0, g: 0.5, b: 0.0 },     // Orange
            { r: 1.0, g: 1.0, b: 0.0 },     // Yellow
            { r: 0.0, g: 1.0, b: 0.0 },     // Green
            { r: 0.0, g: 1.0, b: 1.0 },     // Cyan
            { r: 0.0, g: 0.0, b: 1.0 },     // Blue
            { r: 0.5, g: 0.0, b: 1.0 },     // Purple
            { r: 1.0, g: 0.0, b: 0.5 }      // Magenta
        ]
    },
    synthwave: {
        name: 'Synthwave Sunset',
        colors: [
            { r: 1.0, g: 0.08, b: 0.58 },   // Hot pink
            { r: 1.0, g: 0.84, b: 0.0 },    // Golden yellow
            { r: 0.0, g: 0.81, b: 0.82 },   // Teal
            { r: 0.58, g: 0.0, b: 0.83 },   // Vivid purple
            { r: 1.0, g: 0.41, b: 0.71 }    // Neon pink
        ]
    },
    retroSwirl: {
        name: 'Retro Swirl',
        colors: [
            { r: 0.83, g: 0.66, b: 0.29 },  // Golden yellow
            { r: 0.91, g: 0.52, b: 0.49 },  // Coral
            { r: 0.96, g: 0.65, b: 0.69 },  // Soft pink
            { r: 0.49, g: 0.71, b: 0.84 },  // Light blue
            { r: 0.55, g: 0.78, b: 0.49 }   // Soft green
        ]
    },
    dripWave: {
        name: 'Drip Wave',
        colors: [
            { r: 0.95, g: 0.75, b: 0.2 },   // Golden yellow
            { r: 0.9, g: 0.45, b: 0.5 },    // Coral pink
            { r: 0.3, g: 0.75, b: 0.85 },   // Cyan
            { r: 0.28, g: 0.28, b: 0.7 },   // Deep blue
            { r: 0.6, g: 0.35, b: 0.75 }    // Purple
        ]
    },
    freshPop: {
        name: 'Fresh Pop',
        colors: [
            { r: 0.35, g: 0.7, b: 0.8 },    // Teal blue
            { r: 0.55, g: 0.85, b: 0.45 },  // Lime green
            { r: 0.9, g: 0.78, b: 0.4 },    // Golden yellow
            { r: 0.92, g: 0.38, b: 0.45 },  // Coral red
            { r: 0.75, g: 0.25, b: 0.75 }   // Magenta
        ]
    },
    seventiesGroove: {
        name: '70s Groove',
        colors: [
            { r: 0.2, g: 0.55, b: 0.6 },    // Teal
            { r: 0.85, g: 0.3, b: 0.25 },   // Burnt red
            { r: 0.95, g: 0.65, b: 0.2 },   // Orange gold
            { r: 0.95, g: 0.88, b: 0.7 },   // Warm cream
            { r: 0.3, g: 0.45, b: 0.5 }     // Deep teal
        ]
    },
    purpleHaze: {
        name: 'Purple Haze',
        colors: [
            { r: 0.7, g: 0.3, b: 0.65 },    // Purple
            { r: 0.95, g: 0.25, b: 0.55 },  // Hot pink
            { r: 0.95, g: 0.5, b: 0.35 },   // Coral orange
            { r: 1.0, g: 0.8, b: 0.3 },     // Yellow
            { r: 0.8, g: 0.5, b: 0.7 }      // Lavender pink
        ]
    },
    popArt: {
        name: 'Pop Art',
        colors: [
            { r: 1.0, g: 0.15, b: 0.55 },   // Hot pink
            { r: 1.0, g: 0.5, b: 0.15 },    // Orange
            { r: 0.2, g: 0.85, b: 0.4 },    // Green
            { r: 0.95, g: 0.3, b: 0.4 },    // Red pink
            { r: 0.85, g: 0.25, b: 0.7 }    // Magenta
        ]
    }
};

class App {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.currentPalette = 'rainbow';
        this.paletteIndex = 0;
        this.resizeCanvas();

        try {
            this.fluid = new FluidSimulation(this.canvas);
        } catch (e) {
            console.error('Failed to initialize fluid simulation:', e);
            document.body.innerHTML = '<div style="color:white;padding:20px;font-family:sans-serif;">WebGL2 with float textures required. Please use a modern browser.</div>';
            return;
        }

        this.isMobile = this.fluid.isMobile;
        this.pointers = new Map();
        this.hueOffset = 0;
        this.lastTime = performance.now();
        this.autoSplatTimer = 0;
        this.fadingSplats = [];

        this.setupEvents();
        this.warmUp();
        this.animate();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupEvents() {
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.fluid.resize();
        });

        // Pointer events for unified touch/mouse handling
        this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
        this.canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
        this.canvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));
        this.canvas.addEventListener('pointerleave', (e) => this.onPointerUp(e));

        // Prevent default touch behaviors
        this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

        // GUI toggle with buttons
        this.gui = document.getElementById('gui');
        this.showSettingsBtn = document.getElementById('showSettings');
        this.closeSettingsBtn = document.getElementById('closeSettings');

        this.showSettingsBtn.addEventListener('click', () => {
            this.gui.classList.add('visible');
            this.showSettingsBtn.classList.add('hidden');
        });

        this.closeSettingsBtn.addEventListener('click', () => {
            this.gui.classList.remove('visible');
            this.showSettingsBtn.classList.remove('hidden');
        });

        // Connect GUI controls to fluid config
        this.setupGUI();
    }

    warmUp() {
        // Pre-populate with splats and run simulation to blend them
        const warmUpSplats = this.isMobile ? 15 : 30;
        for (let i = 0; i < warmUpSplats; i++) {
            const x = Math.random();
            const y = Math.random();
            const angle = Math.random() * Math.PI * 2;
            const speed = 300 + Math.random() * 300;
            const dx = Math.cos(angle) * speed;
            const dy = Math.sin(angle) * speed;
            const color = this.getColor();
            this.fluid.splat(x, y, dx, dy, color);
        }
        // Run simulation steps to blend everything together
        const warmUpSteps = this.isMobile ? 30 : 60;
        for (let i = 0; i < warmUpSteps; i++) {
            this.fluid.step(0.016);
        }
    }

    randomSplat() {
        // Create a splat that fades in over time
        const x = Math.random();
        const y = Math.random();
        const angle = Math.random() * Math.PI * 2;
        const baseSpeed = this.fluid.config.autoSplatVelocity;
        const speed = baseSpeed * (0.75 + Math.random() * 0.5);
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed;
        const color = this.getColor();

        this.fadingSplats.push({
            x, y, dx, dy, color,
            elapsed: 0
        });
    }

    updateFadingSplats(dt) {
        const duration = this.fluid.config.autoSplatFadeDuration;
        const pushStrength = this.fluid.config.autoSplatPush;
        const burstDuration = 0.8; // Touch burst fades in over 0.8 seconds

        for (let i = this.fadingSplats.length - 1; i >= 0; i--) {
            const splat = this.fadingSplats[i];
            splat.elapsed += dt;

            if (splat.isBurst) {
                // Handle touch burst splats
                const progress = Math.min(splat.elapsed / burstDuration, 1);
                const prevProgress = Math.max((splat.elapsed - dt) / burstDuration, 0);
                const deltaProgress = progress - prevProgress;

                // Ease out curve for smooth fade in
                const ease = 1 - Math.pow(1 - progress, 2);
                const prevEase = 1 - Math.pow(1 - prevProgress, 2);
                const deltaEase = ease - prevEase;

                // Apply burst in all directions
                const numBursts = this.isMobile ? 6 : 12;
                for (let j = 0; j < numBursts; j++) {
                    const angle = (j / numBursts) * Math.PI * 2;
                    const dx = Math.cos(angle) * splat.burstForce * deltaEase;
                    const dy = Math.sin(angle) * splat.burstForce * deltaEase;
                    this.fluid.splat(splat.x, splat.y, dx, dy, {
                        r: splat.color.r * deltaEase,
                        g: splat.color.g * deltaEase,
                        b: splat.color.b * deltaEase
                    });
                }

                // Also apply push
                const pushVel = splat.burstForce * 0.5 * deltaEase;
                const numPushes = this.isMobile ? 4 : 8;
                for (let j = 0; j < numPushes; j++) {
                    const angle = (j / numPushes) * Math.PI * 2;
                    const offset = 0.02;
                    const px = splat.x + Math.cos(angle) * offset;
                    const py = splat.y + Math.sin(angle) * offset;
                    const pdx = Math.cos(angle) * pushVel;
                    const pdy = Math.sin(angle) * pushVel;
                    this.fluid.splat(px, py, pdx, pdy, { r: 0, g: 0, b: 0 });
                }

                if (splat.elapsed >= burstDuration) {
                    this.fadingSplats.splice(i, 1);
                }
            } else {
                // Handle auto splats
                const progress = Math.min(splat.elapsed / duration, 1);
                const prevProgress = Math.max((splat.elapsed - dt) / duration, 0);
                const deltaProgress = progress - prevProgress;

                // Ease out the push effect (stronger at start)
                const pushEase = 1 - progress;

                // Apply main splat with directional velocity
                const vx = splat.dx * deltaProgress;
                const vy = splat.dy * deltaProgress;
                const colorScale = deltaProgress;

                this.fluid.splat(splat.x, splat.y, vx, vy, {
                    r: splat.color.r * colorScale,
                    g: splat.color.g * colorScale,
                    b: splat.color.b * colorScale
                }, this.fluid.config.autoSplatRadius);

                // Push outward in multiple directions
                if (pushStrength > 0) {
                    const pushVel = pushStrength * deltaProgress * pushEase;
                    const numPushes = this.isMobile ? 4 : 8;
                    for (let j = 0; j < numPushes; j++) {
                        const angle = (j / numPushes) * Math.PI * 2;
                        const offset = 0.03;
                        const px = splat.x + Math.cos(angle) * offset;
                        const py = splat.y + Math.sin(angle) * offset;
                        const pdx = Math.cos(angle) * pushVel;
                        const pdy = Math.sin(angle) * pushVel;
                        this.fluid.splat(px, py, pdx, pdy, { r: 0, g: 0, b: 0 });
                    }
                }

                // Remove when done
                if (splat.elapsed >= duration) {
                    this.fadingSplats.splice(i, 1);
                }
            }
        }
    }

    setupGUI() {
        // Load saved settings first
        this.loadSettings();

        // Setup slider controls
        for (const name of SETTINGS_CONFIG.sliders) {
            const input = document.getElementById(name);
            const valueDisplay = document.getElementById(name + 'Val');

            input.addEventListener('input', () => {
                const value = parseFloat(input.value);
                valueDisplay.textContent = value;
                this.fluid.config[name] = value;
                this.saveSettings();
            });
        }

        // Setup checkbox controls
        for (const name of SETTINGS_CONFIG.checkboxes) {
            const checkbox = document.getElementById(name);
            checkbox.addEventListener('change', () => {
                this.fluid.config[name] = checkbox.checked;
                this.saveSettings();
                if (name === 'posterize') this.updateOutlineVisibility();
            });
        }

        this.updateOutlineVisibility();

        // Palette dropdown (special handling for app state)
        const paletteSelect = document.getElementById('palette');
        paletteSelect.addEventListener('change', () => {
            this.currentPalette = paletteSelect.value;
            this.paletteIndex = 0;
            this.updatePaletteColors();
            this.saveSettings();
        });

        // Initialize palette colors
        this.updatePaletteColors();
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;

            const settings = JSON.parse(saved);

            // Apply slider values
            for (const name of SETTINGS_CONFIG.sliders) {
                if (settings[name] !== undefined) {
                    const input = document.getElementById(name);
                    const valueDisplay = document.getElementById(name + 'Val');
                    input.value = settings[name];
                    valueDisplay.textContent = settings[name];
                    this.fluid.config[name] = settings[name];
                }
            }

            // Apply checkbox values
            for (const name of SETTINGS_CONFIG.checkboxes) {
                if (settings[name] !== undefined) {
                    const checkbox = document.getElementById(name);
                    checkbox.checked = settings[name];
                    this.fluid.config[name] = settings[name];
                }
            }

            // Apply palette selection
            if (settings.palette && PALETTES[settings.palette]) {
                const paletteSelect = document.getElementById('palette');
                paletteSelect.value = settings.palette;
                this.currentPalette = settings.palette;
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
    }

    saveSettings() {
        try {
            const settings = {};

            // Save slider values
            for (const name of SETTINGS_CONFIG.sliders) {
                settings[name] = this.fluid.config[name];
            }

            // Save checkbox values
            for (const name of SETTINGS_CONFIG.checkboxes) {
                settings[name] = this.fluid.config[name];
            }

            // Save palette selection
            settings.palette = this.currentPalette;

            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    updateOutlineVisibility() {
        document.getElementById('outlineControl').style.display =
            this.fluid.config.posterize ? '' : 'none';
    }

    updatePaletteColors() {
        const palette = PALETTES[this.currentPalette];
        this.fluid.config.paletteColors = palette.colors || [];
    }

    getColor() {
        const palette = PALETTES[this.currentPalette];

        if (!palette.colors) {
            // Rainbow mode - use HSL cycling
            const color = this.hslToRgb(this.hueOffset + Math.random() * 120, 1, 0.5);
            return color;
        }

        // Use palette colors
        const colors = palette.colors;
        const index = this.paletteIndex % colors.length;
        this.paletteIndex++;

        // Add slight random variation
        const base = colors[index];
        const variation = 0.1;
        return {
            r: Math.max(0, Math.min(1, base.r + (Math.random() - 0.5) * variation)),
            g: Math.max(0, Math.min(1, base.g + (Math.random() - 0.5) * variation)),
            b: Math.max(0, Math.min(1, base.b + (Math.random() - 0.5) * variation))
        };
    }

    getColorForPointer(hue) {
        const palette = PALETTES[this.currentPalette];

        if (!palette.colors) {
            return this.hslToRgb(hue, 1, 0.5);
        }

        // Cycle through palette based on hue offset
        const colors = palette.colors;
        const index = Math.floor(hue / 60) % colors.length;
        return colors[index];
    }

    onPointerDown(e) {
        const pointer = {
            id: e.pointerId,
            x: e.clientX / this.canvas.width,
            y: 1 - e.clientY / this.canvas.height,
            prevX: e.clientX / this.canvas.width,
            prevY: 1 - e.clientY / this.canvas.height,
            hue: this.hueOffset + this.pointers.size * 60
        };
        this.pointers.set(e.pointerId, pointer);

        // Create fading burst splat on initial touch
        const brightness = this.fluid.config.touchSplatBrightness;
        const color = this.getColorForPointer(pointer.hue);
        const dimColor = { r: color.r * brightness, g: color.g * brightness, b: color.b * brightness };

        // Add burst as a fading splat
        const burstForce = this.fluid.config.touchSplatPush * 3;
        this.fadingSplats.push({
            x: pointer.x,
            y: pointer.y,
            dx: 0,
            dy: 0,
            color: dimColor,
            elapsed: 0,
            isBurst: true,
            burstForce: burstForce
        });
    }

    onPointerMove(e) {
        const pointer = this.pointers.get(e.pointerId);
        if (!pointer) return;

        pointer.prevX = pointer.x;
        pointer.prevY = pointer.y;
        const targetX = e.clientX / this.canvas.width;
        const targetY = 1 - e.clientY / this.canvas.height;

        // Interpolate between previous and current position for smoother lines
        const dist = Math.sqrt((targetX - pointer.prevX) ** 2 + (targetY - pointer.prevY) ** 2);
        const steps = Math.max(1, Math.floor(dist * (this.isMobile ? 20 : 50)));

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = pointer.prevX + (targetX - pointer.prevX) * t;
            const y = pointer.prevY + (targetY - pointer.prevY) * t;

            const dx = (targetX - pointer.prevX) * this.fluid.config.splatForce / steps;
            const dy = (targetY - pointer.prevY) * this.fluid.config.splatForce / steps;

            if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
                const brightness = this.fluid.config.touchSplatBrightness;
                const color = this.getColorForPointer(pointer.hue);
                const dimColor = { r: color.r * brightness, g: color.g * brightness, b: color.b * brightness };
                this.fluid.splat(x, y, dx, dy, dimColor);
                if (i === steps) {
                    this.applyTouchPush(x, y, 0.3);
                }
            }
        }

        pointer.x = targetX;
        pointer.y = targetY;
    }

    applyTouchPush(x, y, strength) {
        const pushStrength = this.fluid.config.touchSplatPush * strength;
        if (pushStrength <= 0) return;

        const numPushes = this.isMobile ? 4 : 8;
        for (let j = 0; j < numPushes; j++) {
            const angle = (j / numPushes) * Math.PI * 2;
            const offset = 0.02;
            const px = x + Math.cos(angle) * offset;
            const py = y + Math.sin(angle) * offset;
            const pdx = Math.cos(angle) * pushStrength;
            const pdy = Math.sin(angle) * pushStrength;
            this.fluid.splat(px, py, pdx, pdy, { r: 0, g: 0, b: 0 });
        }
    }

    onPointerUp(e) {
        this.pointers.delete(e.pointerId);
    }

    // Convert HSL to RGB
    hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;

        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }

        return {
            r: r + m,
            g: g + m,
            b: b + m
        };
    }

    animate() {
        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.016);
        this.lastTime = now;

        // Cycle rainbow hue over time
        this.hueOffset += dt * 60; // 60 degrees per second
        if (this.hueOffset > 360) this.hueOffset -= 360;

        // Update pointer hues for continuous color cycling
        for (const [id, pointer] of this.pointers) {
            pointer.hue += dt * 120; // Faster color cycling while touching
        }

        // Add random splats periodically to keep it colorful
        const rate = this.fluid.config.autoSplatRate;
        if (rate > 0) {
            this.autoSplatTimer += dt;
            if (this.autoSplatTimer > (1 / rate)) {
                this.autoSplatTimer = 0;
                this.randomSplat();
            }
        }

        // Update fading splats
        this.updateFadingSplats(dt);

        // Run simulation step
        this.fluid.step(dt);

        // Render to screen
        this.fluid.render();

        requestAnimationFrame(() => this.animate());
    }
}

// Start the application
window.addEventListener('DOMContentLoaded', () => {
    new App();
});
