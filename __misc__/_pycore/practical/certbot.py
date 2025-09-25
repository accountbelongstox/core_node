import os
import subprocess
import datetime
import json
from pycore.utils_linux import file, fpath, plattools
from pycore.globalvar.src import src
from pycore.base.base import Base

class Cerbot(Base):

    def __init__(self):
        super().__init__()
        self.certbot_path = src.find_bin('certbot')
        self.dnspod_config_path = os.path.expanduser("~/.secrets/certbot/dnspod.ini")
        self.cert_save_dir = os.path.expanduser("~/certificates")

    def plattools_exec_cmd(self, cmd, check=True):
        try:
            result = subprocess.run(cmd, shell=True, check=check, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode != 0:
                self.error(result.stderr.decode())
            else:
                return result.stdout.decode()
        except subprocess.CalledProcessError as e:
            self.error(f"Command failed: {e}")
        return None

    def set_dnspod(self, dnspod_id, dnspod_token):
        file.mkbasedir(self.dnspod_config_path)
        with open(self.dnspod_config_path, 'w') as f:
            f.write(f"certbot_dnspod_token_id = {dnspod_id}\n")
            f.write(f"certbot_dnspod_token = {dnspod_token}\n")
        os.chmod(self.dnspod_config_path, 0o600)

        renew_script = f"""
            #!/bin/bash
            certbot renew --manual-auth-hook "/usr/local/bin/setup-dnspod-credentials.sh" --manual-cleanup-hook "/usr/local/bin/setup-dnspod-credentials.sh" --deploy-hook 'service nginx reload' --non-interactive --agree-tos --manual-public-ip-logging-ok
        """

        with open('/usr/local/bin/certbot-auto-renew.sh', 'w') as f:
            f.write(renew_script)

        os.chmod('/usr/local/bin/certbot-auto-renew.sh', 0o755)

        self.setup_crontab()

    def setup_crontab(self):
        current_crontab = self.plattools_exec_cmd('crontab -l', check=False)
        if '/usr/local/bin/certbot-auto-renew.sh' not in current_crontab:
            new_crontab = f"0 1 * * * /usr/local/bin/certbot-auto-renew.sh >> /var/log/cron.log 2>&1\n"
            self.plattools_exec_cmd(f'(crontab -l 2>/dev/null; echo "{new_crontab}") | crontab -')

    def apply_certificate(self, domains, save_dir):
        if isinstance(domains, str):
            domains = self.domain_extension(domains)
        elif isinstance(domains, list):
            domains = list(set(domains + [self.domain_extension(domain) for domain in domains]))
        else:
            self.error("Invalid domain input")
            return

        certbot_args = " ".join([f"-d {domain}" for domain in domains])
        email = "your-email@example.com"  # Replace this with the appropriate email address

        cmd = f"certbot certonly --authenticator certbot-dns-dnspod --certbot-dnspod-credentials {self.dnspod_config_path} --email {email} {certbot_args} --non-interactive --agree-tos --manual-public-ip-logging-ok"
        result = self.plattools_exec_cmd(cmd)

        if result:
            success_status = True  # You can set this based on parsing the actual result
            timestamp = datetime.datetime.now()
            expiry_date = timestamp + datetime.timedelta(days=90)
            self.save_cert_info(save_dir, timestamp, expiry_date, success_status)

    def domain_extension(self, domain):
        if not domain.startswith('*'):
            return [domain, f"*.{domain.lstrip('*.')}" if not domain.startswith('*.') else domain]
        return [domain]

    def save_cert_info(self, save_dir, timestamp, expiry_date, success_status):
        file.mkbasedir(save_dir)
        cert_info = {
            "request_time": timestamp.isoformat(),
            "expiry_time": expiry_date.isoformat(),
            "success": success_status
        }
        with open(os.path.join(save_dir, 'cert_info.json'), 'w') as f:
            json.dump(cert_info, f, indent=4)

    def get_cert_save_dir(self):
        return self.cert_save_dir

    def renew_certificates(self):
        cert_info_path = os.path.join(self.get_cert_save_dir(), 'cert_info.json')

        if not file.isfile(cert_info_path):
            self.error("No cert info found to renew")
            return

        with open(cert_info_path, 'r') as f:
            cert_info = json.load(f)

        expiry_timestamp = datetime.datetime.fromisoformat(cert_info['expiry_time'])
        current_time = datetime.datetime.now()

        if (expiry_timestamp - current_time).days <= 30:
            self.apply_certificate(cert_info['domains'], self.get_cert_save_dir())