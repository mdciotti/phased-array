#version 300 es
precision mediump float;
in vec4 aVertexPosition;
in vec2 aTextureCoord;
out vec2 vScreenCoord;

void main() {
    gl_Position = aVertexPosition;
    vScreenCoord = aTextureCoord;
}
