package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"

	"github.com/Pacerino/CaddyProxyManager/internal/config"
)

var (
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
)

// LoadKeys loads the RSA keys from the configured paths
func LoadKeys() error {
	privateBytes, err := os.ReadFile(config.Configuration.PrivateKey)
	if err != nil {
		return fmt.Errorf("failed to read private key: %v", err)
	}

	privatePEM, _ := pem.Decode(privateBytes)
	if privatePEM == nil {
		return fmt.Errorf("failed to parse private key PEM")
	}

	var parsePrivateKeyErr error
	privateKey, parsePrivateKeyErr = x509.ParsePKCS1PrivateKey(privatePEM.Bytes)
	if parsePrivateKeyErr != nil {
		return fmt.Errorf("failed to parse private key: %v", parsePrivateKeyErr)
	}

	publicBytes, err := os.ReadFile(config.Configuration.PublicKey)
	if err != nil {
		return fmt.Errorf("failed to read public key: %v", err)
	}

	publicPEM, _ := pem.Decode(publicBytes)
	if publicPEM == nil {
		return fmt.Errorf("failed to parse public key PEM")
	}

	parsedPublicKey, err := x509.ParsePKIXPublicKey(publicPEM.Bytes)
	if err != nil {
		return fmt.Errorf("failed to parse public key: %v", err)
	}

	var ok bool
	publicKey, ok = parsedPublicKey.(*rsa.PublicKey)
	if !ok {
		return fmt.Errorf("not an RSA public key")
	}

	return nil
}

// GetPrivateKey returns the loaded private key
func GetPrivateKey() *rsa.PrivateKey {
	return privateKey
}

// GetPublicKey returns the loaded public key
func GetPublicKey() *rsa.PublicKey {
	return publicKey
}
