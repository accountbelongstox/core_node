// PY-REF: none (DOT-only)
using System;
using System.Globalization;
using System.Text;

namespace CoreNodeBridge;

/// <summary>
/// D3 UI element ids: FNV-1a 64 of the lowercase element path (verified against the ids ROSBOT itself uses), plus the paths of the
/// blacksmith / vendor / confirmation controls the bridge commands click. ROSBOT's Context.HasUIElement / ClickUIElement take these ids.
/// </summary>
internal static class UiIds
{
    private const ulong FnvOffset = 14695981039346656037UL;
    private const ulong FnvPrime = 1099511628211UL;
    private const string HexPrefix = "0x";

    public const string VendorDialog = "Root.NormalLayer.vendor_dialog_mainPage";
    public const string ShopDialog = "Root.NormalLayer.shop_dialog_mainPage";
    public const string InventoryDialog = "Root.NormalLayer.inventory_dialog_mainPage";
    public const string SalvageDialog = "Root.NormalLayer.vendor_dialog_mainPage.salvage_dialog";
    public const string SalvageNormal = "Root.NormalLayer.vendor_dialog_mainPage.salvage_dialog.salvage_all_wrapper.salvage_normal_button";
    public const string SalvageMagic = "Root.NormalLayer.vendor_dialog_mainPage.salvage_dialog.salvage_all_wrapper.salvage_magic_button";
    public const string SalvageRare = "Root.NormalLayer.vendor_dialog_mainPage.salvage_dialog.salvage_all_wrapper.salvage_rare_button";
    public const string ConfirmOk = "Root.TopLayer.confirmation.subdlg.stack.wrap.button_ok";

    /// <summary>Vendor side tabs tried in order until the salvage page shows (the blacksmith's salvage tab).</summary>
    public static readonly string[] VendorTabs =
    {
        "Root.NormalLayer.vendor_dialog_mainPage.tab_2",
        "Root.NormalLayer.vendor_dialog_mainPage.tab_1",
        "Root.NormalLayer.vendor_dialog_mainPage.tab_3",
    };

    public static ulong Of(string path)
    {
        ulong hash = FnvOffset;
        unchecked
        {
            foreach (byte b in Encoding.UTF8.GetBytes(path.ToLowerInvariant()))
            {
                hash ^= b;
                hash *= FnvPrime;
            }
        }
        return hash;
    }

    /// <summary>A decimal id, a 0x hex id, or a UI path (hashed).</summary>
    public static bool TryParse(string raw, out ulong id)
    {
        raw = (raw ?? "").Trim();
        if (raw.Length == 0)
        {
            id = 0;
            return false;
        }
        if (raw.StartsWith(HexPrefix, StringComparison.OrdinalIgnoreCase))
            return ulong.TryParse(raw.Substring(HexPrefix.Length), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out id);
        if (ulong.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out id)) return true;
        id = Of(raw);
        return true;
    }
}
