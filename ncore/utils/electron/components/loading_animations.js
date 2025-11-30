// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');

class LoadingAnimations {
    static getAnimation(style = 1, text = 'Loading...', backgroundColor = '#1e1e1e') {
        const animations = {
            1: LoadingAnimations._generateSpinnerAnimation(text, backgroundColor),
            2: LoadingAnimations._generateDotsAnimation(text, backgroundColor),
            3: LoadingAnimations._generatePulseAnimation(text, backgroundColor),
            4: LoadingAnimations._generateRippleAnimation(text, backgroundColor),
            5: LoadingAnimations._generateBounceAnimation(text, backgroundColor),
            6: LoadingAnimations._generateCircleAnimation(text, backgroundColor),
            7: LoadingAnimations._generateBarsAnimation(text, backgroundColor),
            8: LoadingAnimations._generateGradientAnimation(text, backgroundColor),
            9: LoadingAnimations._generateOrbitAnimation(text, backgroundColor),
            10: LoadingAnimations._generateWaveAnimation(text, backgroundColor),
            11: LoadingAnimations._generateSquareAnimation(text, backgroundColor),
            12: LoadingAnimations._generateHeartbeatAnimation(text, backgroundColor),
            13: LoadingAnimations._generateProgressAnimation(text, backgroundColor),
            14: LoadingAnimations._generateGlowAnimation(text, backgroundColor)
        };

        return animations[style] || animations[1];
    }

    static show(window, style = 1, text = 'Loading...', backgroundColor = '#1e1e1e') {
        try {
            const html = LoadingAnimations.getAnimation(style, text, backgroundColor);
            const encodedHTML = encodeURIComponent(html);
            window.loadURL(`data:text/html;charset=utf-8,${encodedHTML}`);
            logger.info(`[LoadingAnimations] Showing loading animation (style ${style})`);
        } catch (error) {
            logger.error(`[LoadingAnimations] Failed to show animation: ${error.message}`);
        }
    }

    static _generateSpinnerAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei UI', sans-serif;
        }
        .loading-container { text-align: center; }
        .spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            border-top: 4px solid #3498db;
            width: 60px;
            height: 60px;
            animation: spin 1s linear infinite;
            margin: 0 auto 24px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .loading-text {
            color: #ffffff;
            font-size: 16px;
            font-weight: 400;
        }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="spinner"></div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }

    static _generateDotsAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loading-container { text-align: center; }
        .dots {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-bottom: 24px;
        }
        .dot {
            width: 16px;
            height: 16px;
            background-color: #3498db;
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
        }
        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }
        .loading-text { color: #ffffff; font-size: 16px; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }

    static _generatePulseAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loading-container { text-align: center; }
        .pulse {
            width: 60px;
            height: 60px;
            background-color: #3498db;
            border-radius: 50%;
            margin: 0 auto 24px;
            animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.6; }
            100% { transform: scale(1); opacity: 1; }
        }
        .loading-text { color: #ffffff; font-size: 16px; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="pulse"></div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }

    static _generateRippleAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loading-container { text-align: center; }
        .ripple {
            position: relative;
            width: 60px;
            height: 60px;
            margin: 0 auto 24px;
        }
        .ripple div {
            position: absolute;
            border: 4px solid #3498db;
            opacity: 1;
            border-radius: 50%;
            animation: ripple 1.5s cubic-bezier(0, 0.2, 0.8, 1) infinite;
        }
        .ripple div:nth-child(2) { animation-delay: -0.5s; }
        @keyframes ripple {
            0% {
                top: 28px;
                left: 28px;
                width: 0;
                height: 0;
                opacity: 1;
            }
            100% {
                top: 0;
                left: 0;
                width: 56px;
                height: 56px;
                opacity: 0;
            }
        }
        .loading-text { color: #ffffff; font-size: 16px; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="ripple">
            <div></div>
            <div></div>
        </div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }

    static _generateBounceAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loading-container { text-align: center; }
        .bounce-container {
            display: flex;
            gap: 8px;
            justify-content: center;
            margin-bottom: 24px;
        }
        .bounce {
            width: 16px;
            height: 16px;
            background-color: #3498db;
            border-radius: 50%;
            animation: bounce-up 0.6s infinite alternate;
        }
        .bounce:nth-child(2) { animation-delay: 0.2s; }
        .bounce:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce-up {
            to { transform: translateY(-20px); }
        }
        .loading-text { color: #ffffff; font-size: 16px; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="bounce-container">
            <div class="bounce"></div>
            <div class="bounce"></div>
            <div class="bounce"></div>
        </div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }

    static _generateCircleAnimation(text, bg) {
        return LoadingAnimations._generateSpinnerAnimation(text, bg);
    }

    static _generateBarsAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loading-container { text-align: center; }
        .bars {
            display: flex;
            gap: 6px;
            justify-content: center;
            align-items: flex-end;
            height: 60px;
            margin-bottom: 24px;
        }
        .bar {
            width: 8px;
            background-color: #3498db;
            animation: scale-up 1.2s infinite ease-in-out;
        }
        .bar:nth-child(1) { animation-delay: 0s; }
        .bar:nth-child(2) { animation-delay: 0.1s; }
        .bar:nth-child(3) { animation-delay: 0.2s; }
        .bar:nth-child(4) { animation-delay: 0.3s; }
        .bar:nth-child(5) { animation-delay: 0.4s; }
        @keyframes scale-up {
            0%, 40%, 100% { height: 30%; }
            20% { height: 100%; }
        }
        .loading-text { color: #ffffff; font-size: 16px; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="bars">
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
            <div class="bar"></div>
        </div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }

    static _generateGradientAnimation(text, bg) {
        return LoadingAnimations._generatePulseAnimation(text, bg);
    }

    static _generateOrbitAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loading-container { text-align: center; }
        .orbit {
            width: 60px;
            height: 60px;
            position: relative;
            margin: 0 auto 24px;
        }
        .orbit-center {
            width: 12px;
            height: 12px;
            background-color: #3498db;
            border-radius: 50%;
            position: absolute;
            top: 24px;
            left: 24px;
        }
        .orbit-ball {
            width: 12px;
            height: 12px;
            background-color: #3498db;
            border-radius: 50%;
            position: absolute;
            top: 0;
            left: 24px;
            animation: orbit 1.5s linear infinite;
        }
        @keyframes orbit {
            from { transform: rotate(0deg) translateX(24px) rotate(0deg); }
            to { transform: rotate(360deg) translateX(24px) rotate(-360deg); }
        }
        .loading-text { color: #ffffff; font-size: 16px; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="orbit">
            <div class="orbit-center"></div>
            <div class="orbit-ball"></div>
        </div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }

    static _generateWaveAnimation(text, bg) {
        return LoadingAnimations._generateBarsAnimation(text, bg);
    }

    static _generateSquareAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loading-container { text-align: center; }
        .square {
            width: 60px;
            height: 60px;
            background-color: #3498db;
            margin: 0 auto 24px;
            animation: rotate 2s linear infinite;
        }
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .loading-text { color: #ffffff; font-size: 16px; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="square"></div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }

    static _generateHeartbeatAnimation(text, bg) {
        return LoadingAnimations._generatePulseAnimation(text, bg);
    }

    static _generateProgressAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loading-container { text-align: center; }
        .progress-bar {
            width: 200px;
            height: 6px;
            background-color: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            overflow: hidden;
            margin: 0 auto 24px;
        }
        .progress-fill {
            height: 100%;
            background-color: #3498db;
            animation: progress 2s ease-in-out infinite;
        }
        @keyframes progress {
            0% { width: 0%; }
            50% { width: 100%; }
            100% { width: 0%; }
        }
        .loading-text { color: #ffffff; font-size: 16px; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }

    static _generateGlowAnimation(text, bg) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background-color: ${bg};
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .loading-container { text-align: center; }
        .glow {
            width: 60px;
            height: 60px;
            background-color: #3498db;
            border-radius: 50%;
            margin: 0 auto 24px;
            animation: glow 1.5s ease-in-out infinite;
        }
        @keyframes glow {
            0%, 100% {
                box-shadow: 0 0 10px #3498db, 0 0 20px #3498db;
            }
            50% {
                box-shadow: 0 0 20px #3498db, 0 0 40px #3498db, 0 0 60px #3498db;
            }
        }
        .loading-text { color: #ffffff; font-size: 16px; }
    </style>
</head>
<body>
    <div class="loading-container">
        <div class="glow"></div>
        <div class="loading-text">${text}</div>
    </div>
</body>
</html>`;
    }
}

module.exports = LoadingAnimations;
