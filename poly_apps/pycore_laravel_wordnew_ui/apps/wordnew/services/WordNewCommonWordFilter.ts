const COMMON_ENGLISH_WORDS = new Set([
  'a', 'about', 'above', 'across', 'after', 'again', 'against', 'ago', 'all', 'almost', 'along', 'already',
  'also', 'although', 'always', 'am', 'among', 'an', 'and', 'another', 'any', 'anybody', 'anyone', 'anything',
  'anywhere', 'are', 'around', 'as', 'at', 'away', 'back', 'be', 'became', 'because', 'become', 'becomes',
  'been', 'before', 'began', 'behind', 'being', 'below', 'beside', 'between', 'beyond', 'both', 'but', 'by',
  'came', 'can', 'cannot', 'could', 'day', 'did', 'do', 'does', 'doing', 'done', 'down', 'during', 'each',
  'either', 'else', 'enough', 'even', 'ever', 'every', 'everybody', 'everyone', 'everything', 'everywhere',
  'few', 'first', 'for', 'found', 'from', 'further', 'gave', 'get', 'gets', 'getting', 'give', 'given', 'go',
  'goes', 'going', 'gone', 'good', 'got', 'great', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
  'hers', 'herself', 'him', 'himself', 'his', 'how', 'however', 'i', 'if', 'in', 'inside', 'into', 'is',
  'it', 'its', 'itself', 'just', 'keep', 'kept', 'know', 'known', 'knows', 'last', 'later', 'least', 'less',
  'let', 'like', 'likely', 'little', 'long', 'made', 'make', 'makes', 'many', 'may', 'maybe', 'me', 'might',
  'more', 'most', 'much', 'must', 'my', 'myself', 'near', 'need', 'never', 'new', 'next', 'no', 'nobody',
  'none', 'nor', 'not', 'nothing', 'now', 'of', 'off', 'often', 'old', 'on', 'once', 'one', 'only', 'or',
  'other', 'others', 'otherwise', 'our', 'ours', 'ourselves', 'out', 'outside', 'over', 'own', 'perhaps',
  'put', 'quite', 'rather', 'really', 'right', 'said', 'same', 'saw', 'say', 'says', 'second', 'see', 'seem',
  'seemed', 'seems', 'seen', 'several', 'she', 'should', 'since', 'so', 'some', 'somebody', 'someone',
  'something', 'sometimes', 'somewhere', 'still', 'such', 'take', 'taken', 'takes', 'taking', 'than', 'that',
  'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'therefore', 'these', 'they', 'thing',
  'things', 'think', 'this', 'those', 'though', 'through', 'thus', 'time', 'to', 'today', 'together', 'too',
  'took', 'toward', 'towards', 'under', 'until', 'up', 'upon', 'us', 'use', 'used', 'uses', 'using', 'very',
  'was', 'way', 'we', 'well', 'went', 'were', 'what', 'whatever', 'when', 'whenever', 'where', 'wherever',
  'whether', 'which', 'while', 'who', 'whoever', 'whom', 'whose', 'why', 'will', 'with', 'within', 'without',
  'would', 'yes', 'yet', 'you', 'your', 'yours', 'yourself', 'yourselves', 'able', 'actually', 'afterwards',
  'ain', 'aren', 'became', 'becoming', 'beforehand', 'besides', 'certain', 'certainly', 'clearly', 'come',
  'comes', 'concerning', 'consider', 'considering', 'despite', 'different', 'directly', 'especially', 'etc',
  'far', 'following', 'former', 'formerly', 'forth', 'gets', 'hence', 'immediate', 'indeed', 'instead', 'latter',
  'mainly', 'meanwhile', 'merely', 'mostly', 'namely', 'nearly', 'necessarily', 'neither', 'normally', 'obviously',
  'onto', 'particularly', 'possibly', 'probably', 'provided', 'regarding', 'relatively', 'respectively', 'round',
  'simply', 'soon', 'specifically', 'sure', 'thereafter', 'thereby', 'therein', 'thereupon', 'throughout',
  'truly', 'unless', 'unlike', 'usually', 'via', 'want', 'wanted', 'wants', 'wasn', 'weren', 'won', 'wouldn',
  "aren't", "can't", "couldn't", "didn't", "doesn't", "don't", "hadn't", "hasn't", "haven't", "he'd",
  "he'll", "he's", "i'd", "i'll", "i'm", "i've", "isn't", "it'd", "it'll", "it's", "let's", "mightn't",
  "mustn't", "shan't", "she'd", "she'll", "she's", "shouldn't", "that's", "there's", "they'd", "they'll",
  "they're", "they've", "wasn't", "we'd", "we'll", "we're", "we've", "weren't", "what's", "where's",
  "who's", "won't", "wouldn't", "you'd", "you'll", "you're", "you've",
]);

export function normalizeEnglishWord(value: string): string {
  return value.trim().toLowerCase().replace(/’/g, "'");
}

export function isCommonEnglishWord(value: string): boolean {
  const word = normalizeEnglishWord(value);
  if (!word || word.length <= 2 || COMMON_ENGLISH_WORDS.has(word)) return true;
  if (word.endsWith("'s") && COMMON_ENGLISH_WORDS.has(word.slice(0, -2))) return true;
  return false;
}

export function selectEnglishContentWords(text: string, limit: number | null = null): string[] {
  const matches = text.match(/[\p{L}]+(?:['’][\p{L}]+)*/gu) ?? [];
  const seen = new Set<string>();
  const selected: string[] = [];
  for (const rawWord of matches) {
    const word = normalizeEnglishWord(rawWord);
    if (isCommonEnglishWord(word) || seen.has(word)) continue;
    seen.add(word);
    selected.push(word);
    if (limit !== null && selected.length >= Math.max(0, limit)) break;
  }
  return selected;
}
