// Fluid Simulation - WebGL Programs and Framebuffers

class FluidSimulation {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false,
            preserveDrawingBuffer: false
        });

        if (!this.gl) {
            throw new Error('WebGL2 not supported');
        }

        const gl = this.gl;

        // Check for float texture support
        const ext = gl.getExtension('EXT_color_buffer_float');
        if (!ext) {
            throw new Error('EXT_color_buffer_float not supported');
        }

        // Simulation parameters
        // Detect phones - touch device with small screen
        this.isMobile = navigator.maxTouchPoints > 0
            && Math.min(screen.width, screen.height) <= 500;

        this.config = {
            // Simulation
            simResolution: 64,
            dyeResolution: 256,
            pressureIterations: this.isMobile ? 10 : 50,
            velocityDissipation: 1,
            densityDissipation: 0.994,

            // Curl/Vorticity (hidden from GUI)
            curl: 0,
            curlRadius: 1,

            // Touch input
            touchSplatRadius: 0.25,
            splatForce: 1000,
            touchSplatPush: 300,
            touchSplatBrightness: 0.4,

            // Auto splats
            autoSplatRate: 20,
            autoSplatRadius: 0.6,
            autoSplatVelocity: 150,
            autoSplatFadeDuration: 3.2,
            autoSplatPush: 500,

            // Display
            brightness: 0.9,
            normalizeHDR: true,
            posterize: true,
            outlineThickness: 2.0,
            paletteColors: []
        };

        this.programs = {};
        this.framebuffers = {};

        this.init();
    }

    init() {
        const gl = this.gl;

        // Create vertex buffer (full-screen quad)
        const vertices = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]);
        const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        // Compile all shader programs
        this.createPrograms();

        // Initialize framebuffers
        this.initFramebuffers();

        // Set up vertex attributes for all programs
        for (const name in this.programs) {
            const program = this.programs[name];
            gl.useProgram(program.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.enableVertexAttribArray(program.attributes.aPosition);
            gl.vertexAttribPointer(program.attributes.aPosition, 2, gl.FLOAT, false, 0, 0);
        }
    }

    createPrograms() {
        const programNames = ['splat', 'advection', 'divergence', 'pressure', 'gradientSubtract', 'curl', 'vorticity', 'display'];

        for (const name of programNames) {
            this.programs[name] = this.createProgram(shaders.vertex, shaders[name]);
        }
    }

    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
        }

        // Get all uniform locations
        const uniforms = {};
        const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            const uniformInfo = gl.getActiveUniform(program, i);
            uniforms[uniformInfo.name] = gl.getUniformLocation(program, uniformInfo.name);
        }

        // Get attribute locations
        const attributes = {
            aPosition: gl.getAttribLocation(program, 'aPosition')
        };

        return { program, uniforms, attributes };
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    initFramebuffers() {
        const simRes = this.getResolution(this.config.simResolution);
        const dyeRes = this.getResolution(this.config.dyeResolution);

        this.simWidth = simRes.width;
        this.simHeight = simRes.height;
        this.dyeWidth = dyeRes.width;
        this.dyeHeight = dyeRes.height;

        const gl = this.gl;
        const texType = gl.HALF_FLOAT;
        const rgba = { internalFormat: gl.RGBA16F, format: gl.RGBA };
        const rg = { internalFormat: gl.RG16F, format: gl.RG };
        const r = { internalFormat: gl.R16F, format: gl.RED };

        // Double-buffered framebuffers
        this.velocity = this.createDoubleFBO(this.simWidth, this.simHeight, rg, texType);
        this.pressure = this.createDoubleFBO(this.simWidth, this.simHeight, r, texType);
        this.dye = this.createDoubleFBO(this.dyeWidth, this.dyeHeight, rgba, texType);

        // Single framebuffers
        this.divergenceFBO = this.createFBO(this.simWidth, this.simHeight, r, texType);
        this.curlFBO = this.createFBO(this.simWidth, this.simHeight, r, texType);
    }

    getResolution(resolution) {
        let aspectRatio = this.canvas.width / this.canvas.height;
        if (aspectRatio < 1) aspectRatio = 1 / aspectRatio;

        const min = Math.round(resolution);
        const max = Math.round(resolution * aspectRatio);

        if (this.canvas.width > this.canvas.height) {
            return { width: max, height: min };
        } else {
            return { width: min, height: max };
        }
    }

    createFBO(width, height, format, type) {
        const gl = this.gl;

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, format.internalFormat, width, height, 0, format.format, type, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT);

        return {
            texture,
            fbo,
            width,
            height,
            attach(id) {
                gl.activeTexture(gl.TEXTURE0 + id);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                return id;
            }
        };
    }

    createDoubleFBO(width, height, format, type) {
        let fbo1 = this.createFBO(width, height, format, type);
        let fbo2 = this.createFBO(width, height, format, type);

        return {
            width,
            height,
            get read() { return fbo1; },
            get write() { return fbo2; },
            swap() {
                const temp = fbo1;
                fbo1 = fbo2;
                fbo2 = temp;
            }
        };
    }

    // Bind a program and set up for rendering
    useProgram(name) {
        const gl = this.gl;
        const prog = this.programs[name];
        gl.useProgram(prog.program);
        return prog;
    }

    // Render to a framebuffer
    blit(target) {
        const gl = this.gl;
        if (target == null) {
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
            gl.viewport(0, 0, target.width, target.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    // Add a splat of velocity and dye
    splat(x, y, dx, dy, color, radius) {
        const gl = this.gl;
        const splatRadius = radius !== undefined ? radius : this.config.touchSplatRadius;

        // Splat velocity
        const prog = this.useProgram('splat');
        gl.uniform1i(prog.uniforms.uTarget, this.velocity.read.attach(0));
        gl.uniform1f(prog.uniforms.aspectRatio, this.canvas.width / this.canvas.height);
        gl.uniform2f(prog.uniforms.point, x, y);
        gl.uniform3f(prog.uniforms.color, dx, dy, 0);
        gl.uniform1f(prog.uniforms.radius, this.correctRadius(splatRadius / 100));
        this.blit(this.velocity.write);
        this.velocity.swap();

        // Splat dye
        gl.uniform1i(prog.uniforms.uTarget, this.dye.read.attach(0));
        gl.uniform3f(prog.uniforms.color, color.r, color.g, color.b);
        this.blit(this.dye.write);
        this.dye.swap();
    }

    correctRadius(radius) {
        const aspectRatio = this.canvas.width / this.canvas.height;
        if (aspectRatio > 1) {
            radius *= aspectRatio;
        }
        return radius;
    }

    // Main simulation step
    step(dt) {
        const gl = this.gl;
        gl.disable(gl.BLEND);

        // Curl
        let prog = this.useProgram('curl');
        gl.uniform2f(prog.uniforms.texelSize, 1 / this.simWidth, 1 / this.simHeight);
        gl.uniform1i(prog.uniforms.uVelocity, this.velocity.read.attach(0));
        gl.uniform1f(prog.uniforms.curlRadius, this.config.curlRadius);
        this.blit(this.curlFBO);

        // Vorticity
        prog = this.useProgram('vorticity');
        gl.uniform2f(prog.uniforms.texelSize, 1 / this.simWidth, 1 / this.simHeight);
        gl.uniform1i(prog.uniforms.uVelocity, this.velocity.read.attach(0));
        gl.uniform1i(prog.uniforms.uCurl, this.curlFBO.attach(1));
        gl.uniform1f(prog.uniforms.curl, this.config.curl);
        gl.uniform1f(prog.uniforms.dt, dt);
        this.blit(this.velocity.write);
        this.velocity.swap();

        // Divergence
        prog = this.useProgram('divergence');
        gl.uniform2f(prog.uniforms.texelSize, 1 / this.simWidth, 1 / this.simHeight);
        gl.uniform1i(prog.uniforms.uVelocity, this.velocity.read.attach(0));
        this.blit(this.divergenceFBO);

        // Pressure - clear
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.read.fbo);
        gl.viewport(0, 0, this.pressure.width, this.pressure.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Pressure - Jacobi iterations
        prog = this.useProgram('pressure');
        gl.uniform2f(prog.uniforms.texelSize, 1 / this.simWidth, 1 / this.simHeight);
        gl.uniform1i(prog.uniforms.uDivergence, this.divergenceFBO.attach(0));
        for (let i = 0; i < this.config.pressureIterations; i++) {
            gl.uniform1i(prog.uniforms.uPressure, this.pressure.read.attach(1));
            this.blit(this.pressure.write);
            this.pressure.swap();
        }

        // Gradient subtraction
        prog = this.useProgram('gradientSubtract');
        gl.uniform2f(prog.uniforms.texelSize, 1 / this.simWidth, 1 / this.simHeight);
        gl.uniform1i(prog.uniforms.uPressure, this.pressure.read.attach(0));
        gl.uniform1i(prog.uniforms.uVelocity, this.velocity.read.attach(1));
        this.blit(this.velocity.write);
        this.velocity.swap();

        // Advect velocity
        prog = this.useProgram('advection');
        gl.uniform2f(prog.uniforms.texelSize, 1 / this.simWidth, 1 / this.simHeight);
        gl.uniform1i(prog.uniforms.uVelocity, this.velocity.read.attach(0));
        gl.uniform1i(prog.uniforms.uSource, this.velocity.read.attach(0));
        gl.uniform1f(prog.uniforms.dt, dt);
        gl.uniform1f(prog.uniforms.dissipation, this.config.velocityDissipation);
        this.blit(this.velocity.write);
        this.velocity.swap();

        // Advect dye
        gl.uniform2f(prog.uniforms.texelSize, 1 / this.dyeWidth, 1 / this.dyeHeight);
        gl.uniform1i(prog.uniforms.uVelocity, this.velocity.read.attach(0));
        gl.uniform1i(prog.uniforms.uSource, this.dye.read.attach(1));
        gl.uniform1f(prog.uniforms.dissipation, this.config.densityDissipation);
        this.blit(this.dye.write);
        this.dye.swap();
    }

    // Render to screen
    render() {
        const gl = this.gl;
        const prog = this.useProgram('display');
        gl.uniform2f(prog.uniforms.texelSize, 1 / this.canvas.width, 1 / this.canvas.height);
        gl.uniform1i(prog.uniforms.uTexture, this.dye.read.attach(0));

        const brightnessLoc = gl.getUniformLocation(prog.program, 'brightness');
        gl.uniform1f(brightnessLoc, this.config.brightness);

        const normalizeHDRLoc = gl.getUniformLocation(prog.program, 'normalizeHDR');
        gl.uniform1i(normalizeHDRLoc, this.config.normalizeHDR ? 1 : 0);

        const posterizeLoc = gl.getUniformLocation(prog.program, 'posterize');
        gl.uniform1i(posterizeLoc, this.config.posterize ? 1 : 0);

        const paletteSizeLoc = gl.getUniformLocation(prog.program, 'paletteSize');
        const paletteColors = this.config.paletteColors || [];
        gl.uniform1i(paletteSizeLoc, paletteColors.length);

        // Pass palette colors
        for (let i = 0; i < 8; i++) {
            const loc = gl.getUniformLocation(prog.program, `palette[${i}]`);
            if (i < paletteColors.length) {
                const c = paletteColors[i];
                gl.uniform3f(loc, c.r, c.g, c.b);
            } else {
                gl.uniform3f(loc, 0, 0, 0);
            }
        }

        const outlineThicknessLoc = gl.getUniformLocation(prog.program, 'outlineThickness');
        gl.uniform1f(outlineThicknessLoc, this.config.outlineThickness);

        this.blit(null);
    }

    // Handle canvas resize
    resize() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.initFramebuffers();
        }
    }
}
