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

  currentIndex(
    segments: WordNewArticleSentenceSegment[],
    currentTime: number,
    duration: number,
  ): number {
    if (segments.length === 0 || duration <= 0) return -1;
    const ratio = Math.max(0, Math.min(1, currentTime / duration));
    const index = segments.findIndex((segment) => ratio >= segment.startRatio && ratio < segment.endRatio);
    return index >= 0 ? index : segments.length - 1;
  }
}

export const wordNewArticlePlaybackHighlighter = new WordNewArticlePlaybackHighlighterClass();
