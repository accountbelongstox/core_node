package auth

import (
	"crypto/ed25519"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"os"

	"github.com/Pacerino/CaddyProxyManager/internal/config"
)

var (
	privateKey interface{}
	publicKey  interface{}
)

// GetPrivateKey will load the private key from the config package and return a usable object
// It should only load from file once per program execution
func GetPrivateKey() (interface{}, error) {
	if privateKey == nil {
		var blankKey interface{}
		// Directly open and read the private key file
		key, err := os.ReadFile(config.Configuration.PrivateKey)
		if err != nil {
			return blankKey, err
		}
		privateKey, err = LoadPemPrivateKey(key)
		if err != nil {
			return blankKey, err
		}
	}
	return privateKey, nil
}

// LoadPemPrivateKey reads a key from a PEM encoded string and returns a private key
func LoadPemPrivateKey(content []byte) (interface{}, error) {
	// Decode the PEM block
	data, _ := pem.Decode(content)
	if data == nil {
		return nil, errors.New("failed to parse PEM data")
	}

	// Attempt to parse different key types
	if key, err := x509.ParsePKCS1PrivateKey(data.Bytes); err == nil {
		return key, nil // RSA private key
	}

	if key, err := x509.ParseECPrivateKey(data.Bytes); err == nil {
		return key, nil // ECDSA private key
	}

	if key, err := x509.ParsePKCS8PrivateKey(data.Bytes); err == nil {
		switch k := key.(type) {
		case ed25519.PrivateKey:
			return k, nil // ED25519 private key
		}
	}

	return nil, errors.New("unsupported private key format")
}

// GetPublicKey will load the public key from the config package and return a usable object
// It should only load once per program execution
func GetPublicKey() (interface{}, error) {
	if publicKey == nil {
		var blankKey interface{}
		// Directly open and read the public key file
		key, err := os.ReadFile(config.Configuration.PublicKey)
		if err != nil {
			return blankKey, err
		}
		publicKey, err = LoadPemPublicKey(key)
		if err != nil {
			return blankKey, err
		}
	}
	return publicKey, nil
}

// LoadPemPublicKey reads a key from a PEM encoded string and returns a public key
func LoadPemPublicKey(content []byte) (interface{}, error) {
	// Decode the PEM block
	data, _ := pem.Decode(content)
	if data == nil {
		return nil, errors.New("failed to parse PEM data")
	}

	// Attempt to parse different key types
	if key, err := x509.ParsePKCS1PublicKey(data.Bytes); err == nil {
		return key, nil // RSA public key
	}

	if key, err := x509.ParsePKIXPublicKey(data.Bytes); err == nil {
		switch k := key.(type) {
		case ed25519.PublicKey:
			return k, nil // ED25519 public key
		}
	}

	return nil, errors.New("unsupported public key format")
}
