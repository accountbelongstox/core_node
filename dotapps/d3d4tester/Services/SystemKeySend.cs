// PY-REF: pyapps/d3-check/d3utils/key_send.py
using DotCore.Utils;

namespace DotApps.d3d4tester.Services;

/// <summary>System-wide key injection (e.g. F7 for Smart Echo). 1:1 Python d3utils.key_send.send_f7_to_system via WindowInputHelper.SendSystemKey.</summary>
public static class SystemKeySend
{
    private const ushort VkF7 = 0x76;

    public static bool TrySendF7() => WindowInputHelper.SendSystemKey(VkF7);
}
