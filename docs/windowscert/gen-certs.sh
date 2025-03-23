#!/usr/bin/env bash

# -e: Immediately exit if any command has a non-zero exit status.
# -x: Print all executed commands to the terminal.
# -u: Exit if an undefined variable is used.
# -o pipefail: Exit if any command in a pipeline fails.
set -exuo pipefail

# This script generates certificates and keys needed for code signing.

mkdir -p certs

# Certificate authority (CA)
openssl genrsa -out certs/ca.key 2048
openssl req -new -x509 -nodes -days 1000 -key certs/ca.key -out certs/ca.crt -subj "/C=US/ST=Texas/L=Austin/O=Your Organization/OU=Your Unit/CN=testCodeSignCA"

# Generate a certificate for code signing, signed by the CA
openssl req -newkey rsa:2048 -nodes -keyout certs/sign.key -out certs/sign.req -subj "/C=US/ST=Texas/L=Austin/O=Your Organization/OU=Your Unit/CN=testCodeSignCert"
openssl x509 -req -in certs/sign.req -days 398 -CA certs/ca.crt -CAkey certs/ca.key -set_serial 01 -out certs/sign.crt

# Clean up
rm certs/sign.req