import { LUT } from './lut.js'

const mouse = { x: 0, y: 0 }
const RP_TYPE_UNIFORM = 0
const RP_TYPE_CARDIOID = 1

const RP = {
    [RP_TYPE_UNIFORM]: (theta, dir) => 1,
    [RP_TYPE_CARDIOID]: (theta, dir) => Math.cos(dir) * (1 + Math.sin(theta)) + Math.sin(dir) * (1 + Math.cos(theta)),
}


/**
 * 
 * @param {CanvasRenderingContext2D} ctx 
 */
function rp_draw(ctx, scene) {
    ctx.globalAlpha = 1
    ctx.fillRect(-50, -50, 100, 100)

    ctx.strokeStyle = 'white'
    ctx.globalAlpha = 0.25
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, 12.5, 0, 2 * Math.PI, false)
    ctx.arc(0, 0, 25, 0, 2 * Math.PI, false)
    ctx.arc(0, 0, 37.5, 0, 2 * Math.PI, false)
    ctx.arc(0, 0, 50, 0, 2 * Math.PI, false)
    ctx.moveTo(-50, 0)
    ctx.lineTo(50, 0)
    ctx.moveTo(0, -50)
    ctx.lineTo(0, 50)
    ctx.moveTo(-50, -50)
    ctx.lineTo(50, 50)
    ctx.moveTo(-50, 50)
    ctx.lineTo(50, -50)
    ctx.stroke()

    ctx.strokeStyle = 'white'
    ctx.globalAlpha = scene.rp_hover ? 1 : 0.5
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(25 * RP[scene.rp_type](0, scene.rp_direction), 0)

    for (let i = 1; i < 72; ++i) {
        const theta = Math.PI * 2 * i / 72
        const r = 25 * RP[scene.rp_type](theta, scene.rp_direction)
        const x = r * Math.cos(theta)
        const y = r * Math.sin(theta)
        ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
}

async function setup() {
    const canvas = document.createElement('canvas')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    document.body.append(canvas)

    const rp_canvas = document.createElement('canvas')
    rp_canvas.width = 100
    rp_canvas.height = 100
    rp_canvas.id = 'rp_canvas'
    document.body.append(rp_canvas)

    const ramp_canvas = document.getElementById('ramp')
    ramp_canvas.width = 256
    ramp_canvas.height = 20
    ramp_canvas.id = 'ramp_canvas'
    // document.body.append(ramp_canvas)

    const $lut = ramp_canvas.parentElement
    $lut.addEventListener('click', (e) => {
        $lut.classList.toggle('open')
    })

    const ctx = rp_canvas.getContext('2d')
    ctx.translate(50, 50)
    ctx.scale(1, -1)

    const scene = {
        n_sources: 30,
        rp_direction: 0,
        rp_hover: false,
        rp_type: RP_TYPE_CARDIOID,
        attenuation: 0,
        phase_velocity: 100,
        phase_delay: 0,
        power: 500,
        frequency: 1,
        k_noise: 0.04,
        k_alpha: 0.01,
        bounds: new Float32Array(8),
    }

    const setBounds = (w, h) => {
        const hw = w / 2
        const hh = h / 2
        scene.bounds[0] = hw
        scene.bounds[1] = hh
        scene.bounds[2] = -hw
        scene.bounds[3] = hh
        scene.bounds[4] = hw
        scene.bounds[5] = -hh
        scene.bounds[6] = -hw
        scene.bounds[7] = -hh
    }

    setBounds(canvas.width, canvas.height)

    rp_draw(ctx, scene)

    const gl = canvas.getContext('webgl2')
    const program = gl.createProgram()

    const fs = gl.createShader(gl.FRAGMENT_SHADER)
    const FS_SOURCE = await (await fetch('./fragment.glsl')).text()
    gl.shaderSource(fs, FS_SOURCE)
    gl.compileShader(fs)
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders:', gl.getShaderInfoLog(fs));
        gl.deleteShader(fs)
        return
    }
    gl.attachShader(program, fs)

    const vs = gl.createShader(gl.VERTEX_SHADER)
    const VS_SOURCE = await (await fetch('./vertex.glsl')).text()
    gl.shaderSource(vs, VS_SOURCE)
    gl.compileShader(vs)
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders:', gl.getShaderInfoLog(vs));
        gl.deleteShader(vs)
        return
    }
    gl.attachShader(program, vs)

    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program:', gl.getProgramInfoLog(program))
        gl.deleteProgram(program)
        return
    }

    const programInfo = {
        program,
        uColorScaleSampler: gl.getUniformLocation(program, 'uColorScaleSampler', 1),
        noise: gl.getUniformLocation(program, 'noise'),
        aVertexPosition: gl.getAttribLocation(program, 'aVertexPosition'),
        aTextureCoord: gl.getAttribLocation(program, 'aTextureCoord'),
        time: gl.getUniformLocation(program, 'time'),
        mouse: gl.getUniformLocation(program, 'mouse'),
        n_sources: gl.getUniformLocation(program, 'n_sources'),
        attenuation: gl.getUniformLocation(program, 'attenuation'),
        phase_velocity: gl.getUniformLocation(program, 'phase_velocity'),
        phase_delay: gl.getUniformLocation(program, 'phase_delay'),
        power: gl.getUniformLocation(program, 'power'),
        frequency: gl.getUniformLocation(program, 'frequency'),
        k_noise: gl.getUniformLocation(program, 'k_noise'),
        k_alpha: gl.getUniformLocation(program, 'k_alpha'),
        rp_type: gl.getUniformLocation(program, 'rp_type'),
    }

    const lut_tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lut_tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

    /**
     * Sets the active color LUT.
     * @param {HTMLCanvasElement} lut
     */
    const setColorLUT = (lut_canvas) => {
        gl.bindTexture(gl.TEXTURE_2D, lut_tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lut_canvas)
    }

    const ramp_ctx = ramp_canvas.getContext('2d')
    // const lut1 = new LUT(['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557'])
    const lut1 = new LUT(['#0000ff', '#000000', '#ff0000'])
    lut1.draw(ramp_ctx)

    // setColorLUT(ramp_canvas)

    const $lut_list = document.getElementById('lut_list')
    for (const $li of $lut_list.children) {
        const $canvas = $li.getElementsByTagName('canvas')[0]
        const lut_ctx = $canvas.getContext('2d')
        const lut = new LUT($canvas.dataset.colors.split(','))
        $canvas.width = 256
        $canvas.height = 20
        lut.draw(lut_ctx)
        // console.log($canvas.dataset.colors.split(','))
        $canvas.parentElement.addEventListener('click', () => {
            setColorLUT($canvas)
            lut.draw(ramp_ctx)
        })
    }

    setColorLUT(ramp_canvas)

    const vb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vb)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        1.0,  1.0,
       -1.0,  1.0,
        1.0, -1.0,
       -1.0, -1.0,
    ]), gl.STATIC_DRAW)

    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.bindBuffer(gl.ARRAY_BUFFER, vb)
    gl.vertexAttribPointer(
        programInfo.aVertexPosition,
        2, // pull out 2 values (x,y) per iteration
        gl.FLOAT, // type
        false, // don't normalize
        0, // how many bytes to get from one set of values to the next (0 = use type and numComponents above)
        0, // how many bytes inside the buffer to start from
    )
    gl.enableVertexAttribArray(programInfo.aVertexPosition)


    const tb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, tb)
    gl.bufferData(gl.ARRAY_BUFFER, scene.bounds, gl.STATIC_DRAW)
    gl.vertexAttribPointer(programInfo.aTextureCoord, 2, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(programInfo.aTextureCoord)

    gl.useProgram(program)

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX
        mouse.y = e.clientY
    })

    window.addEventListener('resize', (e) => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
        setBounds(canvas.width, canvas.height)
        // console.log(scene.bounds)
        gl.bindBuffer(gl.ARRAY_BUFFER, tb)
        gl.bufferData(gl.ARRAY_BUFFER, scene.bounds, gl.STATIC_DRAW)
    })

    // canvas.addEventListener('wheel', (e) => {
    //     scene.n_sources = e.deltaY < 0
    //         ? Math.min(scene.n_sources + 1, 30)
    //         : Math.max(scene.n_sources - 1, 0)
    // })

    const $options = document.getElementById('options')
    document.getElementById('toggle_options').addEventListener('click', () => {
        $options.classList.toggle('hidden')
    })

    function register_parameter(param_name) {
        /** @type {HTMLInputElement} */
        const el = document.getElementById(param_name)
        el.value = scene[param_name]
        el.addEventListener('input', () => scene[param_name] = +el.value)
    }

    register_parameter('n_sources')
    register_parameter('attenuation')
    register_parameter('phase_velocity')
    register_parameter('phase_delay')
    register_parameter('power')
    register_parameter('frequency')
    register_parameter('k_noise')
    register_parameter('k_alpha')

    // rp_canvas.addEventListener('wheel', (e) => {
    //     // scene.rp_direction -= e.deltaY
    //     scene.rp_direction = e.deltaY < 0
    //         ? scene.rp_direction + Math.PI / 90
    //         : scene.rp_direction - Math.PI / 90
    //     rp_draw(ctx, scene)
    // })
    rp_canvas.addEventListener('mouseenter', (e) => {
        scene.rp_hover = true
        rp_draw(ctx, scene)
    })
    rp_canvas.addEventListener('mouseleave', (e) => {
        scene.rp_hover = false
        rp_draw(ctx, scene)
    })
    rp_canvas.style.cursor = 'pointer'
    rp_canvas.addEventListener('click', (e) => {
        scene.rp_type = scene.rp_type === RP_TYPE_UNIFORM
            ? RP_TYPE_CARDIOID
            : RP_TYPE_UNIFORM
        rp_draw(ctx, scene)
    })

    requestAnimationFrame(render.bind(null, gl, programInfo, scene))
}

function render(gl, programInfo, scene) {
    gl.uniform1f(programInfo.time, performance.now() / 1000)
    gl.uniform2f(programInfo.mouse, mouse.x / gl.canvas.width, mouse.y / gl.canvas.height)
    gl.uniform1i(programInfo.n_sources, scene.n_sources)
    gl.uniform1f(programInfo.attenuation, scene.attenuation)
    gl.uniform1f(programInfo.phase_velocity, scene.phase_velocity)
    gl.uniform1f(programInfo.phase_delay, scene.phase_delay)
    gl.uniform1f(programInfo.power, scene.power)
    gl.uniform1f(programInfo.frequency, scene.frequency)
    gl.uniform1f(programInfo.rp_type, scene.rp_type)
    gl.uniform1f(programInfo.k_noise, scene.k_noise)
    gl.uniform1f(programInfo.k_alpha, scene.k_alpha)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    requestAnimationFrame(render.bind(null, gl, programInfo, scene))
}

// document.addEventListener('readystatechange', (ev) => {
//     if (document.readyState === 'interactive') {
//         setup()
//     }
// })

setup()