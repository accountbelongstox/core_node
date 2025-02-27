const { SpeechConfig, SpeechSynthesizer, AudioConfig, ResultReason } = require('microsoft-cognitiveservices-speech-sdk');
    const fs = require('fs');
    const { env, gdir } = require('#@globalvars');
    const Base = require('#@base');
    const crypto = require('crypto');
    const path = require('path');
    const { audioProcessor } = require('./audio_processor.js');

    class TextToSpeechService extends Base {
        constructor(saveDir = null) { 
            super();
            this.subscriptionKey = env.getEnv('AZURE_SPEECH_KEY');
            this.region = env.getEnv('AZURE_SPEECH_REGION');
            this.saveDir = saveDir || gdir.getPublicDir('text_to_speech_cache');
            let speechSpeed = env.getEnv('AZURE_SPEECH_SPEED') || `1.0`;
            this.speechSpeed = parseFloat(speechSpeed);

            if (!this.subscriptionKey || !this.region || !this.saveDir) {
                this.error('Invalid subscriptionKey, region, or saveDir');
                return;
            }

            this.info(`TextToSpeechService: saveDir -> ${this.saveDir}`);
            const availableRegions = [
                'eastus', 'westus', 'centralus', 'northeurope',
                'westeurope', 'eastasia', 'southeastasia',
                'australiaeast', 'japaneast', 'uksouth'
            ];

            if (!this.region) {
                console.warn('Invalid region. Please choose from the following regions:');
                console.log(availableRegions.join(', '));
                this.warn('AZURE_REGION is empty');
                this.region = availableRegions[0];
            }

            this.speechConfig = SpeechConfig.fromSubscription(this.subscriptionKey, this.region);
            this.speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';

            if (!fs.existsSync(this.saveDir)) {
                fs.mkdirSync(this.saveDir, { recursive: true });
            }
        }

        generateMd5Hash(text) {
            return crypto.createHash('md5').update(text).digest('hex');
        }

        fileExists(fileName) {
            return fs.existsSync(fileName);
        }

        getWavFile(text) {
            const md5Hash = this.generateMd5Hash(text);
            const filePath = path.join(this.saveDir, `${md5Hash}.s.1.0.wav`);

            if (this.fileExists(filePath)) {
                this.success(`Returning cached file: ${filePath}`);
                return Promise.resolve(filePath);
            }

            const audioConfig = AudioConfig.fromAudioFileOutput(filePath);
            const synthesizer = new SpeechSynthesizer(this.speechConfig, audioConfig);

            return new Promise((resolve, reject) => {
                synthesizer.speakTextAsync(
                    text,
                    async (result) => {
                        if (result.reason === ResultReason.SynthesizingAudioCompleted) {
                            this.success(`Synthesis finished, saved to ${filePath}`);
                            if (this.speechSpeed !== 1.0) {
                                const adjustedFile = await audioProcessor.adjustSpeed(filePath, this.speechSpeed);
                                resolve(adjustedFile);
                            } else {
                                resolve(filePath);
                            }
                        } else {
                            this.error(`Speech synthesis failed: ${result.errorDetails}`);
                            reject(null);
                        }
                        synthesizer.close();
                    },
                    (error) => {
                        reject(error);
                        synthesizer.close();
                    }
                );
            });
        }
    }

    const textToSpeechService = new TextToSpeechService();
    module.exports = { textToSpeechService };