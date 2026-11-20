"""Fabrique un certificat de TEST pour signer en C2PA (développement et démonstration).

    uv run python -m scripts.make_test_cert

Crée dans backend/certs/ (ignoré par git) :
  - test-root-ca.pem       : l'autorité de test (à ne jamais présenter comme une vraie autorité) ;
  - test-signing-chain.pem : certificat de signature + autorité, dans l'ordre attendu par C2PA ;
  - test-signing-key.pem   : la clé privée de signature.

Ce certificat n'est dans AUCUNE liste de confiance : un lecteur C2PA (Adobe, c2patool...) affichera
« signataire inconnu / non fiable » tout en confirmant que le fichier n'a pas été modifié. C'est le
comportement attendu pour la démonstration, et il faut le dire. En production, on remplace ce
certificat par celui d'une autorité reconnue (voir docs/C2PA.md) : seuls trois réglages changent."""

import datetime as dt
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

OUT = Path(__file__).resolve().parent.parent / "certs"
YEARS = 2


def _name(common_name: str) -> x509.Name:
    return x509.Name(
        [
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Premier Plan (CERTIFICAT DE TEST)"),
            x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        ]
    )


def make_certs(out: Path = OUT) -> Path:
    """Crée les trois fichiers dans `out` et le retourne."""
    now = dt.datetime.now(dt.UTC)
    root_key = ec.generate_private_key(ec.SECP256R1())
    root = (
        x509.CertificateBuilder()
        .subject_name(_name("Premier Plan TEST Root CA"))
        .issuer_name(_name("Premier Plan TEST Root CA"))
        .public_key(root_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=5))
        .not_valid_after(now + dt.timedelta(days=365 * YEARS * 2))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=False, content_commitment=False, key_encipherment=False,
                data_encipherment=False, key_agreement=False, key_cert_sign=True, crl_sign=True,
                encipher_only=False, decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(root_key.public_key()), critical=False)
        .sign(root_key, hashes.SHA256())
    )  # fmt: skip

    key = ec.generate_private_key(ec.SECP256R1())
    leaf = (
        x509.CertificateBuilder()
        .subject_name(_name("Premier Plan TEST Passeport IA"))
        .issuer_name(root.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(minutes=5))
        .not_valid_after(now + dt.timedelta(days=365 * YEARS))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, content_commitment=False, key_encipherment=False,
                data_encipherment=False, key_agreement=False, key_cert_sign=False, crl_sign=False,
                encipher_only=False, decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.EMAIL_PROTECTION]), critical=False)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(root_key.public_key()), critical=False
        )
        .sign(root_key, hashes.SHA256())
    )  # fmt: skip

    out.mkdir(parents=True, exist_ok=True)
    pem = serialization.Encoding.PEM
    (out / "test-root-ca.pem").write_bytes(root.public_bytes(pem))
    (out / "test-signing-chain.pem").write_bytes(leaf.public_bytes(pem) + root.public_bytes(pem))
    key_file = out / "test-signing-key.pem"
    key_file.write_bytes(
        key.private_bytes(pem, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    )
    key_file.chmod(0o600)
    return out


def main() -> None:
    out = make_certs()
    print(
        f"Certificat de TEST créé dans {out} (valable {YEARS} ans). Ne pas l'utiliser en production."
    )


if __name__ == "__main__":
    main()
