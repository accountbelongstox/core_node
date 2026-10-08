// PY-REF: pyapps/d3-check/d3utils/battlenet_operation.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_asia.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_cn.py
// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_base.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// Battle.net operation contract. Implementations are region-specific: Asia and CN only.
/// Do not mix region logic; use GetBattlenetOperation(region) to obtain the correct implementation.
/// Logic 1:1 with Python d3utils.battlenet_operation get_battlenet_operation() returning BattlenetOperationAsia or BattlenetOperationCN.
/// </summary>
public interface IBattlenetOperation
{
    /// <summary>Region this instance serves: "asia" or "cn".</summary>
    string Region { get; }

    /// <summary>Start Battle.net process from configured path. Returns true if started or already running.</summary>
    bool Start();

    /// <summary>Close/kill Battle.net process. Returns true if closed or was not running.</summary>
    bool Close();

    /// <summary>Activate Battle.net window if found. Returns true if activated.</summary>
    bool ActivateWindow();

    /// <summary>CN only: activate, ensure agree checkbox, click NetEase, wait. Asia returns false.</summary>
    bool PerformCnLoginFlow(double waitAfterNetEaseSec = 0.5);

    /// <summary>Asia only: fill account/password and click submit. CN returns false.</summary>
    bool PerformAsiaLoginFillAndSubmit(string? email, string? password);

    /// <summary>Click D3 game tab in Battle.net.</summary>
    bool ClickD3Tab();

    /// <summary>Click Play / Start game button.</summary>
    bool ClickStartGame();

    /// <summary>Asia only: true when the two-step Asia login screen (email / password) is shown. 1:1 Python is_on_asia_login_screen.</summary>
    bool IsOnAsiaLoginScreen() => false;

    /// <summary>Click D4 game tab in Battle.net. 1:1 Python d4_battlenet_operation.click_d4_tab.</summary>
    bool ClickD4Tab() => false;

    /// <summary>Log out of the current account via the account menu (Log Out). Used when switching accounts.</summary>
    bool LogOut();

    /// <summary>Passive client screen state from one control list (all visible Battle.net windows); no clicks. Region UI differs, so each region classifies its own login screens.</summary>
    Battlenet.BattlenetClientStatus ClassifyClientState(IReadOnlyList<Battlenet.BattlenetControl> controls);
}
