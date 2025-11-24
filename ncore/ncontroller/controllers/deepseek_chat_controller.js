// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const { EventEmitter } = require('events');
const logger = require('#@logger');
const { getInstance } = require('#@singleton_browser');

class DeepSeekChatController extends EventEmitter {
    constructor() {
        super();

        this.name = 'deepseek_chat';
        this.isInitialized = false;
        this.baseUrl = 'https://chat.deepseek.com/';
        this.currentPage = null;
        this.singletonBrowser = null;
    }

    getName() {
        return this.name;
    }

    async initialize(options = {}) {
        if (this.isInitialized) {
            logger.warn('[DeepSeekChatController] Already initialized');
            return true;
        }

        logger.info('[DeepSeekChatController] Initializing...');

        this.singletonBrowser = getInstance();
        await this.singletonBrowser.initialize();

        this.isInitialized = true;
        logger.success('[DeepSeekChatController] Initialized successfully');
        this.emit('initialized', this.getStatus());

        return true;
    }

    getStatus() {
        return {
            name: this.name,
            initialized: this.isInitialized,
            baseUrl: this.baseUrl,
            hasActivePage: !!this.currentPage
        };
    }

    async ensurePage() {
        if (!this.currentPage) {
            this.currentPage = await this.singletonBrowser.createPage();
            await this.currentPage.goto(this.baseUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            await this.delay(2000);
        }
        return this.currentPage;
    }

    async checkLogin() {
        try {
            logger.info('[DeepSeekChatController] Checking login status...');

            const page = await this.ensurePage();

            const loginStatus = await page.evaluate(() => {
                const currentUrl = window.location.href;

                const isOnLoginPage = currentUrl.includes('/sign_in') ||
                                     currentUrl.includes('/login') ||
                                     currentUrl.includes('/auth');

                if (isOnLoginPage) {
                    return {
                        loggedIn: false,
                        reason: 'On login page',
                        url: currentUrl
                    };
                }

                const hasUserAvatar = document.querySelector('[class*="avatar"]') ||
                                     document.querySelector('[class*="user-menu"]') ||
                                     document.querySelector('[class*="profile"]');

                const hasChatInterface = document.querySelector('[class*="chat"]') ||
                                        document.querySelector('textarea') ||
                                        document.querySelector('[contenteditable="true"]');

                if (hasUserAvatar || hasChatInterface) {
                    return {
                        loggedIn: true,
                        reason: 'Chat interface detected',
                        url: currentUrl
                    };
                }

                return {
                    loggedIn: false,
                    reason: 'No chat interface found',
                    url: currentUrl
                };
            });

            if (loginStatus.loggedIn) {
                logger.success('[DeepSeekChatController] User is logged in');
                return {
                    success: true,
                    loggedIn: true,
                    message: 'User is logged in',
                    url: loginStatus.url
                };
            } else {
                logger.warn(`[DeepSeekChatController] User is not logged in: ${loginStatus.reason}`);
                return {
                    success: true,
                    loggedIn: false,
                    message: loginStatus.reason,
                    url: loginStatus.url
                };
            }
        } catch (error) {
            logger.error(`[DeepSeekChatController] Failed to check login: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async promptLogin() {
        try {
            logger.info('[DeepSeekChatController] Prompting user to login...');

            const page = await this.ensurePage();
            const currentUrl = page.url();

            return {
                success: true,
                message: 'Please login manually in the browser',
                url: currentUrl,
                instructions: 'The browser page is now open. Please login manually and then proceed with sending messages.'
            };
        } catch (error) {
            logger.error(`[DeepSeekChatController] Failed to prompt login: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async locateChatWindow() {
        try {
            logger.info('[DeepSeekChatController] Locating chat window...');

            const page = await this.ensurePage();

            const chatWindowInfo = await page.evaluate(() => {
                let chatInput = document.querySelector('textarea[placeholder*="Message"]') ||
                               document.querySelector('textarea[placeholder*="message"]') ||
                               document.querySelector('textarea[class*="chat"]') ||
                               document.querySelector('textarea[class*="input"]') ||
                               document.querySelector('div[contenteditable="true"][class*="chat"]') ||
                               document.querySelector('div[contenteditable="true"]') ||
                               document.querySelector('textarea');

                if (!chatInput) {
                    const allTextareas = document.querySelectorAll('textarea');
                    if (allTextareas.length > 0) {
                        chatInput = allTextareas[allTextareas.length - 1];
                    }
                }

                if (!chatInput) {
                    return {
                        found: false,
                        message: 'Chat input element not found',
                        debug: {
                            textareaCount: document.querySelectorAll('textarea').length,
                            contenteditableCount: document.querySelectorAll('[contenteditable="true"]').length
                        }
                    };
                }

                const inputRect = chatInput.getBoundingClientRect();

                return {
                    found: true,
                    inputType: chatInput.tagName.toLowerCase(),
                    isContentEditable: chatInput.contentEditable === 'true',
                    chatInput: {
                        x: inputRect.left + inputRect.width / 2,
                        y: inputRect.top + inputRect.height / 2,
                        width: inputRect.width,
                        height: inputRect.height
                    },
                    selector: chatInput.className ? `.${chatInput.className.split(' ')[0]}` : chatInput.tagName.toLowerCase()
                };
            });

            if (!chatWindowInfo.found) {
                logger.warn(`[DeepSeekChatController] Chat window not found: ${chatWindowInfo.message}`);
                if (chatWindowInfo.debug) {
                    logger.info(`[DeepSeekChatController] Debug: textareas=${chatWindowInfo.debug.textareaCount}, contenteditable=${chatWindowInfo.debug.contenteditableCount}`);
                }
                return {
                    success: false,
                    error: chatWindowInfo.message
                };
            }

            logger.success(`[DeepSeekChatController] Chat window located (${chatWindowInfo.inputType})`);
            return {
                success: true,
                chatWindowInfo
            };
        } catch (error) {
            logger.error(`[DeepSeekChatController] Failed to locate chat window: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async sendMessage(message) {
        let messagesBefore;

        try {
            logger.info(`[DeepSeekChatController] Sending message: ${message}`);

            const page = await this.ensurePage();

            messagesBefore = await page.evaluate(() => {
                const messages = document.querySelectorAll('[class*="message"]');
                return messages.length;
            });

            const locateResult = await this.locateChatWindow();
            if (!locateResult.success) {
                return {
                    success: false,
                    error: 'Failed to locate chat window: ' + locateResult.error
                };
            }

            const { chatInput, isContentEditable, inputType } = locateResult.chatWindowInfo;

            await page.mouse.click(chatInput.x, chatInput.y);
            await this.delay(500);

            if (isContentEditable) {
                await page.evaluate((text) => {
                    const activeElement = document.activeElement;
                    if (activeElement && activeElement.contentEditable === 'true') {
                        activeElement.textContent = text;
                        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }, message);
            } else {
                await page.keyboard.type(message, { delay: 30 });
            }

            await this.delay(500);

            const sendButton = await page.evaluate(() => {
                const buttons = document.querySelectorAll('button[type="submit"], button[class*="send"], button[aria-label*="send"], button[aria-label*="Send"]');
                for (const btn of buttons) {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                    }
                }
                return null;
            });

            if (sendButton) {
                await page.mouse.click(sendButton.x, sendButton.y);
            } else {
                await page.keyboard.press('Enter');
            }

            logger.success('[DeepSeekChatController] Message sent successfully');

            await this.delay(2000);

            return {
                success: true,
                message: 'Message sent successfully',
                messagesBefore: messagesBefore
            };
        } catch (error) {
            logger.error(`[DeepSeekChatController] Failed to send message: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async waitForResponse(previousMessageCount, timeout = 60000) {
        const page = await this.ensurePage();
        const startTime = Date.now();

        try {
            logger.info('[DeepSeekChatController] Waiting for response...');

            while (Date.now() - startTime < timeout) {
                const responseStatus = await page.evaluate((prevCount) => {
                    const messages = document.querySelectorAll('[class*="message"]');
                    const currentCount = messages.length;

                    const loadingIndicator = document.querySelector('[class*="loading"]') ||
                                            document.querySelector('[class*="typing"]') ||
                                            document.querySelector('[class*="generating"]');

                    return {
                        currentCount: currentCount,
                        isLoading: !!loadingIndicator,
                        hasNewMessage: currentCount > prevCount
                    };
                }, previousMessageCount);

                if (responseStatus.hasNewMessage && !responseStatus.isLoading) {
                    logger.info('[DeepSeekChatController] New message detected');
                    await this.delay(2000);
                    return true;
                }

                if (responseStatus.isLoading) {
                    logger.info('[DeepSeekChatController] Response in progress...');
                }

                await this.delay(1000);
            }

            logger.warn('[DeepSeekChatController] Response timeout');
            return false;
        } catch (error) {
            logger.error(`[DeepSeekChatController] Error waiting for response: ${error.message}`);
            return false;
        }
    }

    async getResponse() {
        try {
            logger.info('[DeepSeekChatController] Extracting response...');

            const page = await this.ensurePage();

            const response = await page.evaluate(() => {
                const messageContainers = document.querySelectorAll('[class*="message"]');
                const markdownContainers = document.querySelectorAll('[class*="markdown"], [class*="prose"], [class*="response"]');

                let targetMessages = messageContainers.length > 0 ? messageContainers : markdownContainers;

                if (targetMessages.length === 0) {
                    return {
                        success: false,
                        error: 'No messages found'
                    };
                }

                const lastMessage = targetMessages[targetMessages.length - 1];
                const text = lastMessage.textContent.trim();

                return {
                    success: true,
                    text: text,
                    totalMessages: targetMessages.length
                };
            });

            if (!response.success) {
                logger.warn('[DeepSeekChatController] Failed to extract response');
                return {
                    success: false,
                    error: response.error
                };
            }

            logger.success('[DeepSeekChatController] Response extracted successfully');
            return {
                success: true,
                response: response.text,
                totalMessages: response.totalMessages
            };
        } catch (error) {
            logger.error(`[DeepSeekChatController] Failed to get response: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async chat(message, options = {}) {
        const waitForResponse = options.waitForResponse !== undefined ? options.waitForResponse : true;
        const timeout = options.timeout || 60000;

        try {
            logger.info(`[DeepSeekChatController] Starting chat: ${message}`);

            const loginStatus = await this.checkLogin();
            if (!loginStatus.loggedIn) {
                return {
                    success: false,
                    error: 'Not logged in',
                    loginRequired: true,
                    loginUrl: this.baseUrl
                };
            }

            const sendResult = await this.sendMessage(message);
            if (!sendResult.success) {
                return {
                    success: false,
                    error: sendResult.error
                };
            }

            if (!waitForResponse) {
                return {
                    success: true,
                    messageSent: true,
                    waitingForResponse: false
                };
            }

            const responseReceived = await this.waitForResponse(sendResult.messagesBefore, timeout);
            if (!responseReceived) {
                return {
                    success: false,
                    error: 'Response timeout'
                };
            }

            const responseResult = await this.getResponse();
            if (!responseResult.success) {
                return {
                    success: false,
                    error: responseResult.error
                };
            }

            logger.success('[DeepSeekChatController] Chat completed successfully');
            return {
                success: true,
                message: message,
                response: responseResult.response,
                totalMessages: responseResult.totalMessages
            };
        } catch (error) {
            logger.error(`[DeepSeekChatController] Chat failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async analyzeDom() {
        try {
            logger.info('[DeepSeekChatController] Analyzing DOM structure...');

            const page = await this.ensurePage();

            const analysis = await page.evaluate(() => {
                const result = {
                    url: window.location.href,
                    textareas: [],
                    inputs: [],
                    contentEditables: [],
                    divWithRole: [],
                    possibleInputs: []
                };

                document.querySelectorAll('textarea').forEach((el, i) => {
                    result.textareas.push({
                        index: i,
                        className: el.className,
                        placeholder: el.placeholder,
                        id: el.id
                    });
                });

                document.querySelectorAll('input[type="text"], input:not([type])').forEach((el, i) => {
                    result.inputs.push({
                        index: i,
                        className: el.className,
                        placeholder: el.placeholder,
                        id: el.id,
                        type: el.type
                    });
                });

                document.querySelectorAll('[contenteditable="true"]').forEach((el, i) => {
                    result.contentEditables.push({
                        index: i,
                        tagName: el.tagName.toLowerCase(),
                        className: el.className,
                        id: el.id
                    });
                });

                document.querySelectorAll('[role="textbox"], [role="combobox"]').forEach((el, i) => {
                    const rect = el.getBoundingClientRect();
                    result.divWithRole.push({
                        index: i,
                        tagName: el.tagName.toLowerCase(),
                        role: el.getAttribute('role'),
                        className: el.className,
                        id: el.id,
                        rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
                    });
                });

                document.querySelectorAll('[class*="input"], [class*="chat"], [class*="editor"], [class*="compose"]').forEach((el, i) => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 100 && rect.height > 20 && rect.height < 500) {
                        result.possibleInputs.push({
                            index: i,
                            tagName: el.tagName.toLowerCase(),
                            className: el.className.substring(0, 100),
                            id: el.id,
                            rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
                        });
                    }
                });

                return result;
            });

            logger.info(`[DeepSeekChatController] DOM Analysis complete: ${analysis.textareas.length} textareas, ${analysis.inputs.length} inputs, ${analysis.contentEditables.length} contentEditables, ${analysis.divWithRole.length} role-based, ${analysis.possibleInputs.length} possible`);

            return {
                success: true,
                analysis: analysis
            };
        } catch (error) {
            logger.error(`[DeepSeekChatController] DOM analysis failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async closePage() {
        try {
            if (this.currentPage) {
                await this.currentPage.close();
                this.currentPage = null;
                logger.info('[DeepSeekChatController] Page closed');
            }
            return { success: true };
        } catch (error) {
            logger.error(`[DeepSeekChatController] Failed to close page: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async close() {
        try {
            await this.closePage();
            logger.info('[DeepSeekChatController] Controller closed');
        } catch (error) {
            logger.error(`[DeepSeekChatController] Error closing controller: ${error.message}`);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const deepseekChatController = new DeepSeekChatController();

module.exports = {
    DeepSeekChatController,
    deepseekChatController
};
