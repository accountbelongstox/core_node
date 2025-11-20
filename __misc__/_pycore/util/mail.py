import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pycore.base.base import Base
from pycore.globalvers import env
import time
import re

class Mail(Base):
    def __init__(self):
        super().__init__()
        self.mail_config = self.load_mail_config()
        self.default_recipient = env.get_env("DEFAULT_SERVICE_EMAIL", "default@example.com")

    def load_mail_config(self):
        config = {
            "MAIL_SERVER": env.get_env("MAIL_SERVER", "mail.local.12gm.com"),
            "MAIL_PORT": int(env.get_env("MAIL_PORT", 587)),
            "MAIL_USERNAME": env.get_env("MAIL_USERNAME", "mailserver@mail.local.12gm.com"),
            "MAIL_PASSWORD": env.get_env("MAIL_PASSWORD")
        }

        missing = [key for key, value in config.items() if value is None]
        if missing:
            print(f"Missing configuration for: {', '.join(missing)}")
            print("Example configuration:")
            print("""
MAIL_SERVER=mail.local.12gm.com
MAIL_PORT=587
MAIL_USERNAME=mailserver@mail.local.12gm.com
MAIL_PASSWORD=#Abbb123
            """)

        return config

    def format_email(self, address):
        if not re.match(r"[^@]+@[^@]+\.[^@]+", address):
            address = f"{address}@{self.mail_config['MAIL_SERVER']}"
        return address

    def send_email(self, title, content, recipients):
        if isinstance(recipients, str):
            recipients = [recipients]

        try:
            print(f"Connecting to server: {self.mail_config['MAIL_SERVER']} on port {self.mail_config['MAIL_PORT']}")

            start_time = time.time()
            if self.mail_config["MAIL_PORT"] == 465:
                server = smtplib.SMTP_SSL(self.mail_config["MAIL_SERVER"], self.mail_config["MAIL_PORT"])
            else:
                server = smtplib.SMTP(self.mail_config["MAIL_SERVER"], self.mail_config["MAIL_PORT"])
                if self.mail_config["MAIL_PORT"] in [587, 25]:
                    server.starttls()

            print(f"Connected to server successfully in {time.time() - start_time:.2f} seconds")

            # Login to the server
            server.login(self.mail_config["MAIL_USERNAME"], self.mail_config["MAIL_PASSWORD"])

            # Create the email
            msg = MIMEMultipart()
            msg['From'] = self.format_email(self.mail_config["MAIL_USERNAME"])
            msg['To'] = ", ".join(recipients)
            msg['Subject'] = title
            msg.attach(MIMEText(content, 'plain'))

            # Send the email
            server.sendmail(self.mail_config["MAIL_USERNAME"], recipients, msg.as_string())

            # Close the server connection
            server.quit()

            print(f"Email sent to {recipients}")

        except Exception as e:
            print(f"Failed to send email: {str(e)}")

    def send_default_email(self, title, content):
        self.send_email(title, content, self.default_recipient)


