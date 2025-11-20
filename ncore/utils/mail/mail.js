// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const nodemailer = require('nodemailer');
    const dotenv = require('dotenv');
    const Base = require('#@base');
    const { format } = require('date-fns');
    const { getSecretOrEnv } = require('#@ncore/foundation/common/secret_config_helper');

    dotenv.config();

    class Mail extends Base {
      constructor() {
        super();
        this.mailConfig = this.loadMailConfig();
        this.defaultRecipient = process.env.DEFAULT_SERVICE_EMAIL || 'default@example.com';
      }

      loadMailConfig() {
        const config = {
          MAIL_SERVER: process.env.MAIL_SERVER || 'mail.local.12gm.com',
          MAIL_PORT: parseInt(process.env.MAIL_PORT, 10) || 587,
          MAIL_USERNAME: getSecretOrEnv('MAIL_USERNAME', 'MAIL_USERNAME', 'mailserver@mail.local.12gm.com'),
          MAIL_PASSWORD: getSecretOrEnv('MAIL_PASSWORD', 'MAIL_PASSWORD', null),
        };

        const missing = Object.entries(config).filter(([key, value]) => value === null);
        if (missing.length > 0) {
          console.warn(`Missing configuration for: ${missing.map(([key]) => key).join(', ')}`);
          console.warn(`Example configuration:
    MAIL_SERVER=mail.local.12gm.com
    MAIL_PORT=587
    MAIL_USERNAME=mailserver@mail.local.12gm.com
    MAIL_PASSWORD=#Abbb123`);
        }

        return config;
      }

      formatEmail(address) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(address)) {
          return `${address}@${this.mailConfig.MAIL_SERVER}`;
        }
        return address;
      }

      async sendEmail(title, content, recipients) {
        if (typeof recipients === 'string') {
          recipients = [recipients];
        }

        try {
          console.log(`Connecting to server: ${this.mailConfig.MAIL_SERVER} on port ${this.mailConfig.MAIL_PORT}`);
          const startTime = Date.now();

          const transporter = nodemailer.createTransport({
            host: this.mailConfig.MAIL_SERVER,
            port: this.mailConfig.MAIL_PORT,
            secure: this.mailConfig.MAIL_PORT === 465,
            auth: {
              user: this.mailConfig.MAIL_USERNAME,
              pass: this.mailConfig.MAIL_PASSWORD,
            },
            tls: {
              ciphers: 'SSLv3'
            }
          });

          console.log(`Connected to server successfully in ${(Date.now() - startTime) / 1000} seconds`);

          const mailOptions = {
            from: this.formatEmail(this.mailConfig.MAIL_USERNAME),
            to: recipients.join(', '),
            subject: title,
            text: content,
          };

          await transporter.sendMail(mailOptions);
          console.log(`Email sent to ${recipients}`);

        } catch (error) {
          console.error(`Failed to send email: ${error.message}`);
        }
      }

      sendDefaultEmail(title, content) {
        this.sendEmail(title, content, this.defaultRecipient);
      }
    }

    module.exports = new Mail();