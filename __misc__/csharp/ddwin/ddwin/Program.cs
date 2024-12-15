using System;
using System.Linq;
using System.Windows.Forms;

namespace ddwin
{
    internal static class Program
    {
        [STAThread]
        public static void Main(string[] args)
        {
            if (args.Length > 0 && args[0].Equals("--command", StringComparison.OrdinalIgnoreCase))
            {
                CommandHandler.Handle(args);
            }
            else
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainUI());
            }
        }
    }
}
