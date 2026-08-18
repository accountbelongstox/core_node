export interface VocabularyCoverPromptInput {
  id: number;
  name: string;
  category?: string;
  difficulty?: string;
}

const VISUAL_STYLES = [
  'Japanese woodblock-inspired printmaking',
  'luminous stained-glass illustration',
  'hand-cut editorial paper collage',
  'cinematic matte painting',
  'delicate botanical cyanotype',
  'bold risograph poster art',
  'ornate art nouveau illustration',
  'mid-century modern screen print',
  'surrealist oil painting',
  'tactile stop-motion clay art',
  'intricate ink-and-wash illustration',
  'retro-futurist airbrush art',
  'woven textile tapestry',
  'architectural gouache rendering',
  'layered linocut print',
  'dreamlike soft-pastel painting',
  'crystalline low-poly rendering',
  'vintage natural-history engraving',
  'contemporary editorial photography',
  'ceramic bas-relief artwork',
  'paper-theatre shadow-box art',
  'luminous holographic mixed media',
  'mosaic tile illustration',
  'chalk and charcoal mural art',
  'embroidered folk-art tableau',
  'minimal Swiss-inspired abstraction',
  'maximalist digital collage',
  'soft inflatable 3D sculpture',
  'atmospheric watercolor landscape',
  'precision technical cutaway art',
  'neon noir graphic novel art',
  'organic biomorphic generative art',
] as const;

const CRAFT_TREATMENTS = [
  'visible deckled edges, layered fibers, and hand-made imperfections',
  'translucent color fields with jewel-like refraction',
  'grainy ink overlap and deliberate registration shifts',
  'fine cross-hatching with restrained engraved detail',
  'velvety pigments and softly blended edges',
  'glazed surfaces with subtle kiln texture',
  'dramatic filmic depth, volumetric atmosphere, and realistic scale',
  'stitched contours and richly varied thread textures',
  'carved marks, uneven ink pressure, and strong negative space',
  'hand-painted brush rhythm and opaque matte color',
  'layered translucent vellum and cast paper shadows',
  'polished geometry with controlled crystalline facets',
  'analog halftone grain and a limited overprinted color system',
  'soft tactile forms with convincing miniature materials',
  'weathered fresco texture with elegant pigment variation',
  'shimmering foil-like highlights used only as visual accents',
  'fluid wet-on-wet blooms balanced by crisp dry-brush detail',
  'precise modular construction with subtle optical rhythm',
  'found-material collage with torn edges and surprising scale shifts',
  'powdery charcoal depth with energetic chalk accents',
  'glowing edge light and deep graphic shadows',
  'natural fibers, knots, and dimensional woven relief',
  'museum-diorama craftsmanship with believable miniature depth',
  'clean studio realism interrupted by one impossible visual transformation',
] as const;

const SCENE_ARCHETYPES = [
  'a sweeping narrative landscape with several paths, landmarks, and discoveries across foreground, middle distance, and horizon',
  'an imaginative cabinet of curiosities containing many theme-related objects arranged as a rich visual story',
  'a floating impossible city whose architecture metaphorically expresses the theme',
  'a layered ecosystem cross-section showing relationships above ground, at ground level, and below the surface',
  'a surreal still life where familiar objects transform into one another across the frame',
  'a kinetic workshop of interconnected mechanisms, tools, materials, and moving parts',
  'a theatrical miniature world with scenery, depth, entrances, and an unfolding visual event',
  'an expansive celestial environment with planets, clouds, light trails, and symbolic constellations made only from imagery',
  'an underwater world populated by varied forms, currents, structures, and points of discovery',
  'an architectural cutaway containing several distinct spaces and small visual narratives',
  'a dense botanical world in which leaves, roots, flowers, seeds, and creatures create an exploratory journey',
  'a dreamlike interior whose walls, windows, furniture, and landscape merge into a continuous scene',
  'a sequence of connected islands, bridges, vessels, and changing environments',
  'a sculptural installation assembled from diverse theme-related materials rather than a single emblem',
  'a lively market-like tableau of objects, textures, containers, and pathways with no signage',
  'a geological world of caverns, strata, crystals, water, and hidden chambers',
  'a sweeping weather system where clouds, wind, rain, light, and terrain form the visual narrative',
  'a richly layered memory palace with doors, stairs, rooms, gardens, and unexpected transitions',
  'a macro-scale natural world where tiny theme-related details feel monumental and immersive',
  'a panoramic journey moving through several distinct environments in one continuous composition',
  'an abstract field built from many interacting masses, textures, currents, and spatial layers',
  'a carefully staged photographic set with multiple objects, shadows, reflections, and material contrasts',
  'a woven story-world in which many figurative motifs flow through borders, fields, and overlapping scenes',
  'a playful chain reaction of objects and environments spanning the full cover',
] as const;

const COMPOSITIONS = [
  'an asymmetric editorial composition with a strong visual path from lower left to upper right',
  'a deep panoramic composition with large foreground forms and a distant atmospheric horizon',
  'an overhead flat-lay composition that fills the frame through varied scale and controlled overlap',
  'a cinematic wide-angle composition viewed from within the scene rather than from outside it',
  'a cascading diagonal composition with several focal moments instead of one central symbol',
  'a layered stage composition with foreground framing, an active middle plane, and a surprising background reveal',
  'a quiet edge-weighted composition using intentional open space balanced by a detailed visual cluster',
  'a sweeping S-curve composition that guides the eye through multiple discoveries',
  'a fragmented collage composition with irregular panels that still reads as one unified cover',
  'a low viewpoint composition that gives the world monumental scale and depth',
  'a top-to-bottom journey composition with changing scale, rhythm, and density',
  'a close macro crop that reveals a much larger world continuing beyond every edge',
  'an architectural perspective composition built around passages, openings, and receding layers',
  'a flowing composition of overlapping forms with no isolated central badge or medallion',
  'a horizonless immersive composition that surrounds the viewer with imagery',
  'a restrained triptych-like rhythm without visible frames or borders',
  'a dynamic off-axis composition with controlled tension and strong directional movement',
  'a balanced all-over composition whose many elements reward close exploration',
] as const;

const CAMERA_AND_PERSPECTIVE = [
  'wide cinematic lens with strong near-to-far depth',
  'orthographic cutaway perspective',
  'bird-eye perspective with map-like spatial clarity',
  'ground-level perspective with an immersive sense of scale',
  'macro photography perspective with shallow selective focus',
  'tilted isometric perspective with layered spatial logic',
  'telephoto compression that creates elegant overlapping planes',
  'fisheye-like spatial sweep used subtly and tastefully',
  'stage-like frontal perspective with dimensional scenery',
  'aerial oblique perspective with a long visual journey',
  'close still-life perspective with tactile material detail',
  'deep one-point perspective through successive openings',
] as const;

const COLOR_PALETTES = [
  'saffron, ultramarine, parchment, and charcoal',
  'deep forest green, oxidized copper, cream, and coral',
  'electric violet, midnight blue, cyan, and warm peach',
  'terracotta, dusty rose, indigo, and sunlit ochre',
  'sea-glass teal, kelp green, pearl, and ember orange',
  'black, ivory, vermilion, and muted gold',
  'lavender haze, plum, pale mint, and apricot',
  'cobalt, tomato red, butter yellow, and cool white',
  'moss, clay, sand, and stormy blue',
  'burgundy, petrol blue, blush, and brass',
  'graphite, silver, icy blue, and one vivid magenta accent',
  'warm monochrome sepia with small turquoise accents',
  'night-sky navy, moonlit gray, amber, and emerald',
  'coral reef pink, aqua, deep purple, and shell white',
  'pine green, cranberry, pale gold, and smoke gray',
  'sun-bleached cyan, faded orange, ink black, and paper white',
  'soft grayscale with translucent spectral highlights',
  'rich aubergine, olive, copper, and pale sky blue',
] as const;

const LIGHTING_DIRECTIONS = [
  'long golden-hour light with sculptural shadows',
  'cool moonlight crossed by small warm practical glows',
  'soft overcast daylight revealing every material clearly',
  'dramatic backlighting with luminous atmospheric depth',
  'dappled light moving across the scene through unseen foliage',
  'museum-display lighting with precise pools of illumination',
  'underwater caustic light with layered rays and soft diffusion',
  'dawn light emerging gradually through mist',
  'high-contrast theatrical lighting with colored shadow edges',
  'bright diffuse studio light with crisp material separation',
  'internal bioluminescent light emerging from multiple scene elements',
  'storm-break lighting where a focused shaft of sunlight crosses deep clouds',
] as const;

const ATMOSPHERES = [
  'curious, intelligent, and quietly adventurous',
  'energetic, playful, and full of discovery',
  'mysterious, sophisticated, and contemplative',
  'optimistic, expansive, and fresh',
  'warm, tactile, and gently nostalgic',
  'bold, surprising, and experimental',
  'calm, immersive, and dreamlike',
  'precise, inventive, and intellectually engaging',
  'wonder-filled, cinematic, and slightly uncanny',
  'elegant, poetic, and richly atmospheric',
] as const;

const DETAIL_DIRECTIONS = [
  'many distinct visual discoveries at large, medium, and small scales',
  'a clear primary journey supported by secondary scenes and tiny material details',
  'varied silhouettes, organic forms, constructed forms, and environmental texture',
  'strong depth separation and enough complexity to remain interesting as a large cover',
  'repeated visual rhythms that evolve across the image instead of repeating identically',
  'a few bold masses balanced by intricate pockets of detail and quiet breathing room',
  'believable material variation across every major part of the scene',
  'subtle visual metaphors embedded throughout the environment without using symbols as labels',
] as const;

const STYLE_PAIR_COUNT = VISUAL_STYLES.length * (VISUAL_STYLES.length - 1);
const STYLE_TREATMENT_COUNT = STYLE_PAIR_COUNT * CRAFT_TREATMENTS.length;

export class VocabularyCoverPromptLibrary {
  compose(input: VocabularyCoverPromptInput): string {
    const coverSequence = Math.abs(Math.trunc(input.id)) || 1;
    const theme = this.normalize(input.name) || 'language learning';
    const category = this.normalize(input.category || '');
    const difficulty = this.normalize(input.difficulty || '');
    const semanticContext = [
      `collection theme ${theme}`,
      category ? `subject category ${category}` : '',
      difficulty ? `learning level ${difficulty}` : '',
    ].filter(Boolean).join(', ');
    const seed = this.hash(`${coverSequence}|${semanticContext}`);
    const styleDirection = this.buildUniqueStyleDirection(coverSequence);
    const scene = this.pick(SCENE_ARCHETYPES, seed, 11);
    const composition = this.pick(COMPOSITIONS, seed, 23);
    const perspective = this.pick(CAMERA_AND_PERSPECTIVE, seed, 37);
    const palette = this.pick(COLOR_PALETTES, seed, 53);
    const lighting = this.pick(LIGHTING_DIRECTIONS, seed, 71);
    const atmosphere = this.pick(ATMOSPHERES, seed, 89);
    const detail = this.pick(DETAIL_DIRECTIONS, seed, 107);

    return [
      'Create exactly one original, full-bleed editorial cover image for a vocabulary library.',
      `Semantic context: ${semanticContext}. Use it only to inspire imagery, never as visible text.`,
      `One-off visual language: ${styleDirection}.`,
      `Scene: ${scene}.`,
      `Composition: ${composition}, rendered with ${perspective}.`,
      `Color and light: a ${palette} palette under ${lighting}.`,
      `Mood and finish: ${atmosphere}, with ${detail}.`,
      'Make this a complete cover artwork, not a logo, icon, badge, isolated symbol, clip-art object, repeating template, product mockup, or picture of a physical book.',
      'Do not default to a single centered geometric shape, open book, lightbulb, brain, speech bubble, alphabet block, or generic education symbol. Build a varied visual world across the entire frame.',
      'Use a 16:9 landscape aspect ratio, edge-to-edge artwork, strong readability at thumbnail size, rich detail at full size, and no decorative border.',
      'Absolutely no visible text: no words, letters, numbers, glyphs, captions, titles, labels, signage, typography, logos, signatures, interface elements, or watermarks anywhere in the image.',
    ].join(' ');
  }

  private buildUniqueStyleDirection(coverSequence: number): string {
    const stylePairIndex = coverSequence % STYLE_PAIR_COUNT;
    const primaryIndex = stylePairIndex % VISUAL_STYLES.length;
    const secondaryOffset = Math.floor(stylePairIndex / VISUAL_STYLES.length);
    const secondaryIndex = secondaryOffset >= primaryIndex ? secondaryOffset + 1 : secondaryOffset;
    const treatmentIndex = Math.floor(coverSequence / STYLE_PAIR_COUNT) % CRAFT_TREATMENTS.length;
    const cycleIndex = Math.floor(coverSequence / STYLE_TREATMENT_COUNT);
    const primary = VISUAL_STYLES[primaryIndex];
    const secondary = VISUAL_STYLES[secondaryIndex];
    const treatment = CRAFT_TREATMENTS[treatmentIndex];
    const cycleDirection = this.pick(DETAIL_DIRECTIONS, this.hash(String(cycleIndex)), coverSequence);

    return `an uncommon fusion led by ${primary} and reinterpreted through ${secondary}, finished with ${treatment}; emphasize ${cycleDirection}`;
  }

  private pick<T>(pool: readonly T[], seed: number, salt: number): T {
    const mixed = this.mix(seed, salt);
    return pool[mixed % pool.length];
  }

  private mix(seed: number, salt: number): number {
    let value = (seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
    return (value ^ (value >>> 16)) >>> 0;
  }

  private hash(value: string): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private normalize(value: string): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
}

export const vocabularyCoverPromptLibrary = new VocabularyCoverPromptLibrary();
