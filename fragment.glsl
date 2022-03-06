#version 300 es
precision mediump float;
uniform vec2 mouse;
uniform float time;
uniform int n_sources;
uniform float attenuation;
uniform float phase_velocity;
uniform float phase_delay;
uniform float rp_type;
uniform float power;
uniform float frequency;
uniform float k_noise;
uniform float k_alpha;
uniform sampler2D uColorScaleSampler;
in vec2 vScreenCoord;
out vec4 FragColor;

struct source {
    float frequency;
    float phase;
    vec2 position;
};

const float pi = 2.0 * acos(0.0);

float cardioid(vec2 delta, float direction) {
    // return 1.0 + normalize(delta).y;
    return 1.0 + sin(atan(delta.y, delta.x));
}

float wave_sample(vec2 coord) {
    float sum = 0.0;

    source s;
    float w = 2.0 * pi * frequency;
    float k = w / phase_velocity;

    for (int i = 0; i < n_sources; ++i) {
        s.position = vec2(float(i - n_sources / 2) * 20.0, 0.0);
        s.phase = float(i);

        vec2 delta = coord - s.position;
        float d = length(delta);
        float dt = d / phase_velocity;
        float rp = 1.0 + rp_type * (cardioid(delta, 0.0) - 1.0);
        float sampled_power = power * rp / d;
        // float power = s.power * (1.0 + sin(atan(delta.y, delta.x)));
        // sum += power * sin((time - dt - s.phase * mouse.x) * s.frequency);
        // sum += power * sin(4.0 * acos(0.0) * s.frequency * time - dt - s.phase * (mouse.x - 0.5));
        float phi = 2.0 * pi * s.phase * phase_delay;
        sum += sampled_power * sin(k * d - w * time + phi);
    }

    return sum;
}

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453 + time);
}

float tang(float t, float k) {
    return tan(k*pi*(t - 0.5)) / (2.0*tan(0.5*k*pi));
}

void main() {
    float val = wave_sample(vScreenCoord) / float(n_sources);
    float noise_uniform = rand(vScreenCoord);
    float noise = k_noise * tang(noise_uniform, sqrt(k_alpha));
    // val = clamp(val, 0.0, 255.0 / 256.0);
    FragColor = texture(uColorScaleSampler, vec2(val + 0.5 + noise, 0.0));
    // FragColor = vec4(val, 0.0, -val, 1.0);
}