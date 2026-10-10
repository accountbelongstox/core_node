// PY-REF: dotapps/d3d4tester/reference/py_d3check/providor/providor_index.py
using Microsoft.Extensions.Configuration;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>log_detection section: login_try trigger substring for screenshot callback. 1:1 Python get_config_section("log_detection").</summary>
public sealed class LogDetectionOptions
{
    [ConfigurationKeyName("login_try")]
    public string LoginTry { get; set; } = "";
}
