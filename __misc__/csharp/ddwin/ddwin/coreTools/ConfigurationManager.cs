using System;
using System.IO;
using System.Text.Json;

namespace ddwin
{
    public class ConfigurationManager
    {
        private const string ConfigFileName = "config.json";
        private Configuration configuration;

        public ConfigurationManager()
        {
            if (!File.Exists(ConfigFileName))
            {
                configuration = new Configuration
                {
                    ShutdownDetection = new ShutdownDetection
                    {
                        IpRange = "192.168.100.0",
                        Interval = "5 seconds",
                        Enabled = true
                    },
                    BasicService = new BasicService()
                };
                SaveConfiguration();
            }
            else
            {
                string json = File.ReadAllText(ConfigFileName);
                configuration = JsonSerializer.Deserialize<Configuration>(json);
            }

            FileSystemWatcher watcher = new FileSystemWatcher(Directory.GetCurrentDirectory(), ConfigFileName);
            watcher.Changed += OnConfigFileChanged;
            watcher.EnableRaisingEvents = true;
        }

        public string ReadValue(string typeName, string key)
        {
            if (typeName == "ShutdownDetection" && configuration.ShutdownDetection != null)
            {
                switch (key)
                {
                    case "IpRange":
                        return configuration.ShutdownDetection.IpRange;
                    case "Interval":
                        return configuration.ShutdownDetection.Interval;
                    case "Enabled":
                        return configuration.ShutdownDetection.Enabled.ToString();
                }
            }
            else if (typeName == "BasicService" && configuration.BasicService != null)
            {
            }

            return null;
        }

        public void ModifyValue(string typeName, string key, string value)
        {
            if (typeName == "ShutdownDetection" && configuration.ShutdownDetection != null)
            {
                switch (key)
                {
                    case "IpRange":
                        configuration.ShutdownDetection.IpRange = value;
                        break;
                    case "Interval":
                        configuration.ShutdownDetection.Interval = value;
                        break;
                    case "Enabled":
                        configuration.ShutdownDetection.Enabled = bool.Parse(value);
                        break;
                }
            }
            else if (typeName == "BasicService" && configuration.BasicService != null)
            {
            }

            SaveConfiguration();
        }

        private void SaveConfiguration()
        {
            string json = JsonSerializer.Serialize(configuration);
            File.WriteAllText(ConfigFileName, json);
        }

        private void OnConfigFileChanged(object sender, FileSystemEventArgs e)
        {
            string json = File.ReadAllText(ConfigFileName);
            configuration = JsonSerializer.Deserialize<Configuration>(json);
        }
    }

    public class Configuration
    {
        public ShutdownDetection ShutdownDetection { get; set; }
        public BasicService BasicService { get; set; }
    }

    public class ShutdownDetection
    {
        public string IpRange { get; set; }
        public string Interval { get; set; }
        public bool Enabled { get; set; }
    }

    public class BasicService
    {
    }
}