export interface WordNewArticleSentenceSegment {
  text: string;
  startRatio: number;
  endRatio: number;
}

class WordNewArticlePlaybackHighlighterClass {
  segment(text: string): WordNewArticleSentenceSegment[] {
    const matches = text.match(/[^.!?。！？]+[.!?。！？]+(?:["'”’」』)\]]*)?|[^.!?。！？]+$/gu) ?? [];
    const weights = matches.map((sentence) => Math.max(1, sentence.trim().length));
    const totalWeight = weights.reduce((total, weight) => total + weight, 0);
    let consumedWeight = 0;
    return matches.map((sentence, index) => {
      const startRatio = totalWeight > 0 ? consumedWeight / totalWeight : 0;
      consumedWeight += weights[index];
      return {
        text: sentence,
        startRatio,
        endRatio: totalWeight > 0 ? consumedWeight / totalWeight : 1,
      };
    });
  }

  indexAtRatio(segments: WordNewArticleSentenceSegment[], ratio: number): number {
    if (segments.length === 0) return -1;
    const clamped = Math.max(0, Math.min(1, ratio));
    const index = segments.findIndex((segment) => clamped >= segment.startRatio && clamped < segment.endRatio);
    return index >= 0 ? index : segments.length - 1;
  }

  currentIndex(
    segments: WordNewArticleSentenceSegment[],
    currentTime: number,
    duration: number,
  ): number {
    if (duration <= 0) return -1;
    return this.indexAtRatio(segments, currentTime / duration);
  }
}

export const wordNewArticlePlaybackHighlighter = new WordNewArticlePlaybackHighlighterClass();
