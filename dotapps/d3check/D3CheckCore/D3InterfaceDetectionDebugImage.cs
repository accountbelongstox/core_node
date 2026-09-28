using System.Drawing;
using DotCore.Foundations;
using DotCore.TemplateMatcher;

namespace DotApps.d3check.Core;

/// <summary>
/// Draw and save one DEBUG image: game window (big image) + template thumbnails (small images) + match result (rect + center).
/// 1:1 with Python d3utils.d3u_common.image_annotator_helper save_match_debug_image / save_no_match_debug_image / draw_match_result.
/// </summary>
public static class D3InterfaceDetectionDebugImage
{
    private const int ThumbMaxHeight = 60;
    private const int RowHeight = 80;
    private const int Margin = 10;

    /// <summary>
    /// Draw attempts (template thumbnails + labels) and match results on a copy of gameImage, then save to outputPath.
    /// Each attempt: thumbnail at (Margin, Margin + i*RowHeight) if template file exists, then text "{name}: FOUND (score)" or "NOT FOUND".
    /// For each successful match: green rectangle and circle at match position on the game image.
    /// </summary>
    public static bool SaveDebugImage(Bitmap? gameImage, IList<InterfaceDetectionAttempt>? attempts, string outputPath)
    {
        if (gameImage == null || attempts == null || attempts.Count == 0 || string.IsNullOrWhiteSpace(outputPath))
            return false;
        try
        {
            using var canvas = (Bitmap)gameImage.Clone();
            using var g = Graphics.FromImage(canvas);
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;

            using var font = new Font("Segoe UI", 9);
            using var brushGreen = new SolidBrush(Color.Lime);
            using var brushRed = new SolidBrush(Color.Red);
            using var brushWhite = new SolidBrush(Color.White);
            using var penGreen = new Pen(Color.Lime, 3);
            using var penWhite = new Pen(Color.White, 2);

            for (int i = 0; i < attempts.Count; i++)
            {
                var a = attempts[i];
                int y = Margin + i * RowHeight;

                // Draw template thumbnail if file exists
                if (a.TemplateExists && File.Exists(a.TemplatePath))
                {
                    try
                    {
                        using var tpl = new Bitmap(a.TemplatePath);
                        int tw = tpl.Width;
                        int th = tpl.Height;
                        if (th > ThumbMaxHeight)
                        {
                            tw = (int)(tw * (ThumbMaxHeight / (double)th));
                            th = ThumbMaxHeight;
                        }
                        if (tw > 0 && th > 0)
                            g.DrawImage(tpl, Margin, y, tw, th);
                    }
                    catch { /* ignore */ }
                }

                // Label: name + FOUND (score) / NOT FOUND / file missing
                string label = a.TemplateName + ": ";
                if (!a.TemplateExists)
                    label += "file missing";
                else if (a.MatchResult != null && a.MatchResult.Success)
                    label += $"FOUND ({a.MatchResult.Score:F2})" + (a.InLeft30 ? " left30" : "");
                else
                    label += "NOT FOUND";
                var brush = !a.TemplateExists ? brushRed : (a.MatchResult != null && a.MatchResult.Success ? brushGreen : brushRed);
                g.DrawString(label, font, brush, Margin, y + ThumbMaxHeight + 2);

                // Draw match result on game image (rectangle + center circle)
                if (a.MatchResult != null && a.MatchResult.Success)
                {
                    var r = a.MatchResult;
                    g.DrawRectangle(penGreen, r.X, r.Y, r.Width, r.Height);
                    int cx = r.CenterX;
                    int cy = r.CenterY;
                    g.DrawEllipse(penGreen, cx - 8, cy - 8, 16, 16);
                    g.DrawLine(penWhite, cx - 15, cy, cx + 15, cy);
                    g.DrawLine(penWhite, cx, cy - 15, cx, cy + 15);
                }
            }

            var dir = Path.GetDirectoryName(outputPath);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            canvas.Save(outputPath);
            ColorPrinter.Gray($"[DEBUG][InterfaceDetection] Saved annotator debug image (big+small+result) to: {outputPath}");
            return true;
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[InterfaceDetection] Failed to save debug image: {ex.Message}");
            return false;
        }
    }
}
