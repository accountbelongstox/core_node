<?php

namespace App\Apps\AppQyV1\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use Illuminate\Support\Str;

/**
 * Builds the AI image prompt for a vocabulary-library cover.
 *
 * Two deliberate properties:
 *
 *  1. NO TEXT. Most image models render letters/words poorly, so the prompt
 *     never asks for a title, typography or any embedded words, and ends with an
 *     explicit negative clause forbidding text of any kind. The library name is
 *     used only to bias the THEME, never to be drawn.
 *
 *  2. VARIATION. A fixed template has a handful of slots (art style, palette,
 *     background, lighting, motif, composition) that are each filled from a pool
 *     at random on every build. Regenerating a cover therefore yields a visibly
 *     different image instead of repeating the same one.
 */
class AppQyV1CoverPromptBuilder
{
    /** Art styles (the dominant visual treatment). */
    private const STYLES = [
        'modern flat vector',
        'soft gradient vector',
        'minimal geometric',
        'paper-cut layered',
        'isometric',
        'gentle watercolor',
        'low-poly',
        'clean line-art',
        'abstract memphis-style',
        'soft 3D clay-render',
    ];

    /** Color palettes. */
    private const PALETTES = [
        'warm sunset',
        'cool teal and indigo',
        'pastel',
        'deep jewel-tone',
        'muted earthy',
        'vibrant complementary',
        'monochrome blue',
        'fresh green and cream',
        'dusk purple and amber',
        'soft coral and mint',
    ];

    /** Background treatments. */
    private const BACKGROUNDS = [
        'softly blurred gradient backdrop',
        'clean solid backdrop with subtle texture',
        'layered abstract shapes',
        'gentle bokeh light field',
        'minimal geometric pattern',
        'airy open negative space',
        'soft radial glow',
    ];

    /** Lighting / mood. */
    private const LIGHTING = [
        'warm diffused lighting',
        'soft morning light',
        'cool ambient light',
        'bright airy lighting',
        'dramatic rim lighting',
        'calm even lighting',
    ];

    /** Subject motifs — abstract, education-adjacent imagery (no words). */
    private const MOTIFS = [
        'an open book dissolving into floating abstract shapes',
        'a stylized brain made of interconnected nodes',
        'a glowing lightbulb surrounded by orbiting particles',
        'overlapping speech-bubble silhouettes',
        'a sprouting plant growing from an open book',
        'a constellation of connected dots forming a network',
        'a stack of abstract layered cards fanning out',
        'a paper airplane tracing a looping path',
        'concentric ripples radiating from a central spark',
        'a key turning into a flock of small geometric birds',
    ];

    /** Composition framing. */
    private const COMPOSITIONS = [
        'centered balanced composition',
        'off-center dynamic composition',
        'symmetrical composition',
        'rule-of-thirds composition',
    ];

    /**
     * Build a fresh, randomized, text-free prompt for the library.
     *
     * The library's name/category/difficulty bias the THEME only; the visual
     * variables are randomized so each call differs.
     */
    public static function build(AppQyV1VocabularyLibraryModel $library): string
    {
        $category = Str::of($library->category ?? 'general')->replace('_', ' ')->lower()->toString();
        $difficulty = Str::of($library->difficulty_level ?? 'intermediate')->lower()->toString();
        $theme = Str::of($library->name ?? 'language learning')->squish()->toString();

        $style = self::pick(self::STYLES);
        $palette = self::pick(self::PALETTES);
        $background = self::pick(self::BACKGROUNDS);
        $lighting = self::pick(self::LIGHTING);
        $motif = self::pick(self::MOTIFS);
        $composition = self::pick(self::COMPOSITIONS);

        return sprintf(
            'A %s illustration for a %s %s vocabulary collection themed around "%s". '
            . 'Depict %s on a %s, using a %s color palette with %s. %s, 16:9 aspect ratio, '
            . 'clean and uncluttered, professional and tasteful. '
            . 'Do NOT include any text, letters, words, numbers, captions, titles, labels or typography anywhere in the image — purely visual imagery only.',
            $style,
            $difficulty,
            $category,
            $theme,
            $motif,
            $background,
            $palette,
            $lighting,
            ucfirst($composition)
        );
    }

    /** Random element from a non-empty pool. */
    private static function pick(array $pool): string
    {
        return $pool[array_rand($pool)];
    }
}
