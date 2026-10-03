/** Lorem ipsum generator: classic vocabulary, sentence and paragraph assembly. */
export type LoremUnit = 'words' | 'sentences' | 'paragraphs';

const OPENING = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit'];

const VOCABULARY = ('a ac accumsan ad aenean aliquam aliquet amet ante aptent arcu at auctor augue bibendum blandit commodo condimentum congue consectetur consequat conubia convallis cras cubilia curabitur curae cursus dapibus diam dictum dictumst dignissim dis dolor donec dui duis egestas eget eleifend elementum elit enim erat eros est et etiam eu euismod facilisi facilisis fames faucibus felis fermentum feugiat fringilla fusce gravida habitant habitasse hac hendrerit himenaeos iaculis id imperdiet in inceptos integer interdum ipsum justo lacinia lacus laoreet lectus leo libero ligula litora lobortis lorem luctus maecenas magna magnis malesuada massa mattis mauris metus mi molestie mollis montes morbi nam nascetur natoque nec neque netus nibh nisi nisl non nostra nulla nullam nunc odio orci ornare parturient pellentesque penatibus per pharetra phasellus placerat platea porta porttitor posuere potenti praesent pretium primis proin pulvinar purus quam quis quisque rhoncus ridiculus risus rutrum sagittis sapien scelerisque sed sem semper senectus sit sociis sociosqu sodales sollicitudin suscipit suspendisse taciti tellus tempor tempus tincidunt torquent tortor tristique turpis ullamcorper ultrices ultricies urna ut varius vehicula vel velit venenatis vestibulum vitae vivamus viverra volutpat vulputate').split(' ');

export type RandomSource = () => number;

const pick = (random: RandomSource): string => VOCABULARY[Math.floor(random() * VOCABULARY.length)];

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const makeWords = (count: number, startWithLorem: boolean, random: RandomSource): string[] => {
  const words: string[] = startWithLorem ? OPENING.slice(0, Math.min(count, OPENING.length)) : [];
  while (words.length < count) words.push(pick(random));
  return words;
};

const makeSentence = (startWithLorem: boolean, random: RandomSource): string => {
  const length = 8 + Math.floor(random() * 10);
  const words = makeWords(length, startWithLorem, random);
  const commaAt = length > 10 ? 4 + Math.floor(random() * 3) : -1;
  const text = words.map((word, index) => (index === commaAt ? `${word},` : word)).join(' ');
  return `${capitalize(text)}.`;
};

export const generateLorem = (unit: LoremUnit, count: number, startWithLorem: boolean, random: RandomSource = Math.random): string[] => {
  if (unit === 'words') return [makeWords(count, startWithLorem, random).join(' ')];
  if (unit === 'sentences') {
    return [Array.from({ length: count }, (_, index) => makeSentence(startWithLorem && index === 0, random)).join(' ')];
  }
  return Array.from({ length: count }, (_, paragraph) => {
    const sentences = 3 + Math.floor(random() * 4);
    return Array.from({ length: sentences }, (__, index) => makeSentence(startWithLorem && paragraph === 0 && index === 0, random)).join(' ');
  });
};

export const joinLorem = (paragraphs: string[], html: boolean): string => (
  html ? paragraphs.map((text) => `<p>${text}</p>`).join('\n') : paragraphs.join('\n\n')
);
