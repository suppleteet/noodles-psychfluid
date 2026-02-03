// GLSL Shader Source Code

const shaders = {
    // Vertex shader - used by all programs
    vertex: `#version 300 es
        in vec2 aPosition;
        out vec2 vUv;
        out vec2 vL;
        out vec2 vR;
        out vec2 vT;
        out vec2 vB;
        uniform vec2 texelSize;

        void main() {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `,

    // Splat shader - adds velocity/color at touch point
    splat: `#version 300 es
        precision highp float;
        in vec2 vUv;
        out vec4 fragColor;

        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;

        void main() {
            vec2 p = vUv - point;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture(uTarget, vUv).xyz;
            fragColor = vec4(base + splat, 1.0);
        }
    `,

    // Advection shader - moves quantities along velocity field
    advection: `#version 300 es
        precision highp float;
        in vec2 vUv;
        out vec4 fragColor;

        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform float dt;
        uniform float dissipation;

        void main() {
            vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
            vec4 result = dissipation * texture(uSource, coord);
            fragColor = result;
        }
    `,

    // Divergence shader - calculates velocity field divergence
    divergence: `#version 300 es
        precision highp float;
        in vec2 vUv;
        in vec2 vL;
        in vec2 vR;
        in vec2 vT;
        in vec2 vB;
        out vec4 fragColor;

        uniform sampler2D uVelocity;

        void main() {
            float L = texture(uVelocity, vL).x;
            float R = texture(uVelocity, vR).x;
            float T = texture(uVelocity, vT).y;
            float B = texture(uVelocity, vB).y;
            float div = 0.5 * (R - L + T - B);
            fragColor = vec4(div, 0.0, 0.0, 1.0);
        }
    `,

    // Pressure shader - Jacobi iteration for pressure solve
    pressure: `#version 300 es
        precision highp float;
        in vec2 vUv;
        in vec2 vL;
        in vec2 vR;
        in vec2 vT;
        in vec2 vB;
        out vec4 fragColor;

        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;

        void main() {
            float L = texture(uPressure, vL).x;
            float R = texture(uPressure, vR).x;
            float T = texture(uPressure, vT).x;
            float B = texture(uPressure, vB).x;
            float divergence = texture(uDivergence, vUv).x;
            float pressure = (L + R + B + T - divergence) * 0.25;
            fragColor = vec4(pressure, 0.0, 0.0, 1.0);
        }
    `,

    // Gradient subtraction shader - makes velocity divergence-free
    gradientSubtract: `#version 300 es
        precision highp float;
        in vec2 vUv;
        in vec2 vL;
        in vec2 vR;
        in vec2 vT;
        in vec2 vB;
        out vec4 fragColor;

        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;

        void main() {
            float L = texture(uPressure, vL).x;
            float R = texture(uPressure, vR).x;
            float T = texture(uPressure, vT).x;
            float B = texture(uPressure, vB).x;
            vec2 velocity = texture(uVelocity, vUv).xy;
            velocity.xy -= vec2(R - L, T - B);
            fragColor = vec4(velocity, 0.0, 1.0);
        }
    `,

    // Curl shader - calculates vorticity with adjustable radius
    curl: `#version 300 es
        precision highp float;
        in vec2 vUv;
        out vec4 fragColor;

        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        uniform float curlRadius;

        void main() {
            vec2 offset = texelSize * curlRadius;
            float L = texture(uVelocity, vUv - vec2(offset.x, 0.0)).y;
            float R = texture(uVelocity, vUv + vec2(offset.x, 0.0)).y;
            float T = texture(uVelocity, vUv + vec2(0.0, offset.y)).x;
            float B = texture(uVelocity, vUv - vec2(0.0, offset.y)).x;
            float vorticity = R - L - T + B;
            fragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
        }
    `,

    // Vorticity confinement shader - adds swirl force
    vorticity: `#version 300 es
        precision highp float;
        in vec2 vUv;
        in vec2 vL;
        in vec2 vR;
        in vec2 vT;
        in vec2 vB;
        out vec4 fragColor;

        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform float curl;
        uniform float dt;

        void main() {
            float L = texture(uCurl, vL).x;
            float R = texture(uCurl, vR).x;
            float T = texture(uCurl, vT).x;
            float B = texture(uCurl, vB).x;
            float C = texture(uCurl, vUv).x;

            vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
            force /= length(force) + 0.0001;
            force *= curl * C;
            force.y *= -1.0;

            vec2 velocity = texture(uVelocity, vUv).xy;
            velocity += force * dt;
            fragColor = vec4(velocity, 0.0, 1.0);
        }
    `,

    // Display shader - renders dye to screen
    display: `#version 300 es
        precision highp float;
        in vec2 vUv;
        out vec4 fragColor;

        uniform sampler2D uTexture;
        uniform vec2 texelSize;
        uniform float brightness;
        uniform bool normalizeHDR;
        uniform bool posterize;
        uniform vec3 palette[8];
        uniform int paletteSize;
        uniform float outlineThickness;

        vec3 getPosterizedColor(vec3 color) {
            float minDist = 1000.0;
            vec3 closest = palette[0];
            for (int i = 0; i < 8; i++) {
                if (i >= paletteSize) break;
                vec3 diff = color - palette[i];
                float dist = dot(diff, diff);
                if (dist < minDist) {
                    minDist = dist;
                    closest = palette[i];
                }
            }
            return closest;
        }

        vec3 sampleColor(vec2 uv) {
            vec3 color = texture(uTexture, uv).rgb;
            color *= brightness;
            if (normalizeHDR) {
                float maxVal = max(max(color.r, color.g), color.b);
                if (maxVal > 1.0) {
                    color /= maxVal;
                }
            }
            return color;
        }

        void main() {
            vec3 color = sampleColor(vUv);

            if (!posterize || paletteSize <= 0) {
                fragColor = vec4(color, 1.0);
                return;
            }

            vec3 centerColor = getPosterizedColor(color);

            // Edge detection - sample neighbors and check for color boundaries
            float edge = 0.0;
            float thickness = outlineThickness;

            if (thickness > 0.0) {
                // Sample in 8 directions for edge detection
                for (int i = 0; i < 8; i++) {
                    float angle = float(i) * 0.7854; // PI/4
                    vec2 offset = vec2(cos(angle), sin(angle)) * texelSize * thickness;
                    vec3 neighborRaw = sampleColor(vUv + offset);
                    vec3 neighborColor = getPosterizedColor(neighborRaw);

                    if (distance(centerColor, neighborColor) > 0.01) {
                        edge = 1.0;
                        break;
                    }
                }
            }

            // Black outline at edges, otherwise use posterized color
            color = edge > 0.5 ? vec3(0.0) : centerColor;

            fragColor = vec4(color, 1.0);
        }
    `
};
