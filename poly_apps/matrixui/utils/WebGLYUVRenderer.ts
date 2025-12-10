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

  // Qt WebEngine UNPACK_ROW_LENGTH workaround flag
  private supportsUnpackRowLength: boolean | null = null;  // null = not tested yet
  private hasLoggedFallback: boolean = false;

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

    // Create U texture (YUV420P: half resolution)
    this.textureU = this.createTexture(width / 2, height / 2);

    // Create V texture (YUV420P: half resolution)
    this.textureV = this.createTexture(width / 2, height / 2);
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
   * Upload texture data with stride support and Qt WebEngine fallback
   *
   * Qt WebEngine may not support UNPACK_ROW_LENGTH properly,
   * so we need a fallback that manually copies row-by-row.
   */
  private uploadTextureWithStride(
    data: Uint8Array,
    width: number,
    height: number,
    stride: number | undefined
  ): void {
    const { gl } = this;

    // Fast path: no stride or stride equals width (tightly packed)
    if (!stride || stride === width) {
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0, 0, 0,
        width, height,
        gl.LUMINANCE, gl.UNSIGNED_BYTE,
        data
      );
      return;
    }

    // Test UNPACK_ROW_LENGTH support on first use
    if (this.supportsUnpackRowLength === null) {
      try {
        // Clear any previous errors
        while (gl.getError() !== gl.NO_ERROR) { /* clear */ }

        // Try using UNPACK_ROW_LENGTH
        gl.pixelStorei(gl.UNPACK_ROW_LENGTH, stride);
        const error = gl.getError();

        if (error === gl.NO_ERROR) {
          this.supportsUnpackRowLength = true;
          console.log('[WebGLYUVRenderer] ✓ UNPACK_ROW_LENGTH supported');
        } else {
          this.supportsUnpackRowLength = false;
          console.warn('[WebGLYUVRenderer] ✗ UNPACK_ROW_LENGTH not supported (Qt WebEngine limitation), using fallback');
        }
      } catch (e) {
        this.supportsUnpackRowLength = false;
        console.warn('[WebGLYUVRenderer] ✗ UNPACK_ROW_LENGTH test failed, using fallback:', e);
      }
    }

    // Method 1: Use UNPACK_ROW_LENGTH if supported
    if (this.supportsUnpackRowLength) {
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, stride);
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0, 0, 0,
        width, height,
        gl.LUMINANCE, gl.UNSIGNED_BYTE,
        data
      );
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);  // Reset
      return;
    }

    // Method 2: Fallback for Qt WebEngine - manually copy row by row
    if (!this.hasLoggedFallback) {
      console.log('[WebGLYUVRenderer] Using row-by-row fallback for stride (Qt WebEngine)');
      console.log(`[WebGLYUVRenderer] Fallback details: width=${width}, height=${height}, stride=${stride}`);
      console.log(`[WebGLYUVRenderer] Source data size: ${data.length} bytes`);
      console.log(`[WebGLYUVRenderer] Expected packed size: ${width * height} bytes`);
      this.hasLoggedFallback = true;
    }

    // Create tightly packed buffer
    const packedData = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      const srcOffset = y * stride;
      const dstOffset = y * width;
      packedData.set(data.subarray(srcOffset, srcOffset + width), dstOffset);
    }

    // Log first packed data for debugging
    if (!this.hasLoggedFallback) {
      const sample = Array.from(packedData.slice(0, 16)).map(v => v.toString(16).padStart(2, '0')).join(' ');
      console.log(`[WebGLYUVRenderer] First 16 bytes of packed data: ${sample}`);
    }

    // Upload packed data
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0, 0, 0,
      width, height,
      gl.LUMINANCE, gl.UNSIGNED_BYTE,
      packedData
    );
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
  // Debug logging flag
  private hasLoggedFirstRender: boolean = false;

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

    const isFirstRender = !this.hasLoggedFirstRender;
    if (isFirstRender) {
      console.log('[WebGLYUVRenderer] 🎬 First frame render starting...');
      console.log(`[WebGLYUVRenderer] Frame dimensions: ${width}x${height}`);
      console.log(`[WebGLYUVRenderer] Y plane: ${yPlane.length} bytes, stride: ${yStride || 'none'}`);
      console.log(`[WebGLYUVRenderer] U plane: ${uPlane.length} bytes, stride: ${uStride || 'none'}`);
      console.log(`[WebGLYUVRenderer] V plane: ${vPlane.length} bytes, stride: ${vStride || 'none'}`);
      this.hasLoggedFirstRender = true;
    }

    // 初始化纹理（首次或尺寸变化时）
    if (width !== this.frameWidth || height !== this.frameHeight) {
      if (isFirstRender) {
        console.log(`[WebGLYUVRenderer] Initializing textures for ${width}x${height}...`);
      }
      this.initTextures(width, height);
      // 调整 canvas 尺寸
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
      if (isFirstRender) {
        console.log(`[WebGLYUVRenderer] ✓ Canvas resized to ${width}x${height}`);
        console.log(`[WebGLYUVRenderer] ✓ Viewport set to ${width}x${height}`);
      }
    }

    // 更新 Y 纹理
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textureY);
    if (isFirstRender) console.log('[WebGLYUVRenderer] Uploading Y texture...');
    this.uploadTextureWithStride(yPlane, width, height, yStride);
    if (isFirstRender) {
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        console.error(`[WebGLYUVRenderer] ✗ Y texture upload error: ${error}`);
      } else {
        console.log('[WebGLYUVRenderer] ✓ Y texture uploaded');
      }
    }

    // Update U texture (YUV420P: U plane is half resolution)
    const uWidth = width / 2;
    const uHeight = height / 2;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textureU);
    if (isFirstRender) console.log(`[WebGLYUVRenderer] Uploading U texture (${uWidth}x${uHeight})...`);
    this.uploadTextureWithStride(uPlane, uWidth, uHeight, uStride);
    if (isFirstRender) {
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        console.error(`[WebGLYUVRenderer] ✗ U texture upload error: ${error}`);
      } else {
        console.log('[WebGLYUVRenderer] ✓ U texture uploaded');
      }
    }

    // Update V texture (YUV420P: V plane is half resolution)
    const vWidth = width / 2;
    const vHeight = height / 2;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.textureV);
    if (isFirstRender) console.log(`[WebGLYUVRenderer] Uploading V texture (${vWidth}x${vHeight})...`);
    this.uploadTextureWithStride(vPlane, vWidth, vHeight, vStride);
    if (isFirstRender) {
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        console.error(`[WebGLYUVRenderer] ✗ V texture upload error: ${error}`);
      } else {
        console.log('[WebGLYUVRenderer] ✓ V texture uploaded');
      }
    }

    // 清除画布
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (isFirstRender) console.log('[WebGLYUVRenderer] ✓ Canvas cleared');

    // 绘制矩形（渲染 YUV → RGB）
    if (isFirstRender) {
      console.log('[WebGLYUVRenderer] Drawing triangle strip...');
      console.log(`[WebGLYUVRenderer] Shader program: ${this.shaderProgram ? 'valid' : 'null'}`);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (isFirstRender) {
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        console.error(`[WebGLYUVRenderer] ✗ Draw error: ${error}`);
      } else {
        console.log('[WebGLYUVRenderer] ✓ Draw completed successfully');
        console.log('[WebGLYUVRenderer] 🎬 First frame render complete!');

        // Sample a pixel to verify it's not black
        const pixels = new Uint8Array(4);
        gl.readPixels(width / 2, height / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        console.log(`[WebGLYUVRenderer] Center pixel: R=${pixels[0]} G=${pixels[1]} B=${pixels[2]} A=${pixels[3]}`);
      }
    }
  }

  public destroy(): void {
    const { gl } = this;

    if (this.textureY) gl.deleteTexture(this.textureY);
    if (this.textureU) gl.deleteTexture(this.textureU);
    if (this.textureV) gl.deleteTexture(this.textureV);
    if (this.shaderProgram) gl.deleteProgram(this.shaderProgram);
  }
}

