using System;
using System.Drawing;
using System.Windows.Forms;

namespace ddwin
{
    public partial class MainUI : Form
    {
        private ConfigurationManager configManager;
        private Label statusLabel;
        private TextBox logTextBox;

        public MainUI()
        {
            InitializeComponent();
            LoadConfiguration();
        }

        private void LoadConfiguration()
        {
            configManager = new ConfigurationManager();
            var ipRange = configManager.ReadValue("ShutdownDetection", "IpRange");
            var interval = configManager.ReadValue("ShutdownDetection", "Interval");
            var timeout = configManager.ReadValue("ShutdownDetection", "Timeout");
            var enabled = configManager.ReadValue("ShutdownDetection", "Enabled");

            textBox1.Text = ipRange;
            textBox2.Text = interval;
            textBox3.Text = timeout;
            checkBox1.Checked = bool.Parse(enabled);

            UpdateStatusLabel();

            textBox1.TextChanged += (sender, e) =>
            {
                configManager.ModifyValue("ShutdownDetection", "IpRange", textBox1.Text);
                AppendLog($"IP段更新为: {textBox1.Text}");
            };

            textBox2.TextChanged += (sender, e) =>
            {
                configManager.ModifyValue("ShutdownDetection", "Interval", textBox2.Text);
                AppendLog($"检测间隔更新为: {textBox2.Text}");
            };

            textBox3.TextChanged += (sender, e) =>
            {
                configManager.ModifyValue("ShutdownDetection", "Timeout", textBox3.Text);
                AppendLog($"超时时间更新为: {textBox3.Text}");
            };

            checkBox1.CheckedChanged += (sender, e) =>
            {
                configManager.ModifyValue("ShutdownDetection", "Enabled", checkBox1.Checked.ToString());
                UpdateStatusLabel();
                AppendLog($"启用状态更新为: {checkBox1.Checked}");
            };
        }

        private void UpdateStatusLabel()
        {
            if (checkBox1.Checked)
            {
                statusLabel.Text = "启动";
                statusLabel.ForeColor = Color.Green;
            }
            else
            {
                statusLabel.Text = "关闭";
                statusLabel.ForeColor = Color.Black;
            }
        }

        private void AppendLog(string message)
        {
            logTextBox.AppendText($"{DateTime.Now}: {message}{Environment.NewLine}");
        }

        private void InitializeComponent()
        {
            this.tabControl1 = new System.Windows.Forms.TabControl();
            this.tabPage1 = new System.Windows.Forms.TabPage();
            this.tabPage2 = new System.Windows.Forms.TabPage();
            this.textBox1 = new System.Windows.Forms.TextBox();
            this.textBox2 = new System.Windows.Forms.TextBox();
            this.textBox3 = new System.Windows.Forms.TextBox();
            this.checkBox1 = new System.Windows.Forms.CheckBox();
            this.statusLabel = new System.Windows.Forms.Label();
            this.logTextBox = new System.Windows.Forms.TextBox();
            this.tabControl1.SuspendLayout();
            this.tabPage1.SuspendLayout();
            this.SuspendLayout();

            this.ClientSize = new System.Drawing.Size(800, 600);
            this.Text = "主界面";

            tabControl1.Location = new System.Drawing.Point(12, 12);
            tabControl1.Size = new System.Drawing.Size(776, 400);

            tabPage1.Text = "关机检测";

            Label label1 = new Label() { Location = new Point(10, 10), Text = "IP 段", AutoSize = true };
            textBox1.Location = new System.Drawing.Point(10, 30);
            textBox1.Size = new System.Drawing.Size(200, 20);

            Label label2 = new Label() { Location = new Point(10, 60), Text = "检测间隔", AutoSize = true };
            textBox2.Location = new System.Drawing.Point(10, 80);
            textBox2.Size = new System.Drawing.Size(200, 20);

            Label label3 = new Label() { Location = new Point(10, 110), Text = "超时时间", AutoSize = true };
            textBox3 = new TextBox() { Location = new System.Drawing.Point(10, 130), Size = new System.Drawing.Size(200, 20) };

            checkBox1.Location = new System.Drawing.Point(10, 160);
            checkBox1.Text = "是否启用";

            statusLabel.Location = new System.Drawing.Point(220, 160);
            statusLabel.Size = new System.Drawing.Size(100, 20);

            logTextBox.Location = new System.Drawing.Point(10, 200);
            logTextBox.Size = new System.Drawing.Size(760, 150);
            logTextBox.Multiline = true;
            logTextBox.ScrollBars = ScrollBars.Vertical;
            logTextBox.ReadOnly = true;

            tabPage1.Controls.Add(label1);
            tabPage1.Controls.Add(textBox1);
            tabPage1.Controls.Add(label2);
            tabPage1.Controls.Add(textBox2);
            tabPage1.Controls.Add(label3);
            tabPage1.Controls.Add(textBox3);
            tabPage1.Controls.Add(checkBox1);
            tabPage1.Controls.Add(statusLabel);
            tabPage1.Controls.Add(logTextBox);

            tabPage2.Text = "基础服务";

            tabControl1.Controls.Add(tabPage1);
            tabControl1.Controls.Add(tabPage2);

            this.Controls.Add(tabControl1);

            this.tabControl1.ResumeLayout(false);
            this.tabPage1.ResumeLayout(false);
            this.tabPage1.PerformLayout();
            this.ResumeLayout(false);
        }

        private System.Windows.Forms.TabControl tabControl1;
        private System.Windows.Forms.TabPage tabPage1;
        private System.Windows.Forms.TabPage tabPage2;
        private System.Windows.Forms.TextBox textBox1;
        private System.Windows.Forms.TextBox textBox2;
        private System.Windows.Forms.TextBox textBox3;
        private System.Windows.Forms.CheckBox checkBox1;
    }
}
