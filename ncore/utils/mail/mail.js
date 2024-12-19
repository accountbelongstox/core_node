const nodemailer = require('nodemailer');
    const dotenv = require('dotenv');
    const Base = require('#@base');
    const { format } = require('date-fns');

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
          MAIL_USERNAME: process.env.MAIL_USERNAME || 'mailserver@mail.local.12gm.com',
          MAIL_PASSWORD: process.env.MAIL_PASSWORD || null,
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