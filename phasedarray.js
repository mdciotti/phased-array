import { LUT } from './lut.js'

const mouse = { x: 0, y: 0 }
const RP_TYPE_UNIFORM = 0
const RP_TYPE_CARDIOID = 1

const { cos, sin, PI } = Math

const RP = {
    [RP_TYPE_UNIFORM]: (theta) => 1,
    [RP_TYPE_CARDIOID]: (theta) => (1 + Math.sin(theta)),
}

/**
 * Draws the radiation pattern diagram onto the provided Canvas2D context.
 * @param {CanvasRenderingContext2D} ctx
 */
function rp_draw(ctx, scene, params) {
    ctx.save()
    const pattern = RP[params.rp_type]
    ctx.globalAlpha = 1
    ctx.fillRect(-50, -50, 100, 100)

    ctx.strokeStyle = 'white'
    ctx.globalAlpha = 0.25
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, 12.5, 0, 2 * PI, false)
    ctx.arc(0, 0, 25, 0, 2 * PI, false)
    ctx.arc(0, 0, 37.5, 0, 2 * PI, false)
    ctx.arc(0, 0, 50, 0, 2 * PI, false)
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
    ctx.rotate(params.rp_direction * 2 * PI)

    const a = 25
    ctx.moveTo(a * pattern(0), 0)

    for (let i = 1; i < 72; ++i) {
        const theta = PI * 2 * i / 72
        const r = a * pattern(theta)
        ctx.lineTo(r * cos(theta), r * sin(theta))
    }
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
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

    const $lut = ramp_canvas.parentElement
    $lut.addEventListener('click', (e) => {
        $lut.classList.toggle('open')
    })

    const ctx = rp_canvas.getContext('2d')
    ctx.translate(50, 50)
    ctx.scale(-1, -1)

    const scene = {
        lut_steps: 5,
        rp_hover: false,
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
        aVertexPosition: gl.getAttribLocation(program, 'aVertexPosition'),
        aTextureCoord: gl.getAttribLocation(program, 'aTextureCoord'),
        time: gl.getUniformLocation(program, 'time'),
        mouse: gl.getUniformLocation(program, 'mouse'),
    }

    // Define the LUT
    const lut_tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, lut_tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

    /**
     * Sets, redraws, and binds the active color LUT to WebGL.
     */
    function update_lut() {
        const ramp_ctx = ramp_canvas.getContext('2d')
        const lut = new LUT(ramp_canvas.dataset.colors.split(','))
        scene.lut_steps === 1
            ? lut.draw(ramp_ctx)
            : lut.drawDiscrete(ramp_ctx, scene.lut_steps)
        gl.bindTexture(gl.TEXTURE_2D, lut_tex)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ramp_canvas)
    }

    // Set up LUT list canvases, register click handler
    const $lut_list = document.getElementById('lut_list')
    for (const $li of $lut_list.children) {
        const $canvas = $li.getElementsByTagName('canvas')[0]
        $canvas.width = 256
        $canvas.height = 20
        $canvas.parentElement.addEventListener('click', () => {
            ramp_canvas.dataset.colors = $canvas.dataset.colors
            update_lut()
            update_url(params)
        })
    }

    /**
     * Redraws all LUTs in the LUT list.
     */
    function redraw_luts() {
        for (const $li of $lut_list.children) {
            const $canvas = $li.getElementsByTagName('canvas')[0]
            const lut_ctx = $canvas.getContext('2d')
            const lut = new LUT($canvas.dataset.colors.split(','))
            scene.lut_steps === 1
                ? lut.draw(lut_ctx)
                : lut.drawDiscrete(lut_ctx, scene.lut_steps)
        }
    }

    // Initial draw of all LUTs in LUT list
    redraw_luts()

    // Handle redrawing all LUTs when the LUT steps value changes
    /** @type {HTMLInputElement} */
    const $lut_steps = document.getElementById('lut_steps')
    if ($lut_steps) {
        $lut_steps.value = scene.lut_steps.toString()
        $lut_steps.addEventListener('input', () => {
            scene.lut_steps = +$lut_steps.value
            redraw_luts()
            update_lut()
            params['lut_steps'] = scene.lut_steps
            update_url()
        })
    }

    const vb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vb)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        1.0,  1.0,
       -1.0,  1.0,
        1.0, -1.0,
       -1.0, -1.0,
    ]), gl.STATIC_DRAW)

    gl.viewport(0, 0, canvas.width, canvas.height)
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
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.bindBuffer(gl.ARRAY_BUFFER, tb)
        gl.bufferData(gl.ARRAY_BUFFER, scene.bounds, gl.STATIC_DRAW)
    })

    const $options = document.getElementById('options')
    document.getElementById('toggle_options')
        .addEventListener('click', () => $options.classList.toggle('hidden'))

    /**
     * Reference table to numeric parameters to be manipulated and passed to WebGL.
     * @type {{[_:string]: number}}
    */
    const params = {}

    const initial_url = new URL(window.location)
    console.log('initial params:')
    for (const [key, value] of initial_url.searchParams.entries()) {
        if (key === 'lut') {
            const decoded = value.split('-').map(c => '#' + c).join(',')
            params[key] = decoded
            ramp_canvas.dataset.colors = decoded
            console.log('lut', decoded)
            continue
        }
        console.log(key, +value)
        params[key] = +value
    }

    update_lut()

    /**
     * Sets the active URL to reflect the parameter values.
     */
    function update_url() {
        const url = new URL(window.location)
        for (const [ key, param ] of Object.entries(params)) {
            if (key === 'lut') continue
            switch (typeof param) {
                case 'string':
                    url.searchParams.set(key, param)
                    break;
                case 'number':
                    url.searchParams.set(key, param.toFixed(2))
                    break;
            }
        }

        const lut_encoded = ramp_canvas.dataset.colors.replaceAll(',', '-').replaceAll('#', '')
        url.searchParams.set('lut', lut_encoded)
        window.history.replaceState({}, '', url)
    }

    /**
     * Reference table to shader program locations.
     * @type {{[_:string]: WebGLUniformLocation}}
    */
    const locations = {}

    /**
     * Helper function to initialize a parameter.
     * @param {string} param_name 
     * @param {number} default_value 
     */
    function create_param(param_name, default_value) {
        /** @type {HTMLInputElement} */
        const element = document.getElementById(param_name)

        locations[param_name] = gl.getUniformLocation(program, param_name)
        params[param_name] = params.hasOwnProperty(param_name)
            ? params[param_name]
            : default_value

        if (element) {
            element.value = params[param_name].toString()
            element.addEventListener('input', () => {
                params[param_name] = +element.value
                update_url()
            })
        }
    }

    // Initialize all parameters
    create_param('n_sources', 30)
    // create_param('attenuation', 0)
    create_param('phase_velocity', 100)
    create_param('phase_delay', 0)
    create_param('power', 500)
    create_param('frequency', 2)
    create_param('k_noise', 0.04)
    create_param('k_alpha', 0.01)
    create_param('rp_type', RP_TYPE_CARDIOID)
    create_param('rp_direction', 0.0)
    create_param('warp', 0.5)
    update_url()

    rp_draw(ctx, scene, params)

    // Register event handlers for the radiation pattern canvas
    rp_canvas.addEventListener('wheel', (e) => {
        params.rp_direction = e.deltaY < 0
            ? params.rp_direction + 0.01
            : params.rp_direction - 0.01
        rp_draw(ctx, scene, params)
        update_url()
    })
    rp_canvas.addEventListener('mouseenter', (e) => {
        scene.rp_hover = true
        rp_draw(ctx, scene, params)
    })
    rp_canvas.addEventListener('mouseleave', (e) => {
        scene.rp_hover = false
        rp_draw(ctx, scene, params)
    })
    rp_canvas.style.cursor = 'pointer'
    rp_canvas.addEventListener('click', (e) => {
        params.rp_type = params.rp_type === RP_TYPE_UNIFORM
            ? RP_TYPE_CARDIOID
            : RP_TYPE_UNIFORM
        rp_draw(ctx, scene, params)
        update_url()
    })

    requestAnimationFrame(render.bind(null, gl, programInfo, scene, locations, params))
}

function render(gl, programInfo, scene, locations, params) {
    gl.uniform1f(programInfo.time, params.warp * performance.now() / 1000)
    gl.uniform2f(programInfo.mouse, mouse.x / gl.canvas.width, mouse.y / gl.canvas.height)

    for (const [ param_name, location ] of Object.entries(locations)) {
        gl.uniform1f(location, params[param_name])
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    requestAnimationFrame(render.bind(null, gl, programInfo, scene, locations, params))
}

setup()
