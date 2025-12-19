/*
 * Qt 6.10 Compatibility Updates:
 * - QOpenGLWidget moved to Qt OpenGL Widgets module (QT += openglwidgets)
 * - QOpenGLTexture requires Qt OpenGL module (QT += opengl)
 * - All QGL* classes removed, use QOpenGL* equivalents
 */

#include <QCoreApplication>
#include <QOpenGLTexture>
#include <QSurfaceFormat>

#include "qyuvopenglwidget.h"

// Store vertex coordinates and texture coordinates
// Stored together in vbo cache
// Use glVertexAttribPointer to specify access method
static const GLfloat coordinate[] = {
    // Vertex coordinates, store 4 xyz coordinates
    // Coordinate range is [-1,1], center point is 0,0
    // Z is always 0 for 2D images
    // GL_TRIANGLE_STRIP drawing method:
    // Use first 3 coordinates to draw a triangle, use last 3 coordinates to draw another triangle, exactly forms a rectangle
    // x     y     z
    -1.0f,
    -1.0f,
    0.0f,
    1.0f,
    -1.0f,
    0.0f,
    -1.0f,
    1.0f,
    0.0f,
    1.0f,
    1.0f,
    0.0f,

    // Texture coordinates, store 4 xy coordinates
    // Coordinate range is [0,1], bottom-left corner is 0,0
    0.0f,
    1.0f,
    1.0f,
    1.0f,
    0.0f,
    0.0f,
    1.0f,
    0.0f
};

// Vertex shader
static const QString s_vertShader = R"(
    attribute vec3 vertexIn;    // xyz vertex coordinates
    attribute vec2 textureIn;   // xy texture coordinates
    varying vec2 textureOut;    // Texture coordinates passed to fragment shader
    void main(void)
    {
        gl_Position = vec4(vertexIn, 1.0);  // 1.0 indicates vertexIn is a vertex position
        textureOut = textureIn; // Texture coordinates are passed directly to fragment shader
    }
)";

// Fragment shader
static QString s_fragShader = R"(
    varying vec2 textureOut;        // Texture coordinates passed from vertex shader
    uniform sampler2D textureY;     // uniform texture unit, can use multiple textures
    uniform sampler2D textureU;     // sampler2D is a 2D sampler
    uniform sampler2D textureV;     // Declare three YUV texture units
    void main(void)
    {
        vec3 yuv;
        vec3 rgb;

        // SDL2 BT709_SHADER_CONSTANTS
        // https://github.com/spurious/SDL-mirror/blob/4ddd4c445aa059bb127e101b74a8c5b59257fbe2/src/render/opengl/SDL_shaders_gl.c#L102
        const vec3 Rcoeff = vec3(1.1644,  0.000,  1.7927);
        const vec3 Gcoeff = vec3(1.1644, -0.2132, -0.5329);
        const vec3 Bcoeff = vec3(1.1644,  2.1124,  0.000);

        // Sample based on specified texture textureY and coordinates textureOut
        yuv.x = texture2D(textureY, textureOut).r;
        yuv.y = texture2D(textureU, textureOut).r - 0.5;
        yuv.z = texture2D(textureV, textureOut).r - 0.5;

        // Convert to RGB after sampling
        // Reduce brightness slightly
        yuv.x = yuv.x - 0.0625;
        rgb.r = dot(yuv, Rcoeff);
        rgb.g = dot(yuv, Gcoeff);
        rgb.b = dot(yuv, Bcoeff);
        // Output color value
        gl_FragColor = vec4(rgb, 1.0);
    }
)";

QYUVOpenGLWidget::QYUVOpenGLWidget(QWidget *parent) : QOpenGLWidget(parent)
{
    /*
    QSurfaceFormat format = QSurfaceFormat::defaultFormat();
    format.setColorSpace(QSurfaceFormat::sRGBColorSpace);
    format.setProfile(QSurfaceFormat::CompatibilityProfile);
    format.setMajorVersion(3);
    format.setMinorVersion(2);
    QSurfaceFormat::setDefaultFormat(format);
    */
}

QYUVOpenGLWidget::~QYUVOpenGLWidget()
{
    makeCurrent();
    m_vbo.destroy();
    deInitTextures();
    doneCurrent();
}

QSize QYUVOpenGLWidget::minimumSizeHint() const
{
    return QSize(50, 50);
}

QSize QYUVOpenGLWidget::sizeHint() const
{
    return size();
}

void QYUVOpenGLWidget::setFrameSize(const QSize &frameSize)
{
    if (m_frameSize != frameSize) {
        m_frameSize = frameSize;
        m_needUpdate = true;
        // inittexture immediately
        repaint();
    }
}

const QSize &QYUVOpenGLWidget::frameSize()
{
    return m_frameSize;
}

void QYUVOpenGLWidget::updateTextures(quint8 *dataY, quint8 *dataU, quint8 *dataV, quint32 linesizeY, quint32 linesizeU, quint32 linesizeV)
{
    if (m_textureInited) {
        updateTexture(m_texture[0], 0, dataY, linesizeY);
        updateTexture(m_texture[1], 1, dataU, linesizeU);
        updateTexture(m_texture[2], 2, dataV, linesizeV);
        update();
    }
}

void QYUVOpenGLWidget::initializeGL()
{
    initializeOpenGLFunctions();
    glDisable(GL_DEPTH_TEST);

    // Initialize vertex buffer object
    m_vbo.create();
    m_vbo.bind();
    m_vbo.allocate(coordinate, sizeof(coordinate));
    initShader();
    // Set background clear color to black
    glClearColor(0.0, 0.0, 0.0, 0.0);
    // Clear color background
    glClear(GL_COLOR_BUFFER_BIT);
}

void QYUVOpenGLWidget::paintGL()
{
    if (m_needUpdate) {
        deInitTextures();
        initTextures();
        m_needUpdate = false;
    }

    if (m_textureInited) {
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, m_texture[0]);

        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, m_texture[1]);

        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, m_texture[2]);

        glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    }
}

void QYUVOpenGLWidget::resizeGL(int width, int height)
{
    glViewport(0, 0, width, height);
    repaint();
}

void QYUVOpenGLWidget::initShader()
{
    // OpenGL ES requires manual precision specification for float, int, etc.
    if (QCoreApplication::testAttribute(Qt::AA_UseOpenGLES)) {
        s_fragShader.prepend(R"(
                             precision mediump int;
                             precision mediump float;
                             )");
    }
    m_shaderProgram.addShaderFromSourceCode(QOpenGLShader::Vertex, s_vertShader);
    m_shaderProgram.addShaderFromSourceCode(QOpenGLShader::Fragment, s_fragShader);
    m_shaderProgram.link();
    m_shaderProgram.bind();

    // Specify vertex coordinate access method in vbo
    // Parameters: parameter name in shader, vertex coordinates are float, starting offset 0, vertex coordinate type vec3, stride 3 floats
    m_shaderProgram.setAttributeBuffer("vertexIn", GL_FLOAT, 0, 3, 3 * sizeof(float));
    // Enable vertex attribute
    m_shaderProgram.enableAttributeArray("vertexIn");

    // Specify texture coordinate access method in vbo
    // Parameters: parameter name in shader, texture coordinates are float, starting offset 12 floats (skip 12 vertex coordinates stored before), texture coordinate type vec2, stride 2 floats
    m_shaderProgram.setAttributeBuffer("textureIn", GL_FLOAT, 12 * sizeof(float), 2, 2 * sizeof(float));
    m_shaderProgram.enableAttributeArray("textureIn");

    // Associate texture units in fragment shader with texture units in OpenGL (OpenGL generally provides 16 texture units)
    m_shaderProgram.setUniformValue("textureY", 0);
    m_shaderProgram.setUniformValue("textureU", 1);
    m_shaderProgram.setUniformValue("textureV", 2);
}

void QYUVOpenGLWidget::initTextures()
{
    // Create texture
    glGenTextures(1, &m_texture[0]);
    glBindTexture(GL_TEXTURE_2D, m_texture[0]);
    // Set texture scaling strategy
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // Set display strategy when texture exceeds coordinates in st directions
    glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_LUMINANCE, m_frameSize.width(), m_frameSize.height(), 0, GL_LUMINANCE, GL_UNSIGNED_BYTE, nullptr);

    glGenTextures(1, &m_texture[1]);
    glBindTexture(GL_TEXTURE_2D, m_texture[1]);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_LUMINANCE, m_frameSize.width() / 2, m_frameSize.height() / 2, 0, GL_LUMINANCE, GL_UNSIGNED_BYTE, nullptr);

    glGenTextures(1, &m_texture[2]);
    glBindTexture(GL_TEXTURE_2D, m_texture[2]);
    // Set texture scaling strategy
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    // Set display strategy when texture exceeds coordinates in st directions
    glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_LUMINANCE, m_frameSize.width() / 2, m_frameSize.height() / 2, 0, GL_LUMINANCE, GL_UNSIGNED_BYTE, nullptr);

    m_textureInited = true;
}

void QYUVOpenGLWidget::deInitTextures()
{
    if (QOpenGLFunctions::isInitialized(QOpenGLFunctions::d_ptr)) {
        glDeleteTextures(3, m_texture);
    }

    memset(m_texture, 0, sizeof(m_texture));
    m_textureInited = false;
}

void QYUVOpenGLWidget::updateTexture(GLuint texture, quint32 textureType, quint8 *pixels, quint32 stride)
{
    if (!pixels)
        return;

    QSize size = 0 == textureType ? m_frameSize : m_frameSize / 2;

    makeCurrent();
    glBindTexture(GL_TEXTURE_2D, texture);
    glPixelStorei(GL_UNPACK_ROW_LENGTH, static_cast<GLint>(stride));
    glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, size.width(), size.height(), GL_LUMINANCE, GL_UNSIGNED_BYTE, pixels);
    doneCurrent();
}
