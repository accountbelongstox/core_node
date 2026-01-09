// Quick parameter extraction and analysis
const crypto = require('crypto');

const OBFUSCATED_PARAMS = Buffer.from('2i5HlrZbpub5YV0P0hkSduDEGe1xjzEtapd/BZgXVf2IBWNLRTuqPZH4Ext3jAozEifTxXarBDYCSfDgTh/uz0KAd30d55G1xK3U6us4tbT1j2uqLVLCSckUPR/h5IgHVpqZKd45+CcZxBnGZBkJ/kT4HRnOumi0V4uoyLPgEVlma/Yha3U+oHV3Y3BvL/nLwneU0t+VfyXGNTVnOxpKJoD3qBtJVVW65SodkgpsMy6iv6OxS5V0MSyfSqaAuox06P2cQBvBQ9d94v+V9wS16VnzX6ovz33upoYOOJB9RB0D4DVjobXroPIoNsXABC5ZfjfC/oyBPlulgNGjd4Q0g5Ip/EsGTV0KhnfsH1hCkGoLSKbjQwwS+CFJYTQcBbTMQWAWzi/VGRhsBdF8VAKLxfdYZtcX/IvzI8H/g6+bGN+0f2hElJaSEhPTyWW6DcXZlSKzdOKfR9/g5VUpto6ZB6XcYOhcJLAkbdgnMKiyMmJe8CpKWfCpwZhsBouPSzW/', 'base64');
const PARAMS_KEY = Buffer.from('K2rThDG7vC+WNnqhBIHNfYFa29R5gaUlkAxS9rAGtus=', 'base64');
const PARAMS_IV = Buffer.from('5yf0zpzjhbWx91zY/GLYmQ==', 'base64');

try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', PARAMS_KEY, PARAMS_IV);
    const decrypted = Buffer.concat([
        decipher.update(OBFUSCATED_PARAMS),
        decipher.final()
    ]);
    const params = JSON.parse(decrypted.toString());

    console.log('Extracted Parameters:');
    console.log(JSON.stringify(params, null, 2));
} catch (err) {
    console.error('Failed:', err.message);
}
