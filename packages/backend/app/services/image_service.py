import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings

_BOTO_CONFIG = Config(
    connect_timeout=10,
    read_timeout=30,
    retries={"max_attempts": 3, "mode": "adaptive"},
)

# Module-level session — reuses underlying HTTP connections across calls
_session = boto3.session.Session()
_s3_client = _session.client(
    "s3",
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key,
    region_name=settings.aws_region,
    config=_BOTO_CONFIG,
)


def upload_file_to_s3(local_path: str, s3_key: str, content_type: str = "image/jpeg") -> str:
    _s3_client.upload_file(
        local_path,
        settings.aws_s3_bucket,
        s3_key,
        ExtraArgs={"ContentType": content_type},
    )
    return f"https://{settings.aws_s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{s3_key}"


def delete_from_s3(s3_key: str) -> None:
    try:
        _s3_client.delete_object(Bucket=settings.aws_s3_bucket, Key=s3_key)
    except ClientError:
        pass


def generate_presigned_url(s3_key: str, expiry_seconds: int = 3600) -> str:
    return _s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.aws_s3_bucket, "Key": s3_key},
        ExpiresIn=expiry_seconds,
    )
