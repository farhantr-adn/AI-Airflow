"""Symmetric encryption for user-supplied API keys, derived from JWT_SECRET."""
import base64
import hashlib

from cryptography.fernet import Fernet

from ..config import settings


def _derive_key() -> bytes:
    digest = hashlib.sha256(settings.JWT_SECRET.encode()).digest()
    return base64.urlsafe_b64encode(digest)


_fernet = Fernet(_derive_key())


def encrypt(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _fernet.decrypt(ciphertext.encode()).decode()


def mask(secret: str) -> str:
    """Return only the last 4 chars for UI display."""
    if not secret:
        return ""
    return "•" * 6 + secret[-4:]
