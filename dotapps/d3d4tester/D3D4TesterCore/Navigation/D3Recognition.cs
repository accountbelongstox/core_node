// PY-REF: none (DOT-only)
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotCore.YoloDetect;

namespace DotApps.d3d4tester.Core.Navigation;

/// <summary>One detected object; Box and Center in game-window pixels, Screen = Center plus the window offset (click target).</summary>
public sealed record D3RecognizedObject(
    [property: JsonPropertyName("class")] string ClassName,
    [property: JsonPropertyName("confidence")] double Confidence,
    [property: JsonPropertyName("box")] D3Box Box,
    [property: JsonPropertyName("center")] D3Point Center,
    [property: JsonPropertyName("screen")] D3Point Screen);

public sealed record D3Box(
    [property: JsonPropertyName("x")] int X,
    [property: JsonPropertyName("y")] int Y,
    [property: JsonPropertyName("width")] int Width,
    [property: JsonPropertyName("height")] int Height);

public sealed record D3Point([property: JsonPropertyName("x")] int X, [property: JsonPropertyName("y")] int Y);

/// <summary>Party portrait: slot 1-4 from the top of the left column.</summary>
public sealed record D3PartyMember(
    [property: JsonPropertyName("slot")] int Slot,
    [property: JsonPropertyName("confidence")] double Confidence,
    [property: JsonPropertyName("box")] D3Box Box,
    [property: JsonPropertyName("screen")] D3Point Screen);

public sealed record D3RecognizedText(
    [property: JsonPropertyName("text")] string Text,
    [property: JsonPropertyName("center")] D3Point Center,
    [property: JsonPropertyName("screen")] D3Point Screen);

/// <summary>
/// One recognition of the D3 client frame by a town model: the open NPC panel, every object with window and screen coordinates,
/// and the enchant affix lines read by OCR; serialized as JSON for the model test history and other consumers.
/// </summary>
public sealed record D3Recognition(
    [property: JsonPropertyName("time")] DateTime Time,
    [property: JsonPropertyName("model")] string Model,
    [property: JsonPropertyName("window")] D3Box Window,
    [property: JsonPropertyName("panel")] string? Panel,
    [property: JsonPropertyName("objects")] IReadOnlyList<D3RecognizedObject> Objects,
    [property: JsonPropertyName("player")] D3RecognizedObject? Player,
    [property: JsonPropertyName("party")] IReadOnlyList<D3PartyMember> Party,
    [property: JsonPropertyName("banners")] int Banners,
    [property: JsonPropertyName("enchant_lines")] IReadOnlyList<D3RecognizedText> EnchantLines,
    [property: JsonPropertyName("enchant_option_lines")] IReadOnlyList<D3RecognizedText> EnchantOptionLines,
    [property: JsonPropertyName("capture_ms")] double CaptureMs,
    [property: JsonPropertyName("detect_ms")] double DetectMs)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public string ToJson() => JsonSerializer.Serialize(this, JsonOptions);

    /// <summary>Recognition of a captured frame: detections from the caller's model, panel and OCR via D3TownNavigator.Read.</summary>
    public static D3Recognition From(string model, int width, int height, (int X, int Y) offset, D3PanelReading reading, double captureMs, double detectMs)
    {
        D3Point Screen(int x, int y) => new(x + offset.X, y + offset.Y);
        var objects = reading.Detections
            .OrderBy(d => d.ClassId).ThenByDescending(d => d.Confidence)
            .Select(d => new D3RecognizedObject(d.ClassName, Math.Round(d.Confidence, 3), new D3Box(d.Box.X, d.Box.Y, d.Box.Width, d.Box.Height),
                new D3Point(d.Center.X, d.Center.Y), Screen(d.Center.X, d.Center.Y)))
            .ToList();
        var player = objects.Where(o => o.ClassName == D3TownActors.Player).MaxBy(o => o.Confidence);
        var party = objects.Where(o => o.ClassName == D3TownActors.PartyPortrait).OrderByDescending(o => o.Confidence).Take(D3TownActors.MaxPartySlots)
            .OrderBy(o => o.Box.Y).Select((o, i) => new D3PartyMember(i + 1, o.Confidence, o.Box, o.Screen)).ToList();
        int banners = Math.Min(D3TownActors.MaxPartySlots, objects.Count(o => o.ClassName == D3TownActors.Banner));
        List<D3RecognizedText> Texts(IReadOnlyList<D3TextLine> source) =>
            source.Select(l => new D3RecognizedText(l.Text, new D3Point(l.Center.X, l.Center.Y), Screen(l.Center.X, l.Center.Y))).ToList();
        return new D3Recognition(DateTime.Now, model, new D3Box(offset.X, offset.Y, width, height), reading.Panel, objects, player, party, banners,
            Texts(reading.EnchantLines), Texts(reading.EnchantOptionLines), Math.Round(captureMs, 1), Math.Round(detectMs, 1));
    }
}
