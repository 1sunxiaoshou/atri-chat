import uuid
import base64


def generate_short_uuid(length=5):
    full_uuid = uuid.uuid4()
    uuid_bytes = full_uuid.bytes
    b64 = base64.urlsafe_b64encode(uuid_bytes).decode('ascii')
    short = b64.replace('=', '').replace('-', '').replace('_', '').lower()
    return short[:length]


def is_short_uuid(value, length=5):
    if not isinstance(value, str):
        return False
    if len(value) != length:
        return False
    return value.isalnum() and value.islower()
