// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace CoreNodeBridge;

/// <summary>Minimal streaming JSON writer (net48 has no System.Text.Json): objects, arrays, strings, numbers, booleans.</summary>
internal sealed class JsonWriter
{
    private readonly StringBuilder _sb = new();
    private readonly Stack<bool> _first = new();

    public JsonWriter BeginObject(string key = null) => Open(key, '{');

    public JsonWriter EndObject() => Close('}');

    public JsonWriter BeginArray(string key = null) => Open(key, '[');

    public JsonWriter EndArray() => Close(']');

    public JsonWriter Prop(string key, string value)
    {
        Next(key);
        _sb.Append('"').Append(Escape(value ?? "")).Append('"');
        return this;
    }

    public JsonWriter Prop(string key, bool value)
    {
        Next(key);
        _sb.Append(value ? "true" : "false");
        return this;
    }

    public JsonWriter Prop(string key, long value)
    {
        Next(key);
        _sb.Append(value.ToString(CultureInfo.InvariantCulture));
        return this;
    }

    public JsonWriter Prop(string key, double value)
    {
        Next(key);
        _sb.Append(double.IsNaN(value) || double.IsInfinity(value) ? "0" : value.ToString("0.###", CultureInfo.InvariantCulture));
        return this;
    }

    public JsonWriter Prop(string key, DateTime utc) => Prop(key, utc == DateTime.MinValue ? "" : utc.ToString("o", CultureInfo.InvariantCulture));

    public override string ToString() => _sb.ToString();

    private JsonWriter Open(string key, char bracket)
    {
        if (_first.Count > 0) Next(key);
        _sb.Append(bracket);
        _first.Push(true);
        return this;
    }

    private JsonWriter Close(char bracket)
    {
        _first.Pop();
        _sb.Append(bracket);
        return this;
    }

    private void Next(string key)
    {
        if (_first.Count > 0)
        {
            if (!_first.Pop()) _sb.Append(',');
            _first.Push(false);
        }
        if (key != null) _sb.Append('"').Append(Escape(key)).Append("\":");
    }

    private static string Escape(string s)
    {
        var sb = new StringBuilder(s.Length);
        foreach (char c in s)
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\n': sb.Append("\\n"); break;
                case '\r': sb.Append("\\r"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < ' ') sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
                    else sb.Append(c);
                    break;
            }
        }
        return sb.ToString();
    }
}
