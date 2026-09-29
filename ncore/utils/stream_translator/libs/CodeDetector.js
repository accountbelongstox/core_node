const config = require('../config/index.js');

class CodeDetector {
    constructor() {
        this.codeMarkers = config.codeMarkers;
        this.commentPatterns = config.commentPatterns;
        this.codeBlockMarkers = config.codeBlockMarkers;
    }

    isCodeContext(previousSentences) {
        let hasCodeMarker = false;
        let i;

        for (i = 0; i < previousSentences.length; i++) {
            const sentence = previousSentences[i].toLowerCase();
            for (let j = 0; j < this.codeMarkers.length; j++) {
                if (sentence.includes(this.codeMarkers[j])) {
                    hasCodeMarker = true;
                    break;
                }
            }
            if (hasCodeMarker) break;
        }

        return hasCodeMarker;
    }

    isInCodeBlock(sentence, codeBlockState) {
        let trimmed = sentence.trim();
        let i;

        if (!codeBlockState.inBlock) {
            for (i = 0; i < this.codeBlockMarkers.start.length; i++) {
                if (trimmed.startsWith(this.codeBlockMarkers.start[i])) {
                    codeBlockState.inBlock = true;
                    codeBlockState.marker = this.codeBlockMarkers.start[i];
                    break;
                }
            }
        }

        if (codeBlockState.inBlock) {
            const endMarkerIndex = this.codeBlockMarkers.start.indexOf(codeBlockState.marker);
            if (endMarkerIndex !== -1) {
                const endMarker = this.codeBlockMarkers.end[endMarkerIndex];
                if (trimmed.endsWith(endMarker) || trimmed === endMarker) {
                    codeBlockState.inBlock = false;
                    codeBlockState.marker = null;
                }
            }
            return true;
        }

        return false;
    }

    detectCommentType(sentence) {
        let trimmed = sentence.trimStart();
        let leadingSpaces = sentence.length - trimmed.length;
        let commentType = null;
        let isComment = false;
        let i;

        for (i = 0; i < this.commentPatterns.singleLine.length; i++) {
            if (trimmed.startsWith(this.commentPatterns.singleLine[i])) {
                isComment = true;
                commentType = 'single';
                break;
            }
        }

        if (!isComment) {
            for (i = 0; i < this.commentPatterns.multiLineStart.length; i++) {
                if (trimmed.startsWith(this.commentPatterns.multiLineStart[i])) {
                    isComment = true;
                    commentType = 'multi_start';
                    break;
                }
            }
        }

        if (!isComment) {
            for (i = 0; i < this.commentPatterns.multiLineEnd.length; i++) {
                if (trimmed.includes(this.commentPatterns.multiLineEnd[i])) {
                    isComment = true;
                    commentType = 'multi_end';
                    break;
                }
            }
        }

        return {
            isComment: isComment,
            commentType: commentType,
            leadingSpaces: leadingSpaces
        };
    }

    isEnglishOnly(sentence) {
        const chineseRegex = /[\u4e00-\u9fa5]/;
        return !chineseRegex.test(sentence);
    }

    shouldTranslate(sentence, context) {
        let isCodeCtx = context.isCodeContext;
        let inCodeBlock = context.inCodeBlock;
        let isComment = context.isComment;
        let isEnglish = this.isEnglishOnly(sentence);

        if (!isEnglish) {
            return false;
        }

        if (isCodeCtx && isComment) {
            return true;
        }

        if (!isCodeCtx && !inCodeBlock) {
            return true;
        }

        return false;
    }
}

module.exports = CodeDetector;
