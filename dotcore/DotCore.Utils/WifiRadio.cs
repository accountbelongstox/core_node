// PY-REF: none (DOT-only)
using System.Runtime.InteropServices;
using DotCore.Foundations;
using Microsoft.Win32;

namespace DotCore.Utils;

/// <summary>
/// Windows airplane mode and WiFi radio: IsAirplaneModeOn reads the radio manager state; EnsureWifiOn switches the software
/// radio of every WLAN interface back on (same as the WiFi tile while airplane mode stays on). Non-Windows: no-op / false.
/// </summary>
public static class WifiRadio
{
    private const string LogTag = "[WifiRadio]";
    private const string RadioManagementKey = @"SYSTEM\CurrentControlSet\Control\RadioManagement\SystemRadioState";
    private const int AirplaneModeOn = 1;
    private const uint WlanClientVersion = 2;
    private const int OpcodeRadioState = 4;
    private const int RadioStateOn = 1;
    private const int RadioStateOff = 2;
    private const int ErrorSuccess = 0;
    private const int InterfaceListHeaderSize = 8;
    private const int InterfaceInfoSize = 532;
    private const int RadioStateHeaderSize = 4;
    private const int PhyRadioStateSize = 12;

    public static bool IsAirplaneModeOn()
    {
        if (!OperatingSystem.IsWindows()) return false;
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(RadioManagementKey);
            return key?.GetValue(null) is int state && state == AirplaneModeOn;
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogTag} airplane mode state not readable: {ex.Message}");
            return false;
        }
    }

    /// <summary>Turn the software radio on for every WLAN PHY that is off. True when at least one radio was switched on.</summary>
    public static bool EnsureWifiOn()
    {
        if (!OperatingSystem.IsWindows()) return false;
        bool switched = false;
        IntPtr handle = IntPtr.Zero;
        IntPtr list = IntPtr.Zero;
        try
        {
            int rc = WlanOpenHandle(WlanClientVersion, IntPtr.Zero, out _, out handle);
            if (rc != ErrorSuccess)
            {
                ColorPrinter.Yellow($"{LogTag} WlanOpenHandle failed: {rc}");
                return false;
            }
            rc = WlanEnumInterfaces(handle, IntPtr.Zero, out list);
            if (rc != ErrorSuccess)
            {
                ColorPrinter.Yellow($"{LogTag} WlanEnumInterfaces failed: {rc}");
                return false;
            }
            int count = Marshal.ReadInt32(list);
            for (int i = 0; i < count; i++)
            {
                var item = list + InterfaceListHeaderSize + i * InterfaceInfoSize;
                var guid = Marshal.PtrToStructure<Guid>(item);
                string name = Marshal.PtrToStringUni(item + 16) ?? guid.ToString();
                switched |= SwitchInterfaceOn(handle, guid, name);
            }
        }
        catch (Exception ex) when (ex is DllNotFoundException or EntryPointNotFoundException)
        {
            ColorPrinter.Yellow($"{LogTag} WLAN API not available: {ex.Message}");
        }
        finally
        {
            if (list != IntPtr.Zero) WlanFreeMemory(list);
            if (handle != IntPtr.Zero) WlanCloseHandle(handle, IntPtr.Zero);
        }
        return switched;
    }

    private static bool SwitchInterfaceOn(IntPtr handle, Guid guid, string name)
    {
        int rc = WlanQueryInterface(handle, ref guid, OpcodeRadioState, IntPtr.Zero, out _, out var data, out _);
        if (rc != ErrorSuccess)
        {
            ColorPrinter.Yellow($"{LogTag} radio state of '{name}' not readable: {rc}");
            return false;
        }
        var offPhys = new List<int>();
        try
        {
            int phys = Marshal.ReadInt32(data);
            for (int p = 0; p < phys; p++)
            {
                var phy = data + RadioStateHeaderSize + p * PhyRadioStateSize;
                int software = Marshal.ReadInt32(phy, 4);
                int hardware = Marshal.ReadInt32(phy, 8);
                if (software == RadioStateOff && hardware != RadioStateOff) offPhys.Add(Marshal.ReadInt32(phy));
            }
        }
        finally
        {
            WlanFreeMemory(data);
        }

        bool switched = false;
        var buffer = Marshal.AllocHGlobal(PhyRadioStateSize);
        try
        {
            foreach (int phyIndex in offPhys)
            {
                Marshal.WriteInt32(buffer, 0, phyIndex);
                Marshal.WriteInt32(buffer, 4, RadioStateOn);
                Marshal.WriteInt32(buffer, 8, RadioStateOn);
                rc = WlanSetInterface(handle, ref guid, OpcodeRadioState, PhyRadioStateSize, buffer, IntPtr.Zero);
                if (rc == ErrorSuccess)
                {
                    ColorPrinter.Blue($"{LogTag} WiFi radio of '{name}' (phy {phyIndex}) switched on");
                    switched = true;
                }
                else ColorPrinter.Yellow($"{LogTag} switching on WiFi radio of '{name}' (phy {phyIndex}) failed: {rc}");
            }
        }
        finally
        {
            Marshal.FreeHGlobal(buffer);
        }
        return switched;
    }

    [DllImport("wlanapi.dll")]
    private static extern int WlanOpenHandle(uint clientVersion, IntPtr reserved, out uint negotiatedVersion, out IntPtr clientHandle);

    [DllImport("wlanapi.dll")]
    private static extern int WlanCloseHandle(IntPtr clientHandle, IntPtr reserved);

    [DllImport("wlanapi.dll")]
    private static extern int WlanEnumInterfaces(IntPtr clientHandle, IntPtr reserved, out IntPtr interfaceList);

    [DllImport("wlanapi.dll")]
    private static extern int WlanQueryInterface(IntPtr clientHandle, ref Guid interfaceGuid, int opCode, IntPtr reserved,
        out uint dataSize, out IntPtr data, out int opcodeValueType);

    [DllImport("wlanapi.dll")]
    private static extern int WlanSetInterface(IntPtr clientHandle, ref Guid interfaceGuid, int opCode, uint dataSize, IntPtr data, IntPtr reserved);

    [DllImport("wlanapi.dll")]
    private static extern void WlanFreeMemory(IntPtr memory);
}
