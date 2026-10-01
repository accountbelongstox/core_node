namespace DotApps.d3d4tester.Core;

/// <summary>
/// D3 UI points in standard outer space (1316x839) and their scaled game-window coordinates.
/// 1:1 Python share.game_interface_data StandardCoordinates + d3_scale_single_coord / d3_scale_region / get_scaled_* helpers.
/// </summary>
public static class D3StandardCoordinates
{
    public static readonly (int X, int Y) BlacksmithTabForgeWeapon = (390, 201);
    public static readonly (int X, int Y) BlacksmithTabArmor = (386, 296);
    public static readonly (int X, int Y) BlacksmithTabSalvageMaterials = (385, 387);
    public static readonly (int X, int Y) BlacksmithTabRepair = (385, 488);
    public static readonly (int X, int Y) BlacksmithTabTrain = (387, 578);
    public static readonly (int X, int Y) BlacksmithForgeWeaponCraftButton = (227, 613);
    public static readonly (int X, int Y) BlacksmithSalvageButton = (144, 226);
    public static readonly (int X, int Y) BlacksmithSalvageDialogSalvageButton = (128, 249);
    public static readonly (int X, int Y) BlacksmithSalvageDialogConfirm = (584, 310);
    public static readonly (int X, int Y) BlacksmithSalvageDialogCancel = (766, 310);
    public static readonly (int X, int Y) BlacksmithSalvageOneclickWhite = (195, 248);
    public static readonly (int X, int Y) BlacksmithSalvageOneclickBlue = (245, 248);
    public static readonly (int X, int Y) BlacksmithSalvageOneclickYellow = (297, 248);

    public static readonly (int X, int Y) KanaiConversionButton = (178, 643);
    public static readonly (int X, int Y) KanaiRightPanelToggle = (329, 647);
    public static readonly (int X, int Y) KanaiRecipePrevPageButton = (439, 652);
    public static readonly (int X, int Y) KanaiPutMaterialButton = (532, 653);
    public static readonly (int X, int Y) KanaiNextPageButton = (636, 651);

    public static readonly (int X, int Y) ReforgeRegionStart = (262, 289);
    public static readonly (int X, int Y) ReforgeRegionEnd = (262, 445);

    public static readonly (int X, int Y) BagTopLeft = (925, 445);
    public static readonly (int X, int Y) BagBottomRight = (1297, 665);

    public static readonly (int X, int Y) GameFocusClickPoint = (1051, 783);

    /// <summary>Blacksmith UI coordinate keys. 1:1 get_scaled_blacksmith_ui_coords keys.</summary>
    public const string KeyTabForgeWeapon = "tab_forge_weapon";
    public const string KeyTabArmor = "tab_armor";
    public const string KeyTabSalvageMaterials = "tab_salvage_materials";
    public const string KeyTabRepair = "tab_repair";
    public const string KeyTabTrain = "tab_train";
    public const string KeySalvageButton = "salvage_button";
    public const string KeySalvageDialogSalvageButton = "salvage_dialog_salvage_button";
    public const string KeySalvageDialogConfirm = "salvage_dialog_confirm";
    public const string KeySalvageDialogCancel = "salvage_dialog_cancel";

    /// <summary>Scale one standard point to the current game window. 1:1 d3_scale_single_coord.</summary>
    public static (int X, int Y) Scale((int X, int Y) standard) =>
        GameInterfaceData.Instance.CalculateUnifiedScaledCoordinate(standard.X, standard.Y);

    /// <summary>Scale a standard region. 1:1 d3_scale_region.</summary>
    public static ((int X, int Y) Start, (int X, int Y) End) ScaleRegion((int X, int Y) start, (int X, int Y) end) => (Scale(start), Scale(end));

    public static ((int X, int Y) Start, (int X, int Y) End) GetScaledBagRegion() => ScaleRegion(BagTopLeft, BagBottomRight);
    public static (int X, int Y) GetScaledBlacksmithSalvageButton() => Scale(BlacksmithSalvageButton);
    public static (int X, int Y) GetScaledBlacksmithTabSalvageMaterials() => Scale(BlacksmithTabSalvageMaterials);
    public static (int X, int Y) GetScaledBlacksmithSalvageDialogSalvageButton() => Scale(BlacksmithSalvageDialogSalvageButton);
    public static (int X, int Y) GetScaledBlacksmithSalvageDialogConfirm() => Scale(BlacksmithSalvageDialogConfirm);
    public static (int X, int Y) GetScaledBlacksmithSalvageDialogCancel() => Scale(BlacksmithSalvageDialogCancel);
    public static (int X, int Y) GetScaledBlacksmithSalvageOneclickWhite() => Scale(BlacksmithSalvageOneclickWhite);
    public static (int X, int Y) GetScaledBlacksmithSalvageOneclickBlue() => Scale(BlacksmithSalvageOneclickBlue);
    public static (int X, int Y) GetScaledBlacksmithSalvageOneclickYellow() => Scale(BlacksmithSalvageOneclickYellow);
    public static (int X, int Y) GetScaledGameFocusClickPoint() => Scale(GameFocusClickPoint);
    public static ((int X, int Y) Start, (int X, int Y) End) GetScaledReforgeRegion() => ScaleRegion(ReforgeRegionStart, ReforgeRegionEnd);
    public static (int X, int Y) GetScaledKanaiPutMaterialButton() => Scale(KanaiPutMaterialButton);
    public static (int X, int Y) GetScaledConversionButton() => Scale(KanaiConversionButton);
    public static (int X, int Y) GetScaledKanaiRightPanelToggle() => Scale(KanaiRightPanelToggle);
    public static (int X, int Y) GetScaledKanaiNextPageButton() => Scale(KanaiNextPageButton);
    public static (int X, int Y) GetScaledKanaiRecipePrevPageButton() => Scale(KanaiRecipePrevPageButton);

    /// <summary>All blacksmith UI points scaled (game-window relative). 1:1 get_scaled_blacksmith_ui_coords.</summary>
    public static IReadOnlyDictionary<string, (int X, int Y)> GetScaledBlacksmithUiCoords() => new Dictionary<string, (int X, int Y)>
    {
        [KeyTabForgeWeapon] = Scale(BlacksmithTabForgeWeapon),
        [KeyTabArmor] = Scale(BlacksmithTabArmor),
        [KeyTabSalvageMaterials] = Scale(BlacksmithTabSalvageMaterials),
        [KeyTabRepair] = Scale(BlacksmithTabRepair),
        [KeyTabTrain] = Scale(BlacksmithTabTrain),
        [KeySalvageButton] = Scale(BlacksmithSalvageButton),
        [KeySalvageDialogSalvageButton] = Scale(BlacksmithSalvageDialogSalvageButton),
        [KeySalvageDialogConfirm] = Scale(BlacksmithSalvageDialogConfirm),
        [KeySalvageDialogCancel] = Scale(BlacksmithSalvageDialogCancel),
    };
}
