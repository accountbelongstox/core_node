// Encrypted Image - Build Factory
// Original: app_splash5.png
// Extension: .png
// Generated: 2026-01-04T22:59:59.448Z
// Logic Pair: /public/js/image_decryptor.js

const encrypted = "yyUnK2lMe2l0b3J0DCYnIHlwdflvbkr1cTQwMjXCyl+gZEZhagQnKwpFbm22eXB6rW77YGtiMjA3TgsxKDgcnIy0VSFxOFHuAvQ1yDMgH/bVZHA8eGq06vCTdkDg3wNf+Pb759wE2jtFFeZdMuts4vIeiYadAuil2t+XrE9XcnlFbmNyeXB0aW9uS2V5MjAyNUJ1aWxkRmFjdG9yeUVuY3J5cHRpEXrHxcdADnuTQgxCCi+56lZpdXN5R2zj8nlQVGlnZkttcTIyMLXCdUlMZE5pY3xncntH7uNyWVB0YWduQ215MDKytUJVSWxsTmFrfG9we8XuY1JZcHglp4sIr4AWiXyVTf+wXu+5P3h8b3B7xe5jUllwfGFvZkNlezCwsjViVWlkbEZpa3RtcPnFbkNSeXh8aWdmS2d7srAyFWJ1YWRkTmljdm3y+UVOQ3J1PRyK/xx1LD8/4KxX9BmVk7lAY+P0b1JZRWZrcntydGtt7stlWRIwOj1Cd2tsZkTh43RPUnlNZmNwe3B2a+/uS0VZMjg6NUB3aW5mxuFjVE9ycU1uIGH00MryhCUI5bWPjIwswHhtbGVHISN0f2J5QWpjdn1wdWgvLkt1aTIgIjVGcWltZQYhY2R/cmlVbmd2eXF1KS9uW3V5IiAyMUZ1aG0kBmFzZG+qUl8vpP63vdTHBYOFuEAEIDIxRnVobWRHYCM0b2JpRWpncnhxdGhuLgtlaSIwNjFCdGhsZUchI3R/YnlBamNzeHB1aC8uS3VpMjQ2NUNEa2xgQuG1MExq5/7pxJS2yEkGk+KYRg7b/oO0QlVJbGxOYWt8b3B7xe5jUllwfGFvZkNlezCwsjViVWlkbEZpa3RtcPnFbkNSeXh8aWdmS2d7srAyFWJ1SUxkTmljmeY0SXmh7IUADDychlyWXE8iMDYxQnRobGVHISN0f2J5QWpjc3hwdWgvLkt1aTI0NjVDdGltZQYhY2R/cn1BbmJzeXF1KS9uW3V5NjQyNHN3aWhgxrcnV4fqEyhojW4VUHRhZ25DbXkwMrK1QlVJbGxOYWt8b3B7xe5jUllwfGFvZkNlezCwsjViVWlkbEZpa3RtcPnFbkNSeXh8aWdmS2d7cjd3FsKKPOHvgK57GSTxv0Ns4/J5UFRpZ2ZLbXEyMjC1wnVJTGROaWN8Z3J7R+7jcllQdGFnbkNteTAysrVCVUlsRGZha3xvcHvF7mNSWXBUSW+SGVF7yJooIhsJrgQ//C0PVG96cUVma3J7cvTpb05rZXE6MDo9Qndr7ORGQUN0Z3p5TWZjcHvw9GlPTkttcTI4OjVAd+nsZGZBY1RPcnFNbmFwOX8wSsdBVzr9lP96al28zYd9KyoghHSOCqASgUURc3UpL25bdXk2NDI0Q3VobSQGYXNkb3Z9RWpncnhxNClvfltlfTYwNjFCdGgsJEZxc3RrdnlBamNzeDA0aX9+S2F9Msa4c5JYiJRG3iNeHdg4IJmXqudCt3Jr7+5L5fkyEBI1Sn1pbmbG4WP073JZZW5renlydunvbsvleRIQMj1KdWtu5MZh4/RvUllFZmtye3J0a23uy2VZEjDGdXb3k74K03tcEN67Gh29UH2/y56M1BQyOgKmBiI1RnFpbWUGIWNkf3JpVW5ndnlxdSkvbgsleSIgMjFGdWhtJAZhIzRvYmlFamdyeHE0KW8uC2VpIjA2MUJ0aCwkRgHM5KT13ZhEVgyxEpesG6e/SfbdwJwztdurpTFQnt5Cf3J9QW5iczkwdHl/blt1eTY0MjRDNSlsdFZhc2Rvdn1Fb2IyOXBkeW9+W2V9NjAzNAI1aXx0RnFzdGt2eURvIzJ5aO4Ba5qdBxo0UDE0AjVpfHRGcXN0a3Z5RG8jMnlgZGl/fkthfTIxM3UCdXl8ZFZxY3BrcnhELiNyaWB0eX9uT2F5MzFydUJleU9kBiFjHKJFXjYg5fvZXp5pb25LLDx8dJx3Ivc=";
const metadata = {
  "original": "app_splash5.png",
  "extension": ".png",
  "encrypted": "2026-01-04T22:59:59.448Z"
};

// Backend decryption (Node.js)
function decrypt(password = "BuildFactoryEncryptionKey2025") {
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const passwordBuffer = Buffer.from(password, 'utf8');
    const result = Buffer.alloc(encryptedBuffer.length);

    for (let i = 0; i < encryptedBuffer.length; i++) {
        result[i] = encryptedBuffer[i] ^ passwordBuffer[i % passwordBuffer.length];
    }

    return result;
}

module.exports = { encrypted, metadata, decrypt };
