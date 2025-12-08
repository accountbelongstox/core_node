/**
 * WebGL YUV Renderer - 基于 QtScrcpy OpenGL 实现
 *
 * 使用 WebGL 着色器将 YUV420P 数据渲染到 Canvas
 */
export class WebGLYUVRenderer {
  private gl: WebGLRenderingContext;
  private canvas: HTMLCanvasElement;
  private shaderProgram: WebGLProgram | null = null;

  // YUV 纹理
  private textureY: WebGLTexture | null = null;
  private textureU: WebGLTexture | null = null;
  private textureV: WebGLTexture | null = null;

  private frameWidth: number = 0;
  private frameHeight: number = 0;

  // 顶点着色器（与 QtScrcpy 相同）
  private static readonly VERTEX_SHADER = `
    attribute vec3 vertexIn;
    attribute vec2 textureIn;
    varying vec2 textureOut;

    void main(void) {
      gl_Position = vec4(vertexIn, 1.0);
      textureOut = textureIn;
    }
  `;

  // 片段着色器（与 QtScrcpy 相同 - BT.709 色彩空间）
  private static readonly FRAGMENT_SHADER = `
    precision mediump float;

    varying vec2 textureOut;
    uniform sampler2D textureY;
    uniform sampler2D textureU;
    uniform sampler2D textureV;

    void main(void) {
      vec3 yuv;
      vec3 rgb;

      // BT.709 色彩空间转换系数（与 QtScrcpy 相同）
      const vec3 Rcoeff = vec3(1.1644,  0.000,  1.7927);
      const vec3 Gcoeff = vec3(1.1644, -0.2132, -0.5329);
      const vec3 Bcoeff = vec3(1.1644,  2.1124,  0.000);

      // 采样 YUV 三个平面
      yuv.x = texture2D(textureY, textureOut).r;
      yuv.y = texture2D(textureU, textureOut).r - 0.5;
      yuv.z = texture2D(textureV, textureOut).r - 0.5;

      // YUV → RGB 转换（GPU 加速）
      yuv.x = yuv.x - 0.0625;
      rgb.r = dot(yuv, Rcoeff);
      rgb.g = dot(yuv, Gcoeff);
      rgb.b = dot(yuv, Bcoeff);

      gl_FragColor = vec4(rgb, 1.0);
    }
  `;

  // 顶点坐标和纹理坐标（与 QtScrcpy 相同）
  private static readonly VERTICES = new Float32Array([
    // 顶点坐标 (x, y, z)
    -1.0, -1.0, 0.0,
     1.0, -1.0, 0.0,
    -1.0,  1.0, 0.0,
     1.0,  1.0, 0.0,
    // 纹理坐标 (u, v)
     0.0,  1.0,
     1.0,  1.0,
     0.0,  0.0,
     1.0,  0.0
  ]);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const gl = canvas.getContext('webgl', { 
      preserveDrawingBuffer: true,
      antialias: false 
    });
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    this.initShaders();
    this.initBuffers();
  }

  private initShaders(): void {
    const { gl } = this;

    // 编译顶点着色器
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, WebGLYUVRenderer.VERTEX_SHADER);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader compilation error: ' + gl.getShaderInfoLog(vertexShader));
    }

    // 编译片段着色器
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, WebGLYUVRenderer.FRAGMENT_SHADER);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader compilation error: ' + gl.getShaderInfoLog(fragmentShader));
    }

    // 链接着色器程序
    this.shaderProgram = gl.createProgram()!;
    gl.attachShader(this.shaderProgram, vertexShader);
    gl.attachShader(this.shaderProgram, fragmentShader);
    gl.linkProgram(this.shaderProgram);
    
    if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
      throw new Error('Program linking error: ' + gl.getProgramInfoLog(this.shaderProgram));
    }
    
    gl.useProgram(this.shaderProgram);

    // 设置纹理单元
    gl.uniform1i(gl.getUniformLocation(this.shaderProgram, 'textureY'), 0);
    gl.uniform1i(gl.getUniformLocation(this.shaderProgram, 'textureU'), 1);
    gl.uniform1i(gl.getUniformLocation(this.shaderProgram, 'textureV'), 2);
  }

  private initBuffers(): void {
    const { gl } = this;

    // 创建顶点缓冲对象 (VBO)
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, WebGLYUVRenderer.VERTICES, gl.STATIC_DRAW);

    // 设置顶点坐标属性
    const vertexIn = gl.getAttribLocation(this.shaderProgram!, 'vertexIn');
    gl.vertexAttribPointer(vertexIn, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertexIn);

    // 设置纹理坐标属性（从第12个浮点数开始，即3个顶点坐标 * 4字节）
    const textureIn = gl.getAttribLocation(this.shaderProgram!, 'textureIn');
    gl.vertexAttribPointer(textureIn, 2, gl.FLOAT, false, 0, 12 * 4);
    gl.enableVertexAttribArray(textureIn);
  }

  private initTextures(width: number, height: number): void {
    const { gl } = this;

    this.frameWidth = width;
    this.frameHeight = height;

    // 创建 Y 纹理
    this.textureY = this.createTexture(width, height);

    // 创建 U 纹理 (宽高各减半)
    this.textureU = this.createTexture(Math.ceil(width / 2), Math.ceil(height / 2));

    // 创建 V 纹理 (宽高各减半)
    this.textureV = this.createTexture(Math.ceil(width / 2), Math.ceil(height / 2));
  }

  private createTexture(width: number, height: number): WebGLTexture {
    const { gl } = this;

    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // 设置纹理参数
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // 分配纹理空间
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE,
      width, height, 0,
      gl.LUMINANCE, gl.UNSIGNED_BYTE, null
    );

    return texture;
  }

  /**
   * 渲染 YUV 帧
   *
   * @param yPlane - Y 平面数据 (Uint8Array)
   * @param uPlane - U 平面数据 (Uint8Array)
   * @param vPlane - V 平面数据 (Uint8Array)
   * @param width - 视频宽度
   * @param height - 视频高度
   * @param yStride - Y 平面步长（可选）
   * @param uStride - U 平面步长（可选）
   * @param vStride - V 平面步长（可选）
   */
  public renderFrame(
    yPlane: Uint8Array,
    uPlane: Uint8Array,
    vPlane: Uint8Array,
    width: number,
    height: number,
    yStride?: number,
    uStride?: number,
    vStride?: number
  ): void {
    const { gl } = this;

    // 初始化纹理（首次或尺寸变化时）
    if (width !== this.frameWidth || height !== this.frameHeight) {
      this.initTextures(width, height);
      // 调整 canvas 尺寸
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    // 更新 Y 纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textureY);
    if (yStride && yStride !== width) {
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, yStride);
    } else {
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    }
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0,
      width, height,
      gl.LUMINANCE, gl.UNSIGNED_BYTE,
      yPlane
    );

    // 更新 U 纹理
    const uWidth = Math.ceil(width / 2);
    const uHeight = Math.ceil(height / 2);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textureU);
    if (uStride && uStride !== uWidth) {
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, uStride);
    } else {
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    }
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0,
      uWidth, uHeight,
      gl.LUMINANCE, gl.UNSIGNED_BYTE,
      uPlane
    );

    // 更新 V 纹理
    const vWidth = Math.ceil(width / 2);
    const vHeight = Math.ceil(height / 2);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.textureV);
    if (vStride && vStride !== vWidth) {
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, vStride);
    } else {
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    }
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0,
      vWidth, vHeight,
      gl.LUMINANCE, gl.UNSIGNED_BYTE,
      vPlane
    );

    // 清除画布
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 绘制矩形（渲染 YUV → RGB）
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  public destroy(): void {
    const { gl } = this;

    if (this.textureY) gl.deleteTexture(this.textureY);
    if (this.textureU) gl.deleteTexture(this.textureU);
    if (this.textureV) gl.deleteTexture(this.textureV);
    if (this.shaderProgram) gl.deleteProgram(this.shaderProgram);
  }
}

